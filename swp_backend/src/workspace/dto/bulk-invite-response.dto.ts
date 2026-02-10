export class BulkInviteResponseDto {
    success: boolean;
    message: string;
    data: {
        total: number;
        invited: number;
        skipped: number;
        failed: number;
        executionTimeMs: number;
        details: {
            invited: Array<{ email: string; invitationId?: string }>;
            skipped: Array<{ email: string; reason: string }>;
            failed: Array<{ email: string; error: string }>;
        };
    };
    timestamp: string;
}

export interface BulkInviteResult {
    total: number;
    invited: number;
    skipped: number;
    failed: number;
    details: {
        invited: Array<{ email: string; invitationId?: string }>;
        skipped: Array<{ email: string; reason: string }>;
        failed: Array<{ email: string; error: string }>;
    };
    executionTimeMs: number;
}