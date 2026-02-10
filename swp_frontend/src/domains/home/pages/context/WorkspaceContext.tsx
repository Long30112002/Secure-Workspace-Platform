import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Workspace {
    id: string;
    name: string;
    domain: string;
    plan: 'free' | 'pro' | 'enterprise';
    role: 'ADMIN' | 'USER' | 'MODERATOR';
}

interface WorkspaceContextType {
    currentWorkspace: Workspace | null;
    workspaces: Workspace[];
    switchWorkspace: (workspaceId: string) => void;
    isLoading: boolean;
    refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Function để fetch workspaces từ API
    const fetchWorkspaces = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/workspace/my-workspaces', {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                setWorkspaces(data.data.map((item: any) => ({
                    id: item.workspace.id,
                    name: item.workspace.name,
                    domain: item.workspace.subdomain,
                    plan: item.workspace.plan || 'free',
                    role: item.role || 'USER'
                })));
            }
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load workspaces khi component mount
    React.useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const switchWorkspace = (workspaceId: string) => {
        const workspace = workspaces.find(w => w.id === workspaceId);
        if (workspace) {
            setCurrentWorkspace(workspace);
            localStorage.setItem('currentWorkspaceId', workspaceId);

            // Call API để set current workspace
            fetch('http://localhost:3000/api/workspace/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ workspaceId })
            }).catch(console.error);
        }
    };

    const refreshWorkspaces = async () => {
        await fetchWorkspaces();
    };

    return (
        <WorkspaceContext.Provider value={{
            currentWorkspace,
            workspaces,
            switchWorkspace,
            isLoading,
            refreshWorkspaces // Thêm vào context
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within WorkspaceProvider');
    }
    return context;
};