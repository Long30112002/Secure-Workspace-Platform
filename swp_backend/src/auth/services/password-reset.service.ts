import { ConfigService } from '@nestjs/config';
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from "src/database/database.service";
import { MyLoggerService } from "src/my-logger/my-logger.service";
import { resolve } from 'path';

export interface PasswordResetResult {
    resetToken?: string;
    expiresAt?: Date;
    maskedEmail?: string;
}
//Da xoa message, success

@Injectable()
export class PasswordResetService {
    private transporter: nodemailer.Transporter;
    private readonly RESET_TOKEN_EXPIRY_HOURS = 24; // 24 giờ
    private readonly PASSWORD_MIN_LENGTH = 6;

    constructor(
        private readonly prisma: DatabaseService,
        @Inject(MyLoggerService) private readonly logger: MyLoggerService,
        private readonly configService: ConfigService,
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
                pass: this.configService.get('SMTP_PASS')
            },
        });
        this.verifyTransporter();
    }

    private async verifyTransporter() {
        try {
            await this.transporter.verify();
            this.logger.log('SMTP connection astablished for password reset');
        } catch (error) {
            this.logger.error('SMTP connection failed:', error.message);
        }
    }

    //Ham reset token
    generateResetToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    //Người dùng nhập email - Tạo và gửi reset token
    async initiatePasswordReset(email: string): Promise<PasswordResetResult> {
        const maskedEmail = this.maskEmail(email);

        this.logger.log(`Password reset initiated for: ${maskedEmail}`);

        //Tim user
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                isEmailVerified: true,
                passwordResetToken: true,
                passwordResetExpires: true,
            }
        });

        if (!user) {
            return {};
        }

        if (!user.isEmailVerified) {
            throw new BadRequestException({
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your emil before resetting password',
            });
        }

        //Kiem tra neu da co token con hieu luc (prevent spam)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (user.passwordResetToken &&
            user.passwordResetExpires &&
            user.passwordResetExpires > oneHourAgo
        ) {
            throw new BadRequestException({
                code: 'RESET_TOKEN_STILL_VALID',
                message: 'A password reset link has already been sent. Please check your email.',
            });
        }

        //Tao token moi
        const resetToken = this.generateResetToken();
        const expiresAt = new Date(Date.now() + this.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: expiresAt,
                passwordResetAttempts: 0,
            },
        });

        //Gui email
        await this.sendPasswordResetEmail(user.email, resetToken);

        return {
            // resetToken,
            expiresAt,
            maskedEmail,
        };
    }

    private async sendPasswordResetEmail(email: string, resetToken: string) {
        const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        const appName = this.configService.get('APP_NAME', 'Nexus Platform');

        await this.transporter.sendMail({
            from: this.configService.get('EMAIL_FROM', `"${appName}" <longhoang30112002@gmail.com>`),
            to: email,
            subject: `Reset your ${appName} password`,
            html:
                `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
                    .button:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3); }
                    .token-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; font-family: monospace; word-break: break-all; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; color: #666; font-size: 12px; }
                    .security-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; border-radius: 6px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0;">${appName}</h1>
                        <p style="margin:10px 0 0; opacity:0.9;">Password Reset Request</p>
                    </div>
                    <div class="content">
                        <h2 style="color:#2d3748;">Reset Your Password</h2>
                        <p>Hello,</p>
                        <p>We received a request to reset your password for your ${appName} account.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" class="button" style="color: white;">Reset Password</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <div class="token-box">${resetLink}</div>
                        
                        <div class="security-note">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin:8px 0; padding-left:20px;">
                                <li>This link will expire in ${this.RESET_TOKEN_EXPIRY_HOURS} hours</li>
                                <li>If you didn't request this, please ignore this email</li>
                                <li>Never share your reset link with anyone</li>
                            </ul>
                        </div>
                        
                        <p>If you're having trouble clicking the button, copy the link above and paste it in your browser.</p>
                        
                        <div class="footer">
                            <p>Best regards,<br>The ${appName} Team</p>
                            <p><small>This is an automated message, please do not reply.</small></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
                `,
            text:
                ` 
            Reset Your ${appName} Password

            Hello,

            We received a request to reset your password for your ${appName} account.

            To reset your password, click the link below:
            ${resetLink}

            This link will expire in ${this.RESET_TOKEN_EXPIRY_HOURS} hours.

            If you didn't request a password reset, please ignore this email.

            Best regards,
            The ${appName} Team

            This is an automated message, please do not reply.
                `,
        });
    }

    // Xác thực reset token
    async validateResetToken(token: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                passwordResetToken: token,
                passwordResetExpires: {
                    gt: new Date(),
                },
            },
            select: {
                id: true,
                email: true,
                passwordResetExpires: true,
                passwordResetAttempts: true,
            }
        });

        if (!user) {
            throw new BadRequestException({
                code: 'INVALID_OR_EXPIRED_TOKEN',
                message: 'Password reset token is invalid or has expired',
            })
        }

        // Kiểm tra số lần thử (prevent brute force)
        const MAX_ATTEMPTS = 5;
        if (user.passwordResetAttempts >= MAX_ATTEMPTS) {
            await this.prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    passwordResetToken: null,
                    passwordResetExpires: null,
                    passwordResetAttempts: 0,
                }
            });

            throw new BadRequestException({
                code: 'TOKEN_ATTEMPTS_EXCEEDED',
                message: 'Too many attempts with this token',
            });
        }

        return {
            userId: user.id,
            email: user.email,
            remainingAttempts: MAX_ATTEMPTS - user.passwordResetAttempts,
        };
    }

    //Đặt lại mật khẩu mới
    async resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
        const validation = await this.validateResetToken(token);

        const passwordError = this.validatePasswordStrength(newPassword);
        if (passwordError) {
            await this.prisma.user.update({
                where: { id: validation.userId },
                data: {
                    passwordResetAttempts: { increment: 1 },
                },
            });

            throw new BadRequestException({
                code: 'WEAK_PASSWORD',
                message: passwordError,
                remainingAttempts: validation.remainingAttempts - 1,
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: validation.userId },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                passwordResetAttempts: 0,
                lastPasswordChange: new Date(),
                updatedAt: new Date(),
            },
        });

        await this.sendPasswordChangedConfirmation(validation.email);

        return {
            maskedEmail: this.maskEmail(validation.email),
        };
    }

    private async sendPasswordChangedConfirmation(email: string) {
        const appName = this.configService.get('APP_NAME', 'Nexus Platform');
        const maskedEmail = this.maskEmail(email);

        await this.transporter.sendMail({
            from: this.configService.get('EMAIL_FROM', `"${appName}" <longhoang30112002@gmail.com>`),
            to: email,
            subject: `Your ${appName} Password Has Been Changed`,
            html:
                `
            <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .security-alert { background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1 style="margin:0;">✅ Password Updated</h1>
                        </div>
                        <div class="content">
                            <h2 style="color:#059669;">Password Successfully Changed</h2>
                            <p>Hello,</p>
                            <p>Your password for <strong>${appName}</strong> was successfully changed on ${new Date().toLocaleString()}.</p>
                            
                            <div class="security-alert">
                                <strong>🔒 Security Information:</strong>
                                <p style="margin:8px 0;">
                                    If you did not make this change, please contact our support team immediately.
                                </p>
                            </div>
                            
                            <p>You can now log in to your account with your new password.</p>
                            
                            <p style="color: #666; font-size: 14px;">
                                Account: ${maskedEmail}<br>
                                Time: ${new Date().toLocaleString()}<br>
                                IP Address: [Automatically detected]
                            </p>
                            
                            <div class="footer">
                                <p>Best regards,<br>The ${appName} Security Team</p>
                                <p><small>This is an automated security notification.</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
            Password Successfully Changed

            Hello,

            Your password for ${appName} was successfully changed on ${new Date().toLocaleString()}.

            If you did not make this change, please contact our support team immediately.

            You can now log in to your account with your new password.

            Account: ${maskedEmail}
            Time: ${new Date().toLocaleString()}
            IP Address: [Automatically detected]

            Best regards,
            The ${appName} Security Team

            This is an automated security notification.
            `,
        });

    }
    
    //Validate password strength
    private validatePasswordStrength(password: string): string | null {
        if (password.length < this.PASSWORD_MIN_LENGTH) {
            return `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters`;
        }

        // Kiểm tra độ mạnh cơ bản
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

        if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
        if (!hasLowerCase) return 'Password must contain at least one lowercase letter';
        if (!hasNumbers) return 'Password must contain at least one number';
        if (!hasSpecialChar) return 'Password must contain at least one special character';

        return null;
    }

    private maskEmail(email: string): string {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}