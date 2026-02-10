import {
    WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, OnGatewayInit  // ⬅️ THÊM DÒNG NÀY
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from 'src/database/database.service';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    namespace: '/workspace',
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
    transports: ['websocket', 'polling'],
})

@Injectable()
export class WorkspaceGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit { // ⬅️ THÊM OnGatewayInit
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WorkspaceGateway.name);
    private onlineUsers = new Map<number, Set<string>>();
    private userSocketMap = new Map<string, number>();
    private jwtSecret: string;

    constructor(
        private jwtService: JwtService,
        private prisma: DatabaseService,
        private configService: ConfigService,
    ) {
        this.logger.log('✅ WorkspaceGateway constructor');
    }

    // ⬅️ THÊM METHOD afterInit
    afterInit(server: Server) {
        this.jwtSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key';
        this.logger.log(`🔑 JWT Secret loaded: ${this.jwtSecret ? 'YES' : 'NO'}`);
    }
    
    // ⬅️ THÊM METHOD xác thực token tập trung
    private verifyToken(token: string): any {
        try {
            const payload = this.jwtService.verify(token, {
                secret: this.jwtSecret
            });
            return { success: true, payload };
        } catch (error) {
            this.logger.error(`❌ Token verification failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async handleConnection(client: Socket) {
        try {
            this.logger.log(`=== NEW WORKSPACE CONNECTION ===`);
            this.logger.log(`Client ID: ${client.id}`);

            let token = client.handshake.auth?.token;

            if (!token) {
                const authHeader = client.handshake.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                }
            }

            if (!token) {
                const cookies = client.handshake.headers.cookie;
                if (cookies) {
                    const tokenMatch = cookies.match(/access_token=([^;]+)/);
                    if (tokenMatch) token = tokenMatch[1];
                }
            }

            if (!token) {
                client.disconnect();
                return;
            }

            // ⬅️ DÙNG METHOD verifyToken THAY VÌ TRỰC TIẾP
            const verification = this.verifyToken(token);
            if (!verification.success) {
                this.logger.error('Token verification failed');
                client.disconnect();
                return;
            }

            const userId = verification.payload.sub;
            this.logger.log(`✅ Token verified for user ${userId}`);

            this.userSocketMap.set(client.id, userId);

            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
            }
            this.onlineUsers.get(userId)!.add(client.id);

            client.join(`user:${userId}`);

            const currentOnlineUsers = Array.from(this.onlineUsers.keys());
            this.server.to(client.id).emit('online-users:list', {
                users: currentOnlineUsers
            });

            client.broadcast.emit('user:online', {
                userId: userId,
                timestamp: new Date().toISOString()
            });

            client.emit('connected', {
                success: true,
                message: 'Connected to workspace WebSocket',
                userId: userId,
                onlineUsers: currentOnlineUsers,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            this.logger.error('Connection error:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = this.userSocketMap.get(client.id);

        if (userId) {
            if (this.onlineUsers.has(userId)) {
                const socketIds = this.onlineUsers.get(userId)!;
                socketIds.delete(client.id);

                if (socketIds.size === 0) {
                    this.onlineUsers.delete(userId);

                    this.server.emit('user:offline', {
                        userId: userId,
                        timestamp: new Date().toISOString()
                    });
                    this.logger.log(`🔴 User ${userId} is now offline`);
                }
            }

            this.userSocketMap.delete(client.id);
        }

        this.logger.log(`Client disconnected: ${client.id}`);
    }

    private extractTokenFromCookies(client: Socket): string | null {
        try {
            const cookieHeader = client.handshake.headers.cookie;
            if (!cookieHeader) return null;

            const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {} as Record<string, string>);

            return cookies['access_token'] || null;
        } catch (error) {
            return null;
        }
    }

    @SubscribeMessage('join-workspace')
    async handleJoinWorkspace(client: Socket, workspaceId: string) {
        try {
            const token = client.handshake.auth?.token || this.extractTokenFromCookies(client);
            if (!token) {
                this.logger.warn('No token for join-workspace');
                return;
            }

            // ⬅️ SỬA: DÙNG verifyToken THAY VÌ jwtService.verify() trực tiếp
            const verification = this.verifyToken(token);
            if (!verification.success) {
                this.logger.error(`Invalid token for join-workspace: ${verification.error}`);
                return;
            }

            const userId = verification.payload.sub; // ⬅️ LẤY USER ID TỪ PAYLOAD

            // Join workspace room
            client.join(`workspace:${workspaceId}`);

            // Thông báo cho các thành viên khác trong workspace
            this.server.to(`workspace:${workspaceId}`).emit('member:joined', {
                userId,
                workspaceId,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`👤 User ${userId} joined workspace ${workspaceId}`);
        } catch (error) {
            this.logger.error('Join workspace error:', error);
        }
    }

    @SubscribeMessage('leave-workspace')
    async handleLeaveWorkspace(client: Socket, workspaceId: string) {
        client.leave(`workspace:${workspaceId}`);
        this.logger.log(`Client left workspace ${workspaceId}`);
    }

    private async sendPendingInvitations(userId: number) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });

            if (!user?.email) return;

            const invitations = await this.prisma.workspaceInvite.findMany({
                where: {
                    email: user.email,
                    status: 'PENDING',
                    expiresAt: { gt: new Date() },
                },
                include: {
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (invitations.length > 0) {
                this.server.to(`user:${userId}`).emit('invitations:update', {
                    type: 'INITIAL',
                    data: invitations.map(inv => ({
                        id: inv.id,
                        workspaceId: inv.workspaceId,
                        workspaceName: inv.workspace.name,
                        role: inv.role,
                        expiresAt: inv.expiresAt,
                        token: inv.token,
                    })),
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error('Error sending pending invitations:', error);
        }
    }

    private async getUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true },
        });
    }

    async notifyNewInvitation(email: string, invitation: any) {
        try {
            const dbInvitation = await this.prisma.workspaceInvite.findUnique({
                where: { id: invitation.id }
            });

            if (!dbInvitation) {
                return;
            }

            const user = await this.getUserByEmail(email);
            if (user) {
                this.server.to(`user:${user.id}`).emit('invitations:new', {
                    type: 'NEW',
                    data: {
                        id: invitation.id,
                        workspaceId: invitation.workspaceId,
                        workspaceName: invitation.workspaceName,
                        role: invitation.role,
                        invitedBy: invitation.invitedBy,
                        expiresAt: invitation.expiresAt,
                        token: invitation.token,
                        createdAt: invitation.createdAt
                    },
                    timestamp: new Date().toISOString(),
                });
                this.logger.log(`📨 Notification sent to user ${user.id} (${email})`);
            }
        } catch (error) {
            this.logger.error('Error notifying new invitation:', error);
        }
    }

    async notifyInvitationCancelled(email: string, invitationId: string) {
        try {
            const user = await this.getUserByEmail(email);
            if (user) {
                this.server.to(`user:${user.id}`).emit('invitations:cancelled', {
                    type: 'CANCELLED',
                    data: { invitationId },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error('Error notifying cancelled invitation:', error);
        }
    }

    async notifyInvitationUpdated(email: string, invitationId: string, status: 'ACCEPTED' | 'DECLINED') {
        try {
            const user = await this.getUserByEmail(email);
            if (user) {
                this.server.to(`user:${user.id}`).emit('invitations:updated', {
                    type: status,
                    data: { invitationId },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error('Error notifying invitation update:', error);
        }
    }

    isUserOnline(userId: number): boolean {
        return this.onlineUsers.has(userId) && this.onlineUsers.get(userId)!.size > 0;
    }

    getOnlineUsers(): number[] {
        return Array.from(this.onlineUsers.keys());
    }

    // Kiểm tra workspace member online
    async getWorkspaceOnlineMembers(workspaceId: string): Promise<number[]> {
        try {
            const members = await this.prisma.workspaceMember.findMany({
                where: { workspaceId },
                select: { userId: true }
            });

            const memberUserIds = members.map(m => m.userId);
            return memberUserIds.filter(userId => this.isUserOnline(userId));
        } catch (error) {
            this.logger.error('Error getting workspace online members:', error);
            return [];
        }
    }
}