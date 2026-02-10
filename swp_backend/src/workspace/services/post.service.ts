import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { NotificationService } from "src/notification/service/notification.service";

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name);
    constructor(
        private prisma: DatabaseService,
        private notificationService: NotificationService,

    ) {
    }

    async getWorkspacePost(workspaceId: string, postId: string, userId: number) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            const post = await this.prisma.post.findFirst({
                where: {
                    id: postId,
                    workspaceId,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                    attachments: true,
                    likes: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: true,
                                },
                            },
                        },
                    },
                    comments: {
                        include: {
                            author: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'asc' },
                    },
                    _count: {
                        select: {
                            likes: true,
                            comments: true,
                        },
                    },
                },
            });

            if (!post) {
                throw new NotFoundException('Post not found');
            }

            // Kiểm tra xem user đã like bài viết chưa
            const userLike = await this.prisma.postLike.findFirst({
                where: {
                    postId,
                    userId,
                },
            });

            const formattedPost = {
                id: post.id,
                title: post.title,
                content: post.content,
                author: {
                    id: post.author.id,
                    name: post.author.profile
                        ? `${post.author.profile.firstName || ''} ${post.author.profile.lastName || ''}`.trim()
                        : post.author.email.split('@')[0],
                    email: post.author.email,
                    avatar: post.author.profile?.avatarUrl,
                },
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString(),
                likes: post._count.likes,
                comments: post._count.comments,
                attachments: post.attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    url: att.url,
                    size: att.size,
                })),
                isPinned: post.isPinned,
                hasLiked: !!userLike,
                likedBy: post.likes.map(like => ({
                    id: like.user.id,
                    name: like.user.profile
                        ? `${like.user.profile.firstName || ''} ${like.user.profile.lastName || ''}`.trim()
                        : like.user.email.split('@')[0],
                    email: like.user.email,
                })),
                commentsList: post.comments.map(comment => ({
                    id: comment.id,
                    content: comment.content,
                    author: {
                        id: comment.author.id,
                        name: comment.author.profile
                            ? `${comment.author.profile.firstName || ''} ${comment.author.profile.lastName || ''}`.trim()
                            : comment.author.email.split('@')[0],
                        email: comment.author.email,
                    },
                    createdAt: comment.createdAt.toISOString(),
                    updatedAt: comment.updatedAt.toISOString(),
                })),
            };

            return {
                success: true,
                data: formattedPost,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to get workspace post:', error);
            throw error;
        }
    }

    async getWorkspacePosts(workspaceId: string, userId: number, options: { limit?: number; page?: number } = {}) {
        try {
            const { limit = 20, page = 1 } = options;
            const skip = (page - 1) * limit;

            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            const posts = await this.prisma.post.findMany({
                where: { workspaceId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                    attachments: true,
                    _count: {
                        select: {
                            likes: true,
                            comments: true,
                        },
                    },
                },
            });

            const formattedPosts = posts.map(post => ({
                id: post.id,
                title: post.title,
                content: post.content,
                author: {
                    id: post.author.id,
                    name: post.author.profile
                        ? `${post.author.profile.firstName || ''} ${post.author.profile.lastName || ''}`.trim()
                        : post.author.email.split('@')[0],
                    email: post.author.email,
                },
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString(),
                likes: post._count.likes,
                comments: post._count.comments,
                attachments: post.attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    url: att.url,
                    size: att.size,
                })),
                isPinned: post.isPinned,
            }));

            return {
                success: true,
                data: formattedPosts,
                meta: {
                    page,
                    limit,
                    total: await this.prisma.post.count({ where: { workspaceId } }),
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to get workspace posts:', error);
            throw error;
        }
    }

    async addComment(workspaceId: string, postId: string, userId: number, content: string) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Kiểm tra bài viết
            const post = await this.prisma.post.findFirst({
                where: {
                    id: postId,
                    workspaceId,
                },
                include: {
                    author: {
                        select: { id: true, email: true, profile: true },
                    },
                },
            });

            if (!post) {
                throw new NotFoundException('Post not found');
            }

            // Tạo comment
            const comment = await this.prisma.postComment.create({
                data: {
                    postId,
                    authorId: userId,
                    content,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            // Gửi thông báo cho tác giả bài viết (nếu không phải chính họ)
            if (post.authorId !== userId) {
                const commenter = await this.prisma.user.findUnique({
                    where: { id: userId },
                    include: { profile: true },
                });

                const commenterName = commenter?.profile
                    ? `${commenter.profile.firstName || ''} ${commenter.profile.lastName || ''}`.trim()
                    : commenter?.email.split('@')[0] || 'Someone';

                await this.notificationService.notifyMention(
                    workspaceId,
                    postId,
                    `${commenterName} commented on your post: "${post.title}"`,
                    post.authorId,
                    userId,
                );
            }

            return {
                success: true,
                message: 'Comment added successfully',
                data: {
                    id: comment.id,
                    content: comment.content,
                    author: {
                        id: comment.author.id,
                        name: comment.author.profile
                            ? `${comment.author.profile.firstName || ''} ${comment.author.profile.lastName || ''}`.trim()
                            : comment.author.email.split('@')[0],
                        email: comment.author.email,
                    },
                    createdAt: comment.createdAt.toISOString(),
                    updatedAt: comment.updatedAt.toISOString(),
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to add comment:', error);
            throw error;
        }
    }

    async deletePost(workspaceId: string, postId: string, userId: number) {
        try {
            // Kiểm tra membership và role
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Kiểm tra bài viết
            const post = await this.prisma.post.findFirst({
                where: {
                    id: postId,
                    workspaceId,
                },
            });

            if (!post) {
                throw new NotFoundException('Post not found');
            }

            // Kiểm tra quyền: Chỉ OWNER, ADMIN, hoặc tác giả mới được xóa
            const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(membership.role);
            const isAuthor = post.authorId === userId;

            if (!isOwnerOrAdmin && !isAuthor) {
                throw new ForbiddenException('You do not have permission to delete this post');
            }

            // Xóa bài viết (cascade sẽ xóa các likes, comments, attachments)
            await this.prisma.post.delete({
                where: { id: postId },
            });

            return {
                success: true,
                message: 'Post deleted successfully',
                data: null,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to delete post:', error);
            throw error;
        }
    }

    async updatePost(workspaceId: string, postId: string, userId: number, data: { title?: string; content?: string }) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Kiểm tra bài viết
            const post = await this.prisma.post.findFirst({
                where: {
                    id: postId,
                    workspaceId,
                },
            });

            if (!post) {
                throw new NotFoundException('Post not found');
            }

            // Chỉ tác giả mới được cập nhật
            if (post.authorId !== userId) {
                throw new ForbiddenException('Only the author can update this post');
            }

            // Cập nhật bài viết
            const updatedPost = await this.prisma.post.update({
                where: { id: postId },
                data: {
                    title: data.title,
                    content: data.content,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            return {
                success: true,
                message: 'Post updated successfully',
                data: {
                    id: updatedPost.id,
                    title: updatedPost.title,
                    content: updatedPost.content,
                    author: {
                        id: updatedPost.author.id,
                        name: updatedPost.author.profile
                            ? `${updatedPost.author.profile.firstName || ''} ${updatedPost.author.profile.lastName || ''}`.trim()
                            : updatedPost.author.email.split('@')[0],
                        email: updatedPost.author.email,
                    },
                    createdAt: updatedPost.createdAt.toISOString(),
                    updatedAt: updatedPost.updatedAt.toISOString(),
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to update post:', error);
            throw error;
        }
    }

    async togglePinPost(workspaceId: string, postId: string, userId: number) {
        try {
            // Kiểm tra membership và role
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Chỉ OWNER hoặc ADMIN mới được pin bài viết
            if (!['OWNER', 'ADMIN'].includes(membership.role)) {
                throw new ForbiddenException('Only workspace admins can pin posts');
            }

            // Kiểm tra bài viết
            const post = await this.prisma.post.findFirst({
                where: {
                    id: postId,
                    workspaceId,
                },
            });

            if (!post) {
                throw new NotFoundException('Post not found');
            }

            // Toggle pin status
            const updatedPost = await this.prisma.post.update({
                where: { id: postId },
                data: {
                    isPinned: !post.isPinned,
                },
            });

            return {
                success: true,
                message: updatedPost.isPinned ? 'Post pinned successfully' : 'Post unpinned successfully',
                data: {
                    id: updatedPost.id,
                    isPinned: updatedPost.isPinned,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to toggle pin post:', error);
            throw error;
        }
    }

    async createWorkspacePost(workspaceId: string, userId: number, title: string, content: string) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Tạo bài viết
            const post = await this.prisma.post.create({
                data: {
                    title,
                    content,
                    workspaceId,
                    authorId: userId,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            // Tạo thông báo cho các thành viên khác
            await this.notificationService.notifyNewPost(
                workspaceId,
                post.id,
                title,
                content,
                userId,
            );

            return {
                success: true,
                message: 'Post created successfully',
                data: {
                    id: post.id,
                    title: post.title,
                    content: post.content,
                    author: {
                        id: post.author.id,
                        name: post.author.profile
                            ? `${post.author.profile.firstName || ''} ${post.author.profile.lastName || ''}`.trim()
                            : post.author.email.split('@')[0],
                        email: post.author.email,
                    },
                    createdAt: post.createdAt.toISOString(),
                    updatedAt: post.updatedAt.toISOString(),
                    likes: 0,
                    comments: 0,
                    attachments: [],
                    isPinned: false,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to create workspace post:', error);
            throw error;
        }
    }

    async toggleLikePost(workspaceId: string, postId: string, userId: number) {
        try {
            // Kiểm tra membership
            const membership = await this.prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            // Kiểm tra bài viết
            const post = await this.prisma.post.findUnique({
                where: { id: postId },
                include: {
                    author: {
                        select: { id: true, email: true, profile: true },
                    },
                },
            });

            if (!post || post.workspaceId !== workspaceId) {
                throw new NotFoundException('Post not found');
            }

            // Kiểm tra đã thích chưa
            const existingLike = await this.prisma.postLike.findFirst({
                where: {
                    postId,
                    userId,
                },
            });

            let action: 'like' | 'unlike' = 'like';
            let message = 'Post liked successfully';

            if (existingLike) {
                // Xóa like nếu đã tồn tại
                await this.prisma.postLike.delete({
                    where: { id: existingLike.id },
                });
                action = 'unlike';
                message = 'Post unliked successfully';
            } else {
                // Tạo like mới
                await this.prisma.postLike.create({
                    data: {
                        postId,
                        userId,
                    },
                });

                // Gửi thông báo cho tác giả (nếu không phải chính họ)
                if (post.authorId !== userId) {
                    const liker = await this.prisma.user.findUnique({
                        where: { id: userId },
                        include: { profile: true },
                    });

                    const likerName = liker?.profile
                        ? `${liker.profile.firstName || ''} ${liker.profile.lastName || ''}`.trim()
                        : liker?.email.split('@')[0] || 'Someone';

                    await this.notificationService.notifyMention(
                        workspaceId,
                        postId,
                        `${likerName} liked your post: "${post.title}"`,
                        post.authorId,
                        userId,
                    );
                }
            }

            const likeCount = await this.prisma.postLike.count({ where: { postId } });

            return {
                success: true,
                message,
                data: {
                    postId,
                    hasLiked: action === 'like',
                    likes: likeCount,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to toggle like post:', error);
            throw error;
        }
    }
}