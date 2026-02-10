import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class LoginDTO {
    // @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    // @ApiProperty({ example: 'user@example.com' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    // @ApiProperty({ required: false, default: false })
    @IsBoolean()
    @IsOptional()
    rememberMe?: boolean = false;
}