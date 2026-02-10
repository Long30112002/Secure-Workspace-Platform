import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { LoginDTO } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { EmailVerificationService } from './email-verification.service';
import { LoginSecurityService } from './login-security.service';
import { RegistrationService } from './registration.service';
import { TokenService } from './token.service';
import { AuthUtilsService } from './utils.service';

@Injectable()
export class AuthService {
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    private readonly LOCK_TIME_MINUTES = 15;

    constructor(
        private readonly prisma: DatabaseService,
        private readonly logger: MyLoggerService,
        private readonly registrationService: RegistrationService,
        private readonly emailVerificationService: EmailVerificationService,
        private readonly loginSecurityService: LoginSecurityService,
        private readonly tokenService: TokenService,
        private readonly utilsService: AuthUtilsService,
    ) { }

    async register(dto: RegisterDto) {
        return this.registrationService.register(dto);
    }

    async verifyEmail(token: string) {
        return this.emailVerificationService.verifyEmail(token);
    }

    async resendVerificationEmail(email: string) {
        return this.emailVerificationService.resendVerificationEmail(email);
    }

    async login(dto: LoginDTO) {
        const start = Date.now();
        const maskedEmail = this.utilsService.maskEmail(dto.email);
        this.logger.log(`Login attempt for: ${maskedEmail}`);

        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            select: {
                id: true,
                email: true,
                password: true,
                // name: true,
                role: true,
                createdAt: true,
                isEmailVerified: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                emailVerificationExpires: true,
                isActive: true,
                deletedAt: true,
            }
        });

        if (!user) {
            this.logger.warn(`Login failed: User not found - ${maskedEmail}`);
            throw new BadRequestException({
                message: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS',
                attemptsRemaining: 5,
            });
        }

        if (!user.isActive) {
            this.logger.warn(`Login blocked: Account inactive/deleted - ${maskedEmail}`);
            throw new BadRequestException({
                code: 'ACCOUNT_INACTIVE',
                message: 'This account has been deactivated',
                suggestion: 'Please contact administrator'
            });
        }

        if (user.deletedAt) {
            this.logger.warn(`Login blocked: Account deleted - ${maskedEmail}`);
            throw new BadRequestException({
                code: 'ACCOUNT_DELETED',
                message: 'This account has been deleted',
                suggestion: 'Your account has been disabled. Please contact the administrator for assistance.'
            });
        }

        await this.loginSecurityService.checkAccountLock(user);

        const passwordMatch = await bcrypt.compare(dto.password, user.password);

        //kiểm tra mật khẩu
        if (!passwordMatch) {
            const { attemptsRemaining, isLocked } =
                await this.loginSecurityService.handleFailedLogin(
                    user.id,
                    user.failedLoginAttempts
                );

            this.logger.warn(`Login failed: Invalid password - ${maskedEmail}`, {
                userId: user.id,
                failedAttempts: user.failedLoginAttempts + 1,
                remainingAttempts: attemptsRemaining,
            });

            throw new BadRequestException({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid credentials',
                attemptsRemaining,
                suggestion: isLocked
                    ? `Account locked for 15 minutes due to too many failed attempts`
                    : `You have ${attemptsRemaining} attempts remaining`,
            });
        }

        //kiểm tra email verify
        if (!user.isEmailVerified) {
            this.logger.warn(`Login blocked: Email not verified - ${maskedEmail}`);
            throw new BadRequestException({
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in',
                tokenExpires: user.emailVerificationExpires,
            });
        }

        await this.loginSecurityService.resetLoginAttempts(user.id);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
            },
        });

        const { accessToken, refreshToken } =
            await this.tokenService.generateTokens(
                user.id,
                user.email,
                user.role
            );

        const totalTime = Date.now() - start;
        this.logger.log(`Login successful: ${maskedEmail} (${totalTime}ms)`);


        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            accessToken,
            refreshToken,
            expiresIn: dto.rememberMe ? 604800 : 3600,
            redirectTo: this.utilsService.getRedirectPathByRole(user.role),
        };
    }

    async refreshTokens(refreshToken: string) {
        return this.tokenService.refreshTokens(refreshToken);
    }

    async logout(userId: number, token: string) {

        // Optional: Add token to blacklist
        // await this.addTokenToBlacklist(token);

        this.logger.log(`User logged out: ${userId}`);
        return {
            message: 'Logged out successfully'
        }
    }

    async verifyToken(token: string) {
        return this.tokenService.verifyAccessToken(token);
    }

    async validateUser(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                isActive: true,
                lockedUntil: true,
                deletedAt: true,
            }
        });

        if (!user || !user.isActive) {
            return null;
        }

        if (user.deletedAt) {
            return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            return null;
        }

        return user;
    }

}