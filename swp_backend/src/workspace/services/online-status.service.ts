import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class OnlineStatusService {
    private readonly logger = new Logger(OnlineStatusService.name);
    private onlineUsers = new Map<number, string>(); // userId -> socketId

    constructor(private prisma: DatabaseService) {}

    async userConnected(userId: number, socketId: string) {
        this.onlineUsers.set(userId, socketId);
        
        // Cập nhật lastActive trong database
        await this.prisma.workspaceMember.updateMany({
            where: { userId },
            data: { lastActive: new Date() }
        });

        this.logger.log(`User ${userId} is now online`);
    }

    // Khi user disconnect
    async userDisconnected(userId: number) {
        this.onlineUsers.delete(userId);
        this.logger.log(`User ${userId} is now offline`);
    }

    // Kiểm tra user có online không
    isUserOnline(userId: number): boolean {
        return this.onlineUsers.has(userId);
    }

    // Lấy danh sách online users
    getOnlineUsers(): number[] {
        return Array.from(this.onlineUsers.keys());
    }
}