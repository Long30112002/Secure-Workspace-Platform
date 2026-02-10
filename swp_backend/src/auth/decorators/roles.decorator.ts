import { SetMetadata } from "@nestjs/common";
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from "../guards/roles.guard";

export const Role = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

