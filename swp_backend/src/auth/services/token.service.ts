import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { DatabaseService } from "src/database/database.service";
import { MyLoggerService } from "src/my-logger/my-logger.service";

@Injectable()
export class TokenService {
    constructor(
        private readonly prisma: DatabaseService,
        @Inject(MyLoggerService) private readonly logger: MyLoggerService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async generateTokens(userId: number, email: string, role: string) {
        const payload = {
            sub: userId,
            email: email,
            role: role,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                payload,
                {
                    secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
                    expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
                } as JwtSignOptions,
            ),
            this.jwtService.signAsync(
                { sub: userId },
                {
                    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                    expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'),
                } as JwtSignOptions,
            ),
        ]);

        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
        };
    }

    async refreshTokens(refreshToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });

            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                select: { id: true, email: true, role: true, isActive: true },
            });

            if (!user || !user.isActive) {
                throw new UnauthorizedException('User not found or inactive');
            }

            const tokens = await this.generateTokens(user.id, user.email, user.role);

            this.logger.log(`Tokens refreshed for user: ${this.maskEmail(user.email)}`);

            return {
                tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
            };
        } catch (error) {
            this.logger.warn(`Token refresh failed: ${error.message}`);
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    verifyAccessToken(token: string) {
        // return this.jwtService.verify(token);
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
            });

            // Trả về đầy đủ user info
            return {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                exp: payload.exp,
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }


    private maskEmail(email: string) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}