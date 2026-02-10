import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
    @ApiProperty({ example: 'John', required: false })
    @IsOptional()
    @IsString({ message: 'First name cannot exceed 50 characters' })
    @MaxLength(50, { message: 'First name cannot be exceed 50 characters' })
    firstName?: string;

    @IsOptional()
    @IsString({ message: 'Last name must be a string' })
    @MaxLength(50, { message: 'Last name cannot exceed 50 character' })
    lastName?: string;

    @IsOptional()
    @IsUrl({}, { message: 'Please provide a valid URL for avatar' })
    @Transform(({ value }) => value === '' ? null : value)
    avatarUrl?: string | null;

    @IsOptional()
    @IsString({ message: 'Phone number must be a string' })
    phone?: string;

    @IsOptional()
    @IsString({ message: 'Bio must be a string' })
    @MaxLength(500, { message: 'Bio cannot exceed 500 characters' })
    bio?: string;

}

export class ChangePasswordDto {
    @IsString({ message: 'Current password is required' })
    currentPassword: string;

    @IsString({ message: 'New password is required' })
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    newPassword: string;

    @IsString({ message: 'Confirm password is required' })
    confirmPassword: string;
}

export class ProfileResponseDto {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    bio?: string;
    role: string;
    permissions: string[];
    isEmailVerified: boolean;
    createdAt: Date;
    lastLoginAt?: Date;
}