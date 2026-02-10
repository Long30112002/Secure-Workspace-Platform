import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../../../auth/context/AuthContext";

interface WebSocketContextType {
    workspaceSocket: Socket | null;
    notificationSocket: Socket | null;
    isConnected: boolean;
    joinWorkspace: (workspaceId: string) => void;
    leaveWorkspace: (workspaceId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
}


export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const workspaceSocketRef = useRef<Socket | null>(null);
    const notificationSocketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);


    const getAccessToken = async (): Promise<string> => {
        try {
            const response = await fetch('http://localhost:3000/api/auth/ws-token', {
                credentials: 'include',
            });

            if (!response.ok) {
                console.error('Failed to get WebSocket token:', response.status);
                return '';
            }

            const data = await response.json();
            const token = data.token || (data.data?.token);

            if (!token) {
                console.error('No token in response');
                return '';
            }

            return token;
        } catch (error) {
            console.error('Error getting WebSocket token:', error);
            return '';
        }
    };

    const initializeSockets = async () => {
        // Xóa socket cũ nếu có
        if (workspaceSocketRef.current) {
            workspaceSocketRef.current.disconnect();
            workspaceSocketRef.current = null;
        }

        if (notificationSocketRef.current) {
            notificationSocketRef.current.disconnect();
            notificationSocketRef.current = null;
        }

        setIsConnected(false);

        const token = await getAccessToken();
        if (!token || !user) {
            console.log('No token or user, skipping WebSocket');
            return;
        }

        console.log('Initializing WebSockets with token');

        // 1. TẠO WORKSPACE SOCKET (BẮT BUỘC)
        workspaceSocketRef.current = io('http://localhost:3000/workspace', {
            withCredentials: true,
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });

        workspaceSocketRef.current.on('connect', () => {
            console.log('✅ Workspace WebSocket CONNECTED');
            setIsConnected(true);
        });

        workspaceSocketRef.current.on('connect_error', (error) => {
            console.error('❌ Workspace WebSocket ERROR:', error.message);
            setIsConnected(false);
        });

        workspaceSocketRef.current.on('disconnect', (_reason) => {
            console.log('Workspace WebSocket disconnected');
            setIsConnected(false);
        });

        // 2. TẠO NOTIFICATION SOCKET (TÙY CHỌN - CÓ THỂ BỎ)
        // Tôi sẽ tạm BỎ notification socket vì nó gây lỗi
        // Bạn comment phần dưới này nếu không cần notification socket

        /*
        try {
            console.log('Trying to create notification socket...');
            
            notificationSocketRef.current = io('http://localhost:3000/notifications', {
                withCredentials: true,
                auth: { token },
                reconnection: false, // Tắt reconnect để test
                timeout: 3000,
            });

            // Đợi 3 giây để kiểm tra kết nối
            setTimeout(() => {
                if (!notificationSocketRef.current?.connected) {
                    console.log('Notification socket failed to connect, disabling...');
                    notificationSocketRef.current?.disconnect();
                    notificationSocketRef.current = null;
                }
            }, 3000);

            notificationSocketRef.current.on('connect', () => {
                console.log('✅ Notification WebSocket connected');
            });

            notificationSocketRef.current.on('connect_error', (error) => {
                console.warn('Notification socket error:', error.message);
                notificationSocketRef.current = null;
            });

            notificationSocketRef.current.on('disconnect', () => {
                console.log('Notification WebSocket disconnected');
            });
            
        } catch (error) {
            console.log('Cannot create notification socket:', error);
            notificationSocketRef.current = null;
        }
        */

        // HOẶC ĐƠN GIẢN HƠN: Luôn đặt notification socket = null
        notificationSocketRef.current = null;
        console.log('ℹ️ Notification socket is disabled');
    };

    const cleanupSockets = () => {
        if (workspaceSocketRef.current) {
            workspaceSocketRef.current.disconnect();
            workspaceSocketRef.current = null;
        }
        if (notificationSocketRef.current) {
            notificationSocketRef.current.disconnect();
            notificationSocketRef.current = null;
        }
        setIsConnected(false);
    };

    useEffect(() => {
        if (user) {
            console.log('User logged in, setting up WebSockets');
            initializeSockets();
        } else {
            console.log('No user, cleaning up WebSockets');
            cleanupSockets();
        }

        return cleanupSockets;
    }, [user]);

    const joinWorkspace = (workspaceId: string) => {
        if (workspaceSocketRef.current?.connected) {
            console.log(`Joining workspace: ${workspaceId}`);
            workspaceSocketRef.current.emit('join-workspace', workspaceId);
        } else {
            console.log('Cannot join workspace: WebSocket not connected');
        }
    };

    const leaveWorkspace = (workspaceId: string) => {
        if (workspaceSocketRef.current?.connected) {
            console.log(`Leaving workspace: ${workspaceId}`);
            workspaceSocketRef.current.emit('leave-workspace', workspaceId);
        }
    };

    return (
        <WebSocketContext.Provider value={{
            workspaceSocket: workspaceSocketRef.current,
            notificationSocket: notificationSocketRef.current, // Sẽ là null
            isConnected,
            joinWorkspace,
            leaveWorkspace,
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}