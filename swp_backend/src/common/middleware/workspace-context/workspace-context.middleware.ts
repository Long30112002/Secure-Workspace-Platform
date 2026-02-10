import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class WorkspaceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const workspaceId =
      req.headers['x-workspace-id'] as string ||
      req.query.workspaceId as string ||
      this.extractFromSubdomain(req);

    (req as any).workspaceId = workspaceId;

    next();
  }

  extractFromSubdomain(req: Request): string | null {
    const host = req.headers.host;
    if (!host) return null;

    const parts = host.split('.');
    if (parts.length > 2 && parts[1] === 'localhost') {
      return parts[0]; // "acme"
    }

    if (parts.length > 2) {
      return parts[0];
    }

    return null;
  }
}
