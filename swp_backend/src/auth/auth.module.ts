import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { MyLoggerModule } from '../my-logger/my-logger.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { EmailVerificationService } from './services/email-verification.service';
import { LoginSecurityService } from './services/login-security.service';
import { AuthUtilsService } from './services/utils.service';
import { RegistrationService } from './services/registration.service';
import { TokenService } from './services/token.service';
import { PasswordResetService } from './services/password-reset.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthService } from './jwt/jwt.service';
import { MyLoggerService } from '../my-logger/my-logger.service';
import { AuthService } from './services/auth.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MyLoggerModule,
    DatabaseModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_ACCESS_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET is not defined in environment variables');
        }

        return {
          secret: secret,
          signOptions: {
            expiresIn: '15m',
          },
        };
      },
      inject: [ConfigService]
    })
  ],
  controllers: [
    AuthController,
  ],
  providers: [
    AuthService,
    EmailVerificationService,
    LoginSecurityService,
    TokenService,
    RegistrationService,
    MyLoggerService,
    AuthUtilsService,
    PasswordResetService,
    JwtStrategy,
    JwtAuthService,
  ],
  exports: [
    AuthService,
    TokenService,
    PassportModule,
    EmailVerificationService,
    JwtAuthService,
    JwtModule,
  ],
})
export class AuthModule { }