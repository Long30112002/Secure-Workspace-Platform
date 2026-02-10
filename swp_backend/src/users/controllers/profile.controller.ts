import { BadRequestException, Body, Controller, Delete, FileTypeValidator, Get, MaxFileSizeValidator, ParseFilePipe, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ChangePasswordDto, ProfileResponseDto, UpdateProfileDto } from '../dto/profile.dto';
import { ProfileService } from '../services/profile.service';
import { Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { ActiveUserGuard } from 'src/auth/guards/active-user.guard';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller('profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) { }
    private readonly logger = new MyLoggerService(ProfileController.name);

    @Get()
    @ApiOperation({ summary: 'Get user profile' })
    async getProfile(@Request() req): Promise<ProfileResponseDto> {
        this.logger.log(`Get profile for user ${req.user.id}`);
        return this.profileService.getProfile(req.user.id);
    }

    @Put()
    @ApiOperation({ summary: 'Update profile information' })
    async updateProfile(@Request() req, @Body() dto: UpdateProfileDto): Promise<ProfileResponseDto> {
        this.logger.log(`Update profile for user ${req.user.id}`);
        return this.profileService.updateProfile(req.user.id, dto);
    }

    @Post('change-password')
    @ApiOperation({ summary: 'Change password' })
    async changePassword(@Request() req, @Body() dto: ChangePasswordDto): Promise<void> {
        this.logger.log(`Change password for user ${req.user.id}`);
        return this.profileService.changePassword(req.user.id, dto);
    }

    @Post('upload-avatar')
    @ApiOperation({ summary: 'Upload profile picture' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('avatar'))
    async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File): Promise<{ avatarUrl: string }> {
        this.logger.log(`Upload avatar for user ${req.user.id}`);
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return this.profileService.uploadAvatar(req.user.id, file);
    }

    @Delete('avatar')
    @ApiOperation({ summary: 'Remove profile picture' })
    async removeAvatar(@Request() req): Promise<{ message: string }> {
        this.logger.log(`Remove avatar for user ${req.user.id}`);
        await this.profileService.updateProfile(req.user.id, { avatarUrl: null });
        return { message: 'Avatar removed successfully' };
    }

    @Delete('account')
    @ApiOperation({ summary: 'Delete account (soft delete)' })
    async deleteAccount(@Request() req, @Body() body: { password: string }): Promise<{ message: string }> {
        this.logger.log(`Delete account for user ${req.user.id}`);
        return this.profileService.deleteAccount(req.user.id, body.password);
    }

}