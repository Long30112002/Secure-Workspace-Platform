import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "./AdminUsersManagement.css";
import { useAuth } from "../../../../auth/context/AuthContext";
import type { FilterOptions, SortOptions, User } from "./user.types";
import UserFilters from "./UserFilters";
import UserTable from "./UserTable";
import UserActions from "./UserActions";
import UserModal from "./UserModal";
import { apiService } from "../../../../../services/api/axiosConfig";
import ImportModal from "./ImportModal";
import ExportModal from "./ExportModal";
import ImportToast from "./ImportToast";
import ImportResultModal from "./ImportResultModal";

interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextPage: number | null;
    prevPage: number | null;
}

const AdminUsersManagement = () => {
    const navigate = useNavigate();
    const { user: adminUser, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | 'bulk'>('add');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchParams] = useSearchParams();
    const tableTopRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [importToastResult, setImportToastResult] = useState<any>(null);
    const [importResultData, setImportResultData] = useState<any>(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const isInitialMount = useRef(true);
    const pageJumpInputRef = useRef<HTMLInputElement>(null);

    // Thay thế các state initialization với giá trị từ URL
    const [searchTerm, setSearchTerm] = useState(() => {
        return searchParams.get('search') || '';
    });

    const [filters, setFilters] = useState<FilterOptions>(() => ({
        role: (searchParams.get('role') as FilterOptions['role']) || 'all',
        status: (searchParams.get('status') as FilterOptions['status']) || 'all',
        verified: (searchParams.get('verified') as FilterOptions['verified']) || 'all'
    }));

    const [sortOption, setSortOption] = useState<SortOptions>(() => {
        return (searchParams.get('sort') as SortOptions) || 'newest';
    });

    // Sử dụng PaginationState type
    const [pagination, setPagination] = useState<PaginationState>(() => {
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        return {
            page: isNaN(page) ? 1 : Math.max(1, page),
            limit: isNaN(limit) ? 10 : limit,
            total: 0,
            totalPages: 1,
            hasMore: false,
            nextPage: null,
            prevPage: null,
        };
    });

    // State cho page jump
    const [pageJumpValue, setPageJumpValue] = useState(pagination.page.toString());

    // Memoized query params
    const queryParams = useMemo(() => {
        const params = new URLSearchParams();

        // LUÔN có page và limit
        params.set('page', pagination.page.toString());
        params.set('limit', pagination.limit.toString());

        // Các params khác chỉ thêm nếu không phải giá trị mặc định
        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (filters.role !== 'all') params.set('role', filters.role);
        if (filters.status !== 'all') params.set('status', filters.status);
        if (filters.verified !== 'all') params.set('verified', filters.verified);
        if (sortOption !== 'newest') params.set('sort', sortOption);

        return params;
    }, [searchTerm, filters, sortOption, pagination.page, pagination.limit]);

    // Cập nhật URL khi query params thay đổi
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        // const newParams = new URLSearchParams();

        // Object.entries(queryParams).forEach(([key, value]) => {
        //     if (value && value !== 'all') {
        //         newParams.set(key, value);
        //     }
        // });

        const currentString = new URLSearchParams(location.search).toString();
        const newString = queryParams.toString();

        if (currentString !== newString) {
            navigate(`?${newString}`, { replace: true });
        }
    }, [queryParams, navigate, location.search]);

    // Cập nhật page jump value khi pagination.page thay đổi
    useEffect(() => {
        setPageJumpValue(pagination.page.toString());
    }, [pagination.page]);

    // Scroll to top khi page thay đổi
    useEffect(() => {
        if (!loading) {
            tableTopRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [pagination.page, loading]);

    // Kiểm tra quyền admin
    useEffect(() => {
        if (!authLoading && (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN'))) {
            navigate('/admin/homepage');
        }
    }, [adminUser, authLoading, navigate]);

    // Fetch user từ API
    const fetchUsers = useCallback(async (targetPage: number = pagination.page) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();

            if (searchTerm.trim()) {
                params.set('search', searchTerm.trim());
            }

            if (filters.role !== 'all') {
                params.set('role', filters.role.toUpperCase());
            }

            if (filters.status !== 'all') {
                if (filters.status === 'active') {
                    params.set('isActive', 'true');
                } else if (filters.status === 'inactive') {
                    params.set('isActive', 'false');
                }
            }

            if (filters.verified !== 'all') {
                params.set(
                    'isEmailVerified',
                    filters.verified === 'verified' ? 'true' : 'false'
                );
            }

            if (sortOption !== 'newest') {
                params.set('sort', sortOption);
            }

            // Đảm bảo page hợp lệ
            const validPage = Math.max(1, targetPage);
            params.set('page', validPage.toString());
            params.set('limit', pagination.limit.toString());

            const queryString = params.toString();
            const url = `/api/user-management${queryString ? `?${queryString}` : ''}`;

            console.log(`📄 Fetching page ${validPage} from:`, url);

            const response = await apiService.request(url);

            if (response.success && response.data) {
                const formattedUsers: User[] = response.data.users.map((user: any) => ({
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    isEmailVerified: user.isEmailVerified,
                    lockedUntil: user.lockedUntil,
                    failedLoginAttempts: user.failedLoginAttempts,
                    lastLoginAt: user.lastLoginAt,
                    createdAt: user.createdAt,
                    profile: user.profile,
                    sessions: user.sessions || 0,
                }));

                setUsers(formattedUsers);
                setFilteredUsers(formattedUsers);

                // Cập nhật pagination với data chính xác từ server
                const serverPage = response.data.meta.page;
                const serverTotalPages = response.data.meta.totalPages;

                setPagination(prev => ({
                    ...prev,
                    page: serverPage,
                    limit: response.data.meta.limit,
                    total: response.data.meta.total,
                    totalPages: serverTotalPages,
                    hasMore: serverPage < serverTotalPages,
                    nextPage: serverPage < serverTotalPages ? serverPage + 1 : null,
                    prevPage: serverPage > 1 ? serverPage - 1 : null,
                }));

                // Cập nhật page jump value
                setPageJumpValue(serverPage.toString());

                console.log(`✅ Loaded page ${serverPage} of ${serverTotalPages}`);
                console.log('🎯 Current state:', {
                    page: pagination.page,
                    loading,
                    targetPage: targetPage || 'not set'
                });
            } else {
                throw new Error(response.message || 'Failed to fetch users');
            }


        } catch (error: any) {
            console.error('Error fetching users:', error);
            setError(error.message || 'An error occurred while fetching users');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filters, sortOption, pagination.limit, pagination.page]);

    // Filter locked users
    useEffect(() => {
        let result = [...users];

        if (filters.status === 'locked') {
            result = result.filter(user =>
                user.lockedUntil && new Date(user.lockedUntil) > new Date()
            );
        }

        setFilteredUsers(result);
    }, [users, filters.status]);

    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        locked: 0,
        verified: 0,
        superAdmins: 0,
        admins: 0
    });

    const fetchStats = useCallback(async () => {
        try {
            const response = await apiService.request('/api/user-management/stats');
            if (response.success) {
                setStats(response.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (!authLoading && adminUser && (adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN')) {
            fetchUsers();
            fetchStats();
        }
        // }, [authLoading, adminUser]);
    }, [authLoading, adminUser, fetchUsers, fetchStats]); // Thêm fetchUsers và fetchStats

    // Handlers
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
    };

    const handleFiltersChange = (newFilters: FilterOptions) => {
        setFilters(newFilters);
    };

    const handleSortChange = (sort: SortOptions) => {
        setSortOption(sort);
    };

    // Debounced fetch khi filters/search/sort thay đổi
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(1); // Reset về page 1
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, filters, sortOption]);

    // Xử lý thay đổi trang
    const handlePageChange = (page: number) => {
        const newPage = Math.max(1, Math.min(page, pagination.totalPages));
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    // Xử lý khi page thay đổi
    useEffect(() => {
        if (!isInitialMount.current) {
            fetchUsers(pagination.page);
        }
    }, [pagination.page]);

    // Xử lý page jump
    const handlePageJump = () => {
        const page = parseInt(pageJumpValue);
        if (!isNaN(page) && page >= 1 && page <= pagination.totalPages) {
            handlePageChange(page);
            pageJumpInputRef.current?.focus();
        }
    };

    const handlePageJumpKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePageJump();
        }
    };

    const handlePageJumpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setPageJumpValue(value);
        }
    };

    // Xử lý thay đổi limit
    const handleLimitChange = (newLimit: number) => {
        setPagination(prev => ({
            ...prev,
            limit: newLimit,
            page: 1 // Reset về page 1
        }));
    };

    // Xử lý khi limit thay đổi
    useEffect(() => {
        if (!isInitialMount.current) {
            fetchUsers(1);
        }
    }, [pagination.limit]);

    // Các handlers khác giữ nguyên...
    const handleSelectUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectAll = () => {
        const currentPageIds = filteredUsers.map(u => u.id);
        const allSelected = currentPageIds.every(id => selectedUsers.includes(id));

        if (allSelected) {
            setSelectedUsers(prev => prev.filter(id => !currentPageIds.includes(id)));
        } else {
            setSelectedUsers(prev => Array.from(new Set([...prev, ...currentPageIds])));
        }
    };

    const handleAddUser = () => {
        setCurrentUser(null);
        setModalType('add');
        setIsModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setCurrentUser(user);
        setModalType('edit');
        setIsModalOpen(true);
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Are you sure you want to delete user: ${user.email}?`)) {
            return;
        }

        console.log(`🗑️ Deleting user ${user.id} (${user.email})`);

        try {
            const response = await apiService.request(`/api/user-management/${user.id}`, {
                method: 'DELETE',
            });

            if (response.success) {
                alert('User deleted successfully');
                fetchUsers(pagination.page);
                setSelectedUsers(prev => prev.filter(id => id !== user.id));
            } else {
                throw new Error(response.message || 'Failed to delete user');
            }
        } catch (error: any) {
            console.error('Error deleting user:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleBulkAction = () => {
        if (selectedUsers.length > 0) {
            setModalType('bulk');
            setIsModalOpen(true);
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)?`)) {
            return;
        }

        try {
            const response = await apiService.request('/api/user-management/bulk-delete', {
                method: 'DELETE',
                body: JSON.stringify({ userIds: selectedUsers }),
            });

            if (response.success) {
                alert(`${selectedUsers.length} user(s) deleted successfully`);
                fetchUsers(pagination.page);
                setSelectedUsers([]);
                setIsModalOpen(false);
            } else {
                throw new Error(response.message || 'Failed to delete user');
            }
        } catch (error: any) {
            console.error('Error in bulk delete:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleSaveUser = async (userData: any) => {
        try {
            if (modalType === 'add') {
                // Gọi API tạo user mới
                const response = await apiService.request('/api/user-management/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: userData.email,
                        role: userData.role || 'USER',
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        sendWelcomeEmail: true
                    }),
                });

                if (response.success) {
                    let message = 'User created successfully!';
                    if (response.data.temporaryPassword) {
                        message += ` Temporary password: ${response.data.temporaryPassword}`;
                    }
                    alert(message);
                    fetchUsers(pagination.page);
                    fetchStats();
                } else {
                    throw new Error(response.message || 'Failed to create user');
                }
            } else if (modalType === 'edit' && currentUser) {
                // Logic edit giữ nguyên
                const updateData = {
                    role: userData.role,
                    isActive: userData.isActive,
                    isEmailVerified: userData.isEmailVerified,
                    firstName: userData.profile?.firstName,    // Tách từ trong profile
                    lastName: userData.profile?.lastName,      
                    phone: userData.profile?.phone
                };

                
                const response = await apiService.request(`/api/user-management/${currentUser.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData),
                });

                if (response.success) {
                    alert('User updated successfully');
                    fetchUsers(pagination.page);
                } else {
                    throw new Error(response.message || 'Failed to update user');
                }
            }
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Error saving user:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleStatusChange = async (userId: string, isActive: boolean) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            const response = await apiService.request(`/api/user-management/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ isActive }),
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, isActive } : u
                ));
            } else {
                throw new Error(response.message || 'Failed to update user status');
            }
        } catch (error: any) {
            console.error('Error updating user status:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleRoleChange = async (userId: string, newRole: User['role']) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            const response = await apiService.request(`/api/user-management/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole }),
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, role: newRole } : u
                ));
            } else {
                throw new Error(response.message || 'Failed to update user status');
            }
        } catch (error: any) {
            console.error('Error updating user status:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleUnlockUser = async (userId: string) => {
        try {
            const response = await apiService.request(`/api/user-management/${userId}/unlock`, {
                method: 'PATCH',
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    u.id === userId
                        ? { ...u, lockedUntil: null, failedLoginAttempts: 0 }
                        : u
                ));
                alert('User unlocked successfully');
            } else {
                throw new Error(response.message || 'Failed to unlock user');
            }
        } catch (error: any) {
            console.error('Error unlocking user:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleVerifyEmail = async (userId: string) => {
        try {
            const response = await apiService.request(`/api/user-management/${userId}/verify-email`, {
                method: 'PATCH',
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, isEmailVerified: true } : u
                ));
                alert('Email verified successfully');
            } else {
                throw new Error(response.message || 'Failed to verify email');
            }
        } catch (err: any) {
            console.error('Error verifying email:', err);
            alert(`Error: ${err.message}`);
        }
    };

    const handleBulkActivate = async () => {
        if (selectedUsers.length === 0) {
            alert('Please select users to activate');
            return;
        }

        try {
            const response = await apiService.request('/api/user-management/bulk-update', {
                method: 'POST',
                body: JSON.stringify({
                    userIds: selectedUsers,
                    isActive: true
                }),
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    selectedUsers.includes(u.id) ? { ...u, isActive: true } : u
                ));
                alert(`${selectedUsers.length} user(s) activated successfully`);
            } else {
                throw new Error(response.message || 'Failed to activate users');
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleBulkDeactivate = async () => {
        if (selectedUsers.length === 0) {
            alert('Please select users to deactivate');
            return;
        }

        try {
            const response = await apiService.request('/api/user-management/bulk-update', {
                method: 'POST',
                body: JSON.stringify({
                    userIds: selectedUsers,
                    isActive: false
                }),
            });

            if (response.success) {
                setUsers(prev => prev.map(u =>
                    selectedUsers.includes(u.id) ? { ...u, isActive: false } : u
                ));
                alert(`${selectedUsers.length} user(s) deactivated successfully`);
            } else {
                throw new Error(response.message || 'Failed to deactivate users');
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleImportUsers = () => {
        setIsImportModalOpen(true);
    };

    const handleExportUsers = () => {
        setIsExportModalOpen(true);
    };

    const handleImportSuccess = (resultData: any) => {
        // Refresh user list after successful import
        fetchUsers(pagination.page);
        fetchStats();

        setImportToastResult({ data: resultData });
        setIsImportModalOpen(false);
    };

    // Thêm hàm để xử lý khi click vào toast
    const handleToastClick = () => {
        // Mở ImportResultModal với kết quả
        setImportResultData(importToastResult);
        setIsResultModalOpen(true);
    };

    const handleCloseToast = () => {
        setImportToastResult(null);
    };

    // Thêm hàm xử lý retry
    const handleImportRetry = () => {
        setIsResultModalOpen(false);
        setImportToastResult(null);
        setIsImportModalOpen(true);
    };


    const handleExportSuccess = () => {
        // Optional: Show success message or refresh
        console.log('Export completed successfully');
    };

    // Smart pagination render
    const renderPaginationNumbers = () => {
        const pages = [];
        const currentPage = pagination.page;
        const totalPages = pagination.totalPages;

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(
                    <button
                        key={i}
                        className={`page-btn ${currentPage === i ? 'active' : ''}`}
                        onClick={() => handlePageChange(i)}
                        disabled={loading}
                    >
                        {i}
                    </button>
                );
            }
        } else {
            pages.push(
                <button
                    key={1}
                    className={`page-btn ${currentPage === 1 ? 'active' : ''}`}
                    onClick={() => handlePageChange(1)}
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

            if (startPage > 2) {
                pages.push(
                    <span key="ellipsis1" className="page-ellipsis">
                        ...
                    </span>
                );
            }

            for (let i = startPage; i <= endPage; i++) {
                if (i > 1 && i < totalPages) {
                    pages.push(
                        <button
                            key={i}
                            className={`page-btn ${currentPage === i ? 'active' : ''}`}
                            onClick={() => handlePageChange(i)}
                            disabled={loading}
                        >
                            {i}
                        </button>
                    );
                }
            }

            if (endPage < totalPages - 1) {
                pages.push(
                    <span key="ellipsis2" className="page-ellipsis">
                        ...
                    </span>
                );
            }

            if (totalPages > 1) {
                pages.push(
                    <button
                        key={totalPages}
                        className={`page-btn ${currentPage === totalPages ? 'active' : ''}`}
                        onClick={() => handlePageChange(totalPages)}
                        disabled={loading}
                    >
                        {totalPages}
                    </button>
                );
            }
        }

        return pages;
    };

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading user management...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <h3>Error loading users</h3>
                <p>{error}</p>
                <button onClick={() => fetchUsers(pagination.page)} className="btn-retry">
                    Retry
                </button>
            </div>
        );
    }

    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'SUPER_ADMIN')) {
        return (
            <div className="error-container">
                <h3>Access Denied</h3>
                <p>You don't have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className="admin-users-management">
            {/* Header */}
            <div className="users-header">
                <div>
                    <h1>User Management</h1>
                    <p className="subtitle">
                        Manage user accounts, roles, and security settings
                    </p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-refresh"
                        onClick={() => fetchUsers(pagination.page)}
                        title="Refresh users"
                        disabled={loading}
                    >
                        🔄 Refresh
                    </button>
                    <button className="btn-add-user" onClick={handleAddUser}>
                        <span>+</span> Add New User
                    </button>
                </div>
            </div>

            {/* Import Toast - THÊM VÀO ĐÂY */}
            {importToastResult && (
                <ImportToast
                    result={importToastResult}
                    onShowDetails={handleToastClick}
                    onClose={handleCloseToast}
                />
            )}

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-label">Total Users</div>
                    </div>
                </div>
                <div className="stat-card stat-active">
                    <div className="stat-icon">🟢</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.active}</div>
                        <div className="stat-label">Active</div>
                    </div>
                </div>
                <div className="stat-card stat-inactive">
                    <div className="stat-icon">⚫</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.inactive}</div>
                        <div className="stat-label">Inactive</div>
                    </div>
                </div>
                <div className="stat-card stat-locked">
                    <div className="stat-icon">🔒</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.locked}</div>
                        <div className="stat-label">Locked</div>
                    </div>
                </div>
                <div className="stat-card stat-verified">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.verified}</div>
                        <div className="stat-label">Verified</div>
                    </div>
                </div>
                <div className="stat-card stat-admin">
                    <div className="stat-icon">👑</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.admins + stats.superAdmins}</div>
                        <div className="stat-label">Admins</div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <UserFilters
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                sortOption={sortOption}
                onSortChange={handleSortChange}
                onLimitChange={handleLimitChange}
                currentLimit={pagination.limit}
            />

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && (
                <div className="bulk-actions-bar">
                    <div className="selected-count">
                        {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                    </div>
                    <div className="bulk-buttons">
                        <button
                            className="btn-bulk btn-activate"
                            onClick={handleBulkActivate}
                        >
                            Activate
                        </button>
                        <button
                            className="btn-bulk btn-deactivate"
                            onClick={handleBulkDeactivate}
                        >
                            Deactivate
                        </button>
                        <button
                            className="btn-bulk btn-verify"
                            onClick={() => selectedUsers.forEach(id => handleVerifyEmail(id))}
                        >
                            Verify Email
                        </button>
                        <button
                            className="btn-bulk btn-delete"
                            onClick={handleBulkAction}
                        >
                            Delete
                        </button>
                        <button
                            className="btn-clear"
                            onClick={() => setSelectedUsers([])}
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            <div ref={tableTopRef}></div>

            {/* Users Table */}
            <UserTable
                users={filteredUsers}
                selectedUsers={selectedUsers}
                onSelectUser={handleSelectUser}
                onSelectAll={handleSelectAll}
                onEditUser={handleEditUser}
                onDeleteUser={handleDeleteUser}
                onStatusChange={handleStatusChange}
                onRoleChange={handleRoleChange}
                onUnlockUser={handleUnlockUser}
                onVerifyEmail={handleVerifyEmail}
                currentAdminRole={adminUser?.role}
            />

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
                <div className="pagination-container-new">
                    <div className="pagination-controls">
                        <div className="pagination-left">
                            <button
                                className="pagination-btn prev-btn"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1 || loading}
                            >
                                Previous
                            </button>
                        </div>

                        <div className="pagination-center">
                            <div className="page-numbers">
                                {renderPaginationNumbers()}
                            </div>
                        </div>

                        <div className="pagination-right">
                            <button
                                className="pagination-btn next-btn"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages || loading}
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    {/* Page Jump */}
                    <div className="page-jump-container">
                        <span className="page-jump-label">Go to page:</span>
                        <input
                            ref={pageJumpInputRef}
                            type="text"
                            value={pageJumpValue}
                            onChange={handlePageJumpInputChange}
                            onKeyDown={handlePageJumpKeyDown}
                            className="page-input"
                            placeholder="Page number"
                            disabled={loading}
                        />
                        <button
                            className="page-input-btn"
                            onClick={handlePageJump}
                            disabled={loading}
                        >
                            Go
                        </button>
                        <span className="total-pages-info">
                            of {pagination.totalPages.toLocaleString()}
                        </span>
                    </div>

                    {/* Pagination Stats */}
                    <div className="pagination-stats">
                        <span className="pagination-info">
                            Page {pagination.page.toLocaleString()} of {pagination.totalPages.toLocaleString()}
                        </span>
                        <span className="pagination-total">
                            ({pagination.total.toLocaleString()} total users)
                        </span>
                    </div>

                    {/* Load More Button
                    {pagination.hasMore && (
                        <div className="load-more-container">
                            <button
                                className="btn-load-more"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Load More Users'}
                            </button>
                        </div>
                    )} */}
                </div>
            )}

            {/* Import Modal */}
            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={handleImportSuccess}
            />

            {/* Import Result Modal - SỬA PROP isOpen */}
            <ImportResultModal
                isOpen={isResultModalOpen}  // Sử dụng isResultModalOpen
                result={importResultData}
                onClose={() => setIsResultModalOpen(false)}
                onRetry={handleImportRetry}
            />

            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                selectedUsers={selectedUsers}
                onExportSuccess={handleExportSuccess}
            />

            {/* Quick Actions */}
            <UserActions
                onAddUser={handleAddUser}
                onExportUsers={handleExportUsers}
                onImportUsers={handleImportUsers}
                onGenerateReport={() => alert('Report generation coming soon!')}
                selectedCount={selectedUsers.length}
            />

            {/* User Modal */}
            <UserModal
                isOpen={isModalOpen}
                type={modalType}
                user={currentUser}
                selectedCount={selectedUsers.length}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveUser}
                onDelete={handleDeleteSelected}
                currentAdminRole={adminUser?.role}
                currentUserId={adminUser?.id}
            />

        </div>
    );
};

export default AdminUsersManagement;