import { ValidateResetTokenDto } from '../../auth/dto/password-reset.dto';
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceGuard } from 'src/auth/guards/workspace.guard';
import { WorkspaceRoles } from 'src/auth/decorators/workspace-roles.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { BulkInviteDto, BulkInviteServiceDto } from '../dto/bulk-invite.dto';

@Controller('workspace')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class WorkspaceManagementController {
    constructor(
        private readonly workspaceService: WorkspaceService,
    ) { }
    // Lấy tất cả workspace user tham gia
    @Get('my-workspaces')
    async getMyWorkspaces(@Req() req: any) {
        const userId = req.user.id;
        return this.workspaceService.getUserWorkspaces(userId);
    }

    // Tạo workspace mới
    @Post('create')
    async createWorkspace(
        @Req() req: any,
        @Body() body: { name: string; subdomain: string }
    ) {
        const userId = req.user.id;
        return this.workspaceService.createWorkspace(userId, body.name, body.subdomain);
    }

    // Chuyển đổi workspace (set current workspace)
    @Post('switch')
    async switchWorkspace(
        @Req() req: any,
        @Body() body: { workspaceId: string }
    ) {
        const userId = req.user.id;
        return this.workspaceService.switchWorkspace(userId, body.workspaceId);
    }

    // Lấy tất cả members trong workspace
    @Get('members')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getWorkspaceMembers(
        @Req() req: any,
        @Query('workspaceId') workspaceId: string
    ) {
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.getWorkspaceMembers(finalWorkspaceId);
    }

    // Lấy thông tin chi tiết của một member
    @Get('members/:userId')
    async getWorkspaceMember(
        @Req() req: any,
        @Param('userId') userId: string,
        @Query('workspaceId') workspaceId: string
    ) {
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        const userIdNumber = parseInt(userId);
        if (isNaN(userIdNumber)) {
            throw new BadRequestException('Invalid user ID');
        }

        return this.workspaceService.getWorkspaceMember(finalWorkspaceId, userIdNumber);
    }

    // Xóa member khỏi workspace
    @Delete('members/:userId')
    @WorkspaceRoles('OWNER', 'ADMIN')
    async removeMemberFromWorkspace(
        @Req() req: any,
        @Param('userId') userId: string,
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        const userIdToRemove = parseInt(userId);
        if (isNaN(userIdToRemove)) {
            throw new BadRequestException('Invalid user ID');
        }

        return this.workspaceService.removeMemberFromWorkspace(
            finalWorkspaceId,
            userIdToRemove,
            currentUserId
        );
    }

    // Cập nhật role của member trong workspace
    @Patch('members/:userId/role')
    @WorkspaceRoles('OWNER')
    async updateMemberRole(
        @Req() req: any,
        @Param('userId') userId: string,
        @Body() body: { role: string },
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        const targetUserId = parseInt(userId);
        if (isNaN(targetUserId)) {
            throw new BadRequestException('Invalid user ID');
        }

        if (!body.role) {
            throw new BadRequestException('Role is required');
        }

        return this.workspaceService.updateMemberRole(
            finalWorkspaceId,
            targetUserId,
            body.role,
            currentUserId
        );
    }

    // Lấy thông tin chi tiết workspace
    @Get('info')
    async getWorkspaceInfo(
        @Req() req: any,
        @Query('workspaceId') workspaceId: string
    ) {
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.getWorkspaceInfo(finalWorkspaceId);
    }

    // Cập nhật thông tin workspace
    @Patch('info')
    async updateWorkspaceInfo(
        @Req() req: any,
        @Body() body: {
            name?: string;
            settings?: any;
            workspaceId?: string
        },
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = body.workspaceId || workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.updateWorkspaceInfo(
            finalWorkspaceId,
            body,
            currentUserId
        );
    }

    // Rời khỏi workspace (cho member tự rời)
    @Delete('leave')
    async leaveWorkspace(
        @Req() req: any,
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.leaveWorkspace(
            finalWorkspaceId,
            currentUserId
        );
    }

    // Kiểm tra quyền của user trong workspace
    @Get('permissions')
    async checkPermissions(
        @Req() req: any,
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.checkPermissions(
            finalWorkspaceId,
            currentUserId
        );
    }

    // Lấy thống kê workspace
    @Get('stats')
    async getWorkspaceStats(
        @Req() req: any,
        @Query('workspaceId') workspaceId: string
    ) {
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        return this.workspaceService.getWorkspaceStats(finalWorkspaceId);
    }

    // Thêm user vào workspace (invite)
    @Post('members')
    async addMemberToWorkspace(
        @Req() req: any,
        @Body() body:
            {
                email: string;
                role?: string;
                workspaceId?: string
                sendInvitation?: boolean;
            }
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = body.workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        if (!body.email) {
            throw new BadRequestException('Email is required');
        }

        const sendInvitation = body.sendInvitation !== undefined ? body.sendInvitation : true;

        return this.workspaceService.addMemberToWorkspace(
            finalWorkspaceId,
            body.email,
            body.role || 'MEMBER',
            currentUserId,
            sendInvitation
        );
    }

    // Gửi invitation
    @Post('invite')
    async inviteToWorkspace(
        @Req() req: any,
        @Body() body: {
            email: string;
            role?: string;
            workspaceId?: string;
        }
    ) {
        const currentUserId = req.user.id;
        const workspaceId = body.workspaceId || req.workspaceId;

        if (!workspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        if (!body.email) {
            throw new BadRequestException('Email is required');
        }

        // Lấy thông tin workspace
        const workspace = await this.workspaceService.getWorkspaceInfo(workspaceId);
        if (!workspace.success) {
            throw new BadRequestException('Workspace not found');
        }

        return this.workspaceService.inviteToWorkspace(
            workspaceId,
            body.email,
            body.role || 'MEMBER',
            currentUserId,
            workspace.data.name,
            workspace.data.subdomain
        );
    }

    @Get('invite/validate')
    async validateInvitationToken(
        @Query('token') token: string
    ) {
        if (!token) {
            throw new BadRequestException('Token is required');
        }
        return this.workspaceService.validateInvitationToken(token);
    }

    // Accept invitation (không cần auth)
    @Post('invite/accept')
    async acceptInvitation(
        @Req() req: any,
        @Body() body: { token: string }
    ) {
        const userId = req.user?.id;
        if (!userId) {
            throw new BadRequestException('Authentication required');
        }

        if (!body.token) {
            throw new BadRequestException('Token is required');
        }

        return this.workspaceService.acceptInvitation(body.token, userId);
    }

    // Decline invitation
    @Post('invite/decline')
    async declineInvitation(
        @Req() req: any,
        @Body() body: { token: string }
    ) {
        const userId = req.user?.id;
        if (!userId) {
            throw new BadRequestException('Authentication required');
        }

        if (!body.token) {
            throw new BadRequestException('Token is required');
        }

        return this.workspaceService.declineInvitation(body.token, userId);
    }

    // Lấy danh sách invitations
    @Get('invitations')
    async getInvitations(
        @Query('workspaceId') workspaceId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'ALL'
    ) {
        return this.workspaceService.getInvitations(workspaceId, {
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            status: status || 'PENDING', 
        });
    }

    @Get('invitations/pending')
    @SkipThrottle()
    async getPendingInvitationsForCurrentUser(@Req() req: any) {
        const userEmail = req.user.email;

        // Sử dụng method getInvitations đã có
        // Nhưng cần filter theo email của user
        const invitations = await this.workspaceService.getInvitationsForUser(userEmail);

        return invitations;
    }

    // Hủy invitation
    @Delete('invitations/:invitationId')
    async cancelInvitation(
        @Req() req: any,
        @Param('invitationId') invitationId: string
    ) {
        const currentUserId = req.user.id;
        return this.workspaceService.cancelInvitation(invitationId, currentUserId);
    }

    @Post('bulk-invite')
    @WorkspaceRoles('OWNER', 'ADMIN')
    async bulkInviteMembers(
        @Req() req: any,
        @Body() dto: BulkInviteDto,
        @Query('workspaceId') workspaceId: string
    ) {
        const currentUserId = req.user.id;
        const finalWorkspaceId = workspaceId || req.workspaceId;

        if (!finalWorkspaceId) {
            throw new BadRequestException('Workspace ID is required');
        }

        const membership = await this.workspaceService.checkPermissions(finalWorkspaceId, currentUserId);
        if (!membership.data.canManageMembers) {
            throw new BadRequestException('You do not have permission to bulk invite members');
        }

        const serviceDto: BulkInviteServiceDto = {
            ...dto,
            workspaceId: finalWorkspaceId,
            invitedByUserId: currentUserId
        };

        return this.workspaceService.bulkInviteMembers(serviceDto);
    }
}