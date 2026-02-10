import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { MyLoggerService } from "src/my-logger/my-logger.service";
import { EmailVerificationService } from "./email-verification.service";
import { RegisterDto } from "../dto/register.dto";
import * as bcrypt from 'bcrypt';

@Injectable()
export class RegistrationService {
    constructor(
        private readonly prisma: DatabaseService,
        private readonly logger: MyLoggerService,
        private readonly emailVerificationService: EmailVerificationService,
    ) { }

    async register(dto: RegisterDto) {
        const startTime = Date.now();
        const maskedEmail = this.maskEmail(dto.email);

        this.logger.log(`Registration started for: ${maskedEmail}`);

        try {
            return await this.prisma.$transaction(async (tx) => {
                const existingUser = await tx.user.findUnique({
                    where: { email: dto.email },
                    select: {
                        id: true,
                        isActive: true,
                        deletedAt: true,
                    },
                });

                if (existingUser) {
                    // if (existingUser.deletedAt) {
                    //     throw new ConflictException({
                    //         code: 'ACCOUNT_DISABLED',
                    //         message: 'This email is associated with a disabled account',
                    //         suggestion: 'Please contact the administrator to restore your account'
                    //     });
                    // }
                    // if (!existingUser.isActive) {
                    //     throw new ConflictException({
                    //         code: 'ACCOUNT_INACTIVE',
                    //         message: 'This account is currently inactive',
                    //         suggestion: 'Please contact support for assistance'
                    //     });
                    // }

                    // throw new ConflictException({
                    //     message: 'Email already registered',
                    //     code: 'EMAIL_EXISTS',
                    //     suggestion: 'Please try a different email or login instead'
                    // })
                    this.handleExistingUser(existingUser);
                }


                const hashedPassword = await bcrypt.hash(dto.password, 10);
                const verificationToken = this.emailVerificationService.generateVerificationToken();
                const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

                // const dbStart = Date.now();
                const newUser = await tx.user.create({
                    data: {
                        email: dto.email,
                        password: hashedPassword,
                        role: dto.role,
                        isEmailVerified: false,
                        emailVerificationToken: verificationToken,
                        emailVerificationExpires: verificationExpires,
                        isActive: true,
                    },
                    select: {
                        id: true,
                        // email: true,
                        role: true,
                        createdAt: true,
                        isEmailVerified: true,
                    },
                });
                // const dbTime = Date.now() - dbStart;
                // this.logger.debug(`User saved in ${dbTime}ms`);

                try {
                    await this.emailVerificationService.sendVerificationEmail(dto.email, verificationToken);
                } catch (error) {
                    this.logger.error(`Failed to send verification email to ${maskedEmail}`, error);
                }

                // const totalTime = Date.now() - startTime;
                this.logger.log(`Registration successful: ${maskedEmail} (${Date.now() - startTime}ms)`);

                return {
                    user: newUser,
                    maskedEmail,
                    redirectTo: '/login',
                    showTutorial: true,
                    requiresVerification: true,
                };
            }, {
                maxWait: 5000,
                timeout: 10000,
            });
            // return result;
        } catch (error) {
            this.handleRegistrationError(error, maskedEmail, startTime);
            throw error;
        }
    }

    private handleRegistrationError(error: any, maskedEmail: string, startTime: number) {
        const duration = Date.now() - startTime;

        if (error instanceof ConflictException) {
            this.logger.warn(
                `Registration conflict: ${maskedEmail} (${duration}ms)`,
                { code: 'EMAIL_EXISTS' }
            );
            return;
        } else if (error instanceof BadRequestException) {
            this.logger.warn(
                `Registration validation failed: ${maskedEmail} (${duration}ms)`,
                { code: 'VALIDATION_ERROR' }
            );
            return;
        } else {
            this.logger.error(`Registration failed: ${maskedEmail} (${duration}ms)`, {
                errorCode: error.code || 'SERVER_ERROR',
            }, error.stack);
        }
    }

    private handleExistingUser(existingUser: any) {
        if (existingUser.deletedAt) {
            throw new ConflictException({
                code: 'ACCOUNT_DISABLED',
                message: 'This email is associated with a disabled account',
                suggestion: 'Please contact the administrator to restore your account'
            });
        }
        if (!existingUser.isActive) {
            throw new ConflictException({
                code: 'ACCOUNT_INACTIVE',
                message: 'This account is currently inactive',
                suggestion: 'Please contact support for assistance'
            });
        }

        throw new ConflictException({
            message: 'Email already registered',
            code: 'EMAIL_EXISTS',
            suggestion: 'Please try a different email or login instead'
        });
    }

    private maskEmail(email: string) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}