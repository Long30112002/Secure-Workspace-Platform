import { SetMetadata } from '@nestjs/common';

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
export const WorkspaceRoles = (...roles: string[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);