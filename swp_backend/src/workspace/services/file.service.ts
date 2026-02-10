import {
    Injectable, Logger, NotFoundException, BadRequestException
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface WorkspaceFile {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
    uploadedBy: {
        id: number;
        name: string;
        email: string;
    };
    uploadedAt: string;
    downloads: number;
    description?: string;
    tags: string[];
    isPublic: boolean;
}

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);
    private readonly uploadDir = path.join(process.cwd(), 'uploads', 'workspaces');

    constructor(private prisma: DatabaseService) {
        this.ensureUploadDir();
    }

    private async ensureUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            this.logger.log(`Upload directory ensured: ${this.uploadDir}`);
        } catch (error) {
            this.logger.error(`Failed to create upload directory: ${error}`);
        }
    }

    async getWorkspaceFiles(
        workspaceId: string,
        userId: number,
        filters?: {
            type?: 'all' | 'images' | 'documents' | 'videos' | 'audio';
            sortBy?: 'date' | 'name' | 'size' | 'downloads';
            search?: string;
            tag?: string;
            page?: number;
            limit?: number;
        }
    ) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Build query conditions
            const where: any = {
                workspaceId,
            };

            // Apply type filter
            if (filters?.type && filters.type !== 'all') {
                switch (filters.type) {
                    case 'images':
                        where.type = { startsWith: 'image/' };
                        break;
                    case 'videos':
                        where.type = { startsWith: 'video/' };
                        break;
                    case 'audio':
                        where.type = { startsWith: 'audio/' };
                        break;
                    case 'documents':
                        where.OR = [
                            { type: { contains: 'pdf' } },
                            { type: { contains: 'word' } },
                            { type: { contains: 'excel' } },
                            { type: { contains: 'document' } },
                            { type: { contains: 'text/' } },
                            { type: { contains: 'msword' } },
                            { type: { contains: 'spreadsheet' } },
                            { type: { contains: 'presentation' } },
                        ];
                        break;
                }
            }

            // Apply search filter
            if (filters?.search) {
                where.OR = [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                    { tags: { has: filters.search.toLowerCase() } },
                ];
            }

            // Apply tag filter
            if (filters?.tag) {
                where.tags = { has: filters.tag.toLowerCase() };
            }

            // Apply visibility filter (chỉ hiển thị public hoặc file của chính user)
            if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
                where.OR = [
                    { isPublic: true },
                    { uploadedById: userId },
                ];
            }

            // Pagination
            const page = filters?.page || 1;
            const limit = filters?.limit || 20;
            const skip = (page - 1) * limit;

            // Build orderBy
            let orderBy: any = { uploadedAt: 'desc' };
            if (filters?.sortBy) {
                switch (filters.sortBy) {
                    case 'name':
                        orderBy = { name: 'asc' };
                        break;
                    case 'size':
                        orderBy = { size: 'desc' };
                        break;
                    case 'downloads':
                        orderBy = { downloads: 'desc' };
                        break;
                    case 'date':
                    default:
                        orderBy = { uploadedAt: 'desc' };
                }
            }

            // Query files
            const [files, total] = await Promise.all([
                this.prisma.workspaceFile.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include: {
                        uploadedBy: {
                            select: {
                                id: true,
                                email: true,
                                profile: true,
                            },
                        },
                    },
                }),
                this.prisma.workspaceFile.count({ where }),
            ]);

            // Format response
            const formattedFiles: WorkspaceFile[] = files.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type,
                url: `/api/workspace/${workspaceId}/files/${file.id}/download`,
                size: file.size,
                uploadedBy: {
                    id: file.uploadedBy.id,
                    name: file.uploadedBy.profile
                        ? `${file.uploadedBy.profile.firstName || ''} ${file.uploadedBy.profile.lastName || ''}`.trim()
                        : file.uploadedBy.email.split('@')[0],
                    email: file.uploadedBy.email,
                },
                uploadedAt: file.uploadedAt.toISOString(),
                downloads: file.downloads,
                description: file.description || undefined,
                tags: file.tags,
                isPublic: file.isPublic,
            }));

            const totalPages = Math.ceil(total / limit);

            // Calculate statistics
            const stats = await this.prisma.workspaceFile.aggregate({
                where: { workspaceId },
                _sum: { size: true, downloads: true },
                _count: { id: true },
            });

            return {
                success: true,
                data: {
                    files: formattedFiles,
                    total,
                    page,
                    limit,
                    totalPages,
                    hasMore: page < totalPages,
                },
                stats: {
                    totalFiles: stats._count.id,
                    totalSize: stats._sum.size || 0,
                    totalDownloads: stats._sum.downloads || 0,
                },
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to get workspace files:', error);
            throw error;
        }
    }

    async uploadFile(
        workspaceId: string,
        userId: number,
        file: Express.Multer.File,
        metadata: {
            description?: string;
            tags?: string[];
            isPublic?: boolean;
        }
    ) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Kiểm tra quyền upload
            if (membership.role === 'VIEWER') {
                throw new BadRequestException('Viewers cannot upload files');
            }

            // Validate file size (max 100MB)
            const maxSize = 100 * 1024 * 1024; // 100MB
            if (file.size > maxSize) {
                throw new BadRequestException('File size exceeds 100MB limit');
            }

            // Tạo unique filename
            const fileExtension = path.extname(file.originalname);
            const fileName = `${crypto.randomUUID()}${fileExtension}`;
            const filePath = path.join(this.uploadDir, workspaceId, fileName);

            // Đảm bảo thư mục workspace tồn tại
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            // Lưu file
            await fs.writeFile(filePath, file.buffer);

            // Lưu metadata vào database
            const savedFile = await this.prisma.workspaceFile.create({
                data: {
                    workspaceId,
                    name: file.originalname,
                    type: file.mimetype,
                    path: filePath,
                    size: file.size,
                    uploadedById: userId,
                    description: metadata.description,
                    tags: metadata.tags?.map(tag => tag.toLowerCase()) || [],
                    isPublic: metadata.isPublic !== undefined ? metadata.isPublic : true,
                    downloads: 0,
                },
                include: {
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            // Format response
            const formattedFile: WorkspaceFile = {
                id: savedFile.id,
                name: savedFile.name,
                type: savedFile.type,
                url: `/api/workspace/${workspaceId}/files/${savedFile.id}/download`,
                size: savedFile.size,
                uploadedBy: {
                    id: savedFile.uploadedBy.id,
                    name: savedFile.uploadedBy.profile
                        ? `${savedFile.uploadedBy.profile.firstName || ''} ${savedFile.uploadedBy.profile.lastName || ''}`.trim()
                        : savedFile.uploadedBy.email.split('@')[0],
                    email: savedFile.uploadedBy.email,
                },
                uploadedAt: savedFile.uploadedAt.toISOString(),
                downloads: savedFile.downloads,
                description: savedFile.description || undefined,
                tags: savedFile.tags,
                isPublic: savedFile.isPublic,
            };

            return {
                success: true,
                message: 'File uploaded successfully',
                data: formattedFile,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to upload file:', error);
            throw error;
        }
    }

    async downloadFile(workspaceId: string, fileId: string, userId: number) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy thông tin file
            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            // Kiểm tra quyền truy cập
            if (!file.isPublic && file.uploadedById !== userId &&
                membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
                throw new BadRequestException('You do not have permission to access this file');
            }

            // Cập nhật số lượt download
            await this.prisma.workspaceFile.update({
                where: { id: fileId },
                data: { downloads: { increment: 1 } },
            });

            // Đọc file từ disk
            const fileBuffer = await fs.readFile(file.path);

            return {
                fileBuffer,
                fileName: file.name,
                contentType: file.type,
            };

        } catch (error) {
            this.logger.error('Failed to download file:', error);
            throw error;
        }
    }

    async deleteFile(workspaceId: string, fileId: string, userId: number) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy thông tin file
            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            // Kiểm tra quyền xóa
            const canDelete =
                membership.role === 'OWNER' ||
                membership.role === 'ADMIN' ||
                file.uploadedById === userId;

            if (!canDelete) {
                throw new BadRequestException('You do not have permission to delete this file');
            }

            // Xóa file từ disk
            try {
                await fs.unlink(file.path);
            } catch (error) {
                this.logger.warn(`File not found on disk: ${file.path}`);
            }

            // Xóa record từ database
            await this.prisma.workspaceFile.delete({
                where: { id: fileId },
            });

            return {
                success: true,
                message: 'File deleted successfully',
                data: null,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to delete file:', error);
            throw error;
        }
    }

    async updateFileMetadata(
        workspaceId: string,
        fileId: string,
        userId: number,
        updates: {
            description?: string;
            tags?: string[];
            isPublic?: boolean;
        }
    ) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy thông tin file
            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            // Kiểm tra quyền cập nhật
            const canUpdate =
                membership.role === 'OWNER' ||
                membership.role === 'ADMIN' ||
                file.uploadedById === userId;

            if (!canUpdate) {
                throw new BadRequestException('You do not have permission to update this file');
            }

            // Cập nhật metadata
            const updatedFile = await this.prisma.workspaceFile.update({
                where: { id: fileId },
                data: {
                    ...(updates.description !== undefined && { description: updates.description }),
                    ...(updates.tags !== undefined && { tags: updates.tags.map(tag => tag.toLowerCase()) }),
                    ...(updates.isPublic !== undefined && { isPublic: updates.isPublic }),
                },
                include: {
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            // Format response
            const formattedFile: WorkspaceFile = {
                id: updatedFile.id,
                name: updatedFile.name,
                type: updatedFile.type,
                url: `/api/workspace/${workspaceId}/files/${updatedFile.id}/download`,
                size: updatedFile.size,
                uploadedBy: {
                    id: updatedFile.uploadedBy.id,
                    name: updatedFile.uploadedBy.profile
                        ? `${updatedFile.uploadedBy.profile.firstName || ''} ${updatedFile.uploadedBy.profile.lastName || ''}`.trim()
                        : updatedFile.uploadedBy.email.split('@')[0],
                    email: updatedFile.uploadedBy.email,
                },
                uploadedAt: updatedFile.uploadedAt.toISOString(),
                downloads: updatedFile.downloads,
                description: updatedFile.description || undefined,
                tags: updatedFile.tags,
                isPublic: updatedFile.isPublic,
            };

            return {
                success: true,
                message: 'File metadata updated successfully',
                data: formattedFile,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to update file metadata:', error);
            throw error;
        }
    }

    async getFileInfo(workspaceId: string, fileId: string, userId: number) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy thông tin file
            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
                include: {
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            // Kiểm tra quyền truy cập
            if (!file.isPublic && file.uploadedById !== userId &&
                membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
                throw new BadRequestException('You do not have permission to access this file');
            }

            // Format response
            const formattedFile: WorkspaceFile = {
                id: file.id,
                name: file.name,
                type: file.type,
                url: `/api/workspace/${workspaceId}/files/${file.id}/download`,
                size: file.size,
                uploadedBy: {
                    id: file.uploadedBy.id,
                    name: file.uploadedBy.profile
                        ? `${file.uploadedBy.profile.firstName || ''} ${file.uploadedBy.profile.lastName || ''}`.trim()
                        : file.uploadedBy.email.split('@')[0],
                    email: file.uploadedBy.email,
                },
                uploadedAt: file.uploadedAt.toISOString(),
                downloads: file.downloads,
                description: file.description || undefined,
                tags: file.tags,
                isPublic: file.isPublic,
            };

            return {
                success: true,
                data: formattedFile,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to get file info:', error);
            throw error;
        }
    }

    async previewFile(workspaceId: string, fileId: string, userId: number) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy thông tin file
            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            // Kiểm tra quyền xem
            if (!file.isPublic && file.uploadedById !== userId &&
                membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
                throw new BadRequestException('You do not have permission to preview this file');
            }

            // Kiểm tra file type có thể preview được không
            const previewableTypes = [
                // Images
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
                'image/webp', 'image/svg+xml', 'image/bmp',

                // PDF
                'application/pdf',

                // Text files
                'text/plain', 'text/html', 'text/css', 'text/javascript',
                'text/markdown', 'text/xml',

                // Code files
                'application/json', 'application/xml',

                // Office documents - ĐÃ THÊM
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/msword',
                'application/vnd.ms-excel',
                'application/vnd.ms-powerpoint',
            ];

            const isPreviewable = previewableTypes.some(type => file.type.includes(type) || file.type === type);

            if (!isPreviewable) {
                return {
                    success: true,
                    message: 'File cannot be previewed directly',
                    data: {
                        canPreview: false,
                        fileName: file.name,
                        fileType: file.type,
                        downloadUrl: `/api/workspace/${workspaceId}/files/${fileId}/download`,
                    },
                    timestamp: new Date().toISOString(),
                };
            }

            const fileBuffer = await fs.readFile(file.path);

            let previewData: any = null;

            if (file.type.includes('openxmlformats') || file.type.includes('msword') ||
                file.type.includes('ms-excel') || file.type.includes('ms-powerpoint')) {
                previewData = {
                    type: 'office',
                    embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(`${process.env.FRONTEND_URL}/api/workspace/${workspaceId}/files/${fileId}/download`)}`,
                    googleDocsUrl: `https://docs.google.com/viewer?url=${encodeURIComponent(`${process.env.FRONTEND_URL}/api/workspace/${workspaceId}/files/${fileId}/download`)}&embedded=true`,
                };
            } else if (file.type.startsWith('image/')) {
                const base64 = fileBuffer.toString('base64');
                previewData = {
                    type: 'image',
                    dataUrl: `data:${file.type};base64,${base64}`,
                };
            } else if (file.type === 'application/pdf') {
                previewData = {
                    type: 'pdf',
                    embedUrl: `/api/workspace/${workspaceId}/files/${fileId}/embed`,
                    downloadUrl: `/api/workspace/${workspaceId}/files/${fileId}/download`,
                };
            } else if (file.type.startsWith('text/')) {
                previewData = {
                    type: 'text',
                    content: fileBuffer.toString('utf-8'),
                    encoding: 'utf-8',
                };
            } else if (file.type === 'application/json') {
                try {
                    const content = fileBuffer.toString('utf-8');
                    const jsonData = JSON.parse(content);
                    previewData = {
                        type: 'json',
                        content: JSON.stringify(jsonData, null, 2),
                        formatted: true,
                    };
                } catch {
                    previewData = {
                        type: 'text',
                        content: fileBuffer.toString('utf-8'),
                    };
                }
            }

            return {
                success: true,
                message: 'File preview available',
                data: {
                    canPreview: true,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    previewData,
                    downloadUrl: `/api/workspace/${workspaceId}/files/${fileId}/download`,
                },
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to preview file:', error);
            throw error;
        }
    }



    // Serve file embed (cho PDF, images)
    async serveFileEmbed(workspaceId: string, fileId: string, userId: number) {
        try {
            // Kiểm tra membership (giống như preview)
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            const file = await this.prisma.workspaceFile.findUnique({
                where: { id: fileId },
            });

            if (!file || file.workspaceId !== workspaceId) {
                throw new NotFoundException('File not found');
            }

            if (!file.isPublic && file.uploadedById !== userId &&
                membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
                throw new BadRequestException('You do not have permission to access this file');
            }

            const fileBuffer = await fs.readFile(file.path);

            return {
                fileBuffer,
                fileName: file.name,
                contentType: file.type,
            };

        } catch (error) {
            this.logger.error('Failed to serve file embed:', error);
            throw error;
        }
    }

    async getWorkspaceTags(workspaceId: string, userId: number) {
        try {
            // Kiểm tra user có trong workspace không
            const membership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Lấy tất cả tags từ các file trong workspace
            const files = await this.prisma.workspaceFile.findMany({
                where: { workspaceId },
                select: { tags: true },
            });

            // Tạo set để loại bỏ duplicates
            const tagSet = new Set<string>();
            files.forEach(file => {
                file.tags.forEach(tag => tagSet.add(tag));
            });

            const tags = Array.from(tagSet).sort();

            return {
                success: true,
                data: {
                    tags,
                    count: tags.length,
                },
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to get workspace tags:', error);
            throw error;
        }
    }
}