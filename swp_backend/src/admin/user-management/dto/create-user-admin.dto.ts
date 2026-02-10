// src/auth/dto/create-user-admin.dto.ts
import { UserRole } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches, MinLength, ValidateNested } from "class-validator";

export class CreateUserAdminDto {
    @IsEmail()
    email: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole = UserRole.USER;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message: 'Password must contain at least 6 characters, one uppercase, one lowercase, one number and one special character'
    })
    password?: string;

    @IsOptional()
    @IsBoolean()
    sendWelcomeEmail?: boolean = true;
}

export class ImportUsersDto {
    @IsString({ each: true })
    users: string[]; // JSON string array

    @IsOptional()
    @IsBoolean()
    sendWelcomeEmail?: boolean = true;

    @IsOptional()
    @IsBoolean()
    updateExisting?: boolean = false;
}

export class CSVUserDataDto {
    @IsNumber()
    row: number;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    role?: string = 'USER';
}

export class ImportCSVDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CSVUserDataDto)
    usersData: CSVUserDataDto[];

    @IsOptional()
    @IsBoolean()
    sendWelcomeEmail?: boolean = true;

    @IsOptional()
    @IsBoolean()
    updateExisting?: boolean = false;
}

export class ExportUsersDto {
    @IsOptional()
    @IsString({ each: true })
    userIds?: string[];

    @IsOptional()
    @IsString()
    format?: 'csv' | 'json' | 'excel' = 'csv';

    @IsOptional()
    @IsBoolean()
    includeDeleted?: boolean = false;
}