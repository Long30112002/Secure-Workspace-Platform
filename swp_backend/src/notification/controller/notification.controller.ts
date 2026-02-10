import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
    CreateNotificationDto,
    UpdateNotificationDto,
    NotificationFilterDto,
    MarkNotificationsAsReadDto,
    UpdateNotificationSettingsDto,
    UpdateWorkspaceNotificationSettingsDto,
} from '../dto/notification.dto';
import { SkipThrottle } from '@nestjs/throttler';
import { NotificationService } from '../service/notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    async getNotifications(@Req() req: any, @Query() filter: NotificationFilterDto) {
        const userId = req.user.id;
        return this.notificationService.getUserNotifications(userId, filter);
    }

    @Get('stats')
    async getNotificationStats(@Req() req: any) {
        const userId = req.user.id;
        const stats = await this.notificationService.getUserNotificationStats(userId);
        return {
            success: true,
            data: stats,
            timestamp: new Date().toISOString(),
        };
    }

    @Get('unread-count')
    async getUnreadCount(@Req() req: any, @Query('workspaceId') workspaceId?: string) {
        const userId = req.user.id;
        return this.notificationService.getUnreadCount(userId, workspaceId);
    }

    @Get(':id')
    async getNotificationById(@Req() req: any, @Param('id') id: string) {
        const userId = req.user.id;
        return this.notificationService.getNotificationById(id, userId);
    }

    @Post()
    async createNotification(@Req() req: any, @Body() dto: CreateNotificationDto) {
        const senderId = req.user.id;
        return this.notificationService.createNotification(dto, senderId);
    }

    @Post('bulk')
    async createBulkNotifications(
        @Req() req: any,
        @Body() dtos: CreateNotificationDto[],
    ) {
        const senderId = req.user.id;
        return this.notificationService.createBulkNotifications(dtos, senderId);
    }

    @Post('workspace/:workspaceId')
    async createWorkspaceNotification(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Body() dto: Omit<CreateNotificationDto, 'userId' | 'userEmail' | 'workspaceId'>,
    ) {
        const senderId = req.user.id;
        return this.notificationService.createWorkspaceNotification(workspaceId, dto, senderId);
    }

    @Post('post/:workspaceId')
    async notifyNewPost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Body() body: { postId: string; postTitle: string; content: string },
    ) {
        const authorId = req.user.id;
        return this.notificationService.notifyNewPost(
            workspaceId,
            body.postId,
            body.postTitle,
            body.content,
            authorId,
        );
    }

    @Post('mention/:workspaceId/:userId')
    async notifyMention(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('userId') mentionedUserId: string,
        @Body() body: { postId: string; content: string },
    ) {
        const authorId = req.user.id;
        const mentionedUserIdNum = parseInt(mentionedUserId);
        if (isNaN(mentionedUserIdNum)) {
            throw new BadRequestException('Invalid user ID');
        }
        return this.notificationService.notifyMention(
            workspaceId,
            body.postId,
            body.content,
            mentionedUserIdNum,
            authorId,
        );
    }

    @Patch(':id/read')
    async markAsRead(@Req() req: any, @Param('id') id: string) {
        const userId = req.user.id;
        return this.notificationService.markAsRead(userId, id);
    }

    @Post('mark-read')
    async markMultipleAsRead(@Req() req: any, @Body() dto: MarkNotificationsAsReadDto) {
        const userId = req.user.id;
        return this.notificationService.markMultipleAsRead(userId, dto);
    }

    @Post('mark-all-read')
    async markAllAsRead(@Req() req: any, @Query('workspaceId') workspaceId?: string) {
        const userId = req.user.id;
        return this.notificationService.markMultipleAsRead(userId, {
            all: true,
            workspaceId,
        });
    }

    @Patch(':id')
    async updateNotification(
        @Req() req: any,
        @Param('id') id: string,
        @Body() dto: UpdateNotificationDto,
    ) {
        const userId = req.user.id;

        if (dto.archived !== undefined) {
            return this.notificationService.archiveNotification(userId, id);
        }

        throw new BadRequestException('Only archiving is allowed through this endpoint');
    }

    @Delete(':id')
    async deleteNotification(@Req() req: any, @Param('id') id: string) {
        const userId = req.user.id;
        return this.notificationService.deleteNotification(userId, id);
    }

    @Get('settings')
    async getSettings(@Req() req: any) {
        const userId = req.user.id;
        const settings = await this.notificationService.getUserNotificationSettings(userId);
        return {
            success: true,
            data: settings,
            timestamp: new Date().toISOString(),
        };
    }

    @Patch('settings')
    async updateSettings(@Req() req: any, @Body() dto: UpdateNotificationSettingsDto) {
        const userId = req.user.id;
        return this.notificationService.updateNotificationSettings(userId, dto);
    }

    @Get('workspace/:workspaceId/settings')
    async getWorkspaceSettings(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
    ) {
        const userId = req.user.id;
        const settings = await this.notificationService.getWorkspaceNotificationSettings(
            userId,
            workspaceId,
        );
        return {
            success: true,
            data: settings || { enabled: true, settings: {} },
            timestamp: new Date().toISOString(),
        };
    }

    @Patch('workspace/:workspaceId/settings')
    async updateWorkspaceSettings(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Body() dto: UpdateWorkspaceNotificationSettingsDto,
    ) {
        const userId = req.user.id;
        return this.notificationService.updateWorkspaceNotificationSettings(
            userId,
            workspaceId,
            dto,
        );
    }

    @Post('cleanup')
    @SkipThrottle()
    async cleanupOldNotifications(@Query('days') days: string) {
        const daysNum = days ? parseInt(days) : 30;
        return this.notificationService.cleanupOldNotifications(daysNum);
    }

    @Get('admin/all')
    @SkipThrottle()
    async getAllNotifications(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('userId') userId?: string,
        @Query('workspaceId') workspaceId?: string,
        @Query('type') type?: string,
    ) {
        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 50;
        const userIdNum = userId ? parseInt(userId) : undefined;

        return this.notificationService.getAllNotifications({
            page: pageNum,
            limit: limitNum,
            userId: userIdNum,
            workspaceId,
            type: type as any,
        });
    }

    @Get('verify/:token')
    @SkipThrottle()
    async verifyNotificationToken(@Param('token') token: string) {
        // You can implement actual token verification logic here
        return {
            success: true,
            message: 'Token verification endpoint',
            timestamp: new Date().toISOString(),
        };
    }
}