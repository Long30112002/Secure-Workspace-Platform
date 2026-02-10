import { IsString, MinLength, MaxLength, Matches } from "class-validator";

export class CreateWorkspaceDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    name: string;

    @IsString()
    @MinLength(3)
    @MaxLength(63)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Subdomain can only contain lowercase letters, numbers, and hyphens'
    })
    subdomain: string;
}

export class SwitchWorkspaceDto {
    @IsString()
    workspaceId: string;
}

export class WorkspaceMembersQueryDto {
    @IsString()
    @MinLength(1)
    search?: string;

    role?: string;
    isActive?: boolean;
}