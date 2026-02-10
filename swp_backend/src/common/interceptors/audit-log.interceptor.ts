import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from 'src/admin/user-management/service/audit-log.service';
import { AuditAction, AuditEntityType } from 'src/admin/user-management/dto/audit-log.dto';

const requestLogMap = new Map<string, boolean>();

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    constructor(private auditLogService: AuditLogService) { }
    private readonly loggedRequests = new Set<string>();

    private shouldSkipLogging(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        // Debug log
        console.log(`🔍 Audit check: ${request.method} ${request.path}`, {
            hasUser: !!request.user,
            userEmail: request.user?.email,
            requestId: request.id || 'no-id'
        });

        // Skip if no user
        if (!request.user) {
            return true;
        }

        // Skip OPTIONS requests
        if (request.method === 'OPTIONS') {
            return true;
        }

        // Skip static files and health checks
        const path = request.path;
        if (path.includes('.') ||
            path.includes('health') ||
            path.includes('favicon')) {
            return true;
        }

        // Check if already logged in this request
        const requestKey = this.generateRequestKey(context);
        if (requestLogMap.has(requestKey)) {
            return true;
        }

        // Mark as logged
        requestLogMap.set(requestKey, true);

        // Cleanup after 2 seconds
        setTimeout(() => {
            requestLogMap.delete(requestKey);
        }, 2000);

        return false;
    }

    private getUserIp(request: any): string {
        return (
            request.headers['x-forwarded-for'] ||
            request.headers['x-real-ip'] ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.ip ||
            'unknown'
        );
    }

    private generateRequestKey(request: any): string {
        const requestId = request.id || Date.now();
        const userId = request.user?.id || 'anonymous';

        // Tạo key unique cho mỗi request
        return `${userId}:${request.method}:${request.path}:${requestId}`;
    }

    private getUserAgent(request: any): string {
        return request.headers['user-agent'] || 'unknown';
    }

    private mapRouteToAction(context: ExecutionContext): {
        action: AuditAction;
        entityType: AuditEntityType;
    } | null {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const path = request.path;

        // Map routes to audit actions
        const routeMap: Record<string, { action: AuditAction; entityType: AuditEntityType }> = {
            // User Management
            'POST:/api/user-management/create': {
                action: AuditAction.CREATE_USER,
                entityType: AuditEntityType.USER
            },
            'PUT:/api/user-management/': {
                action: AuditAction.UPDATE_USER,
                entityType: AuditEntityType.USER
            },
            'DELETE:/api/user-management/': {
                action: AuditAction.DELETE_USER,
                entityType: AuditEntityType.USER
            },
            'PATCH:/api/user-management/.*/restore': {
                action: AuditAction.RESTORE_USER,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/bulk-delete': {
                action: AuditAction.BULK_DELETE_USERS,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/bulk-update': {
                action: AuditAction.BULK_UPDATE_USERS,
                entityType: AuditEntityType.USER
            },
            'PATCH:/api/user-management/.*/unlock': {
                action: AuditAction.UNLOCK_USER,
                entityType: AuditEntityType.USER
            },
            'PATCH:/api/user-management/.*/verify-email': {
                action: AuditAction.VERIFY_EMAIL,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/import': {
                action: AuditAction.IMPORT_USERS,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/import/csv': {
                action: AuditAction.IMPORT_USERS,
                entityType: AuditEntityType.USER
            },
            'GET:/api/user-management/export': {
                action: AuditAction.EXPORT_USERS,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/export/': {
                action: AuditAction.EXPORT_USERS,
                entityType: AuditEntityType.USER
            },
            'POST:/api/user-management/.*/reset-password': {
                action: AuditAction.RESET_PASSWORD,
                entityType: AuditEntityType.USER
            },
        };

        const routeKey = `${method}:${path}`;

        for (const [pattern, mapping] of Object.entries(routeMap)) {
            const [patternMethod, patternPath] = pattern.split(':');

            if (method === patternMethod && path.match(new RegExp(patternPath))) {
                return mapping;
            }
        }

        return null;
    }

    private extractEntityId(request: any, response: any): number | undefined {
        if (request.params?.id) {
            const id = parseInt(request.params.id);
            if (!isNaN(id)) return id;
        }

        // Try from request body
        if (request.body?.userId) {
            const id = parseInt(request.body.userId);
            if (!isNaN(id)) return id;
        }

        // Try from response
        if (response?.data?.user?.id) {
            const id = parseInt(response.data.user.id);
            if (!isNaN(id)) return id;
        }

        if (response?.data?.id) {
            const id = parseInt(response.data.id);
            if (!isNaN(id)) return id;
        }

        return undefined;
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Check if we should skip logging for this request
        if (this.shouldSkipLogging(context)) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        const auditMapping = this.mapRouteToAction(context);
        if (!auditMapping) {
            console.log(`   ↳ Skipped: No audit mapping for ${request.method} ${request.path}`);
            return next.handle();
        }

        const startTime = Date.now();

        return next.handle().pipe(
            tap(async (response) => {
                try {
                    const duration = Date.now() - startTime;

                    // Only log successful operations
                    if (response && (response.success === true || response.success === undefined)) {
                        console.log(`✅ Will create audit log: ${auditMapping.action}`, {
                            userId: user.id,
                            email: user.email,
                            duration: `${duration}ms`,
                            entityId: this.extractEntityId(request, response)
                        });

                        const details = this.formatDetailsForDisplay(request.body, response, duration);

                        const entityId = this.extractEntityId(request, response);

                        await this.auditLogService.createAuditLog(user.id, {
                            action: auditMapping.action,
                            entityType: auditMapping.entityType,
                            entityId: entityId,
                            details: JSON.stringify(details),
                            ipAddress: this.getUserIp(request),
                            userAgent: this.getUserAgent(request),
                        });

                        console.log(`📝 Audit logged: ${auditMapping.action} by ${user.email}`);
                    }

                } catch (error) {
                    console.error('Audit logging failed:', error);
                }
            })
        );
    }

    // Thay đổi hàm format details để thân thiện hơn
    private formatDetailsForDisplay(requestBody: any, response: any, duration: number): any {
        const sanitizedRequest = this.sanitizeRequestBody(requestBody);
        const sanitizedResponse = this.sanitizeResponse(response);

        return {
            summary: this.generateSummary(sanitizedRequest, sanitizedResponse),
            request: this.formatRequestForDisplay(sanitizedRequest),
            response: this.formatResponseForDisplay(sanitizedResponse),
            metadata: {
                duration: `${duration}ms`,
                timestamp: new Date().toLocaleString('vi-VN'),
                itemsProcessed: this.countItemsProcessed(sanitizedRequest, sanitizedResponse),
            },
        };
    }

    private generateSummary(request: any, response: any): string {
        if (request.users && Array.isArray(request.users)) {
            const count = request.users.length;
            return `Imported ${count} user${count !== 1 ? 's' : ''}`;
        }

        if (request.userIds && Array.isArray(request.userIds)) {
            const count = request.userIds.length;
            // Check action type from response if available
            const responseMessage = response?.message || '';
            const isDelete = responseMessage.includes('delete') ||
                responseMessage.includes('Delete') ||
                (response?.data?.deletedCount !== undefined);

            if (isDelete) {
                return `Deleted ${count} user${count !== 1 ? 's' : ''}`;
            }
            return `Processed ${count} user${count !== 1 ? 's' : ''}`;
        }

        if (request.email && typeof request.email === 'string') {
            // Check action type
            const responseMessage = response?.message || '';
            const isCreate = responseMessage.includes('create') ||
                responseMessage.includes('Create');
            const isUpdate = responseMessage.includes('update') ||
                responseMessage.includes('Update');
            const isDelete = responseMessage.includes('delete') ||
                responseMessage.includes('Delete');

            if (isCreate) return `Created user: ${request.email}`;
            if (isUpdate) return `Updated user: ${request.email}`;
            if (isDelete) return `Deleted user: ${request.email}`;
            return `User: ${request.email}`;
        }

        // Check response message for clues
        const responseMessage = response?.message || '';
        if (responseMessage) {
            const msg = responseMessage.toLowerCase();
            if (msg.includes('import')) return 'Imported users';
            if (msg.includes('export')) return 'Exported users';
            if (msg.includes('restore')) return 'Restored user';
            if (msg.includes('unlock')) return 'Unlocked user';
            if (msg.includes('verify')) return 'Verified email';
            if (msg.includes('reset')) return 'Reset password';
        }

        return 'Action performed';
    }

    private formatRequestForDisplay(request: any): any {
        if (!request || Object.keys(request).length === 0) {
            return { note: 'No request data' };
        }

        const formatted: any = {};

        // Email
        if (request.email) {
            formatted.email = request.email;
        }

        // Role
        if (request.role) {
            formatted.role = request.role;
        }

        // Status
        if (request.isActive !== undefined) {
            formatted.status = request.isActive ? 'Active' : 'Inactive';
        }

        // Name
        if (request.firstName || request.lastName) {
            formatted.name = `${request.firstName || ''} ${request.lastName || ''}`.trim();
        }

        // Bulk operations
        if (request.userIds && Array.isArray(request.userIds)) {
            formatted.usersCount = request.userIds.length;
            if (request.userIds.length <= 5) {
                formatted.userIds = request.userIds;
            } else {
                formatted.userIds = request.userIds.slice(0, 3);
                formatted.note = `...and ${request.userIds.length - 3} more`;
            }
        }

        // Import
        if (request.users && Array.isArray(request.users)) {
            formatted.importCount = request.users.length;
            const emails: string[] = []; // THÊM TYPE Ở ĐÂY

            for (const user of request.users.slice(0, 3)) {
                if (typeof user === 'string') {
                    try {
                        const parsed = JSON.parse(user);
                        if (parsed.email && typeof parsed.email === 'string') {
                            emails.push(parsed.email);
                        }
                    } catch {
                        // Not JSON, skip
                    }
                } else if (user && typeof user === 'object' && user.email && typeof user.email === 'string') {
                    emails.push(user.email);
                }
            }

            if (emails.length > 0) {
                formatted.sampleEmails = emails;
            }
        }

        // Options
        if (request.sendWelcomeEmail !== undefined) {
            formatted.sendWelcomeEmail = request.sendWelcomeEmail;
        }

        if (request.updateExisting !== undefined) {
            formatted.updateExisting = request.updateExisting;
        }

        return formatted;
    }

    private formatResponseForDisplay(response: any): any {
        if (!response) {
            return { note: 'No response data' };
        }

        const formatted: any = {};

        // Success message
        if (response.message && typeof response.message === 'string') {
            formatted.message = response.message;
        }

        // Data statistics
        if (response.data && typeof response.data === 'object') {
            // User data
            if (response.data.user && typeof response.data.user === 'object') {
                formatted.user = {
                    id: response.data.user.id?.toString() || '',
                    email: response.data.user.email || '',
                    role: response.data.user.role || '',
                    status: response.data.user.isActive ? 'Active' : 'Inactive',
                };
            }

            // Import/export statistics
            if (response.data.totalRows !== undefined) {
                formatted.statistics = {
                    total: Number(response.data.totalRows) || 0,
                    success: Number(response.data.successCount || response.data.created || 0),
                    failed: Number(response.data.failed || 0),
                    updated: Number(response.data.updated || 0),
                    skipped: Number(response.data.skipped || 0),
                };
            }

            // Bulk operations
            if (response.data.updatedCount !== undefined) {
                formatted.updatedCount = Number(response.data.updatedCount);
            }

            if (response.data.deletedCount !== undefined) {
                formatted.deletedCount = Number(response.data.deletedCount);
            }

            // Temporary password (masked)
            if (response.data.temporaryPassword) {
                formatted.temporaryPassword = '****** (sent to user)';
            }
        }

        return formatted;
    }

    private countItemsProcessed(request: any, response: any): number {
        if (request.users && Array.isArray(request.users)) {
            return request.users.length;
        }

        if (request.userIds && Array.isArray(request.userIds)) {
            return request.userIds.length;
        }

        if (response?.data?.totalRows !== undefined) {
            return Number(response.data.totalRows) || 0;
        }

        return 1; // Single item by default
    }

    private sanitizeRequestBody(body: any): any {
        if (!body) return {};

        // Remove sensitive information
        const sanitized = { ...body };
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.refreshToken;
        delete sanitized.passwordResetToken;
        delete sanitized.emailVerificationToken;

        // Nếu có users array, sanitize từng user
        if (sanitized.users && Array.isArray(sanitized.users)) {
            sanitized.users = sanitized.users.map((user: any) => {
                if (typeof user === 'string') {
                    try {
                        const userObj = JSON.parse(user);
                        delete userObj.password;
                        delete userObj.token;
                        return JSON.stringify(userObj);
                    } catch {
                        return user;
                    }
                } else if (user && typeof user === 'object') {
                    const userCopy = { ...user };
                    delete userCopy.password;
                    delete userCopy.token;
                    return userCopy;
                }
                return user;
            });
        }

        return sanitized;
    }

    private sanitizeResponse(response: any): any {
        if (!response) return null;

        const sanitized = { ...response };

        // Sanitize user data
        if (sanitized.data?.user && typeof sanitized.data.user === 'object') {
            const user = sanitized.data.user;
            if (user.password) delete user.password;
            if (user.refreshToken) delete user.refreshToken;
        }

        // Sanitize temporary password
        if (sanitized.data?.temporaryPassword) {
            sanitized.data.temporaryPassword = '[REDACTED]';
        }

        // Sanitize trong statistics
        if (sanitized.data?.successes && Array.isArray(sanitized.data.successes)) {
            sanitized.data.successes = sanitized.data.successes.map((success: any) => {
                if (success && typeof success === 'object' && success.temporaryPassword) {
                    return { ...success, temporaryPassword: '[REDACTED]' };
                }
                return success;
            });
        }

        return sanitized;
    }

}