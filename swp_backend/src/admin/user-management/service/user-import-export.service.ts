// src/user-management/service/user-import-export.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { ImportUsersDto, ExportUsersDto } from '../dto/create-user-admin.dto';
import { DatabaseService } from 'src/database/database.service';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { QueryParserService } from 'src/common/parsers/query-parser.service';
import { ImportErrorDto, ImportSuccessDto } from '../dto/import-response.dto';

export interface BaseExportResult {
    success: boolean;
    message: string;
    timestamp: string;
}

export interface CSVExportResult extends BaseExportResult {
    data: string;
    headers: {
        'Content-Type': string;
        'Content-Disposition': string;
    };
}

export interface ExcelExportResult extends BaseExportResult {
    data: Buffer;
    headers: {
        'Content-Type': string;
        'Content-Disposition': string;
    };
}

export interface JSONExportResult extends BaseExportResult {
    data: any[];
}

export type ExportResult = CSVExportResult | ExcelExportResult | JSONExportResult;

export interface CSVImportResult {
    success: boolean;
    message: string;
    data: {
        totalRows: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        errors: Array<{
            row: number;
            email: string;
            reason: string;
        }>;
    };
    timestamp: string;
}

interface ImportProcessingResult {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: ImportErrorDto[];
    successes: ImportSuccessDto[];
    executionTimeMs: number;
    successCount: number;
}

@Injectable()
export class ImportExportService {
    constructor(
        private readonly prisma: DatabaseService,
        private readonly queryParser: QueryParserService,
    ) { }
    private readonly logger = new MyLoggerService(ImportExportService.name)

    async importUsersFromCSVFile(
        file: Express.Multer.File,
        options: { sendWelcomeEmail?: boolean, updateExisting?: boolean } = {}
    ): Promise<any> {
        const startTime = Date.now();

        try {
            const csvContent = file.buffer.toString('utf-8');

            const parseResult = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                trimHeaders: true,
            } as Papa.ParseConfig);

            if (parseResult.errors && parseResult.errors.length > 0) {
                throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`);
            }

            // Convert parsed data to structured format
            const usersData = parseResult.data.map((row: any, index) => ({
                row: index + 1,
                email: row.email || row.Email || '',
                firstName: row.firstName || row['First Name'] || row['first_name'] || '',
                lastName: row.lastName || row['Last Name'] || row['last_name'] || '',
                role: (row.role || row.Role || 'USER').toUpperCase()
            }));

            console.log(`📁 CSV parsed: ${usersData.length} rows`);

            // Process users - SỬA TYPE Ở ĐÂY
            const results: ImportProcessingResult = {
                totalRows: usersData.length,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
                errors: [] as ImportErrorDto[],
                successes: [] as ImportSuccessDto[],
                executionTimeMs: 0,
                successCount: 0
            };

            const sendWelcomeEmail = this.queryParser.parseBoolean(options.sendWelcomeEmail);
            const updateExisting = this.queryParser.parseBoolean(options.updateExisting);

            // Process in batches
            const BATCH_SIZE = 100;
            const batches = Math.ceil(usersData.length / BATCH_SIZE);

            for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
                const start = batchIndex * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, usersData.length);
                const batch = usersData.slice(start, end);

                console.log(`📦 Processing CSV batch ${batchIndex + 1}/${batches}`);

                for (const userData of batch) {
                    try {
                        // Validate
                        if (!userData.email || !this.isValidEmail(userData.email)) {
                            results.failed++;
                            results.errors.push({
                                row: userData.row,
                                email: userData.email,
                                reason: 'INVALID_EMAIL_FORMAT',
                                details: 'Invalid or missing email',
                                field: 'email'
                            });
                            continue;
                        }

                        // Validate role
                        const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
                        if (!validRoles.includes(userData.role)) {
                            results.failed++;
                            results.errors.push({
                                row: userData.row,
                                email: userData.email,
                                reason: 'INVALID_ROLE',
                                details: `Role "${userData.role}" not allowed`,
                                field: 'role',
                                suggestion: `Use: ${validRoles.join(', ')}`
                            });
                            continue;
                        }

                        const email = userData.email.trim().toLowerCase();

                        // Check existing user
                        const existingUser = await this.prisma.user.findUnique({
                            where: { email },
                            include: { profile: true }
                        });

                        if (existingUser) {
                            if (updateExisting) {
                                const needsUpdate = this.needsUserUpdate(existingUser, {
                                    role: userData.role as UserRole,
                                    firstName: userData.firstName,
                                    lastName: userData.lastName
                                });

                                if (needsUpdate) {
                                    await this.prisma.user.update({
                                        where: { id: existingUser.id },
                                        data: {
                                            role: userData.role as UserRole,
                                            profile: {
                                                upsert: {
                                                    update: {
                                                        firstName: userData.firstName,
                                                        lastName: userData.lastName
                                                    },
                                                    create: {
                                                        firstName: userData.firstName,
                                                        lastName: userData.lastName
                                                    }
                                                }
                                            }
                                        }
                                    });
                                    results.updated++;
                                    results.successes.push({
                                        row: userData.row,
                                        email: email,
                                        action: 'updated',
                                        changes: { role: userData.role }
                                    });
                                } else {
                                    results.skipped++;
                                    results.successes.push({
                                        row: userData.row,
                                        email: email,
                                        action: 'skipped',
                                        changes: { reason: 'No changes needed' }
                                    });
                                }
                            } else {
                                results.skipped++;
                                results.errors.push({
                                    row: userData.row,
                                    email: email,
                                    reason: 'EMAIL_ALREADY_EXISTS',
                                    details: 'User already exists',
                                    suggestion: 'Enable updateExisting to update'
                                });
                            }
                        } else {
                            // Create new user
                            const password = this.generateRandomPassword();
                            const hashedPassword = await bcrypt.hash(password, 10);

                            await this.prisma.user.create({
                                data: {
                                    email: email,
                                    password: hashedPassword,
                                    role: userData.role as UserRole,
                                    isActive: true,
                                    isEmailVerified: false,
                                    profile: {
                                        create: {
                                            firstName: userData.firstName,
                                            lastName: userData.lastName
                                        }
                                    }
                                }
                            });

                            results.created++;
                            results.successes.push({
                                row: userData.row,
                                email: email,
                                action: 'created',
                                temporaryPassword: sendWelcomeEmail ? password : undefined
                            });
                        }
                    } catch (error: any) {
                        results.failed++;
                        results.errors.push({
                            row: userData.row,
                            email: userData.email,
                            reason: 'PROCESSING_ERROR',
                            details: error.message
                        });
                    }
                }
            }

            results.executionTimeMs = Date.now() - startTime;
            results.successCount = results.created + results.updated; // KHÔNG CÒN LỖI

            return {
                success: true,
                message: 'CSV import completed',
                data: results,
                timestamp: new Date().toISOString()
            };

        } catch (error: any) {
            console.error('❌ CSV import failed:', error);
            throw error;
        }
    }

    private async processCSVUsers(
        usersData: Array<{ row: number; email: string; firstName: string; lastName: string; role: string }>,
        options: { sendWelcomeEmail?: boolean | string, updateExisting?: boolean | string }
    ): Promise<CSVImportResult> {
        const errors: Array<{ row: number; email: string; reason: string }> = [];
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        const sendWelcomeEmail = this.queryParser.parseBoolean(options.sendWelcomeEmail);
        const updateExisting = this.queryParser.parseBoolean(options.updateExisting);

        console.log('📊 CSV Import Options:', {
            updateExisting,
            sendWelcomeEmail,
            totalRows: usersData.length
        });

        for (const userData of usersData) {
            try {
                // Validate email
                if (!userData.email || !this.isValidEmail(userData.email)) {
                    errors.push({
                        row: userData.row,
                        email: userData.email,
                        reason: 'INVALID_EMAIL_FORMAT'
                    });
                    continue;
                }

                // Validate role
                const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
                const role = userData.role.toUpperCase();
                if (!validRoles.includes(role)) {
                    errors.push({
                        row: userData.row,
                        email: userData.email,
                        reason: 'ROLE_NOT_ALLOWED'
                    });
                    continue;
                }

                const email = userData.email.trim().toLowerCase();

                // Kiểm tra email đã tồn tại
                const existingUser = await this.prisma.user.findUnique({
                    where: { email },
                    include: { profile: true }
                });

                if (existingUser) {
                    if (updateExisting) {
                        // Kiểm tra có gì cần update không
                        const needsUpdate = this.needsUserUpdate(existingUser, {
                            role: role as UserRole,
                            firstName: userData.firstName,
                            lastName: userData.lastName
                        });

                        if (needsUpdate) {
                            // Update user hiện có
                            await this.prisma.user.update({
                                where: { id: existingUser.id },
                                data: {
                                    role: role as UserRole,
                                    profile: {
                                        upsert: {
                                            update: {
                                                firstName: userData.firstName,
                                                lastName: userData.lastName
                                            },
                                            create: {
                                                firstName: userData.firstName,
                                                lastName: userData.lastName
                                            }
                                        }
                                    }
                                }
                            });
                            updatedCount++;
                            console.log(`✅ Updated user: ${email}`);
                        } else {
                            // Không có gì thay đổi, skip
                            skippedCount++;
                            console.log(`⏭️ Skipped (no changes): ${email}`);
                        }
                    } else {
                        // Bỏ qua nếu không cho phép update
                        errors.push({
                            row: userData.row,
                            email: email,
                            reason: 'EMAIL_ALREADY_EXISTS'
                        });
                        console.log(`❌ Skipped (already exists): ${email}`);
                        continue;
                    }
                } else {
                    // Tạo user mới
                    const password = this.generateRandomPassword();
                    const hashedPassword = await bcrypt.hash(password, 10);

                    await this.prisma.user.create({
                        data: {
                            email: email,
                            password: hashedPassword,
                            role: role as UserRole,
                            isActive: true,
                            isEmailVerified: false,
                            profile: {
                                create: {
                                    firstName: userData.firstName,
                                    lastName: userData.lastName
                                }
                            }
                        }
                    });

                    // TODO: Send welcome email
                    if (sendWelcomeEmail) {
                        console.log(`📧 Would send welcome email to ${email} with temp password`);
                    }

                    createdCount++;
                    console.log(`✅ Created new user: ${email}`);
                }
            } catch (error: any) {
                errors.push({
                    row: userData.row,
                    email: userData.email,
                    reason: error.message || 'UNKNOWN_ERROR'
                });
                console.error(`❌ Error processing ${userData.email}:`, error);
            }
        }

        // Log kết quả
        console.log('📊 CSV Import Result:', {
            totalRows: usersData.length,
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount,
            failed: errors.length,
            errors: errors.length
        });

        return {
            success: true,
            message: 'Import completed',
            data: {
                totalRows: usersData.length,
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                failed: errors.length,
                errors
            },
            timestamp: new Date().toISOString()
        }
    }

    async importUsers(importData: ImportUsersDto): Promise<any> {
        const { users, sendWelcomeEmail = true, updateExisting = false } = importData;

        const startTime = Date.now();
        const results: ImportProcessingResult = {
            totalRows: users.length,
            created: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            errors: [] as ImportErrorDto[],
            successes: [] as ImportSuccessDto[],
            executionTimeMs: 0,
            successCount: 0
        };

        console.log('📥 Starting bulk import:', {
            count: users.length,
            sendWelcomeEmail,
            updateExisting
        });

        // Xử lý theo batch để tránh quá tải database
        const BATCH_SIZE = 100;
        const batches = Math.ceil(users.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, users.length);
            const batch = users.slice(start, end);

            console.log(`📦 Processing batch ${batchIndex + 1}/${batches} (${batch.length} users)`);

            for (let i = 0; i < batch.length; i++) {
                const userIndex = start + i;
                const userStr = batch[i];

                try {
                    // Parse và validate user data
                    const validationResult = await this.validateAndParseUser(
                        userStr,
                        userIndex,
                        updateExisting
                    );

                    if (!validationResult.valid) {
                        results.failed++;
                        results.errors.push({
                            row: userIndex + 1,
                            email: userStr.substring(0, 50) + '...',
                            reason: validationResult.error!.reason,
                            details: validationResult.error!.details,
                            field: validationResult.error!.field,
                            suggestion: validationResult.error!.suggestion
                        });
                        continue;
                    }

                    const userData = validationResult.data!;
                    const email = userData.email.toLowerCase();

                    // Kiểm tra user đã tồn tại
                    const existingUser = await this.prisma.user.findUnique({
                        where: { email },
                        include: { profile: true }
                    });

                    if (existingUser) {
                        // User đã tồn tại
                        if (updateExisting) {
                            const updateResult = await this.processExistingUser(
                                existingUser,
                                userData,
                                userIndex + 1
                            );

                            if (updateResult.updated) {
                                results.updated++;
                                results.successes.push({
                                    row: userIndex + 1,
                                    email: email,
                                    action: 'updated',
                                    changes: updateResult.changes
                                });
                            } else {
                                results.skipped++;
                                results.successes.push({
                                    row: userIndex + 1,
                                    email: email,
                                    action: 'skipped',
                                    changes: { reason: 'No changes needed' }
                                });
                            }
                        } else {
                            results.skipped++;
                            results.errors.push({
                                row: userIndex + 1,
                                email: email,
                                reason: 'USER_ALREADY_EXISTS',
                                details: 'User already exists and updateExisting is false',
                                suggestion: 'Enable updateExisting option to update existing users'
                            });
                        }
                    } else {
                        // Tạo user mới
                        const createResult = await this.createNewUser(
                            userData,
                            sendWelcomeEmail,
                            userIndex + 1
                        );

                        results.created++;
                        results.successes.push({
                            row: userIndex + 1,
                            email: email,
                            action: 'created',
                            temporaryPassword: createResult.temporaryPassword,
                            changes: { role: userData.role || 'USER' }
                        });
                    }

                } catch (error: any) {
                    results.failed++;
                    results.errors.push({
                        row: userIndex + 1,
                        email: userStr.substring(0, 50) + '...',
                        reason: 'PROCESSING_ERROR',
                        details: error.message,
                        suggestion: 'Check data format and try again'
                    });
                    console.error(`❌ Error at row ${userIndex + 1}:`, error);
                }
            }

            // Thêm delay nhỏ giữa các batch để tránh quá tải
            if (batchIndex < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        results.executionTimeMs = Date.now() - startTime;
        results.successCount = results.created + results.updated;

        console.log('📊 Import completed:', {
            total: results.totalRows,
            created: results.created,
            updated: results.updated,
            skipped: results.skipped,
            failed: results.failed,
            executionTime: `${results.executionTimeMs}ms`
        });

        return {
            success: true,
            message: 'Import completed successfully',
            data: results,
            timestamp: new Date().toISOString()
        };

    }

    // Hàm validate và parse user data
    private async validateAndParseUser(
        userStr: string,
        index: number,
        updateExisting: boolean
    ): Promise<{
        valid: boolean;
        data?: any;
        error?: {
            reason: string;
            details?: string;
            field?: string;
            suggestion?: string;
        }
    }> {
        try {
            const userData = this.parseUserString(userStr, index);

            // Validate email
            if (!userData.email) {
                return {
                    valid: false,
                    error: {
                        reason: 'MISSING_EMAIL',
                        details: 'Email field is required',
                        field: 'email',
                        suggestion: 'Add valid email address'
                    }
                };
            }

            if (!this.isValidEmail(userData.email)) {
                return {
                    valid: false,
                    error: {
                        reason: 'INVALID_EMAIL_FORMAT',
                        details: `"${userData.email}" is not a valid email format`,
                        field: 'email',
                        suggestion: 'Use format: user@example.com'
                    }
                };
            }


            // Validate role
            if (userData.role) {
                const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
                if (!validRoles.includes(userData.role.toUpperCase())) {
                    return {
                        valid: false,
                        error: {
                            reason: 'INVALID_ROLE',
                            details: `Role "${userData.role}" is not allowed`,
                            field: 'role',
                            suggestion: `Use one of: ${validRoles.join(', ')}`
                        }
                    };
                }
            }

            // Validate name length
            if (userData.firstName && userData.firstName.length > 100) {
                return {
                    valid: false,
                    error: {
                        reason: 'NAME_TOO_LONG',
                        details: 'First name exceeds 100 characters',
                        field: 'firstName',
                        suggestion: 'Shorten first name to 100 characters or less'
                    }
                };
            }

            if (userData.lastName && userData.lastName.length > 100) {
                return {
                    valid: false,
                    error: {
                        reason: 'NAME_TOO_LONG',
                        details: 'Last name exceeds 100 characters',
                        field: 'lastName',
                        suggestion: 'Shorten last name to 100 characters or less'
                    }
                };
            }

            return {
                valid: true,
                data: userData
            };

        } catch (error: any) {
            return {
                valid: false,
                error: {
                    reason: 'PARSE_ERROR',
                    details: error.message,
                    suggestion: 'Check JSON format: {"email":"user@example.com","firstName":"John",...}'
                }
            };
        }
    }

    // Hàm xử lý user đã tồn tại
    private async processExistingUser(
        existingUser: any,
        newData: any,
        row: number
    ): Promise<{ updated: boolean; changes?: Record<string, any> }> {
        const changes: Record<string, any> = {};

        // Kiểm tra role thay đổi
        if (newData.role && newData.role.toUpperCase() !== existingUser.role) {
            // Không cho phép downgrade SUPER_ADMIN
            if (existingUser.role === 'SUPER_ADMIN' && newData.role.toUpperCase() !== 'SUPER_ADMIN') {
                throw new Error('Cannot change SUPER_ADMIN role');
            }
            changes.role = newData.role.toUpperCase();
        }

        // Kiểm tra profile thay đổi
        const profileChanges: Record<string, any> = {};
        if (existingUser.profile) {
            if (newData.firstName && newData.firstName !== existingUser.profile.firstName) {
                profileChanges.firstName = newData.firstName;
            }
            if (newData.lastName && newData.lastName !== existingUser.profile.lastName) {
                profileChanges.lastName = newData.lastName;
            }
        } else if (newData.firstName || newData.lastName) {
            // Tạo profile mới
            profileChanges.firstName = newData.firstName || '';
            profileChanges.lastName = newData.lastName || '';
        }

        if (Object.keys(profileChanges).length > 0) {
            changes.profile = profileChanges;
        }

        // Nếu có thay đổi, update
        if (Object.keys(changes).length > 0) {
            await this.prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    ...(changes.role && { role: changes.role }),
                    ...(changes.profile && {
                        profile: {
                            upsert: {
                                update: changes.profile,
                                create: changes.profile
                            }
                        }
                    })
                }
            });

            return { updated: true, changes };
        }

        return { updated: false };
    }

    async exportUsers(exportData: ExportUsersDto): Promise<ExportResult> {
        const {
            format = 'csv',
            userIds = [],
            includeDeleted = false
        } = exportData;

        console.log('📤 Exporting users with:', {
            format,
            userIdsCount: userIds.length,
            includeDeleted
        });

        const where: any = {};

        if (userIds && userIds.length > 0) {
            const numericIds = userIds.map(id => {
                const num = parseInt(id);
                if (isNaN(num)) {
                    throw new Error(`Invalid user ID: ${id}`);
                }
                return num;
            });
            where.id = { in: numericIds };
        }

        if (!includeDeleted) {
            where.deletedAt = null;
        }

        const users = await this.prisma.user.findMany({
            where,
            include: {
                profile: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`📊 Found ${users.length} users for export`);

        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            lockedUntil: user.lockedUntil,
            deletedAt: user.deletedAt
        }));

        console.log(`📦 Generating ${format.toUpperCase()} export...`);

        if (format === 'csv') {
            return this.generateCSV(formattedUsers);
        }

        if (format === 'excel') {
            return await this.generateExcel(formattedUsers);
        }

        if (format === 'json') {
            return {
                success: true,
                message: 'Users exported successfully',
                data: formattedUsers,
                timestamp: new Date().toISOString()
            };
        }
        throw new Error(`Unsupported export format: ${format}`);
    }

    private generateCSV(users: any[]): CSVExportResult {
        const csv = Papa.unparse(users, {
            quotes: true,
            header: true
        });

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `users-export-${dateStr}.csv`;

        console.log('📁 CSV Filename:', filename);
        console.log('📁 Content-Disposition:', `attachment; filename="${filename}"`);

        return {
            success: true,
            message: 'CSV generated successfully',
            data: csv,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`
            },
            timestamp: new Date().toISOString()
        };
    }

    private async generateExcel(users: any[]): Promise<ExcelExportResult> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Define columns
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'First Name', key: 'firstName', width: 20 },
            { header: 'Last Name', key: 'lastName', width: 20 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Active', key: 'isActive', width: 10 },
            { header: 'Email Verified', key: 'isEmailVerified', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];

        // Add rows
        users.forEach(user => {
            worksheet.addRow(user);
        });

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        let nodeBuffer: Buffer;

        if (Buffer.isBuffer(buffer)) {
            nodeBuffer = buffer;
        } else if (buffer instanceof Uint8Array) {
            nodeBuffer = Buffer.from(buffer);
        } else {
            nodeBuffer = Buffer.from(buffer as any);
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `users-export-${dateStr}.xlsx`;

        return {
            success: true,
            message: 'Excel file generated successfully',
            data: nodeBuffer,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"` // Đã sửa
            },
            timestamp: new Date().toISOString()
        };
    }

    private needsUserUpdate(
        existingUser: any,
        newData: { role: UserRole, firstName: string, lastName: string }
    ): boolean {
        // Kiểm tra role thay đổi
        if (existingUser.role !== newData.role) {
            return true;
        }

        // Kiểm tra profile thay đổi
        if (existingUser.profile) {
            if (existingUser.profile.firstName !== newData.firstName) {
                return true;
            }
            if (existingUser.profile.lastName !== newData.lastName) {
                return true;
            }
        } else {
            // Nếu chưa có profile nhưng newData có firstName/lastName thì cần update
            if (newData.firstName || newData.lastName) {
                return true;
            }
        }

        return false;
    }

    private generateRandomPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }


    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private parseUserString(userStr: string, index: number): {
        email: string;
        role?: string;
        firstName?: string;
        lastName?: string;
    } {
        if (!userStr || typeof userStr !== 'string') {
            throw new Error(`Invalid user data at index ${index}: must be a string`);
        }

        const trimmedStr = userStr.trim();

        // Trường hợp 1: JSON string
        if (trimmedStr.startsWith('{') && trimmedStr.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmedStr);
                return {
                    email: parsed.email || '',
                    role: parsed.role,
                    firstName: parsed.firstName,
                    lastName: parsed.lastName
                };
            } catch (error) {
                throw new Error(`Invalid JSON at index ${index}: ${error.message}`);
            }
        }

        // Trường hợp 2: Chỉ có email (plain string)
        if (this.isValidEmail(trimmedStr)) {
            return { email: trimmedStr };
        }

        // Trường hợp 3: CSV-like format (email,firstName,lastName,role)
        const parts = trimmedStr.split(',');
        if (parts.length >= 1 && this.isValidEmail(parts[0].trim())) {
            return {
                email: parts[0].trim(),
                firstName: parts[1]?.trim(),
                lastName: parts[2]?.trim(),
                role: parts[3]?.trim()
            };
        }

        throw new Error(`Cannot parse user data at index ${index}`);
    }
    private async updateExistingUser(userId: number, userData: any): Promise<void> {
        const updateData: any = {};

        if (userData.role) {
            const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
            if (validRoles.includes(userData.role.toUpperCase())) {
                updateData.role = userData.role.toUpperCase() as UserRole;
            }
        }

        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
            await this.prisma.user.update({
                where: { id: userId },
                data: updateData
            });
        }

        // Update profile if name provided
        if (userData.firstName || userData.lastName) {
            await this.prisma.profile.upsert({
                where: { userId },
                update: {
                    ...(userData.firstName && { firstName: userData.firstName }),
                    ...(userData.lastName && { lastName: userData.lastName })
                },
                create: {
                    userId,
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || ''
                }
            });
        }
    }

    // Hàm tạo user mới
    private async createNewUser(
        userData: any,
        sendWelcomeEmail: boolean,
        row: number
    ): Promise<{ temporaryPassword?: string }> {
        const password = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        const role = userData.role ?
            (userData.role.toUpperCase() as UserRole) :
            UserRole.USER;

        await this.prisma.user.create({
            data: {
                email: userData.email.toLowerCase(),
                password: hashedPassword,
                role,
                isActive: true,
                isEmailVerified: false,
                profile: {
                    create: {
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || ''
                    }
                }
            }
        });

        // TODO: Gửi email chào mừng
        if (sendWelcomeEmail) {
            console.log(`📧 Would send welcome email to ${userData.email}`);
            return { temporaryPassword: password };
        }

        return {};
    }

}