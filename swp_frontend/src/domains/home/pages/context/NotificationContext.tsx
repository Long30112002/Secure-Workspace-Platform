import { createContext, useCallback, useContext, useState, useEffect } from "react";

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface Notification {
  id: string;
  type: string;
  title?: string;
  message: string;
  read: boolean;
  archived: boolean;
  priority: string;
  createdAt: string;
  expiresAt?: string;
  workspaceId?: string;
  workspace?: {
    id: string;
    name: string;
  };
  sender?: {
    id: number;
    email: string;
  };
  actionUrl?: string;
  actionLabel?: string;
  data?: any;
}

interface WorkspaceInvitationNotification {
  id: string;
  type: 'workspace_invitation';
  invitationId: string;
  workspaceName: string;
  workspaceId: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  token: string;
  read?: boolean;
}

interface NotificationContextType {
  // Toast functions
  showToast: (message: string, type?: 'success' | 'error' | 'info', action?: Toast['action']) => void;
  clearToasts: () => void;
  toasts: Toast[];
  removeToast: (id: string) => void;

  // Workspace invitations
  showWorkspaceInvitation: (invitation: Omit<WorkspaceInvitationNotification, 'id' | 'type'>) => void;
  invitations: WorkspaceInvitationNotification[];
  removeInvitation: (id: string) => void;
  markInvitationAsRead: (id: string) => void;

  // General notifications
  notifications: Notification[];
  unreadCount: number;
  workspaceUnreadCount: Record<string, number>;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  removeNotification: (id: string) => void;
  archiveNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
  isLoading: boolean;

  // Stats
  getNotificationStats: () => {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byWorkspace: Record<string, number>;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationNotification[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedNotifications = localStorage.getItem('notifications');
    const savedInvitations = localStorage.getItem('invitations');

    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (error) {
        console.error('Failed to parse saved notifications:', error);
      }
    }

    if (savedInvitations) {
      try {
        setInvitations(JSON.parse(savedInvitations));
      } catch (error) {
        console.error('Failed to parse saved invitations:', error);
      }
    }
  }, []);

  // Save to localStorage when notifications change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('invitations', JSON.stringify(invitations));
  }, [invitations]);

  // Calculate unread counts
  const unreadCount = notifications.filter(n => !n.read).length;

  const workspaceUnreadCount = notifications.reduce((acc, notification) => {
    if (!notification.read && notification.workspaceId) {
      acc[notification.workspaceId] = (acc[notification.workspaceId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Toast functions
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', action?: Toast['action']) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, action };

    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Workspace invitation functions
  const showWorkspaceInvitation = useCallback((invitationData: Omit<WorkspaceInvitationNotification, 'id' | 'type'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const invitation: WorkspaceInvitationNotification = {
      ...invitationData,
      id,
      type: 'workspace_invitation',
      read: false
    };

    setInvitations(prev => [invitation, ...prev]);
  }, []);

  const removeInvitation = useCallback((id: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== id));
  }, []);

  const markInvitationAsRead = useCallback((id: string) => {
    setInvitations(prev => prev.map(inv =>
      inv.id === id ? { ...inv, read: true } : inv
    ));
  }, []);

  // Notification functions
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
  }, []);

  const markNotificationAsRead = useCallback(async (id: string) => {
    // Update local state
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));

    // Call API to mark as read on server
    try {
      await fetch(`http://localhost:3000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' 
      });
    } catch (error) {
      console.error('Failed to mark notification as read on server:', error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // Call API to mark all as read on server
    try {
      await fetch('http://localhost:3000/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ all: true })
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read on server:', error);
    }
  }, []);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    // Call API to delete on server
    try {
      await fetch(`http://localhost:3000/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Cookie sẽ tự động được gửi
      });
    } catch (error) {
      console.error('Failed to delete notification on server:', error);
    }
  }, []);


  const archiveNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, archived: true } : n
    ));

    // Call API to archive on server
    try {
      await fetch(`http://localhost:3000/api/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Cookie sẽ tự động được gửi
        body: JSON.stringify({ archived: true })
      });
    } catch (error) {
      console.error('Failed to archive notification on server:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/notifications?limit=50&includeArchived=false', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setNotifications(data.data);
        }
      } else if (response.status === 401) {
        await refreshToken();
        const retryResponse = await fetch('http://localhost:3000/api/notifications?limit=50&includeArchived=false', {
          credentials: 'include'
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.success && retryData.data) {
            setNotifications(retryData.data);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        console.log('Token refreshed successfully');
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }
    return false;
  }, []);

  const getNotificationStats = useCallback(() => {
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType: {} as Record<string, number>,
      byWorkspace: {} as Record<string, number>
    };

    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      if (n.workspaceId) {
        stats.byWorkspace[n.workspaceId] = (stats.byWorkspace[n.workspaceId] || 0) + 1;
      }
    });

    return stats;
  }, [notifications]);

  const contextValue: NotificationContextType = {
    // Toast
    showToast,
    clearToasts,
    toasts,
    removeToast,

    // Invitations
    showWorkspaceInvitation,
    invitations,
    removeInvitation,
    markInvitationAsRead,

    // Notifications
    notifications,
    unreadCount,
    workspaceUnreadCount,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    removeNotification,
    archiveNotification,
    loadNotifications,
    isLoading,

    // Stats
    getNotificationStats,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};