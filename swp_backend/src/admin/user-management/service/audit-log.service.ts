import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AuditAction, AuditEntityType, CreateAuditLogDto, AuditLogQueryDto, AuditLogResponseDto } from '../dto/audit-log.dto';

@Injectable()
export class AuditLogService {
    constructor(private prisma: DatabaseService) { }

    async createAuditLog(
        userId: number,
        createDto: CreateAuditLogDto
    ) {
        return this.prisma.auditLog.create({
            data: {
                userId,
                ...createDto,
                details: createDto.details ? JSON.parse(createDto.details) : null,
            },
        });
    }

    async getUserAuditLogs(
        userId: number,
        query: AuditLogQueryDto
    ) {
        const {
            page = 1,
            limit = 20,
            action,
            entityType,
            entityId,
            startDate,
            endDate,
        } = query;

        const pageNum = Math.max(1, page);
        const limitNum = Math.max(1, Math.min(limit, 100));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            userId, // Chỉ lấy log của admin hiện tại
        };

        if (action) {
            where.action = action;
        }

        if (entityType) {
            where.entityType = entityType;
        }

        if (entityId) {
            where.entityId = entityId;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    admin: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        const formattedLogs: AuditLogResponseDto[] = logs.map(log => ({
            id: log.id,
            action: log.action as AuditAction,
            entityType: log.entityType,
            entityId: log.entityId || undefined,
            details: log.details,
            ipAddress: log.ipAddress || undefined,
            userAgent: log.userAgent || undefined,
            createdAt: log.createdAt,
            admin: {
                id: log.admin.id,
                email: log.admin.email,
                role: log.admin.role,
            },
        }));

        return {
            success: true,
            message: 'Audit logs retrieved successfully',
            data: {
                logs: formattedLogs,
                meta: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                    hasMore: pageNum < Math.ceil(total / limitNum),
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    async getAuditLogById(logId: number, userId: number) {
        const log = await this.prisma.auditLog.findFirst({
            where: {
                id: logId,
                userId, // Chỉ admin tạo log mới có thể xem
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        if (!log) {
            return null;
        }

        return {
            success: true,
            message: 'Audit log retrieved successfully',
            data: {
                log: {
                    id: log.id,
                    action: log.action as AuditAction,
                    entityType: log.entityType,
                    entityId: log.entityId || undefined,
                    details: log.details,
                    ipAddress: log.ipAddress || undefined,
                    userAgent: log.userAgent || undefined,
                    createdAt: log.createdAt,
                    admin: {
                        id: log.admin.id,
                        email: log.admin.email,
                        role: log.admin.role,
                    },
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    async getAuditStats(userId: number) {
        const [totalLogs, todayLogs, actions] = await Promise.all([
            this.prisma.auditLog.count({
                where: { userId },
            }),
            this.prisma.auditLog.count({
                where: {
                    userId,
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
            this.prisma.auditLog.groupBy({
                by: ['action'],
                where: { userId },
                _count: {
                    action: true,
                },
                orderBy: {
                    _count: {
                        action: 'desc',
                    },
                },
                take: 5,
            }),
        ]);

        return {
            success: true,
            message: 'Audit statistics retrieved successfully',
            data: {
                total: totalLogs,
                today: todayLogs,
                topActions: actions.map(action => ({
                    action: action.action,
                    count: action._count.action,
                })),
            },
            timestamp: new Date().toISOString(),
        };
    }
}