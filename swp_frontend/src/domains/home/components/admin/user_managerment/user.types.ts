export interface Profile {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    bio?: string;
}

export interface User {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'USER' | 'GUEST';
    isActive: boolean;
    isEmailVerified: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    profile?: Profile;
    sessions: number;
    failedLoginAttempts: number;
    lockedUntil: string | null;
}

export interface FilterOptions {
    role: 'all' | User['role'];
    status: 'all' | 'active' | 'inactive' | 'locked';
    verified: 'all' | 'verified' | 'unverified';
}

export type SortOptions =
    | 'newest'
    | 'oldest'
    | 'email-asc'
    | 'email-desc';