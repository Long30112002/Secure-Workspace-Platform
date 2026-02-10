import { Module } from '@nestjs/common';
import { QueryParserModule } from 'src/common/parsers/query-parser.module';
import { UserManagementController } from './controller/user-management.controller';
import { UserManagementService } from './service/user-management.service';
import { ImportExportService } from './service/user-import-export.service';
import { QueryParserService } from 'src/common/parsers/query-parser.service';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseService } from 'src/database/database.service';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { AuditLogService } from './service/audit-log.service';
import { AuditLogController } from './controller/audit-log.controller';
import { AuditLogInterceptor } from 'src/common/interceptors/audit-log.interceptor';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        QueryParserModule,
        MulterModule.register({
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
            },
        }),
    ],
    controllers: [
        UserManagementController,
        AuditLogController,
    ],
    providers: [
        UserManagementService,
        ImportExportService,
        QueryParserService,
        DatabaseService,
        AuditLogService, 
        AuditLogInterceptor,
    ],
    exports: [
        UserManagementService,
        ImportExportService,
        AuditLogService,
    ],
})
export class UserManagementModule { }
