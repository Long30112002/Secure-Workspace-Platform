import { useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../../../auth/context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

export function WorkspaceInvitationListener() {
    const { showWorkspaceInvitation, addNotification, showToast } = useNotification();
    const { workspaceSocket, notificationSocket, isConnected } = useWebSocket();
    const { user } = useAuth();

    // Phần 1: Lắng nghe workspace invitations
    useEffect(() => {
        // QUAN TRỌNG: Chỉ setup khi socket đã KẾT NỐI
        if (!workspaceSocket || !user || !isConnected) {
            console.log('Workspace socket not ready');
            return;
        }

        console.log('Setting up workspace invitation listeners');

        const handleInvitationNew = (data: any) => {
            console.log('📨 New invitation:', data);
            if (data?.data) {
                showWorkspaceInvitation({
                    invitationId: data.data.invitationId || data.data.id,
                    workspaceName: data.data.workspaceName || 'New Workspace',
                    workspaceId: data.data.workspaceId,
                    role: data.data.role || 'MEMBER',
                    invitedBy: data.data.invitedByEmail || data.data.invitedBy || 'Unknown',
                    expiresAt: data.data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    token: data.data.token,
                });
            }
        };

        const handleInvitationUpdated = (data: any) => {
            if (data?.data) {
                console.log('📨 Invitation updated:', data);
                showToast('Invitation status updated', 'info');
            }
        };

        const handleInvitationCancelled = (data: any) => {
            if (data?.data) {
                console.log('📨 Invitation cancelled:', data);
                showToast('Invitation has been cancelled', 'info');
            }
        };

        // Lắng nghe events
        workspaceSocket.on('invitations:new', handleInvitationNew);
        workspaceSocket.on('invitations:updated', handleInvitationUpdated);
        workspaceSocket.on('invitations:cancelled', handleInvitationCancelled);

        return () => {
            console.log('Cleaning up workspace invitation listeners');
            workspaceSocket.off('invitations:new', handleInvitationNew);
            workspaceSocket.off('invitations:updated', handleInvitationUpdated);
            workspaceSocket.off('invitations:cancelled', handleInvitationCancelled);
        };
    }, [workspaceSocket, user, isConnected, showWorkspaceInvitation, showToast]);

    // Phần 2: Lắng nghe notifications
    useEffect(() => {
        // TÔI TẠM BỎ PHẦN NÀY VÌ NOTIFICATION SOCKET KHÔNG HOẠT ĐỘNG
        console.log('Notification listener is DISABLED');
        return;

        /*
        // Code cũ (comment lại)
        if (!notificationSocket || !user) {
            console.log('Notification socket not ready');
            return;
        }

        console.log('Setting up notification listeners');

        const handleNotificationNew = (data: any) => {
            console.log('🔔 New notification:', data);
            if (data?.data) {
                addNotification(data.data);
                showToast(`New notification: ${data.data.title || data.data.message}`, 'info');
            }
        };

        const handleNotificationUpdate = (data: any) => {
            if (data.type === 'BULK_READ') {
                showToast(`${data.data.count} notifications marked as read`, 'info');
            } else if (data.type === 'READ') {
                console.log('Notification read:', data.data.notificationId);
            }
        };

        notificationSocket.on('notifications:new', handleNotificationNew);
        notificationSocket.on('notifications:update', handleNotificationUpdate);

        return () => {
            console.log('Cleaning up notification listeners');
            notificationSocket.off('notifications:new', handleNotificationNew);
            notificationSocket.off('notifications:update', handleNotificationUpdate);
        };
        */
    }, [notificationSocket, user, addNotification, showToast]);

    return null;
}