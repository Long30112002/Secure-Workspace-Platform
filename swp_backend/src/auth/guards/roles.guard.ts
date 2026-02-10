import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }
    canActivate(context: ExecutionContext): boolean {

        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass(),]
        );

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 401
        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        const hasRole = requiredRoles.some((role) => {
            if (role === 'ADMIN') {
                // Nếu cần ADMIN, cho phép cả ADMIN và SUPER_ADMIN
                return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
            }
            return user.role === role
        });

        // Sai role → 403
        if (!hasRole) {
            throw new ForbiddenException(
                `Insufficient permission. Required roles: ${requiredRoles.join(', ')}`,
            );
        }

        return true;
    }

}