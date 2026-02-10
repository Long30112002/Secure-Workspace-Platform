import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { DatabaseService } from 'src/database/database.service';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private prisma: DatabaseService,
    private reflector: Reflector
  ) { }


  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    let workspaceId =
      request.body?.workspaceId ||
      request.query?.workspaceId ||
      request.params?.workspaceId ||
      request.workspaceId;

    const noWorkspaceRequired = this.getNoWorkspaceRequiredEndpoints();

    const requiresWorkspace = !noWorkspaceRequired.some(route =>
      request.url.includes(route)
    );

    // Endpoint không cần workspace
    if (!requiresWorkspace) {
      return true;
    }

    // Endpoint cần workspace nhưng không có workspaceId
    if (!workspaceId) {
      throw new ForbiddenException('Workspace ID is required');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    // Lưu membership vào request
    request.workspaceMember = membership;
    request.workspaceId = workspaceId;

    // Kiểm tra role nếu có required roles
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = membership.role;
      const hasRole = requiredRoles.some(role => userRole === role);

      if (!hasRole) {
        throw new ForbiddenException(
          `Required workspace roles: ${requiredRoles.join(', ')}. Your role: ${userRole}`
        );
      }
    }

    return true;
  }

  private getNoWorkspaceRequiredEndpoints(): string[] {
    return [
      '/api/workspace/my-workspaces',
      '/api/workspace/create',
      '/api/workspace/switch',
      '/api/workspace/invite/accept',
      '/api/workspace/invite/decline',
      '/api/workspace/invite/validate', 
      '/api/workspace/invitations/pending',
      '/api/workspace/invitations/',
    ];
  }
} 
