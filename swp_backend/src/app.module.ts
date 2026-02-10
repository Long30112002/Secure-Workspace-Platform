import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MyLoggerModule } from './my-logger/my-logger.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MyLoggerService } from './my-logger/my-logger.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { TransformInterceptor } from './api/transform.interceptor';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminModule } from './admin/admin.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { NotificationModule } from './notification/notification.module';
import { JwtModule } from '@nestjs/jwt'; 
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkspaceGateway } from './workspace/real-time/workspace.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    MyLoggerModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 60,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      }
    ]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
    AuthModule,
    UsersModule,
    AdminModule,
    WorkspaceModule,
    NotificationModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    MyLoggerService,
    {
      provide: APP_FILTER,
      useFactory: (logger: MyLoggerService) => {
        return new AllExceptionsFilter(logger);
      },
      inject: [MyLoggerService]
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor
    },
    WorkspaceGateway,
  ],
})
export class AppModule { }