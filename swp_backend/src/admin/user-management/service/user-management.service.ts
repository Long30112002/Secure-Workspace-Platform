import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { UserQueryDto } from 'src/admin/user-management/dto/user-query.dto';
import { DatabaseService } from 'src/database/database.service';
import { BulkUpdateUsersDto, UpdateUserAdminDto } from 'src/admin/user-management/dto/update-user-admin.dto';
import { CreateUserAdminDto } from '../dto/create-user-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserManagementService {
    constructor(private prisma: DatabaseService) { }

    private formatUserResponse(user: any) {
        return {
            id: user.id.toString(),
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            lockedUntil: user.lockedUntil,
            failedLoginAttempts: user.failedLoginAttempts,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            profile: user.profile || null,
            sessions: user._count?.sessions || 0,
            // deletedAt: user.deletedAt,     // Thêm vào response
            // deletedBy: user.deletedBy,
        }
    }

    async createUser(createData: CreateUserAdminDto) {
        const { email, role, firstName, lastName, password, sendWelcomeEmail } = createData;

        // Kiểm tra email đã tồn tại
        const existingUser = await this.prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new BadRequestException('User with this email already exists');
        }

        // Tạo password nếu không có
        let userPassword = password;
        let isTemporaryPassword = false;

        if (!userPassword) {
            userPassword = this.generateRandomPassword();
            isTemporaryPassword = true;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userPassword, 10);

        // Tạo user
        const user = await this.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: role || UserRole.USER,
                isActive: true,
                isEmailVerified: false,
                profile: {
                    create: {
                        firstName: firstName || '',
                        lastName: lastName || ''
                    }
                }
            },
            include: {
                profile: true
            }
        });

        // TODO: Gửi email chào mừng
        if (sendWelcomeEmail) {
            console.log(`Sending welcome email to ${email}`);
        }

        return {
            success: true,
            message: 'User created successfully',
            data: {
                user: this.formatUserResponse(user),
                temporaryPassword: isTemporaryPassword ? userPassword : undefined,
            },
            timestamp: new Date().toISOString()
        };
    }

    async findAllUser(query: UserQueryDto) {
        const {
            page = 1,
            limit = 10,
            search,
            isActive,
            role,
            includeDeleted = false,
            isEmailVerified,
            sort,
        } = query;
        console.log('📊 Service received:', { page, limit, query });

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Math.min(Number(limit) || 10, 500));  // Tăng max limit lên 500 nếu cần
        const skip = (pageNum - 1) * limitNum;

        console.log('📊 Calculated:', { pageNum, limitNum, skip });

        const where: Prisma.UserWhereInput = {};
        const conditions: Prisma.UserWhereInput[] = [];

        if (search) {
            conditions.push({
                OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    {
                        profile: {
                            OR: [
                                { firstName: { contains: search, mode: 'insensitive' } },
                                { lastName: { contains: search, mode: 'insensitive' } },
                            ]
                        }
                    }
                ]
            });
        }


        if (isEmailVerified !== undefined) {
            conditions.push({ isEmailVerified });
        }

        if (isActive !== undefined) {
            conditions.push({ isActive });
        }

        if (role) {
            conditions.push({ role: role as UserRole });
        }

        if (!includeDeleted) {
            conditions.push({ deletedAt: null });
        }

        if (conditions.length === 1) {
            Object.assign(where, conditions[0]);
        } else if (conditions.length > 1) {
            where.AND = conditions;
        }

        //sorting
        let orderBy: any = { createdAt: 'desc' }; // mac dinh laf newest
        if (sort) {
            switch (sort) {
                case 'oldest':
                    orderBy = { createdAt: 'asc' };
                    break;
                case 'email-asc':
                    orderBy = { email: 'asc' };
                    break;
                case 'email-desc':
                    orderBy = { email: 'desc' };
                    break;
                default:
                    orderBy = { createdAt: 'desc' };
            }
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                include: {
                    profile: true,
                    _count: {
                        select: { sessions: true },
                    },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        const formattedUsers = users.map(user => this.formatUserResponse(user));
        // Tính toán totalPages với số trang lớn
        const totalPages = Math.ceil(total / limitNum);

        return {
            success: true,
            message: 'Users retrieved successfully',
            data: {
                users: formattedUsers,
                meta: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                    hasMore: pageNum < totalPages,
                    nextPage: pageNum < totalPages ? pageNum + 1 : null,
                    prevPage: pageNum > 1 ? pageNum - 1 : null,
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    async updateUser(id: string, updateData: UpdateUserAdminDto, currentAdminId?: number) {
        const userId = parseInt(id);

        const existingUser = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!existingUser) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Lấy thông tin admin hiện tại
        const currentAdmin = currentAdminId
            ? await this.prisma.user.findUnique({ where: { id: currentAdminId } })
            : null;

        const updatePayload: Prisma.UserUpdateInput = {};

        // Kiểm tra quyền thay đổi role
        if (updateData.role !== undefined) {
            // SUPER_ADMIN có thể thay đổi mọi role
            if (currentAdmin?.role !== 'SUPER_ADMIN') {
                // ADMIN không thể set role ADMIN hoặc SUPER_ADMIN
                if (updateData.role === 'ADMIN' || updateData.role === 'SUPER_ADMIN') {
                    throw new BadRequestException('You do not have permission to set ADMIN or SUPER_ADMIN role');
                }

                // ADMIN không thể thay đổi role của SUPER_ADMIN
                if (existingUser.role === 'SUPER_ADMIN') {
                    throw new BadRequestException('Cannot change SUPER_ADMIN role');
                }
            }

            updatePayload.role = updateData.role;
        }

        if (updateData.isActive !== undefined) updatePayload.isActive = updateData.isActive;

        if (updateData.isEmailVerified !== undefined) updatePayload.isEmailVerified = updateData.isEmailVerified;

        // Update profile if name provided
        if (updateData.firstName || updateData.lastName || updateData.phone !== undefined) {
            await this.prisma.profile.upsert({
                where: { userId },
                update: {
                    ...(updateData.firstName !== undefined && { firstName: updateData.firstName }),
                    ...(updateData.lastName !== undefined && { lastName: updateData.lastName }),
                    ...(updateData.phone !== undefined && { phone: updateData.phone }),
                },
                create: {
                    userId,
                    firstName: updateData.firstName || '',
                    lastName: updateData.lastName || '',
                    phone: updateData.phone || '',
                },
            });
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updatePayload,
            include: {
                profile: true,
            },
        });

        return {
            success: true,
            message: 'User updated successfully',
            data: {
                user: this.formatUserResponse(updatedUser),
            },
            timestamp: new Date().toISOString(),
        };
    }

    async deleteUser(id: string, deletedByUserId?: number) {
        const userId = parseInt(id);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Lấy thông tin admin đang xóa
        const deletingAdmin = deletedByUserId
            ? await this.prisma.user.findUnique({ where: { id: deletedByUserId } })
            : null;

        // Kiểm tra quyền xóa
        if (deletingAdmin?.role !== 'SUPER_ADMIN') {
            // ADMIN không thể xóa SUPER_ADMIN hoặc ADMIN khác
            if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
                throw new BadRequestException('Cannot delete SUPER_ADMIN or ADMIN user');
            }
        }

        if (deletedByUserId && userId === deletedByUserId) {
            throw new BadRequestException('Cannot delete yourself');
        }

        // Soft delete
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletedBy: deletedByUserId || null,
            },
        });

        return {
            success: true,
            message: 'User deleted successfully',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    async restoreUser(id: string) {
        const userId = parseInt(id);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // RESTORE - xóa thông tin soft delete
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isActive: true,
                deletedAt: null,
                deletedBy: null,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });

        return {
            success: true,
            message: 'User restored successfully',
            data: {
                user: {
                    id: user.id.toString(),
                    email: user.email,
                    isActive: true,
                    deletedAt: null,
                    deletedBy: null,
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    async unlockUser(id: string) {
        const userId = parseInt(id);

        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
            include: {
                profile: true,
            },
        });

        return {
            success: true,
            message: 'User unlocked successfully',
            data: {
                user: this.formatUserResponse(user),
            },
            timestamp: new Date().toISOString(),
        };
    }

    async verifyUserEmail(id: string) {
        const userId = parseInt(id);

        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                isEmailVerified: true,
            },
            include: {
                profile: true,
            },
        });

        return {
            success: true,
            message: 'Email verified successfully',
            data: {
                user: this.formatUserResponse(user),
            },
            timestamp: new Date().toISOString(),
        };
    }

    async bulkUpdateUsers(bulkData: BulkUpdateUsersDto) {
        const userIds = bulkData.userIds.map(id => parseInt(id));

        // Check for SUPER_ADMIN users
        const superAdmins = await this.prisma.user.findMany({
            where: {
                id: { in: userIds },
                role: 'SUPER_ADMIN',
            },
        });

        if (superAdmins.length > 0 && bulkData.role && bulkData.role !== 'SUPER_ADMIN') {
            throw new BadRequestException('Cannot change SUPER_ADMIN roles');
        }

        const updatePayload: Prisma.UserUpdateInput = {};

        if (bulkData.role !== undefined) updatePayload.role = bulkData.role;
        if (bulkData.isActive !== undefined) updatePayload.isActive = bulkData.isActive;

        if (bulkData.unlockAccounts) {
            updatePayload.failedLoginAttempts = 0;
            updatePayload.lockedUntil = null;
        }

        await this.prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: updatePayload,
        });

        return {
            success: true,
            message: `${userIds.length} users updated successfully`,
            data: {
                updatedCount: userIds.length,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async bulkDeleteUsers(userIds: string[], deletedByUserId?: number) {
        const ids = userIds.map(id => parseInt(id));

        // Check for SUPER_ADMIN users
        const superAdmins = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
                role: 'SUPER_ADMIN',
            },
        });

        if (superAdmins.length > 0) {
            throw new BadRequestException('Cannot delete SUPER_ADMIN users');
        }

        if (deletedByUserId && ids.includes(deletedByUserId)) {
            throw new BadRequestException('Cannot delete yourself');
        }

        await this.prisma.user.updateMany({
            where: {
                id: { in: ids },
                role: { not: 'SUPER_ADMIN' },
                NOT: deletedByUserId ? { id: deletedByUserId } : undefined,
            },
            data: {
                isActive: false,
                deletedAt: new Date(),
            },
        });

        return {
            success: true,
            message: `${ids.length} users deleted successfully`,
            data: {
                deletedCount: ids.length,
            },
            timestamp: new Date().toISOString(),
        };
    }
    async bulkRestoreUsers(userIds: string[]) {
        const ids = userIds.map(id => parseInt(id));

        await this.prisma.user.updateMany({
            where: {
                id: { in: ids },
            },
            data: {
                isActive: true,
                deletedAt: null,
                deletedBy: null,
            }
        });

        return {
            success: true,
            message: `${ids.length} users restored successfully`,
            data: {
                restoredCount: ids.length,
            },
            timestamp: new Date().toISOString(),
        };
    }

    async getDeletedUsers(query: UserQueryDto) {
        return this.findAllUser({
            ...query,
            includeDeleted: true,
            isActive: false,
        })
    }

    async forceDeleteUser(id: string, deletedByUserId?: number) {
        const userId = parseInt(id);

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            throw new BadRequestException('Cannot delete SUPER_ADMIN or ADMIN user');
        }

        if (deletedByUserId && userId === deletedByUserId) {
            throw new BadRequestException('Cannot delete yourself');
        }

        // HARD DELETE - xóa thật khỏi database
        await this.prisma.user.delete({
            where: { id: userId },
        });

        return {
            success: true,
            message: 'User permanently deleted',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }

    async getUserStats() {
        const [total, active, inactive, verified, superAdmins, admins, locked] = await Promise.all([
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
            this.prisma.user.count({ where: { isActive: false, deletedAt: null } }),
            this.prisma.user.count({ where: { isEmailVerified: true, deletedAt: null } }),
            this.prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null } }),
            this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
            this.prisma.user.count({
                where: {
                    lockedUntil: { gt: new Date() },
                    deletedAt: null
                }
            })
        ]);

        return {
            success: true,
            message: 'User statistics retrieved successfully',
            data: {
                total,
                active,
                inactive,
                verified,
                superAdmins,
                admins,
                locked
            },
            timestamp: new Date().toISOString()
        };


    }

    private generateRandomPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async resetUserPassword(id: string) {
        const userId = parseInt(id);

        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return {
            success: true,
            message: 'Password reset email sent',
            data: null,
            timestamp: new Date().toISOString(),
        };
    }
}