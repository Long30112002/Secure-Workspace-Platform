import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from 'src/auth/guards/workspace.guard';
import { WorkspaceRoles } from 'src/auth/decorators/workspace-roles.decorator';
import { WorkspaceService } from '../services/workspace.service';

@Controller('workspace/:workspaceId')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class WorkspaceDashboardController {
    constructor(private readonly workspaceService: WorkspaceService) { }

    @Get('dashboard')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getWorkspaceDashboard(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
    ) {
        const userId = req.user.id;
        return this.workspaceService.getWorkspaceDashboard(workspaceId, userId);
    }

    @Get('members/active')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getActiveMembers(
        @Param('workspaceId') workspaceId: string,
    ) {
        return this.workspaceService.getActiveMembers(workspaceId);
    }
}