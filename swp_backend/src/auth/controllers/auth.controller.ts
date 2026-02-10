import {
    BadRequestException, Body, Controller, Get,
    HttpCode, HttpStatus, Ip, Post, Query, Req, Res,
    UnauthorizedException
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { LoginDTO } from '../dto/login.dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import type { Response } from 'express';
import { ForgotPasswordDto, ResetPasswordDto, ValidateResetTokenDto } from '../dto/password-reset.dto';
import { PasswordResetService } from '../services/password-reset.service';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';

@Throttle({ default: { ttl: 60000, limit: 60 } })
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly passwordResetService: PasswordResetService,
    ) { }
    private readonly logger = new MyLoggerService(AuthController.name);

    private logRequest(req: Request) {
        console.log('=== REQUEST DEBUG ===');
        console.log('URL:', req.url);
        console.log('Method:', req.method);
        console.log('Cookies:', req.cookies);
        console.log('Headers:', req.headers);
        console.log('====================');
    }


    @Throttle({ short: { ttl: 1000, limit: 1 } })
    @Post('register')
    async register(@Ip() ip: string, @Body() dto: RegisterDto) {
        this.logger.log(`Request for ALL users\t${ip}`, AuthController.name);
        return await this.authService.register(dto);
    }

    @Throttle({ short: { ttl: 1000, limit: 5 } })
    @Post('login')
    async login(
        @Ip() ip: string,
        @Body() dto: LoginDTO,
        @Res({ passthrough: true }) res: Response
    ) {
        const result = await this.authService.login(dto);

        // 1. Set ACCESS token vào httpOnly cookie
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: result.expiresIn * 1000,
        });

        // 2. Set REFRESH token vào httpOnly cookie
        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: dto.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
        });

        // 3. KHÔNG trả về token trong response!
        let redirectTo = '/homepage';
        if (result.user.role === 'ADMIN') {
            redirectTo = '/admin/homepage';
        }

        const { refreshToken, accessToken, ...safeResult } = result;

        this.logger.log(`Login request from IP: ${ip}`);

        return {
            success: true,
            message: 'Login successful',
            data: {
                user: safeResult.user,
                redirectTo: redirectTo,
            },
            timestamp: new Date().toISOString(),
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body?: { refreshToken?: string }
    ) {
        // Ưu tiên đọc từ cookie, fallback từ body
        const refreshTokenFromCookie = (req as any).cookies?.refresh_token;
        const refreshToken = refreshTokenFromCookie || body?.refreshToken;
        this.logRequest(req);

        if (!refreshToken) {
            throw new BadRequestException('Refresh token is required');
        }

        const result = await this.authService.refreshTokens(refreshToken);

        // Set access token mới vào cookie
        res.cookie('access_token', result.tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600 * 1000,
        });

        // Trả về thông tin (KHÔNG có token)
        return {
            success: true,
            message: 'Token refreshed',
            data: {
                user: result.user,
            },
        };
    }

    @Get('verify')
    @HttpCode(HttpStatus.OK)
    async verifyToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        const accessToken = req.cookies?.access_token;
        const refreshToken = req.cookies?.refresh_token;

        if (!accessToken) {
            return {
                success: false,
                message: 'No access token',
            };
        }

        try {
            const tokenPayload = await this.authService.verifyToken(accessToken);

            // Nếu token sắp hết hạn (< 10 phút), refresh
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = tokenPayload.exp - now;

            if (timeUntilExpiry < 600 && refreshToken) { // 10 phút
                console.log('🔄 Token expiring soon, refreshing...');
                try {
                    const refreshResult = await this.authService.refreshTokens(refreshToken);

                    // Set new access token
                    res.cookie('access_token', refreshResult.tokens.accessToken, {
                        httpOnly: true,
                        secure: false,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 3600 * 1000,
                    });

                    return {
                        success: true,
                        message: 'Token refreshed',
                        data: {
                            user: refreshResult.user,
                            tokenRefreshed: true,
                        },
                    };
                } catch (refreshError) {
                    //somethings
                }
            }

            return {
                success: true,
                message: 'Token valid',
                data: {
                    user: {
                        id: tokenPayload.id,
                        email: tokenPayload.email,
                        role: tokenPayload.role,
                    },
                    tokenRefreshed: false,
                },
            };

        } catch (error) {
            // Thử refresh nếu verify thất bại
            if (refreshToken) {
                try {
                    const refreshResult = await this.authService.refreshTokens(refreshToken);

                    res.cookie('access_token', refreshResult.tokens.accessToken, {
                        httpOnly: true,
                        secure: false,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 3600 * 1000,
                    });

                    return {
                        success: true,
                        message: 'Token refreshed after failure',
                        data: {
                            user: refreshResult.user,
                            tokenRefreshed: true,
                        },
                    };
                } catch (refreshError) {
                    //somethings
                }
            }

            return {
                success: false,
                message: 'Token invalid',
            };
        }
    }

    @Get('verify-email')
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Query('token') token: string, @Res() res: Response) {
        const result = await this.authService.verifyEmail(token);

        // Set tokens vào cookies thay vì query params
        res.cookie('access_token', result.tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 6000 * 1000,
        });

        res.cookie('refresh_token', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        // Redirect đến frontend với thông báo
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const params = new URLSearchParams({
            message: encodeURIComponent(result.message),
            email: encodeURIComponent(result.user.email),
        }).toString();

        return res.redirect(`${frontendUrl}/email-verified?${params}`);
    }

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    async resendVerification(@Body() body: { email: string }) {
        return await this.authService.resendVerificationEmail(body.email);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return await this.passwordResetService.initiatePasswordReset(dto.email);
    }

    @Get('validate-reset-token')
    async validateResetToken(@Query() dto: ValidateResetTokenDto) {
        return await this.passwordResetService.validateResetToken(dto.token);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException({
                code: 'PASSWORD_MISMATCH',
                message: 'Passwords do not match',
            });
        }
        return await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @Res({ passthrough: true }) res: Response,
        @Body() body?: { userId?: number, token?: string }
    ) {
        // 1. Clear cookies
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });

        // 2. Gọi service để xử lý server-side (blacklist token, v.v.)
        if (body?.userId && body?.token) {
            await this.authService.logout(body.userId, body.token);
        }

        return {
            success: true,
            message: 'Logged out successfully',
        };
    }

    @Get('check')
    @HttpCode(HttpStatus.OK)
    async checkAuth(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response) {

        const accessToken = req.cookies?.access_token;

        if (!accessToken) {
            // Đảm bảo format response giống frontend mong đợi
            return {
                authenticated: false,
                message: 'Not authenticated',
                success: false
            };
        }

        try {
            const payload = await this.authService.verifyToken(accessToken);
            // ĐẢM BẢO RESPONSE FORMAT ĐÚNG
            return {
                authenticated: true,
                user: {
                    id: payload.id,
                    email: payload.email,
                    role: payload.role,
                },
                success: true // THÊM field này
            };

        } catch (error) {

            return {
                authenticated: false,
                message: 'Invalid token',
                success: false
            };
        }
    }

    @Get('ws-token')
    @HttpCode(HttpStatus.OK)
    async getWebSocketToken(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        const accessToken = req.cookies?.access_token;

        if (!accessToken) {
            return {
                success: false,
                message: 'No access token found in cookies',
                error: 'NO_TOKEN'
            };
        }

        return {
            success: true,
            token: accessToken,
            message: 'Token retrieved successfully',
            expiresIn: 3600
        };
    }

    @Get('debug-cookies')
    @HttpCode(HttpStatus.OK)
    async debugCookies(@Req() req: Request) {
        return {
            success: true,
            cookies: req.cookies,
            headers: {
                cookie: req.headers.cookie
            },
            timestamp: new Date().toISOString()
        };
    }
}