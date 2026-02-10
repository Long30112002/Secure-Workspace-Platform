import { Module } from '@nestjs/common';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceManagementController } from './controllers/workspace-management.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PostController } from './controllers/post.controller';
import { PostService } from './services/post.service';
import { NotificationModule } from 'src/notification/notification.module';
import { WorkspaceDashboardController } from './controllers/workspace-dashboard.controller';
import { WorkspaceGateway } from './real-time/workspace.gateway';
import { FileController } from './controllers/file.controller';
import { FileService } from './services/file.service';

@Module({
    imports: [
        DatabaseModule,
        AuthModule, 
        NotificationModule,
    ],
    controllers: [
        WorkspaceManagementController,
        WorkspaceDashboardController,
        PostController,
        FileController,
    ],
    providers: [
        WorkspaceService,
        WorkspaceGateway,
        PostService,
        FileService,
    ],
    exports: [
        WorkspaceService,
        WorkspaceGateway,
        PostService,
        FileService,
    ],
})
export class WorkspaceModule { }