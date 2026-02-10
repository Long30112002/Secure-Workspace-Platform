import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../auth/context/AuthContext";
import BaseLayout from "../../../../../shared/components/layout/BaseLayout";
import "./WorkspaceManagement.css"
import { useNotification } from "../../context/NotificationContext";
import WorkspaceImportModal from "./WorkspaceImportModal";

interface WorkspaceMember {
    id: string;
    userId: number;
    email: string;
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'MEMBER';
    joinedAt: string;
    profile?: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
    };
}

interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextPage: number | null;
    prevPage: number | null;
}

interface WorkspaceInvitation {
    id: string;
    email: string;
    role: string;
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    expiresAt: string;
    invitedByUser?: {
        email: string;
        profile?: {
            firstName?: string;
            lastName?: string;
        };
    };
}

interface WorkspaceStats {
    totalMembers: number;
    activeMembers: number;
    roles: {
        owner: number;
        admin: number;
        editor: number;
        viewer: number;
        member: number;
    };
}

interface WorkspacePermissions {
    role: string;
    permissions: string[];
    canManageMembers: boolean;
    canManageWorkspace: boolean;
    canEditContent: boolean;
}

function WorkspaceManagement() {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useNotification();

    // State
    const [workspace, setWorkspace] = useState<any>(null);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [permissions, setPermissions] = useState<WorkspacePermissions | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Check if user is OWNER or ADMIN
    const isOwnerOrAdmin = permissions?.role === 'OWNER' || permissions?.role === 'ADMIN';

    // Form states
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('MEMBER');
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');
    const [settings, setSettings] = useState({});

    void setSettings; //Có thể xóa hỗ trợ chỉ để tránh warning

    // Loading states for each action
    const [isRemovingMember, setIsRemovingMember] = useState<number | null>(null);
    const [isUpdatingRole, setIsUpdatingRole] = useState<number | null>(null);
    const [isInvitingMember, setIsInvitingMember] = useState(false);
    const [isCancellingInvitation, setIsCancellingInvitation] = useState<string | null>(null);
    const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);
    const [isLeavingWorkspace, setIsLeavingWorkspace] = useState(false);

    // Database optimization settings (giống BaseAuthForm)
    const [databaseOptimization] = useState({
        enabled: true,
        minLoadingTime: 1000, // 1 giây minimum loading time
        minRequestInterval: 1000,
        cooldownPeriod: 500,
    });

    const [remainingTime, setRemainingTime] = useState(0);
    const isSubmittingRef = useRef(false);
    const submitStartTimeRef = useRef<number>(0);

    // Import 
    const [showImportModal, setShowImportModal] = useState(false);

    //Page invitations
    const [pendingInvitations, setPendingInvitations] = useState<WorkspaceInvitation[]>([]);
    const [invitationsPagination, setInvitationsPagination] = useState<PaginationState>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        hasMore: false,
        nextPage: null,
        prevPage: null,
    });
    const [invitationsPageJumpValue, setInvitationsPageJumpValue] = useState('1');

    void pendingInvitations; //Để cho vui xóa cũng được

    //Fet workspace data
    useEffect(() => {
        if (workspaceId) {
            fetchWorkspaceData();
        }
    }, [workspaceId]);

    // Timer countdown effect
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime(prev => {
                    const newTime = prev - 100;
                    if (newTime <= 0) {
                        if (interval) clearInterval(interval);
                        return 0;
                    }
                    return newTime;
                });
            }, 100);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [remainingTime]);

    // DATABASE OPTIMIZATION: Throttling check
    const checkThrottling = () => {
        if (!databaseOptimization.enabled) return { shouldThrottle: false, message: '' };

        const now = Date.now();
        const timeSinceLastRequest = now - submitStartTimeRef.current;
        const MIN_REQUEST_INTERVAL = databaseOptimization.minRequestInterval || 1000;

        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && submitStartTimeRef.current !== 0) {
            const waitSeconds = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
            return {
                shouldThrottle: true,
                message: `Please wait ${waitSeconds} seconds before trying again`,
            };
        }
        return { shouldThrottle: false, message: '' };
    };

    // DATABASE OPTIMIZATION: Apply minimum loading time
    const applyMinimumLoadingTime = async <T,>(promise: Promise<T>): Promise<T> => {
        if (!databaseOptimization.enabled) return promise;

        const MIN_LOADING_TIME = databaseOptimization.minLoadingTime || 1000;
        const startTime = Date.now();

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), MIN_LOADING_TIME + 5000)
            );

            const [result] = await Promise.race([
                Promise.all([
                    promise,
                    new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME))
                ]),
                timeoutPromise
            ]);

            return result;

        } catch (error) {
            // Nếu lỗi xảy ra trước minimum loading time, vẫn đợi cho đủ thời gian
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < MIN_LOADING_TIME) {
                const remainingTimeToWait = MIN_LOADING_TIME - elapsedTime;
                console.log(`Waiting additional ${remainingTimeToWait}ms for database protection`);
                await new Promise(resolve => setTimeout(resolve, remainingTimeToWait));
            }
            throw error;
        }
    };

    const fetchWorkspaceData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                fetchWorkspaceInfo(),
                fetchWorkspaceMembers(),
                fetchWorkspaceStats(),
                fetchPermissions(),
                fetchInvitations(1)
            ]);
        } catch (error) {
            console.error('Failed to fetch workspace data:', error);
        } finally {
            setLoading(false);
        }
    }

    const fetchWorkspaceInfo = async () => {
        const response = await fetch(`http://localhost:3000/api/workspace/info?workspaceId=${workspaceId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            setWorkspace(data.data);
            setWorkspaceName(data.data.name);
        }
    };

    const fetchWorkspaceMembers = async () => {
        const response = await fetch(`http://localhost:3000/api/workspace/members?workspaceId=${workspaceId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            setMembers(data.data);
        }
    };

    const fetchWorkspaceStats = async () => {
        const response = await fetch(`http://localhost:3000/api/workspace/stats?workspaceId=${workspaceId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            setStats(data.data);
        }
    };

    const fetchPermissions = async () => {
        const response = await fetch(`http://localhost:3000/api/workspace/permissions?workspaceId=${workspaceId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            setPermissions(data.data);
        }
    };

    const fetchInvitations = async (page: number = invitationsPagination.page) => {
        try {
            const params = new URLSearchParams({
                workspaceId: workspaceId || '',
                page: page.toString(),
                limit: invitationsPagination.limit.toString(),
                status: 'PENDING'
            });

            // QUAN TRỌNG: credentials: 'include' để gửi cookies
            const response = await fetch(
                `http://localhost:3000/api/workspace/invitations?${params.toString()}`,
                {
                    credentials: 'include', // Gửi cookies tự động
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 403) {
                    showToast('You do not have permission to view invitations', 'error');
                    setInvitations([]);
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                setInvitations(data.data || []);
                setPendingInvitations(data.data || []);

                if (data.meta) {
                    setInvitationsPagination(prev => ({
                        ...prev,
                        page: data.meta.page || page,
                        limit: data.meta.limit || prev.limit,
                        total: data.meta.total || 0,
                        totalPages: data.meta.totalPages || 1,
                        hasMore: data.meta.hasMore || false,
                        nextPage: data.meta.nextPage || null,
                        prevPage: data.meta.prevPage || null,
                    }));

                    setInvitationsPageJumpValue((data.meta.page || page).toString());
                }
            } else {
                console.error('API error:', data.message);
                showToast(data.message || 'Failed to fetch invitations', 'error');
            }
        } catch (error: any) {
            console.error('Failed to fetch invitations:', error);
            showToast(`Failed to fetch invitations: ${error.message}`, 'error');
        }
    };
    // Xử lý thay đổi trang
    const handleInvitationsPageChange = (page: number) => {
        const newPage = Math.max(1, Math.min(page, invitationsPagination.totalPages));
        setInvitationsPagination(prev => ({ ...prev, page: newPage }));
        fetchInvitations(newPage);
    };

    // Xử lý page jump
    const handleInvitationsPageJump = () => {
        const page = parseInt(invitationsPageJumpValue);
        if (!isNaN(page) && page >= 1 && page <= invitationsPagination.totalPages) {
            handleInvitationsPageChange(page);
        }
    };

    const handleInvitationsPageJumpKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleInvitationsPageJump();
        }
    };

    const handleInvitationsPageJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setInvitationsPageJumpValue(value);
        }
    };

    // Xử lý thay đổi limit
    const handleInvitationsLimitChange = (newLimit: number) => {
        setInvitationsPagination(prev => ({
            ...prev,
            limit: newLimit,
            page: 1
        }));
    };

    useEffect(() => {
        if (activeTab === 'invitations') {
            // Reset về trang 1 và fetch lại khi limit thay đổi
            fetchInvitations(1);
        }
    }, [invitationsPagination.limit, activeTab]);

    useEffect(() => {
        setInvitationsPageJumpValue(invitationsPagination.page.toString());
    }, [invitationsPagination.page]);

    // Reset về page 1 khi chuyển sang tab invitations
    useEffect(() => {
        if (activeTab === 'invitations' && invitationsPagination.page !== 1) {
            setInvitationsPagination(prev => ({ ...prev, page: 1 }));
            fetchInvitations(1);
        }
    }, [activeTab]);

    const renderInvitationsPaginationNumbers = () => {
        const pages = [];
        const currentPage = invitationsPagination.page;
        const totalPages = invitationsPagination.totalPages;

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(
                    <button
                        key={i}
                        className={`page-btn ${currentPage === i ? 'active' : ''}`}
                        onClick={() => handleInvitationsPageChange(i)}
                        disabled={loading}
                    >
                        {i}
                    </button>
                );
            }
        } else {
            // Always show first page
            pages.push(
                <button
                    key={1}
                    className={`page-btn ${currentPage === 1 ? 'active' : ''}`}
                    onClick={() => handleInvitationsPageChange(1)}
                    disabled={loading}
                >
                    1
                </button>
            );

            let startPage, endPage;

            if (currentPage <= 3) {
                startPage = 2;
                endPage = 5;
            } else if (currentPage >= totalPages - 2) {
                startPage = totalPages - 4;
                endPage = totalPages - 1;
            } else {
                startPage = currentPage - 1;
                endPage = currentPage + 1;
            }

            // Add ellipsis if needed
            if (startPage > 2) {
                pages.push(
                    <span key="ellipsis1" className="page-ellipsis">
                        ...
                    </span>
                );
            }

            // Add middle pages
            for (let i = startPage; i <= endPage; i++) {
                if (i > 1 && i < totalPages) {
                    pages.push(
                        <button
                            key={i}
                            className={`page-btn ${currentPage === i ? 'active' : ''}`}
                            onClick={() => handleInvitationsPageChange(i)}
                            disabled={loading}
                        >
                            {i}
                        </button>
                    );
                }
            }

            // Add ellipsis if needed
            if (endPage < totalPages - 1) {
                pages.push(
                    <span key="ellipsis2" className="page-ellipsis">
                        ...
                    </span>
                );
            }

            // Always show last page if there is more than 1 page
            if (totalPages > 1) {
                pages.push(
                    <button
                        key={totalPages}
                        className={`page-btn ${currentPage === totalPages ? 'active' : ''}`}
                        onClick={() => handleInvitationsPageChange(totalPages)}
                        disabled={loading}
                    >
                        {totalPages}
                    </button>
                );
            }
        }

        return pages;
    };

    // Handle member actions
    const handleRemoveMember = async (userId: number) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        // DATABASE OPTIMIZATION 1: Throttling check
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsRemovingMember(userId);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/members/${userId}?workspaceId=${workspaceId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await applyMinimumLoadingTime(response.json());

            if (data.success) {
                showToast('Member removed successfully', 'success');
                fetchWorkspaceMembers();
                fetchWorkspaceStats();
            }
        } catch (error) {
            showToast('Failed to remove member', 'error');
            if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                const COOLDOWN = databaseOptimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsRemovingMember(null);
            setRemainingTime(0);
        }
    };

    const handleUpdateRole = async (userId: number, newRole: string) => {
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsUpdatingRole(userId);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/members/${userId}/role?workspaceId=${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Role updated successfully', 'success');
                fetchWorkspaceMembers();
                fetchWorkspaceStats();
            }
            else {
                showToast(data.message || 'Failed to update role', 'error');
                if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                    const COOLDOWN = databaseOptimization.cooldownPeriod;
                    submitStartTimeRef.current = Date.now() + COOLDOWN;
                }
            }
        } catch (error) {
            console.error('Failed to update role:', error);
            showToast('Failed to update role', 'error');
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsUpdatingRole(null);
            setRemainingTime(0);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail.trim()) {
            showToast('Please enter an email address', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteEmail)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        // Check if already a member
        const isAlreadyMember = members.some(member =>
            member.email.toLowerCase() === inviteEmail.toLowerCase()
        );

        if (isAlreadyMember) {
            showToast(`${inviteEmail} is already a member of this workspace`, 'error');
            return;
        }

        // Check if already has pending invitation
        const hasPendingInvitation = invitations.some(invite =>
            invite.email.toLowerCase() === inviteEmail.toLowerCase() &&
            invite.status === 'PENDING'
        );

        if (hasPendingInvitation) {
            showToast(`${inviteEmail} already has a pending invitation`, 'error');
            return;
        }

        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsInvitingMember(true);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole,
                    workspaceId
                })
            });

            const data = await applyMinimumLoadingTime(response.json());

            if (response.status === 400) {
                showToast(`Error: ${data.message}`, 'error');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (data.success) {
                showToast('Invitation sent successfully!', 'success');
                setInviteEmail('');
                setShowInviteForm(false);
                // Refresh với trang hiện tại
                fetchInvitations(invitationsPagination.page);
            }
        } catch (error: any) {
            showToast(`Failed to send invitation: ${error.message}`, 'error');
            if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                const COOLDOWN = databaseOptimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsInvitingMember(false);
            setRemainingTime(0);
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        if (!window.confirm('Are you sure you want to cancel this invitation?')) return;

        // DATABASE OPTIMIZATION 1: Throttling check
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsCancellingInvitation(invitationId);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/invitations/${invitationId}?workspaceId=${workspaceId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ workspaceId })
            });

            const data = await applyMinimumLoadingTime(response.json());

            if (data.success) {
                showToast('Invitation cancelled', 'success');
                // Refresh với trang hiện tại
                fetchInvitations(invitationsPagination.page);
            } else {
                showToast(data.message || 'Failed to cancel invitation', 'error');
            }
        } catch (error) {
            console.error('Failed to cancel invitation:', error);
            showToast('Failed to cancel invitation', 'error');

            if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                const COOLDOWN = databaseOptimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsCancellingInvitation(null);
            setRemainingTime(0);
        }
    };

    const handleUpdateWorkspace = async () => {
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsUpdatingWorkspace(true);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/info`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name: workspaceName,
                    settings,
                    workspaceId
                })
            });

            const data = await applyMinimumLoadingTime(response.json());

            if (data.success) {
                showToast('Workspace updated successfully', 'success');
                setEditingWorkspace(false);
                fetchWorkspaceInfo();
            } else {
                showToast(data.message || 'Failed to update workspace', 'error');
            }
        } catch (error) {
            console.error('Failed to update workspace:', error);
            showToast('Failed to update workspace', 'error');
            if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                const COOLDOWN = databaseOptimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsUpdatingWorkspace(false);
            setRemainingTime(0);
        }
    };

    const handleLeaveWorkspace = async () => {
        if (!window.confirm('Are you sure you want to leave this workspace?')) return;

        // DATABASE OPTIMIZATION 1: Throttling check
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            showToast(throttlingCheck.message, 'error');
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsLeavingWorkspace(true);
        setRemainingTime(databaseOptimization.minLoadingTime || 1000);

        const loadingStartTime = Date.now();

        try {
            const response = await fetch(`http://localhost:3000/api/workspace/leave?workspaceId=${workspaceId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                showToast('You have left the workspace', 'success');
                navigate('/workspaces');

            } else {
                showToast(data.message || 'Failed to leave workspace', 'error');
            }
        } catch (error: any) {
            console.error('Failed to leave workspace:', error);
            showToast('Failed to leave workspace', 'error');
            if (databaseOptimization.enabled && databaseOptimization.cooldownPeriod) {
                const COOLDOWN = databaseOptimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (databaseOptimization.enabled && databaseOptimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = databaseOptimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset loading states
            isSubmittingRef.current = false;
            setIsLeavingWorkspace(false);
            setRemainingTime(0);
        }
    };

    if (loading) {
        return (
            <BaseLayout>
                <div className="workspace-dashboard loading_workspace">
                    <div className="loading-workspace-spinner"></div>
                    <p>Loading workspace...</p>
                </div>
            </BaseLayout>
        );
    }

    if (!workspace) {
        return (
            <BaseLayout>
                <div className="workspace-dashboard not-found">
                    <h2>Workspace not found</h2>
                    <p>The workspace you're looking for doesn't exist or you don't have access.</p>
                    <button onClick={() => navigate('/workspaces')} className="btn btn-primary">
                        Back to Workspaces
                    </button>
                </div>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout>
            <div className="workspace-dashboard">
                {/* Header */}
                <div className="workspace-header">
                    <div className="workspace-info">
                        {editingWorkspace ? (
                            <div className="edit-form">
                                <input
                                    type="text"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    className="form-input"
                                />
                                <button
                                    onClick={handleUpdateWorkspace}
                                    className={`btn btn-primary btn-small ${isUpdatingWorkspace ? 'loading' : ''}`}
                                    disabled={isUpdatingWorkspace}
                                >
                                    {isUpdatingWorkspace ? (
                                        <>
                                            <span className="btn-loader"></span>
                                            Saving...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                        </>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                                <button
                                    onClick={() => setEditingWorkspace(false)}
                                    className="btn btn-outline btn-small"
                                    disabled={isUpdatingWorkspace}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <h1>{workspace.name}</h1>
                                <p className="workspace-subdomain">Subdomain: {workspace.subdomain}</p>
                                <div className="header-actions">
                                    <button
                                        onClick={() => navigate(`/workspace/${workspaceId}/dashboard`)}
                                        className="btn btn-outline btn-small"
                                    >
                                        ← Back to Dashboard
                                    </button>

                                    {permissions?.canManageWorkspace && (
                                        <button
                                            onClick={() => setEditingWorkspace(true)}
                                            className="btn btn-outline btn-small"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="workspace-actions">
                        {permissions && (
                            <div className="permission-badge">
                                Your Role: <span className="role-tag">{permissions.role}</span>
                            </div>
                        )}
                        <button
                            onClick={handleLeaveWorkspace}
                            className={`btn btn-danger btn-small ${isLeavingWorkspace ? 'loading' : ''}`}
                            disabled={permissions?.role === 'OWNER' || isLeavingWorkspace}
                            title={permissions?.role === 'OWNER' ? 'Transfer ownership before leaving' : ''}
                        >
                            {isLeavingWorkspace ? (
                                <>
                                    <span className="btn-loader"></span>
                                    Leaving...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                </>
                            ) : (
                                'Leave Workspace'
                            )}
                        </button>
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{stats?.totalMembers || 0}</div>
                        <div className="stat-label">Total Members</div>
                    </div>
                    {isOwnerOrAdmin && (
                        <>
                            <div className="stat-card">
                                <div className="stat-number">{stats?.activeMembers || 0}</div>
                                <div className="stat-label">Active Members</div>
                            </div>
                            <div className="stat-card">
                                {/* <div className="stat-number">{invitations.filter(i => i.status === 'PENDING').length}</div> */}
                                <div className="stat-number">{invitationsPagination.total || 0}</div>
                                <div className="stat-label">Pending Invitations</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{workspace._count?.members || 0}</div>
                                <div className="stat-label">Active Sessions</div>
                            </div>
                        </>
                    )}
                </div>

                {/* Tabs */}
                <div className="workspace-tabs">
                    <button
                        className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => setActiveTab('members')}
                    >
                        Members ({members.length})
                    </button>

                    {isOwnerOrAdmin && (
                        <button
                            className={`tab-button ${activeTab === 'invitations' ? 'active' : ''}`}
                            onClick={() => setActiveTab('invitations')}
                        >
                            Invitations ({invitationsPagination.total || 0})
                        </button>
                    )}

                    {isOwnerOrAdmin && (
                        <button
                            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                            disabled={!permissions?.canManageWorkspace}
                        >
                            Settings
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="overview-content">
                            <div className="permissions-section">
                                <h3>Your Permissions</h3>
                                <div className="permissions-grid">
                                    {permissions?.permissions.map((permission, index) => (
                                        <div key={index} className="permission-tag">
                                            {permission}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="role-distribution">
                                <h3>Role Distribution</h3>
                                <div className="role-bars">
                                    {stats?.roles && Object.entries(stats.roles).map(([role, count]) => (
                                        <div key={role} className="role-bar">
                                            <div className="role-label">{role.toUpperCase()}</div>
                                            <div className="bar-container">
                                                <div
                                                    className="bar-fill"
                                                    style={{
                                                        width: `${(count / (stats.totalMembers || 1)) * 100}%`
                                                    }}
                                                ></div>
                                            </div>
                                            <div className="role-count">{count}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <div className="members-content">
                            <div className="section-header">
                                <h3>Workspace Members</h3>
                                {permissions?.canManageMembers && isOwnerOrAdmin && (
                                    <div className="member-actions-header">
                                        <button
                                            onClick={() => setShowInviteForm(!showInviteForm)}
                                            className="btn btn-primary"
                                        >
                                            + Invite Member
                                        </button>
                                        <button
                                            onClick={() => setShowImportModal(true)}
                                            className="btn btn-secondary"
                                            style={{ marginLeft: '10px' }}
                                        >
                                            📁 Bulk Invite
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Invite Form */}
                            {showInviteForm && (
                                <div className="invite-form">
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="Enter email address"
                                            className="form-input"
                                            disabled={isInvitingMember}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Role</label>
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="MEMBER">Member</option>
                                            <option value="VIEWER">Viewer</option>
                                            <option value="EDITOR">Editor</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                    <div className="form-actions">
                                        <button
                                            onClick={handleInviteMember}
                                            className={`btn btn-primary ${isInvitingMember ? 'loading' : ''}`}
                                            disabled={isInvitingMember}
                                        >
                                            {isInvitingMember ? (
                                                <>
                                                    <span className="btn-loader"></span>
                                                    Sending...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                                </>
                                            ) : (
                                                'Send Invitation'
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setShowInviteForm(false)}
                                            className="btn btn-outline"
                                            disabled={isInvitingMember}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    {isInvitingMember && databaseOptimization.enabled && (
                                        <div className="loading-info">
                                            <small>
                                                <i>
                                                    Optimizing database performance ({databaseOptimization.minLoadingTime ? databaseOptimization.minLoadingTime / 1000 : 1}s minimum)...
                                                </i>
                                            </small>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Members List */}
                            <div className="members-list">
                                {members.map((member) => (
                                    <div key={member.id} className="member-card">
                                        <div className="member-info">
                                            <div className="member-avatar">
                                                {member.profile?.avatar ? (
                                                    <img src={member.profile.avatar} alt={member.email} />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {member.email.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="member-details">
                                                <div className="member-name">
                                                    {member.profile?.firstName && member.profile?.lastName
                                                        ? `${member.profile.firstName} ${member.profile.lastName}`
                                                        : member.email.split('@')[0]}
                                                </div>
                                                <div className="member-email">{member.email}</div>
                                                <div className="member-meta">
                                                    Joined: {new Date(member.joinedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="member-actions">
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                                                disabled={
                                                    !permissions?.canManageMembers ||
                                                    member.role === 'OWNER' ||
                                                    member.userId === user?.id ||
                                                    isUpdatingRole === member.userId
                                                }
                                                className="role-select"
                                            >
                                                <option value="OWNER">Owner</option>
                                                <option value="ADMIN">Admin</option>
                                                <option value="EDITOR">Editor</option>
                                                <option value="VIEWER">Viewer</option>
                                                <option value="MEMBER">Member</option>
                                            </select>

                                            {permissions?.canManageMembers &&
                                                member.role !== 'OWNER' &&
                                                member.userId !== user?.id && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.userId)}
                                                        className={`btn btn-danger btn-small ${isRemovingMember === member.userId ? 'loading' : ''}`}
                                                        disabled={isRemovingMember === member.userId}
                                                    >
                                                        {isRemovingMember === member.userId ? (
                                                            <>
                                                                <span className="btn-loader"></span>
                                                                Removing...
                                                            </>
                                                        ) : (
                                                            'Remove'
                                                        )}
                                                    </button>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Invitations Tab */}
                    {activeTab === 'invitations' && isOwnerOrAdmin && (
                        <div className="invitations-content">
                            <div className="section-header">
                                <h3>Pending Invitations</h3>
                                {isOwnerOrAdmin && permissions?.canManageMembers && (

                                    <div className="member-actions-header">
                                        <button
                                            onClick={() => setShowInviteForm(!showInviteForm)}
                                            className="btn btn-primary"
                                        >
                                            + New Invitation
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Limit selector */}
                            <div className="limit-selector" style={{ marginBottom: '15px' }}>
                                <label>Show: </label>
                                <select
                                    value={invitationsPagination.limit}
                                    onChange={(e) => handleInvitationsLimitChange(parseInt(e.target.value))}
                                    className="form-select"
                                    style={{ width: 'auto', display: 'inline-block', marginLeft: '10px' }}
                                >
                                    <option value="10">10 per page</option>
                                    <option value="25">25 per page</option>
                                    <option value="50">50 per page</option>
                                    <option value="100">100 per page</option>
                                </select>
                            </div>

                            {showInviteForm && (
                                <div className="invite-form">
                                    <div className="form-group">
                                        <label>Email Address</label>
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="Enter email address"
                                            className="form-input"
                                            disabled={isInvitingMember}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Role</label>
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="MEMBER">Member</option>
                                            <option value="VIEWER">Viewer</option>
                                            <option value="EDITOR">Editor</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                    <div className="form-actions">
                                        <button
                                            onClick={handleInviteMember}
                                            className={`btn btn-primary ${isInvitingMember ? 'loading' : ''}`}
                                            disabled={isInvitingMember}
                                        >
                                            {isInvitingMember ? (
                                                <>
                                                    <span className="btn-loader"></span>
                                                    Sending...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                                </>
                                            ) : (
                                                'Send Invitation'
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setShowInviteForm(false)}
                                            className="btn btn-outline"
                                            disabled={isInvitingMember}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    {isInvitingMember && databaseOptimization.enabled && (
                                        <div className="loading-info">
                                            <small>
                                                <i>
                                                    Optimizing database performance ({databaseOptimization.minLoadingTime ? databaseOptimization.minLoadingTime / 1000 : 1}s minimum)...
                                                </i>
                                            </small>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="invitations-list">
                                {pendingInvitations.map((invitation) => (
                                    <div key={invitation.id} className="workspace-invitation-card">
                                        <div className="workspace-invitation-info">
                                            <div className="workspace-invitation-email">{invitation.email}</div>
                                            <div className="workspace-invitation-meta">
                                                <span className="workspace-invitation-tag workspace-invitation-tag-role">
                                                    Role: {invitation.role}
                                                </span>
                                                <span className="workspace-invitation-tag workspace-invitation-tag-expires">
                                                    Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                                                </span>
                                                {invitation.invitedByUser && (
                                                    <span className="workspace-invitation-tag workspace-invitation-tag-inviter">
                                                        Invited by: {invitation.invitedByUser.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="workspace-invitation-actions">
                                            <button
                                                onClick={() => handleCancelInvitation(invitation.id)}
                                                className={`btn btn-danger btn-small ${isCancellingInvitation === invitation.id ? 'loading' : ''}`}
                                                disabled={isCancellingInvitation === invitation.id}
                                            >
                                                {isCancellingInvitation === invitation.id ? (
                                                    <>
                                                        <span className="btn-loader"></span>
                                                        Cancelling...
                                                    </>
                                                ) : (
                                                    'Cancel'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {pendingInvitations.length === 0 && (
                                    <div className="empty-state">
                                        <p>No pending invitations</p>
                                    </div>
                                )}
                            </div>

                            {invitationsPagination.totalPages > 1 && (
                                <div className="pagination-container-new" style={{ marginTop: '20px' }}>
                                    <div className="pagination-controls">
                                        <div className="pagination-left">
                                            <button
                                                className="pagination-btn prev-btn"
                                                onClick={() => handleInvitationsPageChange(invitationsPagination.page - 1)}
                                                disabled={invitationsPagination.page === 1 || loading}
                                            >
                                                Previous
                                            </button>
                                        </div>

                                        <div className="pagination-center">
                                            <div className="page-numbers">
                                                {renderInvitationsPaginationNumbers()}
                                            </div>
                                        </div>

                                        <div className="pagination-right">
                                            <button
                                                className="pagination-btn next-btn"
                                                onClick={() => handleInvitationsPageChange(invitationsPagination.page + 1)}
                                                disabled={invitationsPagination.page === invitationsPagination.totalPages || loading}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>

                                    {/* Page Jump */}
                                    <div className="page-jump-container">
                                        <span className="page-jump-label">Go to page:</span>
                                        <input
                                            type="text"
                                            value={invitationsPageJumpValue}
                                            onChange={handleInvitationsPageJumpInputChange}
                                            onKeyDown={handleInvitationsPageJumpKeyDown}
                                            className="page-input"
                                            placeholder="Page number"
                                            disabled={loading}
                                        />
                                        <button
                                            className="page-input-btn"
                                            onClick={handleInvitationsPageJump}
                                            disabled={loading}
                                        >
                                            Go
                                        </button>
                                        <span className="total-pages-info">
                                            of {invitationsPagination.totalPages.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Pagination Stats */}
                                    <div className="pagination-stats">
                                        <span className="pagination-info">
                                            Page {invitationsPagination.page.toLocaleString()} of {invitationsPagination.totalPages.toLocaleString()}
                                        </span>
                                        <span className="pagination-total">
                                            ({invitationsPagination.total.toLocaleString()} total invitations)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && isOwnerOrAdmin && permissions?.canManageWorkspace && (
                        <div className="settings-content">
                            <div className="settings-section">
                                <h3>Workspace Settings</h3>
                                <div className="settings-form">
                                    <div className="form-group">
                                        <label>Workspace Name</label>
                                        <input
                                            type="text"
                                            value={workspaceName}
                                            onChange={(e) => setWorkspaceName(e.target.value)}
                                            className="form-input"
                                            disabled={isUpdatingWorkspace}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Subdomain</label>
                                        <input
                                            type="text"
                                            value={workspace.subdomain}
                                            readOnly
                                            className="form-input"
                                            disabled
                                        />
                                        <small className="form-help">Subdomain cannot be changed</small>
                                    </div>
                                    <div className="form-actions">
                                        <button
                                            onClick={handleUpdateWorkspace}
                                            className={`btn btn-primary ${isUpdatingWorkspace ? 'loading' : ''}`}
                                            disabled={isUpdatingWorkspace}
                                        >
                                            {isUpdatingWorkspace ? (
                                                <>
                                                    <span className="btn-loader"></span>
                                                    Saving...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                                </>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    </div>
                                    {isUpdatingWorkspace && databaseOptimization.enabled && (
                                        <div className="loading-info">
                                            <small>
                                                <i>
                                                    Optimizing database performance ({databaseOptimization.minLoadingTime ? databaseOptimization.minLoadingTime / 1000 : 1}s minimum)...
                                                </i>
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="settings-section danger-zone">
                                <h3>Danger Zone</h3>
                                <div className="danger-actions">
                                    <button
                                        onClick={handleLeaveWorkspace}
                                        className={`btn btn-danger ${isLeavingWorkspace ? 'loading' : ''}`}
                                        disabled={permissions.role === 'OWNER' || isLeavingWorkspace}
                                    >
                                        {isLeavingWorkspace ? (
                                            <>
                                                <span className="btn-loader"></span>
                                                Leaving...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                            </>
                                        ) : (
                                            'Leave Workspace'
                                        )}
                                    </button>
                                    <p className="danger-note">
                                        {permissions.role === 'OWNER'
                                            ? 'You must transfer ownership before leaving the workspace.'
                                            : 'This action cannot be undone.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {showImportModal && (
                        <WorkspaceImportModal
                            isOpen={showImportModal}
                            onClose={() => setShowImportModal(false)}
                            workspaceId={workspaceId || ''}
                            workspaceName={workspace.name}
                            onImportSuccess={(resultData) => {
                                showToast(`Sent ${resultData.invited} invitations successfully`, 'success');
                                fetchInvitations(); // Refresh pending invitations
                                fetchWorkspaceMembers(); // Refresh members list
                            }}
                            onRefreshInvitations={() => {
                                fetchInvitations();
                            }}
                        />
                    )}
                </div>
            </div>
        </BaseLayout>
    );

}

export default WorkspaceManagement;