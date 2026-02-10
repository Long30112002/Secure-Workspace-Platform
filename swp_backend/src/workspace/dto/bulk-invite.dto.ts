import { IsArray, IsString, IsOptional, IsBoolean, IsEnum, ArrayMinSize } from 'class-validator';

export enum WorkspaceRole {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    EDITOR = 'EDITOR',
    VIEWER = 'VIEWER',
    MEMBER = 'MEMBER'
}

export class BulkInviteDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one email is required' })
    @IsString({ each: true, message: 'Each email must be a string' })
    emails: string[];
    
    @IsString()
    workspaceId: string;
    
    @IsEnum(WorkspaceRole)
    role: WorkspaceRole = WorkspaceRole.MEMBER;
    
    @IsOptional()
    @IsBoolean()
    sendInvitationEmail: boolean = true;
    
    @IsOptional()
    @IsBoolean()
    skipExistingMembers: boolean = true;
    
    @IsOptional()
    @IsBoolean()
    skipPendingInvitations: boolean = true;
}

export type BulkInviteServiceDto = BulkInviteDto & {
    invitedByUserId: number; 
};