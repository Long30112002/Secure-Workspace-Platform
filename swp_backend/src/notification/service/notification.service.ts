import { WorkspaceGateway } from './../../workspace/real-time/workspace.gateway';
import {
    Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef,
} from '@nestjs/common';
import { Prisma, NotificationType, NotificationPriority } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import {
    CreateNotificationDto, NotificationFilterDto, MarkNotificationsAsReadDto, UpdateNotificationSettingsDto, UpdateWorkspaceNotificationSettingsDto, NotificationType as DtoNotificationType, NotificationPriority as DtoNotificationPriority,
} from '../dto/notification.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private prisma: DatabaseService,
        private wsGateway: WorkspaceGateway,
        private eventEmitter: EventEmitter2,
    ) { }

    /**
     * Tạo thông báo mới
     */
    async createNotification(dto: CreateNotificationDto, senderId?: number) {
        try {
            // Tìm user nếu chỉ có email
            let userId = dto.userId;
            if (!userId && dto.userEmail) {
                const user = await this.prisma.user.findUnique({
                    where: { email: dto.userEmail.toLowerCase() },
                    select: { id: true },
                });
                if (user) {
                    userId = user.id;
                }
            }

            if (!userId) {
                throw new BadRequestException('User not found');
            }

            // Kiểm tra cài đặt thông báo của user
            const userSettings = await this.getUserNotificationSettings(userId);
            const workspaceSettings = dto.workspaceId
                ? await this.getWorkspaceNotificationSettings(userId, dto.workspaceId)
                : null;

            // Kiểm tra xem user có muốn nhận thông báo này không
            if (!this.shouldSendNotification(userSettings, workspaceSettings, dto.type)) {
                this.logger.log(
                    `Notification skipped for user ${userId} (type: ${dto.type}) due to settings`,
                );
                return {
                    success: true,
                    message: 'Notification skipped due to user settings',
                    data: null,
                    timestamp: new Date().toISOString(),
                };
            }

            // Kiểm tra thời gian "Do Not Disturb"
            if (this.isInQuietHours(userSettings)) {
                this.logger.log(`Notification queued for user ${userId} (in quiet hours)`);
                // Có thể lưu vào queue để gửi sau, hiện tại vẫn tạo nhưng không gửi real-time
            }

            // Tạo thông báo trong database
            const notification = await this.prisma.notification.create({
                data: {
                    userId,
                    type: this.mapNotificationType(dto.type),
                    title: dto.title,
                    message: dto.message,
                    data: dto.data || {},
                    priority: this.mapNotificationPriority(dto.priority),
                    workspaceId: dto.workspaceId,
                    entityId: dto.entityId,
                    entityType: dto.entityType,
                    actionUrl: dto.actionUrl,
                    actionLabel: dto.actionLabel,
                    senderId,
                    expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                    metadata: {
                        sentAt: new Date().toISOString(),
                        ...((dto.data as any)?.metadata || {}),
                    },
                },
                include: {
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            subdomain: true,
                        },
                    },
                    sender: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            // Gửi thông báo real-time qua WebSocket (trừ khi trong quiet hours)
            if (!this.isInQuietHours(userSettings)) {
                await this.sendRealTimeNotification(notification, userId);
            }

            // Gửi email nếu được bật
            if (userSettings.emailNotifications && userSettings.enabled) {
                await this.sendEmailNotification(notification, userId);
            }

            // Log hành động
            await this.logNotificationAction(notification.id, userId, 'SENT', 'IN_APP');

            this.logger.log(`Notification created: ${notification.id} for user ${userId}`);

            return {
                success: true,
                message: 'Notification created successfully',
                data: notification,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to create notification:', error);
            throw error;
        }
    }

    /**
     * Tạo thông báo cho nhiều users
     */
    async createBulkNotifications(dtos: CreateNotificationDto[], senderId?: number) {
        const results = {
            total: dtos.length,
            successful: 0,
            failed: 0,
            errors: [] as Array<{ email: string; error: string }>,
        };

        for (const dto of dtos) {
            try {
                await this.createNotification(dto, senderId);
                results.successful++;
            } catch (error: any) {
                results.failed++;
                results.errors.push({
                    email: dto.userEmail || 'unknown',
                    error: error.message,
                });
            }
        }

        return {
            success: results.successful > 0,
            message: `Notifications sent: ${results.successful} successful, ${results.failed} failed`,
            data: results,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Tạo thông báo cho tất cả members trong workspace
     */
    async createWorkspaceNotification(
        workspaceId: string,
        dto: Omit<CreateNotificationDto, 'userId' | 'userEmail' | 'workspaceId'>,
        senderId?: number,
        excludeUserIds: number[] = [],
    ) {
        try {
            // Lấy tất cả members trong workspace
            const members = await this.prisma.workspaceMember.findMany({
                where: {
                    workspaceId,
                    userId: { notIn: excludeUserIds },
                },
                include: {
                    user: {
                        select: { id: true, email: true },
                    },
                },
            });

            if (members.length === 0) {
                return {
                    success: true,
                    message: 'No members to notify',
                    data: { count: 0 },
                    timestamp: new Date().toISOString(),
                };
            }

            // Tạo thông báo cho từng member
            const notifications = await Promise.all(
                members.map(async (member) => {
                    try {
                        return await this.createNotification(
                            {
                                ...dto,
                                userId: member.user.id,
                                workspaceId,
                            },
                            senderId,
                        );
                    } catch (error) {
                        this.logger.error(
                            `Failed to create notification for user ${member.user.id}:`,
                            error,
                        );
                        return null;
                    }
                }),
            );

            const successful = notifications.filter((n) => n !== null).length;

            return {
                success: true,
                message: `Notifications sent to ${successful} workspace members`,
                data: {
                    total: members.length,
                    successful,
                    failed: members.length - successful,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to create workspace notification:', error);
            throw error;
        }
    }

    /**
     * Lấy thông báo của user
     */
    async getUserNotifications(userId: number, filter: NotificationFilterDto) {
        const {
            read,
            type,
            workspaceId,
            page = 1,
            limit = 20,
            includeArchived = false,
        } = filter;

        const skip = (page - 1) * limit;

        const where: Prisma.NotificationWhereInput = {
            userId,
            archived: includeArchived ? undefined : false,
            ...(read !== undefined && { read }),
            ...(type && { type: this.mapNotificationType(type) }),
            ...(workspaceId && { workspaceId }),
            ...(!includeArchived && {
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            }),
        };

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            subdomain: true,
                        },
                    },
                    sender: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            }),
            this.prisma.notification.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        // Tính thống kê
        const unreadCount = await this.prisma.notification.count({
            where: { ...where, read: false },
        });

        const stats = await this.getUserNotificationStats(userId);

        return {
            success: true,
            data: notifications,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null,
            },
            stats: {
                totalCount: total,
                unreadCount: unreadCount,
                ...stats,
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Đánh dấu thông báo đã đọc
     */
    async markAsRead(userId: number, notificationId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        if (notification.read) {
            return {
                success: true,
                message: 'Notification already marked as read',
                data: notification,
                timestamp: new Date().toISOString(),
            };
        }

        const updated = await this.prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });

        // Log hành động
        await this.logNotificationAction(notificationId, userId, 'READ');

        // Gửi update qua WebSocket
        this.sendNotificationUpdate(userId, {
            type: 'READ',
            data: { notificationId },
        });

        return {
            success: true,
            message: 'Notification marked as read',
            data: updated,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Đánh dấu nhiều thông báo đã đọc
     */
    async markMultipleAsRead(userId: number, dto: MarkNotificationsAsReadDto) {
        const where: Prisma.NotificationWhereInput = {
            userId,
            read: false,
            archived: false,
            ...(dto.workspaceId && { workspaceId: dto.workspaceId }),
            ...(dto.notificationIds && { id: { in: dto.notificationIds } }),
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        };

        const updated = await this.prisma.notification.updateMany({
            where,
            data: { read: true },
        });

        // Log hành động
        if (dto.notificationIds && dto.notificationIds.length > 0) {
            await Promise.all(
                dto.notificationIds.map((id) =>
                    this.logNotificationAction(id, userId, 'READ'),
                ),
            );
        }

        // Gửi update qua WebSocket
        this.sendNotificationUpdate(userId, {
            type: 'BULK_READ',
            data: { count: updated.count },
        });

        return {
            success: true,
            message: `${updated.count} notifications marked as read`,
            data: { count: updated.count },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Xóa thông báo
     */
    async deleteNotification(userId: number, notificationId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        await this.prisma.notification.delete({
            where: { id: notificationId },
        });

        // Log hành động
        await this.logNotificationAction(notificationId, userId, 'DELETED');

        return {
            success: true,
            message: 'Notification deleted',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Archive thông báo
     */
    async archiveNotification(userId: number, notificationId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        const updated = await this.prisma.notification.update({
            where: { id: notificationId },
            data: { archived: true },
        });

        return {
            success: true,
            message: 'Notification archived',
            data: updated,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Lấy số lượng thông báo chưa đọc
     */
    async getUnreadCount(userId: number, workspaceId?: string) {
        const where: Prisma.NotificationWhereInput = {
            userId,
            read: false,
            archived: false,
            ...(workspaceId && { workspaceId }),
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        };

        const count = await this.prisma.notification.count({ where });

        return {
            success: true,
            data: { count },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Lấy thống kê thông báo của user
     */
    async getUserNotificationStats(userId: number) {
        const notifications = await this.prisma.notification.findMany({
            where: {
                userId,
                archived: false,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: {
                read: true,
                type: true,
                workspaceId: true,
            },
        });

        const stats = {
            byType: {} as Record<string, number>,
            byWorkspace: {} as Record<string, number>,
        };

        // Tính theo type
        notifications.forEach((n) => {
            stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
        });

        // Tính theo workspace - Sửa lỗi null
        notifications
            .filter((n) => n.workspaceId !== null)
            .forEach((n) => {
                const workspaceId = n.workspaceId as string; // Type assertion vì đã filter null
                stats.byWorkspace[workspaceId] =
                    (stats.byWorkspace[workspaceId] || 0) + 1;
            });

        return stats;
    }

    /**
     * Lấy cài đặt thông báo của user
     */
    async getUserNotificationSettings(userId: number) {
        let settings = await this.prisma.notificationSetting.findUnique({
            where: { userId },
        });

        if (!settings) {
            // Tạo cài đặt mặc định nếu chưa có
            settings = await this.prisma.notificationSetting.create({
                data: {
                    userId,
                    settings: this.getDefaultTypeSettings(),
                },
            });
        }

        return settings;
    }

    /**
     * Cập nhật cài đặt thông báo
     */
    async updateNotificationSettings(
        userId: number,
        dto: UpdateNotificationSettingsDto,
    ) {
        const existingSettings = await this.getUserNotificationSettings(userId);

        // Merge settings - Sửa lỗi duplicate userId
        const updateData: any = {
            enabled: dto.enabled !== undefined ? dto.enabled : existingSettings.enabled,
            emailNotifications: dto.emailNotifications !== undefined ? dto.emailNotifications : existingSettings.emailNotifications,
            pushNotifications: dto.pushNotifications !== undefined ? dto.pushNotifications : existingSettings.pushNotifications,
            desktopNotifications: dto.desktopNotifications !== undefined ? dto.desktopNotifications : existingSettings.desktopNotifications,
            soundEnabled: dto.soundEnabled !== undefined ? dto.soundEnabled : existingSettings.soundEnabled,
            quietHoursEnabled: dto.quietHoursEnabled !== undefined ? dto.quietHoursEnabled : existingSettings.quietHoursEnabled,
            doNotDisturbStart: dto.doNotDisturbStart !== undefined ? dto.doNotDisturbStart : existingSettings.doNotDisturbStart,
            doNotDisturbEnd: dto.doNotDisturbEnd !== undefined ? dto.doNotDisturbEnd : existingSettings.doNotDisturbEnd,
            settings: {
                ...(existingSettings.settings as Record<string, any>),
                ...(dto.settings || {}),
            },
        };

        const updated = await this.prisma.notificationSetting.upsert({
            where: { userId },
            update: updateData,
            create: {
                userId,
                ...updateData,
            },
        });

        return {
            success: true,
            message: 'Notification settings updated',
            data: updated,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Lấy cài đặt thông báo cho workspace
     */
    async getWorkspaceNotificationSettings(userId: number, workspaceId: string) {
        const settings = await this.prisma.workspaceNotificationSetting.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
        });

        return settings;
    }

    /**
     * Cập nhật cài đặt thông báo cho workspace
     */
    async updateWorkspaceNotificationSettings(
        userId: number,
        workspaceId: string,
        dto: UpdateWorkspaceNotificationSettingsDto,
    ) {
        const existingSettings = await this.getWorkspaceNotificationSettings(
            userId,
            workspaceId,
        );

        // Merge settings
        const updateData: any = {
            enabled: dto.enabled !== undefined ? dto.enabled : (existingSettings?.enabled ?? true),
            muteUntil: dto.muteUntil ? new Date(dto.muteUntil) : existingSettings?.muteUntil,
            settings: {
                ...((existingSettings?.settings as Record<string, any>) || {}),
                ...(dto.settings || {}),
            },
        };

        const updated = await this.prisma.workspaceNotificationSetting.upsert({
            where: { userId_workspaceId: { userId, workspaceId } },
            update: updateData,
            create: {
                userId,
                workspaceId,
                ...updateData,
            },
        });

        return {
            success: true,
            message: 'Workspace notification settings updated',
            data: updated,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Làm sạch thông báo cũ
     */
    async cleanupOldNotifications(days: number = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Xóa thông báo đã archive và cũ
        const deletedArchived = await this.prisma.notification.deleteMany({
            where: {
                archived: true,
                createdAt: { lt: cutoffDate },
            },
        });

        // Xóa thông báo đã hết hạn
        const deletedExpired = await this.prisma.notification.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
                createdAt: { lt: cutoffDate },
            },
        });

        const totalDeleted = deletedArchived.count + deletedExpired.count;

        this.logger.log(
            `Cleaned up ${totalDeleted} old notifications (${deletedArchived.count} archived, ${deletedExpired.count} expired)`,
        );

        return {
            success: true,
            message: `Cleaned up ${totalDeleted} old notifications`,
            data: {
                archived: deletedArchived.count,
                expired: deletedExpired.count,
                total: totalDeleted,
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Tạo thông báo cho bài viết mới trong workspace
     */
    async notifyNewPost(
        workspaceId: string,
        postId: string,
        postTitle: string,
        content: string,
        authorId: number,
    ) {
        try {
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { name: true },
            });

            if (!workspace) {
                throw new NotFoundException('Workspace not found');
            }

            const author = await this.prisma.user.findUnique({
                where: { id: authorId },
                include: { profile: true },
            });

            if (!author) {
                throw new NotFoundException('Author not found');
            }

            const authorName = author.profile
                ? `${author.profile.firstName || ''} ${author.profile.lastName || ''}`.trim()
                : author.email;

            // Lấy tất cả members trong workspace (trừ author)
            const members = await this.prisma.workspaceMember.findMany({
                where: {
                    workspaceId,
                    userId: { not: authorId },
                },
                include: {
                    user: {
                        select: { id: true, email: true },
                    },
                },
            });

            // Tạo thông báo cho từng member
            const results = {
                total: members.length,
                successful: 0,
                failed: 0,
            };

            for (const member of members) {
                try {
                    await this.createNotification({
                        type: DtoNotificationType.WORKSPACE_POST,
                        userId: member.user.id,
                        workspaceId,
                        title: `New post in ${workspace.name}`,
                        message: `${authorName} posted: ${postTitle}`,
                        data: {
                            postId,
                            postTitle,
                            authorId,
                            authorName,
                            contentPreview: content.substring(0, 200),
                            workspaceName: workspace.name,
                        },
                        entityId: postId,
                        entityType: 'post',
                        actionUrl: `${process.env.FRONTEND_URL}/workspace/${workspaceId}/posts/${postId}`,
                        actionLabel: 'View Post',
                        priority: DtoNotificationPriority.MEDIUM,
                    }, authorId);
                    results.successful++;
                } catch (error) {
                    results.failed++;
                    this.logger.error(`Failed to create notification for user ${member.user.id}:`, error);
                }
            }

            return {
                success: true,
                message: `Notifications sent to ${results.successful} workspace members`,
                data: results,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to create post notification:', error);
            throw error;
        }
    }

    /**
     * Tạo thông báo mention
     */
    async notifyMention(
        workspaceId: string,
        postId: string,
        content: string,
        mentionedUserId: number,
        authorId: number,
    ) {
        try {
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { name: true },
            });

            if (!workspace) {
                throw new NotFoundException('Workspace not found');
            }

            const author = await this.prisma.user.findUnique({
                where: { id: authorId },
                include: { profile: true },
            });

            if (!author) {
                throw new NotFoundException('Author not found');
            }

            const authorName = author.profile
                ? `${author.profile.firstName || ''} ${author.profile.lastName || ''}`.trim()
                : author.email;

            return await this.createNotification({
                type: DtoNotificationType.WORKSPACE_MENTION,
                userId: mentionedUserId,
                workspaceId,
                title: `You were mentioned in ${workspace.name}`,
                message: `${authorName} mentioned you in a post`,
                data: {
                    postId,
                    authorId,
                    authorName,
                    contentPreview: content.substring(0, 200),
                    workspaceName: workspace.name,
                },
                entityId: postId,
                entityType: 'post',
                actionUrl: `${process.env.FRONTEND_URL}/workspace/${workspaceId}/posts/${postId}`,
                actionLabel: 'View Post',
                priority: DtoNotificationPriority.HIGH,
            });
        } catch (error) {
            this.logger.error('Failed to create mention notification:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS ====================

    /**
     * Kiểm tra xem có nên gửi thông báo không
     */
    private shouldSendNotification(
        userSettings: any,
        workspaceSettings: any,
        type: DtoNotificationType,
    ): boolean {
        // Kiểm tra global settings
        if (!userSettings?.enabled) return false;

        // Kiểm tra workspace settings
        if (workspaceSettings) {
            if (!workspaceSettings.enabled) return false;
            if (workspaceSettings.muteUntil && new Date(workspaceSettings.muteUntil) > new Date()) {
                return false;
            }
        }

        // Kiểm tra cài đặt theo loại
        const typeSettings = (userSettings.settings as Record<string, any>) || {};
        if (typeSettings[type] === false) return false;

        return true;
    }

    /**
     * Kiểm tra thời gian "Do Not Disturb"
     */
    private isInQuietHours(userSettings: any): boolean {
        if (
            !userSettings?.quietHoursEnabled ||
            !userSettings.doNotDisturbStart ||
            !userSettings.doNotDisturbEnd
        ) {
            return false;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // Parse time strings like "22:00"
        const [startHour, startMinute] = userSettings.doNotDisturbStart
            .split(':')
            .map(Number);
        const [endHour, endMinute] = userSettings.doNotDisturbEnd.split(':').map(Number);

        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        // Handle overnight time ranges (e.g., 22:00 to 08:00)
        if (startTime <= endTime) {
            // Normal range (e.g., 09:00 to 17:00)
            return currentTime >= startTime && currentTime < endTime;
        } else {
            // Overnight range (e.g., 22:00 to 08:00)
            return currentTime >= startTime || currentTime < endTime;
        }
    }

    /**
     * Gửi thông báo real-time
     */
    private async sendRealTimeNotification(notification: any, userId: number) {
        try {
            this.eventEmitter.emit('notification.new', { userId, notification });
        } catch (error) {
            this.logger.error('Failed to send real-time notification:', error);
        }
    }

    /**
     * Gửi cập nhật thông báo
     */
    private sendNotificationUpdate(userId: number, data: any) {
        try {
            // Gọi method có sẵn trong gateway hoặc tạo mới
            this.sendNotificationUpdateViaGateway(userId, data);
        } catch (error) {
            this.logger.error('Failed to send notification update:', error);
        }
    }

    // private async sendNotificationViaGateway(userId: number, notification: any) {
    //     try {
    //         // Sử dụng method hiện có của gateway hoặc emit trực tiếp
    //         this.wsGateway.server.to(`user:${userId}`).emit('notifications:new', {
    //             type: 'NEW_NOTIFICATION',
    //             data: notification,
    //             timestamp: new Date().toISOString(),
    //         });
    //     } catch (error) {
    //         this.logger.error('Error in sendNotificationViaGateway:', error);
    //     }
    // }

    /**
     * Gửi cập nhật qua gateway (wrapper method)
     */
    private sendNotificationUpdateViaGateway(userId: number, data: any) {
        try {
            this.wsGateway.server.to(`user:${userId}`).emit('notifications:update', {
                type: 'UPDATE',
                data,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            this.logger.error('Error in sendNotificationUpdateViaGateway:', error);
        }
    }

    /**
     * Gửi email thông báo
     */
    private async sendEmailNotification(notification: any, userId: number) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true },
            });

            if (!user) return;

            // Log thay vì gửi email thực (cho mục đích debug)
            this.logger.log(`[EMAIL] To: ${user.email}, Subject: "${notification.title || 'New Notification'}"`);
            this.logger.log(`[EMAIL] Message: ${notification.message}`);

            // Log hành động
            await this.logNotificationAction(notification.id, userId, 'SENT', 'EMAIL');
        } catch (error) {
            this.logger.error('Failed to send email notification:', error);
        }
    }

    /**
     * Log hành động với thông báo
     */
    private async logNotificationAction(
        notificationId: string,
        userId: number,
        action: string,
        channel?: string,
    ) {
        try {
            await this.prisma.notificationLog.create({
                data: {
                    notificationId,
                    userId,
                    action,
                    channel,
                },
            });
        } catch (error) {
            this.logger.error('Failed to log notification action:', error);
        }
    }

    /**
     * Map DTO notification type to Prisma enum
     */
    private mapNotificationType(type: DtoNotificationType): NotificationType {
        return type as NotificationType;
    }

    /**
     * Map DTO priority to Prisma enum
     */
    private mapNotificationPriority(priority?: DtoNotificationPriority): NotificationPriority {
        if (!priority) return NotificationPriority.MEDIUM;
        return priority as NotificationPriority;
    }

    /**
     * Get default type settings
     */
    private getDefaultTypeSettings(): Record<string, any> {
        return {
            WORKSPACE_INVITATION: true,
            WORKSPACE_POST: true,
            WORKSPACE_MENTION: true,
            WORKSPACE_COMMENT: true,
            WORKSPACE_FILE: true,
            WORKSPACE_EVENT: true,
            SYSTEM: true,
            BILLING: true,
            SECURITY: true,
            ACHIEVEMENT: true,
        };
    }

    /**
     * Lấy thông báo theo ID
     */
    async getNotificationById(notificationId: string, userId: number) {
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                    },
                },
                sender: {
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    },
                },
            },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        return {
            success: true,
            data: notification,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Lấy tất cả notifications (admin purposes)
     */
    async getAllNotifications(filter: {
        page?: number;
        limit?: number;
        userId?: number;
        workspaceId?: string;
        type?: DtoNotificationType;
    }) {
        const {
            page = 1,
            limit = 50,
            userId,
            workspaceId,
            type,
        } = filter;

        const skip = (page - 1) * limit;

        const where: Prisma.NotificationWhereInput = {
            ...(userId && { userId }),
            ...(workspaceId && { workspaceId }),
            ...(type && { type: this.mapNotificationType(type) }),
        };

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            subdomain: true,
                        },
                    },
                    sender: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prisma.notification.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            success: true,
            data: notifications,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null,
            },
            timestamp: new Date().toISOString(),
        };
    }
}