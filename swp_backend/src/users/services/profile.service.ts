import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ChangePasswordDto, ProfileResponseDto, UpdateProfileDto } from '../dto/profile.dto';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';


@Injectable()
export class ProfileService {
    constructor(
        private readonly prisma: DatabaseService,
    ) { }

    async getProfile(userId: number): Promise<ProfileResponseDto> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found')
        }

        const avatarUrl = user.profile?.avatarUrl || '';


        return {
            id: user.id,
            email: user.email,
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            fullName: user.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : undefined,
            phone: user.profile?.phone || '',
            avatarUrl: avatarUrl,
            bio: user.profile?.bio || '',
            createdAt: user.createdAt,
            role: user.role,
            permissions: user.permissions,
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt || undefined,
        }
    }

    async updateProfile(userId: number, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) {
            throw new NotFoundException('User not found')
        }

        if (user.profile) {
            await this.prisma.profile.update({
                where: { id: user.profile.id },
                data: {
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    avatarUrl: dto.avatarUrl,
                    bio: dto.bio,
                    updatedAt: new Date(),
                },
            })
        } else {
            await this.prisma.profile.create({
                data: {
                    userId,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    avatarUrl: dto.avatarUrl,
                    bio: dto.bio,
                }
            });
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                updatedAt: new Date(),
            }
        })

        return this.getProfile(userId);
    }

    async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Kiểm tra mật khẩu hiện tại
        const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Kiểm tra mật khẩu mới và xác nhận mật khẩu
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException('New password and confirm password do not match');
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

        // Cập nhật mật khẩu
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                lastPasswordChange: new Date(),
                updatedAt: new Date(),
            },
        });

    }

    async uploadAvatar(userId: number, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        console.log('Uploading avatar for user:', userId);
        console.log('File info:', {
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            bufferLength: file.buffer.length
        });

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars', userId.toString());
        console.log('Upload directory:', uploadDir);

        await fs.mkdir(uploadDir, { recursive: true });

        //Ten file duy nhat
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        //Luu file
        await fs.writeFile(filePath, file.buffer);

        const avatarUrl = `/uploads/avatars/${userId}/${fileName}`;
        console.log('✅ Relative Avatar URL:', avatarUrl);

        if (user.profile) {
            await this.prisma.profile.update({
                where: { userId },
                data: {
                    avatarUrl,
                    updatedAt: new Date(),
                },
            });
        } else {
            await this.prisma.profile.create({
                data: {
                    userId,
                    avatarUrl,
                },
            });
        }

        console.log('File saved to:', filePath);
        console.log('Relative URL:', avatarUrl);

        // Kiểm tra file đã được lưu chưa
        const stats = await fs.stat(filePath);
        console.log('File size on disk:', stats.size);

        return { avatarUrl: avatarUrl };
    }

    async deleteAccount(userId: number, password: string): Promise<{ message: string }> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        //verifify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Password is incorrect');
        }

        // Soft delete: mark as inactive instead of actually deleting
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isActive: false,
                email: `deleted_${Date.now()}_${user.email}`,
                updatedAt: new Date(),
            }
        })

        return { message: 'Account deactivated successfully' };
    }
}

