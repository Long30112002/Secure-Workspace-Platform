import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { WorkspaceGuard } from "src/auth/guards/workspace.guard";
import { WorkspaceService } from "../services/workspace.service";
import { WorkspaceRoles } from "src/auth/decorators/workspace-roles.decorator";
import { PostService } from "../services/post.service";

@Controller('workspace/:workspaceId/posts')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class PostController {
    constructor(private readonly postservice: PostService) { }
    
    @Get()
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getWorkspacePosts(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Query('limit') limit?: string,
        @Query('page') page?: string,
    ) {
        const userId = req.user.id;
        return this.postservice.getWorkspacePosts(workspaceId, userId, {
            limit: limit ? parseInt(limit) : 20,
            page: page ? parseInt(page) : 1,
        });
    }

    @Post()
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'MEMBER')
    async createPost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Body() body: { title: string; content: string },
    ) {
        const userId = req.user.id;
        return this.postservice.createWorkspacePost(
            workspaceId,
            userId,
            body.title,
            body.content,
        );
    }

    @Get(':postId')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getPost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
    ) {
        const userId = req.user.id;
        return this.postservice.getWorkspacePost(workspaceId, postId, userId);
    }

    @Post(':postId/toggle-like')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async toggleLikePost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
    ) {
        const userId = req.user.id;
        return this.postservice.toggleLikePost(workspaceId, postId, userId);
    }


    @Post(':postId/comment')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async addComment(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
        @Body() body: { content: string },
    ) {
        const userId = req.user.id;
        return this.postservice.addComment(workspaceId, postId, userId, body.content);
    }

    @Delete(':postId')
    @WorkspaceRoles('OWNER', 'ADMIN')
    async deletePost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
    ) {
        const userId = req.user.id;
        return this.postservice.deletePost(workspaceId, postId, userId);
    }

    @Patch(':postId')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'MEMBER')
    async updatePost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
        @Body() body: { title?: string; content?: string },
    ) {
        const userId = req.user.id;
        return this.postservice.updatePost(workspaceId, postId, userId, body);
    }

    @Post(':postId/pin')
    @WorkspaceRoles('OWNER', 'ADMIN')
    async pinPost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
    ) {
        const userId = req.user.id;
        return this.postservice.togglePinPost(workspaceId, postId, userId);
    }

    @Delete(':postId/pin')
    @WorkspaceRoles('OWNER', 'ADMIN')
    async unpinPost(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('postId') postId: string,
    ) {
        const userId = req.user.id;
        return this.postservice.togglePinPost(workspaceId, postId, userId);
    }
}