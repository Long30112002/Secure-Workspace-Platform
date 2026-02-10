import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class ActiveUserGuard implements CanActivate {
    constructor(private prisma: DatabaseService) { }
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            return true;
        }

        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
            select: {
                isActive: true,
                deletedAt: true,
            }
        });

        if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
            throw new UnauthorizedException('Account is inactive or deleted');
        }
        return true;
    }
}
