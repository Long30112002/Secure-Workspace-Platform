import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;
}

export class ResetPasswordDto {
    @IsString({ message: 'Reset token is required' })
    @IsNotEmpty({ message: 'Reset token is required' })
    token: string;

    @IsString({ message: 'New password is required' })
    @IsNotEmpty({ message: 'New password is required' })
    newPassword: string;

    @IsString({ message: 'Please confirm your password' })
    @IsNotEmpty({ message: 'Please confirm your password' })
    confirmPassword: string;
}

export class ValidateResetTokenDto {
    @IsString({ message: 'Reset token is required' })
    @IsNotEmpty({ message: 'Reset token is required' })
    token: string;
}