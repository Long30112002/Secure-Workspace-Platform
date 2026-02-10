import { IsEnum, IsString, IsOptional, IsNumber, IsObject, IsDateString, IsBoolean, IsArray, Matches } from "class-validator";

export enum NotificationType {
    WORKSPACE_INVITATION = 'WORKSPACE_INVITATION',
    WORKSPACE_POST = 'WORKSPACE_POST',
    WORKSPACE_MENTION = 'WORKSPACE_MENTION',
    WORKSPACE_COMMENT = 'WORKSPACE_COMMENT',
    WORKSPACE_FILE = 'WORKSPACE_FILE',
    WORKSPACE_EVENT = 'WORKSPACE_EVENT',
    SYSTEM = 'SYSTEM',
    BILLING = 'BILLING',
    SECURITY = 'SECURITY',
    ACHIEVEMENT = 'ACHIEVEMENT',
}

export enum NotificationPriority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    URGENT = 'URGENT',
}

export class CreateNotificationDto {
    @IsEnum(NotificationType)
    type: NotificationType;

    @IsString()
    message: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsNumber()
    userId?: number;

    @IsOptional()
    @IsString()
    userEmail?: string;

    @IsOptional()
    @IsString()
    workspaceId?: string;

    @IsOptional()
    @IsEnum(NotificationPriority)
    priority?: NotificationPriority = NotificationPriority.MEDIUM;

    @IsOptional()
    @IsObject()
    data?: Record<string, any>;

    @IsOptional()
    @IsString()
    entityId?: string;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsString()
    actionUrl?: string;

    @IsOptional()
    @IsString()
    actionLabel?: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}

export class UpdateNotificationDto {
    @IsOptional()
    @IsBoolean()
    read?: boolean;

    @IsOptional()
    @IsBoolean()
    archived?: boolean;
}

export class MarkNotificationsAsReadDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    notificationIds?: string[];

    @IsOptional()
    @IsBoolean()
    all?: boolean;

    @IsOptional()
    @IsString()
    workspaceId?: string;
}

export class NotificationFilterDto {
    @IsOptional()
    @IsBoolean()
    read?: boolean;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsString()
    workspaceId?: string;

    @IsOptional()
    @IsNumber()
    page?: number = 1;

    @IsOptional()
    @IsNumber()
    limit?: number = 20;

    @IsOptional()
    @IsBoolean()
    includeArchived?: boolean = false;
}

export class UpdateNotificationSettingsDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsBoolean()
    emailNotifications?: boolean;

    @IsOptional()
    @IsBoolean()
    pushNotifications?: boolean;

    @IsOptional()
    @IsBoolean()
    desktopNotifications?: boolean;

    @IsOptional()
    @IsBoolean()
    soundEnabled?: boolean;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    quietHoursEnabled?: boolean;

    @IsOptional()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'Time must be in HH:MM format (24-hour)'
    })
    doNotDisturbStart?: string;

    @IsOptional()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'Time must be in HH:MM format (24-hour)'
    })
    doNotDisturbEnd?: string;
}

export class UpdateWorkspaceNotificationSettingsDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsDateString()
    muteUntil?: string;

    @IsOptional()
    @IsObject()
    settings?: Record<string, any>;
}