import { WorkspaceGateway } from './../workspace/real-time/workspace.gateway';
import { Module } from '@nestjs/common';
import { NotificationService } from './service/notification.service';
import { NotificationController } from './controller/notification.controller';
import { DatabaseModule } from '../database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsGateway } from './real-time/notifications.gateway';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [
    NotificationController
  ],
  providers: [
    NotificationService,
    WorkspaceGateway,
    NotificationsGateway,
  ],
  exports: [
    NotificationService
  ],
})
export class NotificationModule { }