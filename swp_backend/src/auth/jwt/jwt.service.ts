import { JwtService as NestJwtService } from '@nestjs/jwt';
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface TokenPayLoad {
    sub: number; //user id;
    email: string;
    role: string;
    permissions: string[];
}

export interface Tokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

@Injectable()
export class JwtAuthService {
    constructor(
        private readonly jwtService: NestJwtService,
        private readonly configService: ConfigService,
    ) { }


    private getJwtConfig() {
        return {
            accessSecret: this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret-key'),
            refreshSecret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-key'),
            accessExpiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m') as `${number} ${"s" | "m" | "h" | "d"}`,
            refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d') as `${number} ${"s" | "m" | "h" | "d"}`,
        };
    }

    async generateTokens(user: any): Promise<Tokens> {
        const payload: TokenPayLoad = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions || [],
        };

        const config = this.getJwtConfig();

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: config.accessSecret,
                expiresIn: config.accessExpiresIn,
            }),

            this.jwtService.signAsync(
                {
                    sub: user.id
                },
                {
                    secret: config.refreshSecret,
                    expiresIn: config.refreshExpiresIn,
                },
            ),
        ]);

        const expiresIn = this.parseExpiresIn(config.accessExpiresIn);

        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    };

    async verifyAccessToken(token: string): Promise<TokenPayLoad> {
        try {
            const config = this.getJwtConfig();
            return await this.jwtService.verifyAsync<TokenPayLoad>(token, {
                secret: config.accessSecret,
            });
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired access token');
        }
    }

    async verifyRefreshToken(token: string): Promise<{ sub: number }> {
        try {
            const config = this.getJwtConfig();
            return await this.jwtService.verifyAsync<{ sub: number }>(token, {
                secret: config.refreshSecret,
            })
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async refreshTokens(refreshToken: string) {
        const payload = await this.verifyRefreshToken(refreshToken);
        return this.generateTokens(payload);
    }

    private parseExpiresIn(expiresIn: string): number {
        const unit = expiresIn.slice(-1);
        const value = parseInt(expiresIn.slice(0, - 1));

        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 3600;
            case 'd': return value * 86400;
            default: return 900;//15 minutes default
        }
    }
}