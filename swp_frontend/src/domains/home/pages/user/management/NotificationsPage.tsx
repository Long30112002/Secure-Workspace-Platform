import { useState, useEffect } from 'react';
import BaseLayout from '../../../../../shared/components/layout/BaseLayout';
import { useNotification } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './NotificationsPage.css';

export default function NotificationsPage() {
    const {
        notifications,
        invitations: notificationInvitations,
        unreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        removeNotification,
        archiveNotification,
        loadNotifications,
        isLoading,
        getNotificationStats
    } = useNotification();

    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived' | 'notif-invitations' | 'workspace-invitations'>('all');
    const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        type: '',
        workspaceId: '',
        fromDate: '',
        toDate: ''
    });
    const [workspaceInvitations, setWorkspaceInvitations] = useState<any[]>([]);
    const [loadingWorkspaceInvitations, setLoadingWorkspaceInvitations] = useState(false);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);

    useEffect(() => {
        loadNotifications();
        if (activeTab === 'workspace-invitations') {
            fetchWorkspaceInvitations();
        }
    }, [loadNotifications, activeTab]);

    useEffect(() => {
        if (activeTab === 'workspace-invitations') {
            fetchWorkspaceInvitations();
        }
    }, [activeTab]);

    const fetchWorkspaceInvitations = async () => {
        setLoadingWorkspaceInvitations(true);
        try {
            console.log('Fetching workspace invitations...');
            const response = await fetch('http://localhost:3000/api/workspace/invitations/pending', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('API response:', data);
                if (data.success) {
                    console.log('Invitations found:', data.data?.length || 0);
                    setWorkspaceInvitations(data.data || []);
                }
            } else {
                console.error('API error:', response.status, response.statusText);
                if (response.status === 401) {
                    console.log('User not authenticated');
                }
            }
        } catch (error) {
            console.error('Failed to fetch invitations:', error);
        } finally {
            setLoadingWorkspaceInvitations(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        await markNotificationAsRead(id);
    };

    const handleBulkMarkAsRead = async () => {
        for (const id of selectedNotifications) {
            await markNotificationAsRead(id);
        }
        setSelectedNotifications([]);
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${selectedNotifications.length} notifications?`)) {
            for (const id of selectedNotifications) {
                await removeNotification(id);
            }
            setSelectedNotifications([]);
        }
    };

    const handleSelectAll = () => {
        const currentNotifications = getFilteredNotifications();
        if (selectedNotifications.length === currentNotifications.length) {
            setSelectedNotifications([]);
        } else {
            setSelectedNotifications(currentNotifications.map(n => n.id));
        }
    };

    const handleSelectNotification = (id: string) => {
        setSelectedNotifications(prev =>
            prev.includes(id)
                ? prev.filter(nid => nid !== id)
                : [...prev, id]
        );
    };

    const getFilteredNotifications = () => {
        let filtered = [...notifications];

        if (activeTab === 'unread') {
            filtered = filtered.filter(n => !n.read);
        } else if (activeTab === 'archived') {
            filtered = filtered.filter(n => n.archived);
        } else if (activeTab === 'notif-invitations') {
            filtered = filtered.filter(n => n.type === 'WORKSPACE_INVITATION');
        }

        if (filters.type) {
            filtered = filtered.filter(n => n.type === filters.type);
        }

        if (filters.workspaceId) {
            filtered = filtered.filter(n => n.workspaceId === filters.workspaceId);
        }

        if (filters.fromDate) {
            const fromDate = new Date(filters.fromDate);
            filtered = filtered.filter(n => new Date(n.createdAt) >= fromDate);
        }

        if (filters.toDate) {
            const toDate = new Date(filters.toDate);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(n => new Date(n.createdAt) <= toDate);
        }

        return filtered.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateOnly = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'WORKSPACE_POST': return '📝';
            case 'WORKSPACE_MENTION': return '👤';
            case 'WORKSPACE_INVITATION': return '📨';
            case 'WORKSPACE_COMMENT': return '💬';
            case 'WORKSPACE_FILE': return '📎';
            case 'WORKSPACE_EVENT': return '📅';
            case 'SYSTEM': return '🔧';
            case 'BILLING': return '💰';
            case 'SECURITY': return '🔒';
            case 'ACHIEVEMENT': return '🏆';
            default: return '🔔';
        }
    };

    const handleAcceptInvitation = async (invitation: any) => {
        setAcceptingId(invitation.id);
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: invitation.token })
            });

            const data = await response.json();
            if (data.success) {
                alert('🎉 Invitation accepted successfully!');
                // Remove from list
                setWorkspaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
                // Navigate to workspace if needed
                if (data.data?.workspace) {
                    navigate(`/workspace/${data.data.workspace.id}`);
                }
            } else {
                alert(data.message || 'Failed to accept invitation');
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            alert('Failed to accept invitation');
        } finally {
            setAcceptingId(null);
        }
    };

    const handleDeclineInvitation = async (invitation: any) => {
        setDecliningId(invitation.id);
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: invitation.token })
            });

            const data = await response.json();
            if (data.success) {
                alert('Invitation declined');
                setWorkspaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } else {
                alert(data.message || 'Failed to decline invitation');
            }
        } catch (error) {
            console.error('Error declining invitation:', error);
            alert('Failed to decline invitation');
        } finally {
            setDecliningId(null);
        }
    };

    const stats = getNotificationStats();
    const filteredNotifications = getFilteredNotifications();

    const renderWorkspaceInvitations = () => {
        if (loadingWorkspaceInvitations) {
            return (
                <div className="loading-invitations">
                    <div className="spinner"></div>
                    <p>Loading workspace invitations...</p>
                </div>
            );
        }

        if (workspaceInvitations.length === 0) {
            return (
                <div className="empty-invitations">
                    <div className="empty-icon">📨</div>
                    <h3>No pending workspace invitations</h3>
                    <p>You don't have any pending workspace invitations at the moment.</p>
                    <button
                        onClick={fetchWorkspaceInvitations}
                        className="btn btn-outline"
                    >
                        Refresh
                    </button>
                </div>
            );
        }

        return (
            <div className="workspace-invitations-list">
                {workspaceInvitations.map(invitation => {
                    const workspace = invitation.workspace || {};
                    const inviter = invitation.invitedByUser || {};

                    return (
                        <div key={invitation.id} className="invitation-card">
                            <div className="invitation-header">
                                <div className="invitation-icon">📨</div>
                                <div className="invitation-info">
                                    <h4>Invitation to {workspace.name || 'Unknown Workspace'}</h4>
                                    <div className="invitation-meta">
                                        <span className="role-badge">{invitation.role}</span>
                                        <span className="inviter">
                                            Invited by: {inviter.email || invitation.invitedByEmail || 'Unknown'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="invitation-details">
                                <p>You've been invited to join as <strong>{invitation.role}</strong></p>
                                <div className="detail-item">
                                    <span className="label">Workspace:</span>
                                    <span className="value">{workspace.name || 'N/A'}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Invitation ID:</span>
                                    <span className="value monospace">{invitation.id.substring(0, 8)}...</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Expires:</span>
                                    <span className="value">{formatDateTime(invitation.expiresAt)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Received:</span>
                                    <span className="value">{formatDateOnly(invitation.createdAt)}</span>
                                </div>
                            </div>

                            <div className="invitation-actions">
                                <button
                                    className={`btn btn-success ${acceptingId === invitation.id ? 'loading' : ''}`}
                                    onClick={() => handleAcceptInvitation(invitation)}
                                    disabled={acceptingId === invitation.id || decliningId === invitation.id}
                                >
                                    {acceptingId === invitation.id ? (
                                        <>
                                            <span className="btn-loader"></span>
                                            Accepting...
                                        </>
                                    ) : (
                                        '✅ Accept Invitation'
                                    )}
                                </button>
                                <button
                                    className={`btn btn-outline ${decliningId === invitation.id ? 'loading' : ''}`}
                                    onClick={() => handleDeclineInvitation(invitation)}
                                    disabled={acceptingId === invitation.id || decliningId === invitation.id}
                                >
                                    {decliningId === invitation.id ? (
                                        <>
                                            <span className="btn-loader"></span>
                                            Declining...
                                        </>
                                    ) : (
                                        '❌ Decline'
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <BaseLayout>
            <div className="notifications-page">
                <div className="page-header">
                    <h1>Notifications</h1>
                    <div className="header-actions">
                        <button
                            className="btn btn-primary"
                            onClick={() => markAllNotificationsAsRead()}
                            disabled={unreadCount === 0}
                        >
                            Mark All as Read
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="filters-section">
                        <div className="filters-grid">
                            <div className="filter-group">
                                <label>Type</label>
                                <select
                                    value={filters.type}
                                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                    className="form-select"
                                >
                                    <option value="">All Types</option>
                                    <option value="WORKSPACE_POST">Workspace Post</option>
                                    <option value="WORKSPACE_MENTION">Mention</option>
                                    <option value="WORKSPACE_INVITATION">Invitation</option>
                                    <option value="WORKSPACE_COMMENT">Comment</option>
                                    <option value="SYSTEM">System</option>
                                    <option value="BILLING">Billing</option>
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>From Date</label>
                                <input
                                    type="date"
                                    value={filters.fromDate}
                                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                                    className="form-input"
                                />
                            </div>
                            <div className="filter-group">
                                <label>To Date</label>
                                <input
                                    type="date"
                                    value={filters.toDate}
                                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                                    className="form-input"
                                />
                            </div>
                            <div className="filter-group">
                                <label>Actions</label>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setFilters({
                                        type: '',
                                        workspaceId: '',
                                        fromDate: '',
                                        toDate: ''
                                    })}
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="stats-cards">
                    <div className="stat-card">
                        <div className="stat-number">{stats.total}</div>
                        <div className="stat-label">Total Notifications</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.unread}</div>
                        <div className="stat-label">Unread</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{notificationInvitations.length}</div>
                        <div className="stat-label">Context Invitations</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{workspaceInvitations.length}</div>
                        <div className="stat-label">Workspace Invitations</div>
                    </div>
                </div>

                <div className="notifications-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All ({notifications.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
                        onClick={() => setActiveTab('unread')}
                    >
                        Unread ({unreadCount})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
                        onClick={() => setActiveTab('archived')}
                    >
                        Archived ({notifications.filter(n => n.archived).length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'notif-invitations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notif-invitations')}
                    >
                        Notification Invites ({notifications.filter(n => n.type === 'WORKSPACE_INVITATION').length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'workspace-invitations' ? 'active' : ''}`}
                        onClick={() => setActiveTab('workspace-invitations')}
                    >
                        Workspace Invites ({workspaceInvitations.length})
                    </button>
                </div>

                {selectedNotifications.length > 0 && activeTab !== 'workspace-invitations' && (
                    <div className="bulk-actions-bar">
                        <span>{selectedNotifications.length} selected</span>
                        <div className="bulk-buttons">
                            <button
                                className="btn btn-primary btn-small"
                                onClick={handleBulkMarkAsRead}
                            >
                                Mark as Read
                            </button>
                            <button
                                className="btn btn-danger btn-small"
                                onClick={handleBulkDelete}
                            >
                                Delete
                            </button>
                            <button
                                className="btn btn-outline btn-small"
                                onClick={() => setSelectedNotifications([])}
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>
                )}

                {isLoading && activeTab !== 'workspace-invitations' ? (
                    <div className="loading-notifications">
                        <div className="spinner"></div>
                        <p>Loading notifications...</p>
                    </div>
                ) : (
                    <div className="notifications-list-container">
                        {activeTab === 'workspace-invitations' ? (
                            renderWorkspaceInvitations()
                        ) : filteredNotifications.length === 0 ? (
                            <div className="empty-notifications">
                                <div className="empty-icon">
                                    {activeTab === 'all' ? '📭' :
                                        activeTab === 'unread' ? '📥' :
                                            activeTab === 'archived' ? '📁' : '📨'}
                                </div>
                                <h3>No {activeTab.replace('-', ' ')} found</h3>
                                <p>You don't have any {activeTab.replace('-', ' ')} matching your filters.</p>
                            </div>
                        ) : (
                            <>
                                <div className="list-header">
                                    <div className="select-all">
                                        <input
                                            type="checkbox"
                                            checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                                            onChange={handleSelectAll}
                                            id="select-all"
                                        />
                                        <label htmlFor="select-all">Select All</label>
                                    </div>
                                    <div className="sort-options">
                                        <select className="form-select">
                                            <option>Newest First</option>
                                            <option>Oldest First</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="notifications-list">
                                    {filteredNotifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`notification-card ${notification.read ? 'read' : 'unread'} ${selectedNotifications.includes(notification.id) ? 'selected' : ''}`}
                                            onClick={() => handleSelectNotification(notification.id)}
                                        >
                                            <div className="notification-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNotifications.includes(notification.id)}
                                                    onChange={() => handleSelectNotification(notification.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="notification-icon">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div
                                                className="notification-content"
                                                onClick={(_e) => {
                                                    if (!notification.read) {
                                                        handleMarkAsRead(notification.id);
                                                    }
                                                    if (notification.actionUrl) {
                                                        navigate(notification.actionUrl);
                                                    }
                                                }}
                                            >
                                                <div className="notification-header">
                                                    <div className="notification-title">
                                                        {notification.title || notification.type.replace(/_/g, ' ')}
                                                        {!notification.read && <span className="unread-badge">NEW</span>}
                                                    </div>
                                                    <div className="notification-time">
                                                        {formatDateTime(notification.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="notification-body">
                                                    <p className="notification-message">{notification.message}</p>
                                                    {notification.workspace && (
                                                        <span className="workspace-tag">
                                                            {notification.workspace.name}
                                                        </span>
                                                    )}
                                                    {notification.sender && (
                                                        <span className="sender-tag">
                                                            From: {notification.sender.email}
                                                        </span>
                                                    )}
                                                </div>
                                                {notification.actionUrl && (
                                                    <div className="notification-actions">
                                                        <button
                                                            className="btn btn-link"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(notification.actionUrl!);
                                                            }}
                                                        >
                                                            {notification.actionLabel || 'View Details'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="notification-actions-menu">
                                                <button
                                                    className="action-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!notification.read) {
                                                            handleMarkAsRead(notification.id);
                                                        } else {
                                                            // Mark as unread logic would need API support
                                                        }
                                                    }}
                                                    title={notification.read ? "Mark as Unread" : "Mark as Read"}
                                                >
                                                    {notification.read ? '📥' : '📤'}
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        archiveNotification(notification.id);
                                                    }}
                                                    title="Archive"
                                                >
                                                    📁
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Delete this notification?')) {
                                                            removeNotification(notification.id);
                                                        }
                                                    }}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </BaseLayout>
    );
}