// WorkspacesPage.tsx
import { Link, useNavigate } from 'react-router-dom';
import './WorkspacesPage.css';
import { useAuth } from '../../../../auth/context/AuthContext';
import BaseLayout from '../../../../../shared/components/layout/BaseLayout';
import { useWorkspace } from '../../context/WorkspaceContext';

function WorkspacesPage() {
    const { workspaces, switchWorkspace, isLoading } = useWorkspace();
    const { user } = useAuth();
    const navigate = useNavigate(); // Thêm useNavigate
    void user; //Để tạm

    // Loading state
    if (isLoading) {
        return (
            <BaseLayout>
                <div className="workspaces-page">
                    <div className="page-header">
                        <h1>Your Workspaces</h1>
                        <p>Loading your workspaces...</p>
                    </div>
                    <div className="workspaces-loading">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="workspace-card-skeleton">
                                <div className="skeleton-header">
                                    <div className="skeleton-icon"></div>
                                    <div className="skeleton-title"></div>
                                </div>
                                <div className="skeleton-info">
                                    <div className="skeleton-line short"></div>
                                    <div className="skeleton-line medium"></div>
                                    <div className="skeleton-line short"></div>
                                </div>
                                <div className="skeleton-actions">
                                    <div className="skeleton-button"></div>
                                    <div className="skeleton-button"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </BaseLayout>
        );
    }

    // Empty state
    if (workspaces.length === 0) {
        return (
            <BaseLayout>
                <div className="workspaces-page">
                    <div className="page-header">
                        <h1>Your Workspaces</h1>
                        <p>You don't have access to any workspaces yet</p>
                    </div>
                    <div className="workspaces-empty-state">
                        <div className="empty-state-icon">🏢</div>
                        <h3>No workspaces found</h3>
                        <p>Create your first workspace to get started</p>
                        <Link to="/workspace/create" className="btn btn-primary">
                            Create First Workspace
                        </Link>
                    </div>
                </div>
            </BaseLayout>
        );
    }

    // Main content
    return (
        <BaseLayout>
            <div className="workspaces-page">
                <div className="page-header">
                    <h1>Your Workspaces</h1>
                    <p>Manage all workspaces you have access to</p>
                </div>

                <div className="workspaces-grid">
                    {workspaces.map(workspace => (
                        <div key={workspace.id} className="workspace-card">
                            <div className="workspace-card-header">
                                <div className="workspace-icon">🏢</div>
                                <h3>{workspace.name}</h3>
                                <span className={`role-badge ${workspace.role.toLowerCase()}`}>
                                    {workspace.role}
                                </span>
                            </div>

                            <div className="workspace-info">
                                <div className="info-item">
                                    <span className="label">Domain:</span>
                                    <span className="domain-preview">
                                        <span className="protocol">https://</span>
                                        <span className="domain-name">{workspace.domain}</span>
                                        <span className="tld">.yourapp.com</span>
                                    </span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Plan:</span>
                                    <span className={`plan ${workspace.plan}`}>
                                        {workspace.plan.toUpperCase()}
                                    </span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Your Role:</span>
                                    <span className="role">{workspace.role}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Members:</span>
                                    <span className="members-count">12</span>
                                </div>
                            </div>

                            <div className="workspace-actions">
                                <button
                                    onClick={() => {
                                        switchWorkspace(workspace.id);
                                        navigate(`/workspace/${workspace.id}/dashboard`);
                                    }}
                                    className="btn btn-primary"
                                >
                                    🚀 Switch to Workspace
                                </button>
                                <button
                                    onClick={() =>
                                        navigate(`/workspace/${workspace.id}/management`)
                                    }
                                    className="btn btn-outline"
                                >
                                    ⚙️ Quản lý
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Add New Workspace Card */}
                    <div className="workspace-card add-new">
                        <Link to="/workspace/create" className="add-new-content">
                            <div className="add-icon">+</div>
                            <h3>Create New Workspace</h3>
                            <p>Start a new team or project</p>
                            <span className="btn btn-secondary">
                                Create Workspace
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}

export default WorkspacesPage;