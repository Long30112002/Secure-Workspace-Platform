import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import './Notifications.css';
import { useWebSocket } from '../../context/WebSocketContext'; // THÊM DÒNG NÀY

export function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const {
        notifications,
        invitations: contextInvitations,
        unreadCount,
        removeInvitation,
        showToast,
        markNotificationAsRead,
        removeNotification,
        archiveNotification,
        loadNotifications,
        isLoading,
    } = useNotification();

    const [workspaceInvitations, setWorkspaceInvitations] = useState<any[]>([]);
    const [loadingWorkspaceInvitations, setLoadingWorkspaceInvitations] = useState(false);

    void archiveNotification; //Để tạm

    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { workspaceSocket, notificationSocket } = useWebSocket(); // THÊM DÒNG NÀY
    // XÓA: const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // WebSocket listeners
    useEffect(() => {
        if (!workspaceSocket || !workspaceSocket.connected) {
            console.log('Workspace socket not connected in NotificationBell');
            return;
        }

        console.log('📨 Setting up invitation listeners in NotificationBell');

        const handleInvitationNew = (data: any) => {
            console.log('📨 New invitation via WebSocket:', data);
            if (data?.data) {
                fetchWorkspaceInvitations();
                showToast(`📨 You've been invited to ${data.data.workspaceName}`, 'info');
            }
        };

        const handleInvitationUpdated = (data: any) => {
            console.log('📨 Invitation updated via WebSocket:', data);
            fetchWorkspaceInvitations();
        };

        const handleInvitationCancelled = (data: any) => {
            console.log('📨 Invitation cancelled via WebSocket:', data);
            fetchWorkspaceInvitations();
        };

        workspaceSocket.on('invitations:new', handleInvitationNew);
        workspaceSocket.on('invitations:updated', handleInvitationUpdated);
        workspaceSocket.on('invitations:cancelled', handleInvitationCancelled);

        return () => {
            workspaceSocket.off('invitations:new', handleInvitationNew);
            workspaceSocket.off('invitations:updated', handleInvitationUpdated);
            workspaceSocket.off('invitations:cancelled', handleInvitationCancelled);
        };
    }, [workspaceSocket, showToast]);

    useEffect(() => {
        console.log('NotificationBell: Notification socket is DISABLED');
        return;

        // if (!notificationSocket) return;

        // const handleNotificationNew = (data: any) => {
        //     console.log('🔔 New notification via WebSocket:', data);
        //     if (data?.data) {
        //         showToast(`🔔 ${data.data.title || data.data.message}`, 'info');
        //         if (isOpen) {
        //             loadNotifications();
        //         }
        //     }
        // };

        // notificationSocket.on('notifications:new', handleNotificationNew);

        // return () => {
        //     notificationSocket.off('notifications:new', handleNotificationNew);
        // };
    }, [notificationSocket, isOpen, loadNotifications, showToast]);

    // Load notifications và invitations khi mở dropdown
    useEffect(() => {
        if (isOpen) {
            loadNotifications();
            fetchWorkspaceInvitations();
        }
    }, [isOpen, loadNotifications]);

    const fetchWorkspaceInvitations = async () => {
        setLoadingWorkspaceInvitations(true);
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invitations/pending', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setWorkspaceInvitations(data.data || []);
                }
            }
        } catch (error) {
            console.error('🔔 Error fetching invitations:', error);
        } finally {
            setLoadingWorkspaceInvitations(false);
        }
    };

    const handleAcceptInvitation = async (invitation: any) => {
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: invitation.token })
            });

            const data = await response.json();
            if (data.success) {
                showToast('🎉 Invitation accepted! You can now access the workspace.', 'success');
                removeInvitation(invitation.id);
                setWorkspaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
                setIsOpen(false);
                navigate(`/workspace/${invitation.workspaceId}`);
            } else {
                showToast(data.message || 'Failed to accept invitation', 'error');
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            showToast('Failed to accept invitation', 'error');
        }
    };

    const handleDeclineInvitation = async (invitation: any) => {
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: invitation.token })
            });

            const data = await response.json();
            if (data.success) {
                showToast('Invitation declined', 'info');
                removeInvitation(invitation.id);
                setWorkspaceInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            }
        } catch (error) {
            console.error('Error declining invitation:', error);
        }
    };

    const handleGoToNotificationPage = () => {
        setIsOpen(false);
        navigate('/notifications');
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Kết hợp tất cả notifications và invitations
    const getAllItems = () => {
        const items: any[] = [];

        // Thêm notifications
        notifications.forEach(notification => {
            items.push({
                type: 'notification',
                id: notification.id,
                data: notification,
                timestamp: new Date(notification.createdAt).getTime(),
                read: notification.read
            });
        });

        // Thêm invitations từ context
        contextInvitations.forEach(invitation => {
            items.push({
                type: 'context-invitation',
                id: invitation.id,
                data: invitation,
                timestamp: new Date(invitation.expiresAt).getTime(),
                read: invitation.read || false
            });
        });

        // Thêm invitations từ API
        workspaceInvitations.forEach(invitation => {
            items.push({
                type: 'workspace-invitation',
                id: invitation.id,
                data: invitation,
                timestamp: new Date(invitation.createdAt).getTime(),
                read: false
            });
        });

        // Sắp xếp theo thời gian (mới nhất trước)
        return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10); // Giới hạn 10 items
    };

    const getNotificationIcon = (type: string, notificationType?: string) => {
        if (type === 'context-invitation' || type === 'workspace-invitation') {
            return '📨';
        }

        switch (notificationType) {
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

    const handleItemClick = (item: any) => {
        if (item.type === 'notification') {
            if (!item.data.read) {
                markNotificationAsRead(item.id);
            }
            if (item.data.actionUrl) {
                // Đi đến URL cụ thể nếu có
                navigate(item.data.actionUrl);
                setIsOpen(false);
            } else {
                // Nếu không có actionUrl, đi đến trang notifications
                navigate('/notifications');
                setIsOpen(false);
            }
        } else if (item.type === 'context-invitation' || item.type === 'workspace-invitation') {
            // Đi đến trang notifications khi click invitation
            navigate('/notifications');
            setIsOpen(false);
        }
    };

    const getItemTitle = (item: any) => {
        if (item.type === 'notification') {
            return item.data.title || item.data.type.replace(/_/g, ' ');
        } else if (item.type === 'context-invitation') {
            return `Invitation to ${item.data.workspaceName}`;
        } else if (item.type === 'workspace-invitation') {
            const workspace = item.data.workspace || {};
            return `Invitation to ${workspace.name || 'Unknown Workspace'}`;
        }
        return 'Notification';
    };

    const getItemMessage = (item: any) => {
        if (item.type === 'notification') {
            return item.data.message;
        } else if (item.type === 'context-invitation') {
            return `You've been invited as ${item.data.role}`;
        } else if (item.type === 'workspace-invitation') {
            const inviter = item.data.invitedByUser || {};
            return `Invited as ${item.data.role} by ${inviter.email || 'Unknown'}`;
        }
        return '';
    };

    const allItems = getAllItems();
    const totalInvitations = contextInvitations.length + workspaceInvitations.length;
    const totalUnread = unreadCount + totalInvitations;

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button
                className="notification-bell"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
            >
                🔔
                {totalUnread > 0 && (
                    <span className="notification-badge">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notifications-dropdown">
                    <div className="notifications-header">
                        <h4>Notifications</h4>
                        <div className="notifications-actions">
                            <button
                                className="btn btn-link btn-small"
                                onClick={() => setIsOpen(false)}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className="notifications-scroll-container">
                        {isLoading || loadingWorkspaceInvitations ? (
                            <div className="notifications-loading">
                                <div className="spinner-small"></div>
                                Loading notifications...
                            </div>
                        ) : allItems.length === 0 ? (
                            <div className="empty-notifications">
                                <p>No notifications</p>
                            </div>
                        ) : (
                            <div className="notifications-list">
                                {allItems.map(item => (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        className={`notification-item ${item.type.includes('invitation') ? 'invitation-item' : ''} ${item.read ? 'read' : 'unread'}`}
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(item.type, item.data?.type)}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-title">
                                                {getItemTitle(item)}
                                                {!item.read && <span className="unread-dot"></span>}
                                            </div>
                                            <div className="notification-message">
                                                {getItemMessage(item)}
                                            </div>
                                            <div className="notification-meta">
                                                <span className="notification-time">
                                                    {formatTime(item.type === 'notification' ? item.data.createdAt :
                                                        item.type === 'context-invitation' ? item.data.expiresAt :
                                                            item.data.createdAt)}
                                                </span>
                                                {item.type === 'notification' && item.data.workspace && (
                                                    <span className="notification-workspace">
                                                        {item.data.workspace.name}
                                                    </span>
                                                )}
                                                {(item.type === 'context-invitation' || item.type === 'workspace-invitation') && (
                                                    <span className="notification-role">
                                                        Role: {item.data.role}
                                                    </span>
                                                )}
                                            </div>
                                            {(item.type === 'context-invitation' || item.type === 'workspace-invitation') && (
                                                <div className="notification-actions">
                                                    <button
                                                        className="btn btn-primary btn-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAcceptInvitation(item.data);
                                                        }}
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        className="btn btn-outline btn-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeclineInvitation(item.data);
                                                        }}
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            )}
                                            {item.type === 'notification' && (
                                                <div className="notification-actions">
                                                    <button
                                                        className="btn btn-link btn-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate('/notifications');
                                                            setIsOpen(false);
                                                        }}
                                                        title="View Details"
                                                    >
                                                        View Details
                                                    </button>
                                                    <button
                                                        className="btn btn-link btn-xs text-danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeNotification(item.id);
                                                        }}
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="notifications-footer">
                        <button
                            className="btn btn-link btn-small"
                            onClick={handleGoToNotificationPage}
                        >
                            View All Notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}