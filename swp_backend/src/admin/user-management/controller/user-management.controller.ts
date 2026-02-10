import { UserManagementService } from '../service/user-management.service';
import {
    Body, Controller, Delete, Patch, Get, HttpCode, HttpStatus,
    Param, Put, Query, UseGuards, Post, Req, UseInterceptors,
    UploadedFile, BadRequestException, Res
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Role } from '../../../auth/decorators/roles.decorator';
import { UserQueryDto } from 'src/admin/user-management/dto/user-query.dto';
import { BulkUpdateUsersDto, UpdateUserAdminDto } from 'src/admin/user-management/dto/update-user-admin.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DatabaseService } from 'src/database/database.service';
import { TransformInterceptor } from 'src/api/transform.interceptor';
import { QueryParserService } from 'src/common/parsers/query-parser.service';
import { CreateUserAdminDto, ExportUsersDto, ImportUsersDto } from '../dto/create-user-admin.dto';
import { CSVExportResult, ExcelExportResult, ImportExportService } from '../service/user-import-export.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditLogInterceptor } from 'src/common/interceptors/audit-log.interceptor';

@Controller('user-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Role(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(TransformInterceptor, AuditLogInterceptor)
export class UserManagementController {
    constructor(
        private readonly userManagementService: UserManagementService,
        private readonly prisma: DatabaseService,
        private readonly queryParser: QueryParserService,
        private readonly importExportService: ImportExportService,
    ) { }

    @Get()
    async getAllUsers(@Req() req: any) {
        const query = this.queryParser.parseUserQuery(req.query);
        return this.userManagementService.findAllUser(query);
    }

    @Post('create')
    async createUser(@Body() createData: CreateUserAdminDto) {
        return this.userManagementService.createUser(createData);
    }

    @Get('deleted')
    async getDeletedUsers(@Query() query: UserQueryDto) {
        return this.userManagementService.getDeletedUsers(query);
    }

    @Put(':id')
    async updateUser(
        @Param('id') id: string,
        @Body() updateData: UpdateUserAdminDto,
        @Req() req: any
    ) {
        const currentAdminId = req.user?.id;
        return this.userManagementService.updateUser(id, updateData, currentAdminId);
    }

    @Delete(':id')
    async deleteUser(@Param('id') id: string, @Req() req: any) {
        const deletedByUserId = req.user?.id;
        return this.userManagementService.deleteUser(id, deletedByUserId);
    }

    @Delete(':id/force')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Role(UserRole.SUPER_ADMIN) // SUPER_ADMIN mới được force delete
    async forceDeleteUser(@Param('id') id: string, @Req() req: any) {
        const deletedByUserId = req.user?.id;
        return this.userManagementService.forceDeleteUser(id, deletedByUserId);
    }

    @Patch(':id/restore')
    async restoreUser(@Param('id') id: string) {
        return this.userManagementService.restoreUser(id);
    }

    @Patch(':id/unlock')
    async unlockUser(@Param('id') id: string) {
        return this.userManagementService.unlockUser(id);
    }

    @Patch(':id/verify-email')
    async verifyUserEmail(@Param('id') id: string) {
        return this.userManagementService.verifyUserEmail(id);
    }

    @Post('bulk-update')
    async bulkUpdateUsers(@Body() bulkData: BulkUpdateUsersDto) {
        return this.userManagementService.bulkUpdateUsers(bulkData);
    }

    @Post('bulk-delete')
    @HttpCode(HttpStatus.NO_CONTENT)
    async bulkDeleteUsers(
        @Body() body: { userIds: string[] },
        @Req() req: any
    ) {
        const deletedByUserId = req.user?.id;
        return this.userManagementService.bulkDeleteUsers(body.userIds, deletedByUserId);
    }

    @Post('bulk-restore')
    async bulkRestoreUsers(@Body() body: { userIds: string[] }) {
        return this.userManagementService.bulkRestoreUsers(body.userIds);
    }
    @Post(':id/reset-password')
    async resetUserPassword(@Param('id') id: string) {
        return this.userManagementService.resetUserPassword(id);
    }

    @Get('stats')
    async getUserStats() {
        return this.userManagementService.getUserStats();
    }

    @Post('import')
    @HttpCode(HttpStatus.OK)
    async importUsers(@Body() importData: ImportUsersDto) {
        return this.importExportService.importUsers(importData);
    }

    @Post('import/csv')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    async importCSV(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { sendWelcomeEmail?: boolean, updateExisting?: boolean }
    ) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
            throw new BadRequestException('File must be a CSV');
        }

        const sendWelcomeEmail = this.queryParser.parseBoolean(body.sendWelcomeEmail);
        const updateExisting = this.queryParser.parseBoolean(body.updateExisting);

        return this.importExportService.importUsersFromCSVFile(file, {
            sendWelcomeEmail,
            updateExisting
        });
    }

    @Get('export')
    async exportUsers(
        @Query() query: ExportUsersDto,
        @Res() res: Response
    ) {
        const result = await this.importExportService.exportUsers(query);

        if (query.format === 'csv') {
            const csvResult = result as CSVExportResult;
            res.set(csvResult.headers);
            res.send(csvResult.data);
        } else if (query.format === 'excel') {
            const excelResult = result as ExcelExportResult;
            res.set(excelResult.headers);
            res.send(excelResult.data);
        } else {
            return result;
        }
    }

    @Post('export/selected/file')
    async exportSelectedUsersFile(
        @Body() body: { userIds: string[], format: 'csv' | 'excel' },
        @Res() res: Response
    ) {

        // Parse userIds nếu là string
        let userIds: string[] = [];
        if (typeof body.userIds === 'string') {
            try {
                userIds = JSON.parse(body.userIds);
            } catch (error) {
                userIds = [body.userIds];
            }
        } else if (Array.isArray(body.userIds)) {
            userIds = body.userIds;
        } else {
            throw new BadRequestException('userIds must be an array or JSON string');
        }

        const result = await this.importExportService.exportUsers({
            userIds: userIds,
            format: body.format || 'csv'
        });

        if (body.format === 'csv') {
            const csvResult = result as CSVExportResult;
            res.set(csvResult.headers);
            res.send(csvResult.data);
        } else if (body.format === 'excel') {
            const excelResult = result as ExcelExportResult;
            res.set(excelResult.headers);
            res.send(excelResult.data);
        } else {
            throw new BadRequestException('Unsupported format. Use "csv" or "excel"');
        }
    }

    @Post('export/selected/json')
    async exportSelectedUsersJson(
        @Body() body: { userIds: string[] }
    ) {
        // Parse userIds nếu là string
        let userIds: string[] = [];
        if (typeof body.userIds === 'string') {
            try {
                userIds = JSON.parse(body.userIds);
            } catch (error) {
                userIds = [body.userIds];
            }
        } else if (Array.isArray(body.userIds)) {
            userIds = body.userIds;
        } else {
            throw new BadRequestException('userIds must be an array or JSON string');
        }

        return this.importExportService.exportUsers({
            userIds: userIds,
            format: 'json'
        });
    }
}