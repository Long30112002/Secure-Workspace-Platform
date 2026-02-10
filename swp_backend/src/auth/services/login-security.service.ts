import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { MyLoggerService } from "src/my-logger/my-logger.service";

@Injectable()
export class LoginSecurityService {
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    private readonly LOCK_TIME_MINUTES = 15;
    constructor(
        private readonly prisma: DatabaseService,
        @Inject(MyLoggerService) private readonly logger: MyLoggerService,
    ) { }

    async checkAccountLock(user: any) {
        const now = new Date();

        if (!user.isActive) {
            throw new BadRequestException({
                code: 'ACCOUNT_INACTIVE',
                message: 'Account is deactivated',
            });
        }

        if (user.deletedAt) {
            throw new BadRequestException({
                code: 'ACCOUNT_DELETED',
                message: 'Account has been deleted',
            });
        }

        if (user.lockedUntil && user.lockedUntil > now) {
            const minutesLeft = Math.ceil(
                (user.lockedUntil.getTime() - now.getTime()) / 60000,
            );

            this.logger.warn(`Login blocked: Account lock - ${this.maskEmail(user.email)}`, {
                lockedUntil: user.lockedUntil,
                remainingMinutes: minutesLeft,
            });

            throw new BadRequestException({
                code: 'ACCOUNT_LOCKED',
                message: `Account locked. Try again in ${minutesLeft} minutes`,
            });
        }
    }

    async handleFailedLogin(userId: number, currentAttempts: number) {
        const now = new Date();
        let updateData: any = {
            failedLoginAttempts: currentAttempts + 1,
            lastLoginAttempt: now,
        };

        if (currentAttempts + 1 >= this.MAX_LOGIN_ATTEMPTS) {
            updateData.lockedUntil = new Date(
                now.getTime() + this.LOCK_TIME_MINUTES * 60000,
            );
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        const attemptsRemaining = Math.max(
            0,
            this.MAX_LOGIN_ATTEMPTS - (currentAttempts + 1),
        );

        return {
            attemptsRemaining,
            isLocked: currentAttempts + 1 >= this.MAX_LOGIN_ATTEMPTS,
        };
    }

    async resetLoginAttempts(userId: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
            },
        });
    }

    private maskEmail(email: string) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}