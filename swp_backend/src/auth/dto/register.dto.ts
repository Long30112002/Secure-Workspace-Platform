import { UserRole } from "@prisma/client";
import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from "class-validator";


export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsEnum(UserRole, {
        message: `Role must be one ò: ${Object.values(UserRole).join(', ')}`
    })
    role?: UserRole = UserRole.USER;
}