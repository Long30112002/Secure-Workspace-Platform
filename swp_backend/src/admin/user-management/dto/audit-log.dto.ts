import { Type } from "class-transformer";
import { IsDate, IsEnum, IsInt, IsJSON, IsOptional, IsString } from "class-validator";

export enum AuditAction {
    CREATE_USER = 'CREATE_USER',
    UPDATE_USER = 'UPDATE_USER',
    DELETE_USER = 'DELETE_USER',
    RESTORE_USER = 'RESTORE_USER',
    BULK_DELETE_USERS = 'BULK_DELETE_USERS',
    BULK_UPDATE_USERS = 'BULK_UPDATE_USERS',
    UNLOCK_USER = 'UNLOCK_USER',
    VERIFY_EMAIL = 'VERIFY_EMAIL',
    IMPORT_USERS = 'IMPORT_USERS',
    EXPORT_USERS = 'EXPORT_USERS',
    RESET_PASSWORD = 'RESET_PASSWORD'
}

export enum AuditEntityType {
    USER = 'user',
    ROLE = 'role',
    PERMISSION = 'permission'
}

export class CreateAuditLogDto {
    @IsEnum(AuditAction)
    action: AuditAction;

    @IsEnum(AuditEntityType)
    entityType: AuditEntityType;

    @IsOptional()
    @IsInt()
    entityId?: number;

    @IsOptional()
    @IsJSON()
    details?: string;

    @IsOptional()
    @IsString()
    ipAddress?: string;

    @IsOptional()
    @IsString()
    userAgent?: string;
}

export class AuditLogQueryDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    limit?: number = 20;

    @IsOptional()
    @IsEnum(AuditAction)
    action?: AuditAction;

    @IsOptional()
    @IsEnum(AuditEntityType)
    entityType?: AuditEntityType;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    entityId?: number;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    startDate?: Date;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    endDate?: Date;
}

export class AuditLogResponseDto {
    id: number;
    action: AuditAction;
    entityType: string;
    entityId?: number;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;

    // Admin info
    admin: {
        id: number;
        email: string;
        role: string;
    };
}