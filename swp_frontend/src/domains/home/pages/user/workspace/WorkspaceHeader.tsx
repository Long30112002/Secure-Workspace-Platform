import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WorkspaceDashboard.css';

interface WorkspaceHeaderProps {
    workspace: {
        name: string;
        description: string;
        stats: {
            totalMembers: number;
        };
    };
    workspaceId: string;
    onlineMembersCount: number;
    onCreatePost: () => void;
    onToggleMembersPanel: () => void;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
    workspace,
    workspaceId,
    onlineMembersCount,
    onCreatePost,
    onToggleMembersPanel
}) => {
    const navigate = useNavigate();

    return (
        <header className="workspace-header">
            <div className="header-left">
                <div className="workspace-brand">
                    <div className="workspace-icon">🏢</div>
                    <div className="workspace-info">
                        <h1 className="workspace-name">{workspace.name}</h1>
                        <p className="workspace-description">{workspace.description}</p>
                        <div className="workspace-meta">
                            <span className="meta-item">
                                <span className="meta-icon">👥</span>
                                {workspace.stats.totalMembers} Member
                            </span>
                            <span className="meta-item">
                                <span className="meta-icon online-dot">●</span>
                                {onlineMembersCount} Online
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="header-right">
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={onCreatePost}
                    >
                        <span className="btn-icon">📝</span>
                        Create a post
                    </button>
                    <button
                        className="btn btn-outline"
                        onClick={() => navigate(`/workspace/${workspaceId}/management`)}
                    >
                        <span className="btn-icon">⚙️</span>
                        Manage
                    </button>
                    <button
                        className="btn btn-icon"
                        onClick={onToggleMembersPanel}
                        title="Toggle members panel"
                    >
                        <span className="btn-icon">👁️‍🗨️</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default WorkspaceHeader;