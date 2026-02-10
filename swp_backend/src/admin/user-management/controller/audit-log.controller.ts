import {
    Controller,
    Get,
    Query,
    UseGuards,
    Req,
    Param,
    ParseIntPipe,
    NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Role } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuditLogService } from '../service/audit-log.service';
import { AuditLogQueryDto } from '../dto/audit-log.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) { }

    @Get('my-logs')
    async getMyAuditLogs(
        @Req() req: any,
        @Query() query: AuditLogQueryDto
    ) {
        const userId = req.user.id;
        return this.auditLogService.getUserAuditLogs(userId, query);
    }

    @Get('my-logs/stats')
    async getMyAuditStats(@Req() req: any) {
        const userId = req.user.id;
        return this.auditLogService.getAuditStats(userId);
    }

    @Get('my-logs/:id')
    async getMyAuditLogById(
        @Req() req: any,
        @Param('id', ParseIntPipe) logId: number
    ) {
        const userId = req.user.id;
        const result = await this.auditLogService.getAuditLogById(logId, userId);

        if (!result) {
            throw new NotFoundException('Audit log not found or access denied');
        }

        return result;
    }
}