import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/database/database.service';

@WebSocketGateway({
    namespace: '/notifications',
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationsGateway.name);

    constructor(
        private jwtService: JwtService,
    ) {
        this.logger.log('✅ NotificationsGateway constructor');
    }

    async handleConnection(client: Socket) {
        try {
            this.logger.log(`New notifications client: ${client.id}`);

            const token = client.handshake.auth?.token;
            if (!token) {
                this.logger.warn('No token provided for notifications WebSocket');
                client.disconnect();
                return;
            }

            let payload;
            try {
                payload = this.jwtService.verify(token, {
                    secret: process.env.JWT_SECRET, // THÊM DÒNG NÀY
                });
            } catch (error) {
                this.logger.error('Invalid token for notifications:', error.message);
                client.disconnect();
                return;
            }

            const userId = payload.sub;
            if (!userId) {
                this.logger.error('No user ID in token');
                client.disconnect();
                return;
            }

            client.join(`user:${userId}`);

            this.logger.log(`✅ User ${userId} connected to notifications WebSocket`);

            client.emit('connected', {
                success: true,
                message: 'Connected to notifications',
                userId
            });
        } catch (error) {
            this.logger.error('Notifications connection error:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Notifications client disconnected: ${client.id}`);
    }

    @SubscribeMessage('join-user')
    handleJoinUser(client: Socket, userId: number) {
        client.join(`user:${userId}`);
        this.logger.log(`User ${userId} joined notifications room`);
    }

    // Gọi method này từ notification service
    sendNotificationToUser(userId: number, notification: any) {
        this.server.to(`user:${userId}`).emit('notifications:new', {
            type: 'NEW_NOTIFICATION',
            data: notification,
            timestamp: new Date().toISOString(),
        });
        this.logger.log(`📢 Notification sent to user ${userId}`);
    }

    sendNotificationUpdate(userId: number, data: any) {
        this.server.to(`user:${userId}`).emit('notifications:update', {
            type: 'UPDATE',
            data,
            timestamp: new Date().toISOString(),
        });
    }

    @OnEvent('notification.new')
    handleNewNotification(payload: { userId: number; notification: any }) {
        this.sendNotificationToUser(payload.userId, payload.notification);
    }

    @OnEvent('notification.update')
    handleNotificationUpdate(payload: { userId: number; data: any }) {
        this.sendNotificationUpdate(payload.userId, payload.data);
    }
}