import {
    Controller, Get, Post, Delete, Patch, Param, Query, Req, Body, UseGuards, UseInterceptors, UploadedFile, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from 'src/auth/guards/workspace.guard';
import { WorkspaceRoles } from 'src/auth/decorators/workspace-roles.decorator';
import { FileService } from '../services/file.service';
import type { Response } from 'express';
import * as path from 'path';

@Controller('workspace/:workspaceId/files')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class FileController {
    constructor(private readonly fileService: FileService) { }

    @Get()
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getFiles(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Query('type') type?: 'all' | 'images' | 'documents' | 'videos' | 'audio',
        @Query('sortBy') sortBy?: 'date' | 'name' | 'size' | 'downloads',
        @Query('search') search?: string,
        @Query('tag') tag?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const userId = req.user.id;
        return this.fileService.getWorkspaceFiles(workspaceId, userId, {
            type,
            sortBy,
            search,
            tag,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
        });
    }

    @Post('upload')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'MEMBER')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: {
            description?: string;
            tags?: string;
            isPublic?: string;
        },
    ) {
        const userId = req.user.id;

        // Parse tags từ string sang array
        let tags: string[] = [];
        if (body.tags) {
            tags = body.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
        }

        const metadata = {
            description: body.description,
            tags,
            isPublic: body.isPublic ? body.isPublic === 'true' : true,
        };

        return this.fileService.uploadFile(workspaceId, userId, file, metadata);
    }

    @Get(':fileId/download')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async downloadFile(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const userId = req.user.id;
        const result = await this.fileService.downloadFile(workspaceId, fileId, userId);

        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
            'Content-Length': result.fileBuffer.length,
        });

        return new StreamableFile(result.fileBuffer);
    }
    @Get(':fileId')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getFileInfo(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
    ) {
        const userId = req.user.id;
        return this.fileService.getFileInfo(workspaceId, fileId, userId);
    }

    @Delete(':fileId')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'MEMBER')
    async deleteFile(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
    ) {
        const userId = req.user.id;
        return this.fileService.deleteFile(workspaceId, fileId, userId);
    }

    @Patch(':fileId')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'MEMBER')
    async updateFileMetadata(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
        @Body() body: {
            description?: string;
            tags?: string[];
            isPublic?: boolean;
        },
    ) {
        const userId = req.user.id;
        return this.fileService.updateFileMetadata(workspaceId, fileId, userId, body);
    }

    @Get(':fileId/preview')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async previewFile(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
    ) {
        const userId = req.user.id;
        return this.fileService.previewFile(workspaceId, fileId, userId);
    }

    @Get(':fileId/embed')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async embedFile(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const userId = req.user.id;
        const result = await this.fileService.downloadFile(workspaceId, fileId, userId);

        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName)}"`,
            'Content-Length': result.fileBuffer.length,
            'X-Content-Type-Options': 'nosniff',
            'Accept-Ranges': 'bytes',
        });

        return new StreamableFile(result.fileBuffer);
    }

    @Get('tags/all')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async getWorkspaceTags(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
    ) {
        const userId = req.user.id;
        return this.fileService.getWorkspaceTags(workspaceId, userId);
    }

    @Get(':fileId/preview/embed')
    @WorkspaceRoles('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'MEMBER')
    async previewFileEmbed(
        @Req() req: any,
        @Param('workspaceId') workspaceId: string,
        @Param('fileId') fileId: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        const userId = req.user.id;
        const result = await this.fileService.downloadFile(workspaceId, fileId, userId);

        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName)}"`,
            'Content-Length': result.fileBuffer.length,
            'X-Content-Type-Options': 'nosniff',
        });

        return new StreamableFile(result.fileBuffer);
    }
}