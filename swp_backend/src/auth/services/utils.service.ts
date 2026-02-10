import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthUtilsService {
    getRedirectPathByRole(role: string): string {
        const rolePaths = {
            SUPER_ADMIN: '/super-admin/homepage',
            ADMIN: '/admin/homepage',
            MANAGER: '/manager/homepage',
            USER: '/homepage',
            GUEST: '/welcome',
        };

        return rolePaths[role] || '/homepage';
    }

    maskEmail(email: string) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 3)}***@${domain}`;
    }
}