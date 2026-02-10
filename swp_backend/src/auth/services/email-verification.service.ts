import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "src/database/database.service";
import { MyLoggerService } from "src/my-logger/my-logger.service";
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { TokenService } from "./token.service";


@Injectable()
export class EmailVerificationService {
    private transporter: nodemailer.Transporter;

    constructor(
        private readonly prisma: DatabaseService,
        @Inject(MyLoggerService) private readonly logger: MyLoggerService,
        private readonly configService: ConfigService,
        private readonly tokenService: TokenService,
    ) {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
            port: parseInt(this.configService.get('SMTP_PORT', '587')),
            secure: false,
            auth: {
                user: this.configService.get('SMTP_USER'),
                pass: this.configService.get('SMTP_PASS'),
            }
        });
        this.verifyTransporter();
    }

    private async verifyTransporter() {
        try {
            await this.transporter.verify();
            this.logger.log('SMTP connection established successfully');
        } catch (error) {
            this.logger.error('SMTP connection failed:', error.message);
            this.logger.warn('Email sending may fail until SMTP is properly configured');
        }
    }

    generateVerificationToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    async sendVerificationEmail(email: string, token: string) {
        // Lấy URL frontend từ config hoặc dùng mặc định
        // const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
        const backendUrl = this.configService.get('BACKEND_URL', 'http://localhost:3000');

        const verificationLink = `${backendUrl}/api/auth/verify-email?token=${token}`;

        const appName = this.configService.get('APP_NAME', 'MY_APP');

        const mailOptions = {
            from: this.configService.get('EMAIL_FROM', `"${appName}"<longhoang30112002@gmail.com>`),
            to: email,
            subject: `Verify your email for ${appName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                        .code { background-color: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${appName}</h1>
                        </div>
                        <div class="content">
                            <h2>Verify Your Email Address</h2>
                            <p>Hello!</p>
                            <p>Thank you for registering with ${appName}. To complete your registration and verify your email address, please click the button below:</p>
                            
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${verificationLink}" class="button" style ="color: white;">Verify Email Address</a>
                            </p>
                            
                            <p>Or copy and paste this link into your browser:</p>
                            <div class="code">${verificationLink}</div>
                            
                            <p>This verification link will expire in 24 hours.</p>
                            
                            <p>If you didn't create an account with ${appName}, you can safely ignore this email.</p>
                            
                            <div class="footer">
                                <p>Thank you,<br>The ${appName} Team</p>
                                <p><small>This is an automated message, please do not reply to this email.</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
            Verify Your Email for ${appName}\n\nHello!\n\nThank you for registering with ${appName}. To complete your registration, please verify your email address by clicking the following link:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account with ${appName}, please ignore this email.\n\nBest regards,\nThe ${appName} Team
            `,
        };

        try {
            this.logger.debug(`Attempting to send email to: ${this.maskEmail(email)}`);
            const info = await this.transporter.sendMail(mailOptions);

            const maskedEmail = this.maskEmail(email);
            this.logger.log(`Verifycation email sent to: ${maskedEmail}`);
            this.logger.debug(`Message ID: ${info.messageId}`);

            return {
                success: true,
                messageId: info.messageId,
                to: maskedEmail,
            };
        } catch (error) {
            this.logger.error(`Failed to send verification email to ${email}:`, error);

            //Báo lỗi phổ biến với Gmail
            let errorMessage = error.message;
            let suggestion = '';

            if (error.code === 'EAUTH') {
                suggestion = 'Please check your Gmail App Password and ensure 2-Step Verification is enabled.';
            } else if (error.code === 'ECONNECTION') {
                suggestion = 'Cannot connect to SMTP server. Check your network or SMTP settings.';
            }

            throw new BadRequestException({
                code: 'EMAIL_SEND_FAILED',
                message: 'Failed to send verification email',
                details: errorMessage,
                suggestion: suggestion,
            });
        }


    }

    async verifyEmail(token: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                emailVerificationToken: token,
                emailVerificationExpires: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            throw new BadRequestException({
                code: 'INVALID_OR_EXPIRED_TOKEN',
                message: 'Verification token is invalid or has expired',
            })
        }

        //Cap nhat user verify thanh cong
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            }
        });

        this.logger.log(`Email verified for user: ${this.maskEmail(user.email)}`);

        // Tạo tokens để auto-login
        const tokens = await this.tokenService.generateTokens(user.id, user.email, user.role);
        return {
            success: true,
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
            },
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            },
            redirecTo: '/homepage'
        }
    }

    async resendVerificationEmail(email: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                isEmailVerified: true,
                emailVerificationExpires: true,
            }
        });

        if (!user) {
            throw new BadRequestException({
                code: 'USER_NOT_FOUND',
                message: 'User not found',
            });
        }

        if (user.isEmailVerified) {
            throw new BadRequestException({
                code: 'ALREADY_VERIFIED',
                message: 'Email is already verified'
            })
        }

        //Kiem tra neu token con hieu luc
        const oneHourAgo = new Date(Date.now() - 69 * 60 * 1000);
        if (user.emailVerificationExpires && user.emailVerificationExpires > oneHourAgo) {
            throw new BadRequestException({
                code: 'TOKEN_STILL_VALID',
                message: 'Verification token is still valid. Please check your email.',
                resendAllowedAfter: user.emailVerificationExpires,
            });
        }
        console.log('Token expiry:', oneHourAgo);

        //Tao token moi
        const newToken = this.generateVerificationToken();
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerificationToken: newToken,
                emailVerificationExpires: newExpiry,
            }
        });

        //Gui email
        await this.sendVerificationEmail(email, newToken);
        this.logger.log(`Verification email resent to: ${this.maskEmail(email)}`);

        return {
            success: true,
            message: 'Verification email has been resent',
            expiresIn: '24 hours'
        };
    }

    async sendEmail(mailOptions: any) {
        try {
            this.logger.debug(`Attempting to send email to: ${this.maskEmail(mailOptions.to)}`);
            const info = await this.transporter.sendMail(mailOptions);

            const maskedEmail = this.maskEmail(mailOptions.to);
            this.logger.log(`Email sent to: ${maskedEmail}`);
            this.logger.debug(`Message ID: ${info.messageId}`);

            return {
                success: true,
                messageId: info.messageId,
                to: maskedEmail,
            };
        } catch (error) {
            this.logger.error(`Failed to send email to ${mailOptions.to}:`, error);

            let errorMessage = error.message;
            let suggestion = '';

            if (error.code === 'EAUTH') {
                suggestion = 'Please check your Gmail App Password and ensure 2-Step Verification is enabled.';
            } else if (error.code === 'ECONNECTION') {
                suggestion = 'Cannot connect to SMTP server. Check your network or SMTP settings.';
            }

            throw new BadRequestException({
                code: 'EMAIL_SEND_FAILED',
                message: 'Failed to send email',
                details: errorMessage,
                suggestion: suggestion,
            });
        }
    }

    maskEmail(email: string) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}