import type { User } from "./user.types";
import "./UserTable.css";

interface UserTableProps {
    users: User[];
    selectedUsers: string[];
    onSelectUser: (userId: string) => void;
    onSelectAll: () => void;
    onEditUser: (user: User) => void;
    onDeleteUser: (user: User) => void;
    onStatusChange: (userId: string, isActive: boolean) => void;
    onRoleChange: (userId: string, role: User['role']) => void;
    onUnlockUser: (userId: string) => void;
    onVerifyEmail: (userId: string) => void;
    currentAdminRole?: User['role']; // Thêm prop này
}

const UserTable = ({
    users,
    selectedUsers,
    onSelectUser,
    onSelectAll,
    onEditUser,
    onDeleteUser,
    onStatusChange,
    onRoleChange,
    onUnlockUser,
    onVerifyEmail,
    currentAdminRole = 'ADMIN'
}: UserTableProps) => {

    const allCurrentPageSelected =
        users.length > 0 &&
        users.every(user => selectedUsers.includes(user.id));

    const getStatusBadgeClass = (user: User) => {
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            return 'status-badge status-locked';
        }
        return user.isActive
            ? 'status-badge status-active'
            : 'status-badge status-inactive';
    };

    const getRoleBadgeClass = (role: User['role']) => {
        switch (role) {
            case 'SUPER_ADMIN': return 'role-badge role-super-admin';
            case 'ADMIN': return 'role-badge role-admin';
            case 'MODERATOR': return 'role-badge role-moderator';
            case 'USER': return 'role-badge role-user';
            case 'GUEST': return 'role-badge role-guest';
            default: return 'role-badge';
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getUserName = (user: User) => {
        if (user.profile?.firstName && user.profile?.lastName) {
            return `${user.profile.firstName} ${user.profile.lastName}`;
        }
        return user.email.split('@')[0];
    };

    const getUserInitials = (user: User) => {
        const name = getUserName(user);
        return name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const isUserLocked = (user: User) => {
        return user.lockedUntil && new Date(user.lockedUntil) > new Date();
    };

    const getStatusColor = (user: User) => {
        if (isUserLocked(user)) {
            return '#92ab00ff';
        }
        return user.isActive ? '#27ae60' : '#95a5a6';
    };

    const canChangeRole = (currentUserRole: User['role'], targetRole: User['role']): boolean => {
        if (currentAdminRole === 'SUPER_ADMIN') {
            return true;
        }

        if (currentAdminRole === 'ADMIN') {
            const allowedRoles: User['role'][] = ['USER', 'MODERATOR', 'GUEST'];
            // ADMIN không thể thay đổi role của ADMIN khác
            if (currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') {
                return false;
            }
            return allowedRoles.includes(targetRole);
        }

        return false;
    };

    const canDeleteUser = (user: User): boolean => {
        // SUPER_ADMIN có thể xóa mọi user trừ chính mình
        if (currentAdminRole === 'SUPER_ADMIN') {
            return true;
        }

        // ADMIN không thể xóa SUPER_ADMIN và ADMIN khác
        if (currentAdminRole === 'ADMIN') {
            return user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN';
        }

        return false;
    };

    const getAvailableRoles = (user: User): User['role'][] => {
        if (currentAdminRole === 'SUPER_ADMIN') {
            return ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'USER', 'GUEST'];
        }

        if (currentAdminRole === 'ADMIN') {
            if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                // Không thể thay đổi role của admin khác
                return [user.role]; // Chỉ hiển thị role hiện tại
            }
            return ['USER', 'MODERATOR', 'GUEST'];
        }

        return ['USER'];
    };

    const isMobile = window.innerWidth <= 640;

    // Helper để render role options
    const renderRoleOptions = (user: User) => {
        const availableRoles = getAvailableRoles(user);

        return availableRoles.map(role => (
            <option
                key={role}
                value={role}
                disabled={!canChangeRole(user.role, role)}
            >
                {role === 'SUPER_ADMIN' ? 'Super Admin' :
                    role === 'ADMIN' ? 'Admin' :
                        role === 'MODERATOR' ? 'Moderator' :
                            role === 'USER' ? 'User' : 'Guest'}
            </option>
        ));
    };

    if (isMobile) {
        // Mobile card view
        return (
            <div className="users-table-container">
                <div className="mobile-users-list">
                    {users.map(user => (
                        <div
                            key={user.id}
                            className={`mobile-user-card ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                        >
                            <div className="mobile-user-header">
                                <div className="mobile-user-avatar-main" style={{
                                    background: getStatusColor(user)
                                }}>
                                    {getUserInitials(user)}
                                </div>
                                <div className="mobile-user-info-main">
                                    <div className="mobile-user-name-main">{getUserName(user)}</div>
                                    <div className="mobile-user-email-main">{user.email}</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => onSelectUser(user.id)}
                                    className="mobile-user-checkbox"
                                />
                            </div>

                            <div className="mobile-user-details">
                                <div className="mobile-detail-row">
                                    <span className="detail-label">Role:</span>
                                    <select
                                        className={getRoleBadgeClass(user.role)}
                                        value={user.role}
                                        onChange={(e) => onRoleChange(user.id, e.target.value as User['role'])}
                                        disabled={!canChangeRole(user.role, user.role)}
                                    >
                                        {renderRoleOptions(user)}
                                    </select>
                                    {user.role === 'SUPER_ADMIN' && (
                                        <span className="role-protected-badge">👑 Protected</span>
                                    )}
                                    {user.role === 'ADMIN' && currentAdminRole === 'ADMIN' && (
                                        <span className="role-protected-badge">🔒 Protected</span>
                                    )}
                                </div>

                                <div className="mobile-detail-row">
                                    <span className="detail-label">Status:</span>
                                    <div className="mobile-status-group">
                                        <select
                                            className={getStatusBadgeClass(user)}
                                            value={user.isActive ? 'active' : 'inactive'}
                                            onChange={(e) => onStatusChange(user.id, e.target.value === 'active')}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                        {isUserLocked(user) && (
                                            <button
                                                className="btn-unlock mobile"
                                                onClick={() => onUnlockUser(user.id)}
                                                title="Unlock user"
                                            >
                                                🔓 Unlock
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mobile-detail-row">
                                    <span className="detail-label">Email:</span>
                                    <div className="mobile-email-group">
                                        <div className="mobile-email-text">{user.email}</div>
                                        <div className="mobile-email-verified">
                                            {user.isEmailVerified ? (
                                                <span className="verified">✅ Verified</span>
                                            ) : (
                                                <button
                                                    className="btn-verify mobile"
                                                    onClick={() => onVerifyEmail(user.id)}
                                                    title="Verify email"
                                                >
                                                    ❌ Verify
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mobile-detail-row">
                                    <span className="detail-label">Last Login:</span>
                                    <div className="mobile-login-info">
                                        <div>{formatDateTime(user.lastLoginAt)}</div>
                                        <div className="mobile-sessions">
                                            {user.sessions} active session{user.sessions !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="mobile-detail-row">
                                    <span className="detail-label">Failed Logins:</span>
                                    <div className="mobile-failed-logins">
                                        <span className="mobile-failed-count">{user.failedLoginAttempts}</span>
                                        {user.failedLoginAttempts > 0 && (
                                            <span className="mobile-failed-warning">
                                                ⚠️ {user.failedLoginAttempts} attempt{user.failedLoginAttempts !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mobile-detail-row">
                                    <span className="detail-label">Joined:</span>
                                    <span>{formatDate(user.createdAt)}</span>
                                </div>
                            </div>

                            <div className="mobile-actions">
                                <button
                                    className="btn-action btn-edit mobile"
                                    onClick={() => onEditUser(user)}
                                    title="Edit user"
                                >
                                    ✏️ Edit
                                </button>
                                <button
                                    className="btn-action btn-delete mobile"
                                    onClick={() => onDeleteUser(user)}
                                    title="Delete user"
                                    disabled={!canDeleteUser(user)}
                                >
                                    🗑️ Delete
                                </button>
                                {!canDeleteUser(user) && (
                                    <span className="delete-disabled-hint">
                                        {user.role === 'SUPER_ADMIN' ? 'Cannot delete Super Admin' :
                                            user.role === 'ADMIN' ? 'Cannot delete Admin' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {users.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">👤</div>
                            <h3>No users found</h3>
                            <p>Try adjusting your filters or add a new user</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Desktop table view
    return (
        <div className="users-table-container">
            <table className="users-table">
                <thead>
                    <tr>
                        <th className="checkbox-cell">
                            <input
                                type="checkbox"
                                checked={allCurrentPageSelected}
                                onChange={onSelectAll}
                            />
                        </th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Email</th>
                        <th>Last Login</th>
                        <th>Joined</th>
                        <th>Failed Logins</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id} className={selectedUsers.includes(user.id) ? 'selected' : ''}>
                            <td className="checkbox-cell">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => onSelectUser(user.id)}
                                />
                            </td>
                            <td className="user-cell">
                                <div className="user-info">
                                    <div className="user-avatar" style={{
                                        background: getStatusColor(user)
                                    }}>
                                        {getUserInitials(user)}
                                    </div>
                                    <div className="user-name">{getUserName(user)}</div>
                                    <div className="user-email">{user.email}</div>
                                </div>
                            </td>
                            <td>
                                <div className="role-cell">
                                    <select
                                        className={getRoleBadgeClass(user.role)}
                                        value={user.role}
                                        onChange={(e) => onRoleChange(user.id, e.target.value as User['role'])}
                                        disabled={!canChangeRole(user.role, user.role)}
                                    >
                                        {renderRoleOptions(user)}
                                    </select>
                                    {user.role === 'SUPER_ADMIN' && (
                                        <span className="role-protected-badge" title="Super Admin - Protected">
                                            👑
                                        </span>
                                    )}
                                    {user.role === 'ADMIN' && currentAdminRole === 'ADMIN' && (
                                        <span className="role-protected-badge" title="Admin - Protected from other admins">
                                            🔒
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td>
                                <div className="status-cell">
                                    <select
                                        className={getStatusBadgeClass(user)}
                                        value={user.isActive ? 'active' : 'inactive'}
                                        onChange={(e) => onStatusChange(user.id, e.target.value === 'active')}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                    {isUserLocked(user) && (
                                        <button
                                            className="btn-unlock"
                                            onClick={() => onUnlockUser(user.id)}
                                            title="Unlock user"
                                        >
                                            🔓 Unlock
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td>
                                <div className="email-cell">
                                    <div className="email-text">{user.email}</div>
                                    <div className="email-verified">
                                        {user.isEmailVerified ? (
                                            <span className="verified">✅ Verified</span>
                                        ) : (
                                            <button
                                                className="btn-verify"
                                                onClick={() => onVerifyEmail(user.id)}
                                                title="Verify email"
                                            >
                                                ❌ Verify
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div className="login-cell">
                                    <div className="login-time">{formatDateTime(user.lastLoginAt)}</div>
                                    <div className="sessions-count">
                                        {user.sessions} active session{user.sessions !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </td>
                            <td>{formatDate(user.createdAt)}</td>
                            <td>
                                <div className="failed-logins-cell">
                                    <div className="failed-count">{user.failedLoginAttempts}</div>
                                    {user.failedLoginAttempts > 0 && (
                                        <div className="failed-warning">
                                            ⚠️ {user.failedLoginAttempts} attempt{user.failedLoginAttempts !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="actions-cell">
                                <button
                                    className="btn-action btn-edit"
                                    onClick={() => onEditUser(user)}
                                    title="Edit user"
                                >
                                    ✏️ Edit
                                </button>
                                <button
                                    className="btn-action btn-delete"
                                    onClick={() => onDeleteUser(user)}
                                    title="Delete user"
                                    disabled={!canDeleteUser(user)}
                                >
                                    🗑️ Delete
                                </button>
                                {!canDeleteUser(user) && (
                                    <div className="delete-hint">
                                        {user.role === 'SUPER_ADMIN' ? '👑 Super Admin' :
                                            user.role === 'ADMIN' ? '🔒 Admin' : ''}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {users.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">👤</div>
                    <h3>No users found</h3>
                    <p>Try adjusting your filters or add a new user</p>
                </div>
            )}

        </div>
    );
};

export default UserTable;