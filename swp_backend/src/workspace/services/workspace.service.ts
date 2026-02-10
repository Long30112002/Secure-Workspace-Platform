import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailVerificationService } from 'src/auth/services/email-verification.service';
import { BulkInviteServiceDto } from '../dto/bulk-invite.dto';
import { BulkInviteResult } from '../dto/bulk-invite-response.dto';
import { WorkspaceGateway } from '../real-time/workspace.gateway';


@Injectable()
export class WorkspaceService {
    private readonly logger = new Logger(WorkspaceService.name);
    constructor(
        private prisma: DatabaseService,
        private readonly emailVerificationService: EmailVerificationService,
        private readonly wsGateway: WorkspaceGateway,
    ) {
    }

    async getWorkspaceDashboard(workspaceId: string, userId: number) {
        try {
            const membership = await this.prisma.workspaceMember.findFirst({
                where: {
                    workspaceId,
                    userId,
                },
            });

            if (!membership) {
                throw new NotFoundException('You are not a member of this workspace');
            }

            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                include: {
                    owner: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        },
                    },
                },
            });

            if (!workspace) {
                throw new NotFoundException('Workspace not found');
            }

            const [totalMembers, totalPosts, activeMembers] = await Promise.all([
                this.prisma.workspaceMember.count({
                    where: { workspaceId },
                }),

                this.prisma.post.count({
                    where: { workspaceId },
                }),

                this.prisma.workspaceMember.count({
                    where: {
                        workspaceId,
                        lastActive: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
            ]);

            const onlineMembersCount = await this.prisma.workspaceMember.count({
                where: {
                    workspaceId,
                    user: {
                        sessions: {
                            some: {
                                lastActivity: {
                                    gte: new Date(Date.now() - 5 * 60 * 1000), // 5 phút
                                },
                            },
                        },
                    },
                },
            });

            return {
                success: true,
                data: {
                    id: workspace.id,
                    name: workspace.name,
                    description: workspace.description || '',
                    subdomain: workspace.subdomain,
                    owner: {
                        id: workspace.owner.id,
                        email: workspace.owner.email,
                        name: workspace.owner.profile
                            ? `${workspace.owner.profile.firstName || ''} ${workspace.owner.profile.lastName || ''}`.trim()
                            : workspace.owner.email.split('@')[0],
                    },
                    stats: {
                        totalMembers,
                        totalPosts,
                        activeMembers,
                        onlineMembers: onlineMembersCount || Math.floor(Math.random() * totalMembers) + 1,
                    },
                    createdAt: workspace.createdAt.toISOString(),
                },
                timestamp: new Date().toISOString(),
            }

        } catch (error) {
            this.logger.error('Failed to get workspace dashboard:', error);
            throw error;
        }
    }

    async getActiveMembers(workspaceId: string) {
        try {
            const members = await this.prisma.workspaceMember.findMany({
                where: {
                    workspaceId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                            sessions: {
                                where: {
                                    lastActivity: {
                                        gte: new Date(Date.now() - 5 * 60 * 1000), // Online trong 5 phút
                                    },
                                    expiresAt: {
                                        gte: new Date(),
                                    }
                                },
                                orderBy: { lastActivity: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { lastActive: 'desc' },
            });

            const formattedMembers = members.map(member => ({
                id: member.id,
                userId: member.user.id,
                email: member.user.email,
                name: member.user.profile
                    ? `${member.user.profile.firstName || ''} ${member.user.profile.lastName || ''}`.trim()
                    : member.user.email.split('@')[0],
                role: member.role,
                status: member.user.sessions.length > 0 ? 'online' : 'offline',
                lastActive: member.lastActive?.toISOString() || new Date().toISOString(),
            }));

            return {
                success: true,
                data: formattedMembers,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to get active members:', error);
            throw error;
        }
    }
    async getUserWorkspaces(userId: number) {
        const memberships = await this.prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                        plan: true,
                        createdAt: true,
                        ownerId: true,
                    },
                },
            },
        });

        return {
            success: true,
            data: memberships.map(m => ({
                workspace: m.workspace,
                role: m.role,
                joinedAt: m.joinedAt,
            })),
            timestamp: new Date().toISOString(),
        };
    }

    async createWorkspace(userId: number, name: string, subdomain: string) {
        if (!this.isValidSubdomain(subdomain)) {
            throw new BadRequestException('Invalid subdomain format');
        }

        const existing = await this.prisma.workspace.findUnique({
            where: { subdomain },
        });

        if (existing) {
            throw new BadRequestException('Subdomain already exists');
        }

        const workspace = await this.prisma.workspace.create({
            data: {
                name,
                subdomain,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: 'OWNER',
                    },
                },
            },
        });

        return {
            success: true,
            message: 'Workspace created successfully',
            data: {
                id: workspace.id,
                name: workspace.name,
                subdomain: workspace.subdomain,
                createdAt: workspace.createdAt,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async removeMemberFromWorkspace(
        workspaceId: string,
        userIdToRemove: number,
        currentUserId: number
    ) {
        // 1. Kiểm tra current user có trong workspace không
        const currentUserMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: currentUserId,
                },
            },
        });

        if (!currentUserMembership) {
            throw new BadRequestException('You are not a member of this workspace');
        }

        // 2. Kiểm tra quyền: chỉ OWNER hoặc ADMIN mới được xóa
        if (currentUserMembership.role !== 'OWNER' && currentUserMembership.role !== 'ADMIN') {
            throw new BadRequestException('You do not have permission to remove members');
        }

        // 3. Kiểm tra user cần xóa có tồn tại trong workspace không
        const targetMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: userIdToRemove,
                },
            },
            include: {
                user: true,
            }
        });

        if (!targetMembership) {
            throw new NotFoundException('User not found in this workspace');
        }

        // 4. Không thể xóa OWNER
        if (targetMembership.role === 'OWNER') {
            throw new BadRequestException('Cannot remove workspace owner');
        }

        // 5. Không được tự xóa chính mình
        if (userIdToRemove === currentUserId) {
            throw new BadRequestException('Cannot remove yourself from workspace');
        }

        // 6. Xóa membership
        await this.prisma.workspaceMember.delete({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: userIdToRemove,
                },
            },
        });

        // 7. Ghi audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId,
                userId: currentUserId,
                action: 'REMOVE_MEMBER',
                entityType: 'member',
                entityId: targetMembership.id,
                details: {
                    removedUserId: userIdToRemove,
                    removedUserEmail: targetMembership.user.email,
                    removedUserRole: targetMembership.role,
                    removedByUserId: currentUserId,
                    removedByRole: currentUserMembership.role,
                }
            }
        });

        return {
            success: true,
            message: 'Member removed from workspace successfully',
            data: {
                removedUserId: userIdToRemove,
                removedBy: currentUserId,
                timestamp: new Date().toISOString(),
            }
        };
    }

    async getWorkspaceMembers(workspaceId: string) {
        const members = await this.prisma.workspaceMember.findMany({
            where: { workspaceId },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
            },
            orderBy: { joinedAt: 'desc' },
        });

        const formattedMembers = members.map(member => ({
            id: member.id,
            userId: member.user.id,
            email: member.user.email,
            role: member.role,
            joinedAt: member.joinedAt,
            lastActive: member.lastActive,
            profile: member.user.profile,
            systemRole: member.user.role,
        }));

        return {
            success: true,
            data: formattedMembers,
            timestamp: new Date().toISOString(),
        };
    }

    async switchWorkspace(userId: number, workspaceId: string) {
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
            include: {
                workspace: true,
            },
        });

        if (!membership) {
            throw new BadRequestException('Workspace not found or access denied');
        }

        return {
            success: true,
            data: {
                workspace: membership.workspace,
                role: membership.role,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async getWorkspaceMember(workspaceId: string, userId: number) {
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
            include: {
                user: {
                    include: {
                        profile: true,
                    },
                },
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                    },
                },
            },
        });

        if (!membership) {
            throw new NotFoundException('Member not found in this workspace');
        }

        return {
            success: true,
            data: membership,
            timestamp: new Date().toISOString(),
        };
    }

    async updateMemberRole(
        workspaceId: string,
        userId: number,
        newRole: string,
        currentUserId: number
    ) {
        // Validate role
        if (!Object.values(WorkspaceRole).includes(newRole as WorkspaceRole)) {
            throw new BadRequestException('Invalid role');
        }

        // Check current user permissions
        const currentUserMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: currentUserId,
                },
            },
        });

        if (!currentUserMembership) {
            throw new BadRequestException('You are not a member of this workspace');
        }

        // Only OWNER or ADMIN can change roles
        if (currentUserMembership.role !== 'OWNER' && currentUserMembership.role !== 'ADMIN') {
            throw new BadRequestException('You do not have permission to change roles');
        }

        // Check target user exists
        const targetMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
            include: {
                user: true,
            },
        });

        if (!targetMembership) {
            throw new NotFoundException('User not found in this workspace');
        }

        // Cannot change OWNER's role
        if (targetMembership.role === 'OWNER') {
            throw new BadRequestException('Cannot change owner role');
        }

        // Cannot promote to OWNER unless current user is OWNER
        if (newRole === 'OWNER' && currentUserMembership.role !== 'OWNER') {
            throw new BadRequestException('Only owner can transfer ownership');
        }

        // Update role
        const updated = await this.prisma.workspaceMember.update({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
            data: { role: newRole as WorkspaceRole },
        });

        // Audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId,
                userId: currentUserId,
                action: 'UPDATE_MEMBER_ROLE',
                entityType: 'member',
                entityId: targetMembership.id,
                details: {
                    userId,
                    oldRole: targetMembership.role,
                    newRole,
                    updatedBy: currentUserId,
                },
            },
        });

        return {
            success: true,
            message: 'Member role updated successfully',
            data: updated,
            timestamp: new Date().toISOString(),
        };
    }

    async addMemberToWorkspace(
        workspaceId: string,
        email: string,
        role: string = 'MEMBER',
        invitedBy: number,
        sendInvitation: boolean = true
    ) {
        // Check workspace exists
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    }
                }
            }
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        // Check inviter permissions
        const inviterMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: invitedBy,
                },
            },
            include: {
                user: {
                    select: {
                        email: true,
                        profile: true,
                    }
                }
            }
        });

        if (!inviterMembership) {
            throw new BadRequestException('You are not a member of this workspace');
        }

        if (inviterMembership.role !== 'OWNER' && inviterMembership.role !== 'ADMIN') {
            throw new BadRequestException('You do not have permission to add members');
        }

        if (sendInvitation) {
            return this.inviteToWorkspace(workspaceId, email, role, invitedBy, workspace.name, workspace.subdomain);
        } else {
            return this.forceAddToWorkspace(workspaceId, email, role, invitedBy, workspace.name, workspace.subdomain, inviterMembership.user.email);
        }

    }

    async forceAddToWorkspace(
        workspaceId: string,
        email: string,
        role: string = 'MEMBER',
        invitedBy: number,
        workspaceName: string,
        workspaceSubdomain: string,
        inviterEmail: string
    ) {
        // Find or create user
        let user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                profile: true,
            }
        });

        let isNewUser = false;
        let temporaryPassword: string | null = null;

        if (!user) {
            // Create new user with temporary password
            const tempPassword = this.generateRandomPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            temporaryPassword = tempPassword;
            isNewUser = true;

            user = await this.prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: 'USER',
                    isActive: true,
                    isEmailVerified: false,
                },
                include: {
                    profile: true,
                }
            });

            await this.sendWelcomeEmailToNewUser(
                email,
                workspaceName,
                inviterEmail,
                temporaryPassword,
                workspaceSubdomain
            );
        } else {
            // Check if already a member
            const existingMembership = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: user.id,
                    },
                },
            });

            if (existingMembership) {
                throw new BadRequestException('User is already a member of this workspace');
            }

            await this.sendAddedToWorkspaceEmail(
                email,
                workspaceName,
                inviterEmail,
                workspaceSubdomain,
                role
            );

        }

        // Add to workspace
        const membership = await this.prisma.workspaceMember.create({
            data: {
                workspaceId,
                userId: user.id,
                role: role as WorkspaceRole,
                invitedBy,
            },
        });

        // Audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId,
                userId: invitedBy,
                action: 'ADD_MEMBER',
                entityType: 'member',
                entityId: membership.id,
                details: {
                    userId: user.id,
                    userEmail: email,
                    role,
                    invitedBy,
                    isNewUser,
                    method: 'force_add',
                },
            },
        });

        return {
            success: true,
            message: isNewUser ?
                'New user created and added to workspace' :
                'User added to workspace',
            data: {
                membership,
                isNewUser,
                temporaryPassword: isNewUser ? temporaryPassword : null,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async inviteToWorkspace(
        workspaceId: string,
        email: string,
        role: string = 'MEMBER',
        invitedBy: number,
        workspaceName: string,
        workspaceSubdomain: string
    ) {
        try {
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId }
            });

            console.log('Workspace found:', !!workspace);

            if (!workspace) {
                throw new NotFoundException('Workspace not found');
            }

            // Kiểm tra inviter
            const inviter = await this.prisma.user.findUnique({
                where: { id: invitedBy }
            });

            console.log('Inviter found:', !!inviter);
            console.log('Inviter email:', inviter?.email);


            if (!inviter) {
                throw new BadRequestException('Invalid inviter');
            }

            const existingUser = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });

            if (existingUser) {
                const existingMembership = await this.prisma.workspaceMember.findUnique({
                    where: {
                        workspaceId_userId: {
                            workspaceId,
                            userId: existingUser.id,
                        }
                    }
                });

                if (existingMembership) {
                    throw new BadRequestException(`User ${email} is already a member of this workspace`);
                }
            }

            // Kiểm tra đã có invitation chưa
            const existingInvite = await this.prisma.workspaceInvite.findFirst({
                where: {
                    workspaceId,
                    email,
                    status: 'PENDING',
                    expiresAt: { gt: new Date() }
                }
            });

            if (existingInvite) {
                throw new BadRequestException('An active invitation already exists for this email');
            }

            // Nếu có invitation cũ (REVOKED/EXPIRED/ACCEPTED), UPDATE thay vì CREATE
            const oldInvite = await this.prisma.workspaceInvite.findFirst({
                where: {
                    workspaceId,
                    email,
                    status: { in: ['REVOKED', 'EXPIRED', 'ACCEPTED'] }
                },
                orderBy: { createdAt: 'desc' } // Lấy cái mới nhất
            });

            //Tao invitation token
            const invitationToken = this.generateInvitationToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            console.log('Generated token:', invitationToken);

            let invitation;
            if (oldInvite) {
                // UPDATE invitation cũ
                invitation = await this.prisma.workspaceInvite.update({
                    where: { id: oldInvite.id },
                    data: {
                        role: role as WorkspaceRole,
                        token: invitationToken,
                        invitedBy,
                        expiresAt,
                        status: 'PENDING',
                        createdAt: new Date()
                    }
                });
                console.log('✅ Updated existing invitation:', invitation.id);
            } else {
                //CREATE invitation moi
                invitation = await this.prisma.workspaceInvite.create({
                    data: {
                        workspaceId,
                        email,
                        role: role as WorkspaceRole,
                        token: invitationToken,
                        invitedBy,
                        expiresAt,
                        status: 'PENDING',
                    }
                });
                console.log('✅ Created new invitation:', invitation.id);
            }

            // Log để kiểm tra
            console.log('Invitation created successfully:', {
                id: invitation.id,
                email: invitation.email,
                token: invitation.token,
                status: invitation.status
            });

            // Gửi email invitation
            await this.sendInvitationEmail(
                email,
                workspaceName,
                inviter.email,
                invitationToken,
                workspaceSubdomain,
                role
            );


            if (existingUser) {
                await this.wsGateway.notifyNewInvitation(
                    email,
                    {
                        id: invitation.id,
                        workspaceId: invitation.workspaceId,
                        workspaceName,
                        role: invitation.role,
                        invitedBy: inviter.email,
                        expiresAt: invitation.expiresAt,
                        createdAt: invitation.createdAt,
                        token: invitation.token,
                    })
            }

            return {
                success: true,
                message: 'Invitation sent successfully',
                data: { invitation },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.log('Error in inviteToWorkspace: ', error);
            throw error;
        }

    }

    private async sendInvitationEmail(userEmail: string, workspaceName: string, inviterEmail: string, invitationToken: string, workspaceSubdomain: string, role: string) {
        const appName = process.env.APP_NAME || 'MY_APP';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Link accept invitation
        // const acceptUrl = `${frontendUrl}/workspace/join?token=${invitationToken}`;
        const acceptUrl = `${frontendUrl}/join/${invitationToken}`;
        // const declineUrl = `${frontendUrl}/workspace/decline?token=${invitationToken}`;
        const declineUrl = `${frontendUrl}/workspace/invite/decline?token=${invitationToken}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"${appName}" <longhoang30112002@gmail.com>`,
            to: userEmail,
            subject: `You're invited to join ${workspaceName} on ${appName}!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                        .button { display: inline-block; padding: 12px 24px; margin: 5px 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                        .accept-btn { background-color: #4F46E5; color: white; }
                        .decline-btn { background-color: #6B7280; color: white; }
                        .info-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${appName}</h1>
                        </div>
                        <div class="content">
                            <h2>You're invited to join ${workspaceName}!</h2>
                            <p>Hello!</p>
                            <p>You have been invited to join <strong>${workspaceName}</strong> on ${appName} by ${inviterEmail}.</p>
                            
                            <div class="info-box">
                                <p><strong>Workspace:</strong> ${workspaceName}</p>
                                <p><strong>Your Role:</strong> ${role}</p>
                                <p><strong>Invited by:</strong> ${inviterEmail}</p>
                                <p><strong>Invitation expires:</strong> 7 days</p>
                            </div>
                            
                            <p>Click the button below to accept this invitation:</p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${acceptUrl}" class="button accept-btn" style="color: #ffffff !important;">Accept Invitation</a>
                                <a href="${declineUrl}" class="button decline-btn" style="color: #ffffff !important;">Decline</a>
                            </div>
                            
                            <p>Or copy and paste this link into your browser:</p>
                            <div style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all;">
                                ${acceptUrl}
                            </div>
                            
                            <p><strong>Note:</strong> You must accept this invitation to join the workspace.</p>
                            
                            <div class="footer">
                                <p>Best regards,<br>The ${appName} Team</p>
                                <p><small>This is an automated message, please do not reply to this email.</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
            You're invited to join ${workspaceName} on ${appName}!
            
            Hello!
            
            You have been invited to join ${workspaceName} on ${appName} by ${inviterEmail}.
            
            Workspace: ${workspaceName}
            Your Role: ${role}
            Invited by: ${inviterEmail}
            Invitation expires: 7 days
            
            To accept this invitation, click the link below:
            ${acceptUrl}
            
            To decline: ${declineUrl}
            
            Or copy and paste the link into your browser.
            
            Note: You must accept this invitation to join the workspace.
            
            Best regards,
            The ${appName} Team
            `
        };

        try {
            // Sử dụng EmailVerificationService để gửi email
            const result = await this.emailVerificationService.sendEmail(mailOptions);
            console.log('Email sent successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            throw new BadRequestException('Failed to send invitation email');
        }
    }

    private async sendWelcomeEmailToNewUser(
        userEmail: string,
        workspaceName: string,
        inviterEmail: string,
        temporaryPassword: string,
        workspaceSubdomain: string
    ) {
        const appName = process.env.APP_NAME || 'MY_APP';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${frontendUrl}/login`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"${appName}" <longhoang30112002@gmail.com>`,
            to: userEmail,
            subject: `Welcome to ${workspaceName} on ${appName}!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                        .password-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${appName}</h1>
                        </div>
                        <div class="content">
                            <h2>Welcome to ${workspaceName}!</h2>
                            <p>Hello!</p>
                            <p>Your account has been created and you've been added to <strong>${workspaceName}</strong> on ${appName} by ${inviterEmail}.</p>
                            
                            <p>Your account credentials:</p>
                            
                            <div class="password-box">
                                <p><strong>Email:</strong> ${userEmail}</p>
                                <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                                <p><strong>Workspace:</strong> ${workspaceName}</p>
                            </div>
                            
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${loginUrl}" class="button" style="color: white;">Login to Your Account</a>
                            </p>
                            
                            <p><strong>Important Security Notes:</strong></p>
                            <ul>
                                <li>Change your password immediately after first login</li>
                                <li>Do not share your password with anyone</li>
                                <li>This temporary password will expire in 7 days</li>
                            </ul>
                            
                            <p>You can now access the workspace and collaborate with your team members.</p>
                            
                            <div class="footer">
                                <p>Best regards,<br>The ${appName} Team</p>
                                <p><small>This is an automated message, please do not reply to this email.</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
            Welcome to ${workspaceName} on ${appName}!
            
            Hello!
            
            Your account has been created and you've been added to ${workspaceName} on ${appName} by ${inviterEmail}.
            
            Your account credentials:
            
            Email: ${userEmail}
            Temporary Password: ${temporaryPassword}
            Workspace: ${workspaceName}
            
            Login URL: ${loginUrl}
            
            Important Security Notes:
            - Change your password immediately after first login
            - Do not share your password with anyone
            - This temporary password will expire in 7 days
            
            You can now access the workspace and collaborate with your team members.
            
            Best regards,
            The ${appName} Team
            `
        };

        try {
            // Sử dụng EmailVerificationService để gửi email
            const result = await this.emailVerificationService.sendEmail(mailOptions);
            console.log('Email sent successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            throw new BadRequestException('Failed to send invitation email');
        }
    }

    private async sendAddedToWorkspaceEmail(
        userEmail: string,
        workspaceName: string,
        inviterEmail: string,
        workspaceSubdomain: string,
        role: string
    ) {
        const appName = process.env.APP_NAME || 'MY_APP';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${frontendUrl}/login`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"${appName}" <longhoang30112002@gmail.com>`,
            to: userEmail,
            subject: `You've been added to ${workspaceName} on ${appName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                        .info-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${appName}</h1>
                        </div>
                        <div class="content">
                            <h2>You've been added to ${workspaceName}!</h2>
                            <p>Hello!</p>
                            <p>You have been added to <strong>${workspaceName}</strong> on ${appName} by ${inviterEmail}.</p>
                            
                            <div class="info-box">
                                <p><strong>Workspace:</strong> ${workspaceName}</p>
                                <p><strong>Your Role:</strong> ${role}</p>
                                <p><strong>Invited by:</strong> ${inviterEmail}</p>
                            </div>
                            
                            <p>You can now access this workspace with your existing account.</p>
                            
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${loginUrl}" class="button" style="color: white;">Access ${workspaceName}</a>
                            </p>
                            
                            <p>Once logged in, you can switch to this workspace from your dashboard.</p>
                            
                            <div class="footer">
                                <p>Best regards,<br>The ${appName} Team</p>
                                <p><small>This is an automated message, please do not reply to this email.</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
            You've been added to ${workspaceName} on ${appName}!
            
            Hello!
            
            You have been added to ${workspaceName} on ${appName} by ${inviterEmail}.
            
            Workspace: ${workspaceName}
            Your Role: ${role}
            Invited by: ${inviterEmail}
            
            You can now access this workspace with your existing account.
            
            Login URL: ${loginUrl}
            
            Once logged in, you can switch to this workspace from your dashboard.
            
            Best regards,
            The ${appName} Team
            `
        };

        try {
            // Sử dụng EmailVerificationService để gửi email
            const result = await this.emailVerificationService.sendEmail(mailOptions);
            console.log('Email sent successfully:', result);
            return result;
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            throw new BadRequestException('Failed to send invitation email');
        }
    }

    private generateInvitationToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    async acceptInvitation(token: string, userId: number) {
        const invitation = await this.prisma.workspaceInvite.findFirst({
            where: {
                token,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
        });

        if (!invitation) {
            throw new BadRequestException('Invalid or expired invitation');
        }

        // Kiểm tra user
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Kiểm tra email có khớp không
        if (user.email !== invitation.email) {
            throw new BadRequestException('This invitation is for a different email address');
        }

        // Lấy thông tin workspace
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: invitation.workspaceId }
        });

        if (!workspace) {
            throw new BadRequestException('Workspace not found');
        }

        // Kiểm tra đã là member chưa
        const existingMembership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: invitation.workspaceId,
                    userId,
                },
            },
        });

        if (existingMembership) {
            // Update invitation status
            await this.prisma.workspaceInvite.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED' }
            });

            return {
                success: true,
                message: 'You are already a member of this workspace',
                data: { workspace },
                timestamp: new Date().toISOString(),
            };
        }

        // Thêm user vào workspace
        const membership = await this.prisma.workspaceMember.create({
            data: {
                workspaceId: invitation.workspaceId,
                userId,
                role: invitation.role as WorkspaceRole,
                invitedBy: invitation.invitedBy,
            },
        });

        // Update invitation status
        await this.prisma.workspaceInvite.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED' }
        });

        // Lấy thông tin người mời
        const inviter = await this.prisma.user.findUnique({
            where: { id: invitation.invitedBy },
            select: { email: true, profile: true }
        });

        // Audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId: invitation.workspaceId,
                userId,
                action: 'ACCEPT_INVITATION',
                entityType: 'member',
                entityId: membership.id,
                details: {
                    invitationId: invitation.id,
                    invitedBy: invitation.invitedBy,
                    inviterEmail: inviter?.email,
                    role: invitation.role,
                },
            },
        });

        return {
            success: true,
            message: 'Invitation accepted successfully',
            data: {
                membership,
                workspace,
                inviter,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async declineInvitation(token: string, userId: number) {
        const invitation = await this.prisma.workspaceInvite.findFirst({
            where: {
                token,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
        });

        if (!invitation) {
            throw new BadRequestException('Invalid or expired invitation');
        }

        // Kiểm tra user
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user || user.email !== invitation.email) {
            throw new BadRequestException('Invalid invitation');
        }

        // Update invitation status
        await this.prisma.workspaceInvite.update({
            where: { id: invitation.id },
            data: { status: 'REVOKED' }
        });

        const invitationEmail = invitation.email;

        await this.wsGateway.notifyInvitationUpdated(
            invitationEmail,
            token,
            'DECLINED'
        );

        return {
            success: true,
            message: 'Invitation declined',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    async getInvitations(
        workspaceId: string,
        query: {
            page?: number;
            limit?: number;
            status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'ALL';
        }
    ) {
        const {
            page = 1,
            limit = 10,
            status = 'ALL'
        } = query;

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Math.min(Number(limit) || 10, 100));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.WorkspaceInviteWhereInput = {
            workspaceId,
        };

        if (status !== 'ALL') {
            where.status = status;
        }

        const [invitations, total] = await Promise.all([
            this.prisma.workspaceInvite.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            subdomain: true
                        }
                    }
                }
            }),
            this.prisma.workspaceInvite.count({ where })
        ]);

        // Lấy thông tin người mời cho mỗi invitation
        const invitationsWithDetails = await Promise.all(
            invitations.map(async (invitation) => {
                const inviter = await this.prisma.user.findUnique({
                    where: { id: invitation.invitedBy },
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    }
                });

                return {
                    ...invitation,
                    invitedByUser: inviter
                };
            })
        );

        const totalPages = Math.ceil(total / limitNum);

        return {
            success: true,
            data: invitationsWithDetails,
            meta: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasMore: pageNum < totalPages,
                nextPage: pageNum < totalPages ? pageNum + 1 : null,
                prevPage: pageNum > 1 ? pageNum - 1 : null,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async cancelInvitation(invitationId: string, currentUserId: number) {
        const invitation = await this.prisma.workspaceInvite.findUnique({
            where: { id: invitationId },
            include: { workspace: true }
        });

        if (!invitation) {
            throw new NotFoundException('Invitation not found');
        }

        // Kiểm tra quyền
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: invitation.workspaceId,
                    userId: currentUserId,
                },
            },
        });

        if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN' && invitation.invitedBy !== currentUserId)) {
            throw new BadRequestException('You do not have permission to cancel this invitation');
        }

        // Update invitation status
        await this.prisma.workspaceInvite.update({
            where: { id: invitationId },
            data: { status: 'REVOKED' }
        });

        const invitationEmail = invitation.email;

        await this.wsGateway.notifyInvitationCancelled(
            invitationEmail,
            invitationId
        );

        return {
            success: true,
            message: 'Invitation cancelled',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    async validateInvitationToken(token: string) {
        const invitation = await this.prisma.workspaceInvite.findFirst({
            where: {
                token,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true,
                    }
                }
            }
        });

        if (!invitation) {
            throw new BadRequestException('Invalid or expired invitation');
        }

        const inviter = await this.prisma.user.findUnique({
            where: { id: invitation.invitedBy },
            select: {
                email: true,
                profile: {
                    select: {
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        });

        return {
            success: true,
            data: {
                invitationId: invitation.id,
                workspaceId: invitation.workspaceId,
                workspaceName: invitation.workspace.name,
                workspaceSubdomain: invitation.workspace.subdomain,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt,
                invitedByEmail: inviter?.email,
                invitedByName: inviter?.profile ?
                    `${inviter.profile.firstName || ''} ${inviter.profile.lastName || ''}`.trim() :
                    null
            },
            timestamp: new Date().toISOString(),
        };
    }

    async leaveWorkspace(workspaceId: string, userId: number) {
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
            include: {
                workspace: true,
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        });

        if (!membership) {
            throw new NotFoundException('You are not a member of this workspace');
        }

        // Cannot leave if you are the owner
        if (membership.role === 'OWNER') {
            throw new BadRequestException('Owner cannot leave workspace. Transfer ownership first.');
        }

        // Delete membership
        await this.prisma.workspaceMember.delete({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        // Audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId,
                userId,
                action: 'LEAVE_WORKSPACE',
                entityType: 'member',
                entityId: membership.id,
                details: {
                    userId,
                    userEmail: membership.user.email,
                    role: membership.role,
                },
            },
        });

        return {
            success: true,
            message: 'Successfully left workspace',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    async getWorkspaceInfo(workspaceId: string) {
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    },
                },
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        return {
            success: true,
            data: workspace,
            timestamp: new Date().toISOString(),
        };
    }

    async updateWorkspaceInfo(
        workspaceId: string,
        updateData: { name?: string; settings?: any },
        currentUserId: number
    ) {
        // Check workspace exists
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        // Check user is member and has permission (OWNER or ADMIN)
        const membership = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: currentUserId,
                },
            },
        });

        if (!membership) {
            throw new BadRequestException('You are not a member of this workspace');
        }

        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
            throw new BadRequestException('You do not have permission to update workspace');
        }

        // Update workspace
        const updatedWorkspace = await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                ...(updateData.name && { name: updateData.name }),
                ...(updateData.settings && { settings: updateData.settings }),
            },
        });

        // Audit log
        await this.prisma.workspaceAuditLog.create({
            data: {
                workspaceId,
                userId: currentUserId,
                action: 'UPDATE_WORKSPACE',
                entityType: 'workspace',
                entityId: workspaceId,
                details: {
                    updatedBy: currentUserId,
                    updates: updateData,
                },
            },
        });

        return {
            success: true,
            message: 'Workspace updated successfully',
            data: updatedWorkspace,
            timestamp: new Date().toISOString(),
        };
    }

    async getWorkspaceStats(workspaceId: string) {
        // Check workspace exists
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        const [
            totalMembers,
            activeMembers,
            ownerCount,
            adminCount,
            editorCount,
            viewerCount,
            memberCount
        ] = await Promise.all([
            this.prisma.workspaceMember.count({ where: { workspaceId } }),
            this.prisma.workspaceMember.count({
                where: {
                    workspaceId,
                    user: {
                        isActive: true,
                    },
                },
            }),
            this.prisma.workspaceMember.count({
                where: { workspaceId, role: 'OWNER' }
            }),
            this.prisma.workspaceMember.count({
                where: { workspaceId, role: 'ADMIN' }
            }),
            this.prisma.workspaceMember.count({
                where: { workspaceId, role: 'EDITOR' }
            }),
            this.prisma.workspaceMember.count({
                where: { workspaceId, role: 'VIEWER' }
            }),
            this.prisma.workspaceMember.count({
                where: { workspaceId, role: 'MEMBER' }
            }),
        ]);

        return {
            success: true,
            data: {
                workspaceId,
                totalMembers,
                activeMembers,
                roles: {
                    owner: ownerCount,
                    admin: adminCount,
                    editor: editorCount,
                    viewer: viewerCount,
                    member: memberCount,
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    async checkPermissions(workspaceId: string, userId: number) {
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

        return {
            success: true,
            data: {
                role: membership.role,
                permissions: this.getRolePermissions(membership.role),
                canManageMembers: ['OWNER', 'ADMIN'].includes(membership.role),
                canManageWorkspace: membership.role === 'OWNER',
                canEditContent: ['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role),
            },
            timestamp: new Date().toISOString(),
        };
    }

    private getRolePermissions(role: WorkspaceRole) {
        const permissions = {
            OWNER: ['manage_workspace', 'manage_members', 'edit_content', 'view_content'],
            ADMIN: ['manage_members', 'edit_content', 'view_content'],
            EDITOR: ['edit_content', 'view_content'],
            VIEWER: ['view_content'],
            MEMBER: ['view_content'],
        };
        return permissions[role] || [];
    }

    private generateRandomPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    private isValidSubdomain(subdomain: string): boolean {
        const regex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        return regex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 63;
    }

    async getInvitationsForUser(userEmail: string) {
        // Lấy tất cả workspace mà user đang có invitation pending
        const invitations = await this.prisma.workspaceInvite.findMany({
            where: {
                email: userEmail,
                status: 'PENDING',
                expiresAt: { gt: new Date() }
            },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        subdomain: true
                    }
                }
            }
        });

        return {
            success: true,
            data: invitations,
            timestamp: new Date().toISOString()
        };
    }

    async getUserById(userId: number) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true }
        });
    }

    async getUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true }
        });
    }

    async bulkInviteMembers(dto: BulkInviteServiceDto): Promise<{
        success: boolean;
        message: string;
        data: BulkInviteResult;
        timestamp: string;
    }> {
        const startTime = Date.now();

        const results: BulkInviteResult = {
            total: dto.emails.length,
            invited: 0,
            skipped: 0,
            failed: 0,
            details: {
                invited: [],
                skipped: [],
                failed: []
            },
            executionTimeMs: 0
        };

        try {
            // 1. Validate workspace exists
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: dto.workspaceId },
                include: {
                    owner: {
                        select: {
                            id: true,
                            email: true,
                            profile: true,
                        }
                    }
                }
            });

            if (!workspace) {
                throw new Error('Workspace not found');
            }

            // 2. Lấy thông tin người mời
            const inviter = await this.prisma.user.findUnique({
                where: { id: dto.invitedByUserId },
                select: {
                    email: true,
                    profile: true
                }
            });

            if (!inviter) {
                throw new Error('Inviter not found');
            }

            // 3. Process in transaction
            await this.prisma.$transaction(async (tx) => {
                // Get existing members (optimized single query)
                const existingMembers = await tx.workspaceMember.findMany({
                    where: {
                        workspaceId: dto.workspaceId,
                        user: {
                            email: {
                                in: dto.emails.map(e => e.toLowerCase().trim())
                            }
                        }
                    },
                    include: { user: true }
                });

                const existingMemberEmails = new Set(
                    existingMembers.map(m => m.user.email.toLowerCase())
                );

                // Get pending invitations (optimized single query)
                const pendingInvites = await tx.workspaceInvite.findMany({
                    where: {
                        workspaceId: dto.workspaceId,
                        email: {
                            in: dto.emails.map(e => e.toLowerCase().trim())
                        },
                        status: 'PENDING'
                    }
                });

                const pendingInvitationEmails = new Set(
                    pendingInvites.map(i => i.email.toLowerCase())
                );

                // Process each email
                for (const email of dto.emails) {
                    const normalizedEmail = email.toLowerCase().trim();

                    // Validate email format
                    if (!this.isValidEmail(normalizedEmail)) {
                        results.failed++;
                        results.details.failed.push({
                            email: normalizedEmail,
                            error: 'INVALID_EMAIL_FORMAT'
                        });
                        continue;
                    }

                    // Skip existing members if enabled
                    if (dto.skipExistingMembers && existingMemberEmails.has(normalizedEmail)) {
                        results.skipped++;
                        results.details.skipped.push({
                            email: normalizedEmail,
                            reason: 'ALREADY_MEMBER'
                        });
                        continue;
                    }

                    // Skip pending invitations if enabled
                    if (dto.skipPendingInvitations && pendingInvitationEmails.has(normalizedEmail)) {
                        results.skipped++;
                        results.details.skipped.push({
                            email: normalizedEmail,
                            reason: 'PENDING_INVITATION'
                        });
                        continue;
                    }

                    try {
                        // Generate unique token
                        const token = this.generateInvitationToken();

                        // Create invitation
                        const invitation = await tx.workspaceInvite.create({
                            data: {
                                email: normalizedEmail,
                                workspaceId: dto.workspaceId,
                                role: dto.role,
                                invitedBy: dto.invitedByUserId,
                                token: token,
                                status: 'PENDING',
                                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                            }
                        });

                        results.invited++;
                        results.details.invited.push({
                            email: normalizedEmail,
                            invitationId: invitation.id
                        });

                        // Send email async if enabled
                        if (dto.sendInvitationEmail) {
                            // FIX: Gọi đúng hàm với đúng tham số
                            this.sendInvitationEmailBulk(
                                normalizedEmail,
                                token,
                                workspace.name,
                                dto.role,
                                inviter.email,
                                workspace.subdomain
                            ).catch(err => {
                                this.logger.warn(`Failed to send email to ${normalizedEmail}:`, err.message);
                            });
                        }

                    } catch (error: any) {
                        this.logger.error(`Error creating invitation for ${normalizedEmail}:`, error);
                        results.failed++;
                        results.details.failed.push({
                            email: normalizedEmail,
                            error: error.message || 'PROCESSING_ERROR'
                        });
                    }
                }
            }, {
                maxWait: 30000,
                timeout: 30000,
            });

            const executionTimeMs = Date.now() - startTime;
            results.executionTimeMs = executionTimeMs;

            this.logger.log(`Bulk invite completed in ${executionTimeMs}ms: ` +
                `${results.invited} invited, ${results.skipped} skipped, ${results.failed} failed`);

            return {
                success: true,
                message: `Bulk invitation completed successfully`,
                data: results,
                timestamp: new Date().toISOString()
            };

        } catch (error: any) {
            this.logger.error('Bulk invite failed:', error);

            const executionTimeMs = Date.now() - startTime;
            results.executionTimeMs = executionTimeMs;

            return {
                success: false,
                message: error.message || 'Bulk invitation failed',
                data: results,
                timestamp: new Date().toISOString()
            };
        }
    }

    private async sendInvitationEmailBulk(
        userEmail: string,
        invitationToken: string,
        workspaceName: string,
        role: string,
        inviterEmail: string,
        workspaceSubdomain: string
    ) {
        // Tái sử dụng logic email từ hàm sendInvitationEmail
        const appName = process.env.APP_NAME || 'MY_APP';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Link accept invitation
        // const acceptUrl = `${frontendUrl}/workspace/join?token=${invitationToken}`;
        // const acceptUrl = `${frontendUrl}/workspace/accept-invitation?token=${invitationToken}`;
        const acceptUrl = `${frontendUrl}/join/${invitationToken}`;
        const declineUrl = `${frontendUrl}/workspace/decline?token=${invitationToken}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"${appName}" <longhoang30112002@gmail.com>`,
            to: userEmail,
            subject: `You're invited to join ${workspaceName} on ${appName}!`,
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 24px; margin: 5px 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .accept-btn { background-color: #4F46E5; color: white; }
                    .decline-btn { background-color: #6B7280; color: white; }
                    .info-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4F46E5; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${appName}</h1>
                    </div>
                    <div class="content">
                        <h2>You're invited to join ${workspaceName}!</h2>
                        <p>Hello!</p>
                        <p>You have been invited to join <strong>${workspaceName}</strong> on ${appName} by ${inviterEmail}.</p>
                        
                        <div class="info-box">
                            <p><strong>Workspace:</strong> ${workspaceName}</p>
                            <p><strong>Your Role:</strong> ${role}</p>
                            <p><strong>Invited by:</strong> ${inviterEmail}</p>
                            <p><strong>Invitation expires:</strong> 7 days</p>
                        </div>
                        
                        <p>Click the button below to accept this invitation:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${acceptUrl}" class="button accept-btn" style="color: #ffffff !important;">Accept Invitation</a>
                            <a href="${declineUrl}" class="button decline-btn" style="color: #ffffff !important;">Decline</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <div style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all;">
                            ${acceptUrl}
                        </div>
                        
                        <p><strong>Note:</strong> You must accept this invitation to join the workspace.</p>
                        
                        <div class="footer">
                            <p>Best regards,<br>The ${appName} Team</p>
                            <p><small>This is an automated message, please do not reply to this email.</small></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
            text: `
        You're invited to join ${workspaceName} on ${appName}!
        
        Hello!
        
        You have been invited to join ${workspaceName} on ${appName} by ${inviterEmail}.
        
        Workspace: ${workspaceName}
        Your Role: ${role}
        Invited by: ${inviterEmail}
        Invitation expires: 7 days
        
        To accept this invitation, click the link below:
        ${acceptUrl}
        
        To decline: ${declineUrl}
        
        Or copy and paste the link into your browser.
        
        Note: You must accept this invitation to join the workspace.
        
        Best regards,
        The ${appName} Team
        `
        };

        try {
            // Sử dụng EmailVerificationService để gửi email
            const result = await this.emailVerificationService.sendEmail(mailOptions);
            console.log(`Bulk email sent successfully to ${userEmail}`);
            return result;
        } catch (error) {
            console.error(`Failed to send bulk invitation email to ${userEmail}:`, error);
            throw new Error(`Failed to send invitation email to ${userEmail}`);
        }
    }

    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }



}