import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/layout/BaseLayout";
import { useAuth } from "../../../../auth/context/AuthContext";
import "./WorkspaceInvitationsListPage.css";
import { useNotification } from "../../context/NotificationContext";

interface WorkspaceInvitation {
    id: string;
    workspaceId: string;
    workspaceName: string;
    role: string;
    invitedByEmail: string;
    expiresAt: string;
    token: string;
    createdAt: string;
}

function WorkspaceInvitationsListPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { showToast, invitations: notificationInvitations, removeInvitation } = useNotification();

    const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);
    
    // State cho direct invitation từ URL
    const [directInvitationToken, setDirectInvitationToken] = useState<string | null>(null);
    const [directInvitation, setDirectInvitation] = useState<any>(null);
    const [validatingDirectInvitation, setValidatingDirectInvitation] = useState(false);
    const [directInvitationError, setDirectInvitationError] = useState<string | null>(null);

    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        if (tokenFromUrl) {
            setDirectInvitationToken(tokenFromUrl);
            validateDirectInvitation(tokenFromUrl);
            // Clear token từ URL để tránh refresh lại
            window.history.replaceState({}, '', '/workspace/invitations');
        }
        
        fetchAllInvitations();
    }, []);

    const validateDirectInvitation = async (token: string) => {
        setValidatingDirectInvitation(true);
        setDirectInvitationError(null);
        
        try {
            const response = await fetch(`http://localhost:3000/api/workspace/invite/validate?token=${token}`, {
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                setDirectInvitation(data.data);
                
                // Auto-accept nếu user đã login và invitation hợp lệ
                if (user && data.data.email === user.email) {
                    showToast('Auto-accepting invitation in 3 seconds...', 'info');
                    const timer = setTimeout(() => {
                        handleAcceptDirectInvitation(token, data.data);
                    }, 3000);
                    
                    // Store timer để clear nếu user cancel
                    return () => clearTimeout(timer);
                }
            } else {
                setDirectInvitationError(data.message || 'Invalid invitation');
            }
        } catch (err) {
            setDirectInvitationError('Failed to validate invitation');
        } finally {
            setValidatingDirectInvitation(false);
        }
    };

    const fetchAllInvitations = async () => {
        try {
            setLoading(true);

            // Fetch all pending invitations for current user
            const response = await fetch('http://localhost:3000/api/workspace/invitations/pending', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    showToast('You need to be logged in to view invitations', 'error');
                    navigate('/login');
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                // Kết hợp invitations từ notification và API
                const apiInvitations = data.data.map((inv: any) => ({
                    id: inv.id,
                    workspaceId: inv.workspaceId,
                    workspaceName: inv.workspace?.name || 'Unknown Workspace',
                    role: inv.role,
                    invitedByEmail: inv.invitedByUser?.email || 'Unknown',
                    expiresAt: inv.expiresAt,
                    token: inv.token,
                    createdAt: inv.createdAt,
                    fromApi: true
                }));

                const notificationInvitationsList = notificationInvitations.map(inv => ({
                    id: inv.invitationId,
                    workspaceId: inv.workspaceId,
                    workspaceName: inv.workspaceName,
                    role: inv.role,
                    invitedByEmail: inv.invitedBy,
                    expiresAt: inv.expiresAt,
                    token: inv.token,
                    createdAt: new Date().toISOString(),
                    fromNotification: true
                }));

                // Gộp và loại bỏ trùng lặp
                const allInvitations = [...apiInvitations, ...notificationInvitationsList];
                const uniqueInvitations = Array.from(
                    new Map(allInvitations.map(inv => [inv.id, inv])).values()
                );

                setInvitations(uniqueInvitations);
                
                // Nếu có direct invitation token, check xem đã có trong list chưa
                if (directInvitationToken) {
                    const existing = uniqueInvitations.find(inv => inv.token === directInvitationToken);
                    if (existing) {
                        setDirectInvitation({
                            invitationId: existing.id,
                            workspaceId: existing.workspaceId,
                            workspaceName: existing.workspaceName,
                            role: existing.role,
                            invitedByEmail: existing.invitedByEmail,
                            expiresAt: existing.expiresAt,
                            token: existing.token
                        });
                    }
                }
            }
        } catch (error: any) {
            console.error('Failed to fetch invitations:', error);
            showToast(`Failed to load invitations: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvitation = async (invitation: WorkspaceInvitation) => {
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
                showToast(`🎉 You've joined "${invitation.workspaceName}"!`, 'success');

                // Remove from local state
                setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
                
                // Remove direct invitation nếu đang xử lý direct
                if (directInvitation?.token === invitation.token) {
                    setDirectInvitation(null);
                    setDirectInvitationToken(null);
                }

                // Remove from notifications
                removeInvitation(invitation.id);

                // Navigate to the workspace
                setTimeout(() => {
                    navigate(`/workspace/${invitation.workspaceId}`);
                }, 1000);
            } else {
                showToast(data.message || 'Failed to accept invitation', 'error');
            }
        } catch (error: any) {
            console.error('Error accepting invitation:', error);
            showToast('Failed to accept invitation', 'error');
        } finally {
            setAcceptingId(null);
        }
    };

    const handleAcceptDirectInvitation = async (token: string, invitationData: any) => {
        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (data.success) {
                showToast(`🎉 You've joined "${invitationData.workspaceName}"!`, 'success');

                // Remove from local state
                setInvitations(prev => prev.filter(inv => inv.token !== token));
                setDirectInvitation(null);
                setDirectInvitationToken(null);

                // Remove from notifications
                if (invitationData.invitationId) {
                    removeInvitation(invitationData.invitationId);
                }

                // Navigate to the workspace
                setTimeout(() => {
                    if (data.data?.workspace?.id) {
                        navigate(`/workspace/${data.data.workspace.id}`);
                    } else {
                        navigate('/workspaces');
                    }
                }, 1000);
            } else {
                showToast(data.message || 'Failed to accept invitation', 'error');
            }
        } catch (error: any) {
            console.error('Error accepting direct invitation:', error);
            showToast('Failed to accept invitation', 'error');
        }
    };

    const handleDeclineInvitation = async (invitation: WorkspaceInvitation) => {
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
                showToast('Invitation declined', 'info');

                // Remove from local state
                setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
                
                // Remove direct invitation nếu đang xử lý direct
                if (directInvitation?.token === invitation.token) {
                    setDirectInvitation(null);
                    setDirectInvitationToken(null);
                }

                // Remove from notifications
                removeInvitation(invitation.id);
            } else {
                showToast(data.message || 'Failed to decline invitation', 'error');
            }
        } catch (error: any) {
            console.error('Error declining invitation:', error);
            showToast('Failed to decline invitation', 'error');
        } finally {
            setDecliningId(null);
        }
    };

    const handleDeclineDirectInvitation = async () => {
        if (!directInvitationToken) return;

        try {
            const response = await fetch('http://localhost:3000/api/workspace/invite/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: directInvitationToken })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Invitation declined', 'info');
                setDirectInvitation(null);
                setDirectInvitationToken(null);
                
                // Refresh list
                fetchAllInvitations();
            }
        } catch (error) {
            console.error('Error declining direct invitation:', error);
            showToast('Failed to decline invitation', 'error');
        }
    };

    const handleLoginForInvitation = () => {
        navigate(`/login?returnUrl=${encodeURIComponent(`/workspace/invitations?token=${directInvitationToken}`)}`);
    };

    const handleViewAllInvitations = () => {
        setDirectInvitation(null);
        setDirectInvitationToken(null);
        setDirectInvitationError(null);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading && !directInvitation) {
        return (
            <BaseLayout>
                <div className="workspace-invitations-page">
                    <div className="loading-invitations">
                        <div className="loading-spinner"></div>
                        <p>Loading your invitations...</p>
                    </div>
                </div>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout>
            <div className="workspace-invitations-page">
                <div className="page-header">
                    <h1>Workspace Invitations</h1>
                    <p className="page-subtitle">
                        Manage all workspace invitations you've received
                    </p>
                    <div className="header-actions">
                        <button
                            onClick={() => navigate('/workspaces')}
                            className="btn btn-outline"
                        >
                            Back to Workspaces
                        </button>
                    </div>
                </div>

                {/* DIRECT INVITATION SECTION (từ email link) */}
                {(directInvitation || validatingDirectInvitation || directInvitationError) && (
                    <div className="direct-invitation-section">
                        <div className="direct-invitation-card">
                            <div className="direct-invitation-header">
                                <div className="invitation-icon">📨</div>
                                <h3>Direct Invitation</h3>
                                <button 
                                    className="btn btn-link btn-small"
                                    onClick={handleViewAllInvitations}
                                >
                                    View All Invitations
                                </button>
                            </div>

                            {validatingDirectInvitation ? (
                                <div className="loading-state">
                                    <div className="loading-spinner small"></div>
                                    <p>Validating invitation...</p>
                                </div>
                            ) : directInvitationError ? (
                                <div className="error-section">
                                    <div className="error-icon">❌</div>
                                    <h4>Invalid Invitation</h4>
                                    <p>{directInvitationError}</p>
                                    <button
                                        onClick={handleViewAllInvitations}
                                        className="btn btn-primary"
                                    >
                                        View All Invitations
                                    </button>
                                </div>
                            ) : directInvitation ? (
                                <>
                                    <div className="invitation-details">
                                        <div className="detail-item">
                                            <span className="label">Workspace:</span>
                                            <span className="value">{directInvitation.workspaceName}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Role:</span>
                                            <span className="value role-badge">{directInvitation.role}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Invited by:</span>
                                            <span className="value">{directInvitation.invitedByEmail}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Expires:</span>
                                            <span className="value">
                                                {new Date(directInvitation.expiresAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    {user ? (
                                        <div className="current-user">
                                            <div className="user-label">This invitation is for:</div>
                                            <div className="user-email">{user.email}</div>
                                        </div>
                                    ) : (
                                        <div className="login-required">
                                            <p>You need to login to accept this invitation.</p>
                                            <div className="auth-buttons">
                                                <button
                                                    onClick={handleLoginForInvitation}
                                                    className="btn btn-primary"
                                                >
                                                    Login
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="invitation-actions">
                                        <button
                                            onClick={() => handleAcceptDirectInvitation(directInvitationToken!, directInvitation)}
                                            disabled={!user || acceptingId === directInvitation.invitationId}
                                            className="btn btn-accept"
                                        >
                                            {acceptingId === directInvitation.invitationId ? (
                                                <>
                                                    <span className="btn-loader-small"></span>
                                                    Accepting...
                                                </>
                                            ) : (
                                                '✅ Accept Invitation'
                                            )}
                                        </button>

                                        <button
                                            onClick={handleDeclineDirectInvitation}
                                            disabled={!user || decliningId === directInvitation.invitationId}
                                            className="btn btn-decline"
                                        >
                                            {decliningId === directInvitation.invitationId ? (
                                                <>
                                                    <span className="btn-loader-small"></span>
                                                    Declining...
                                                </>
                                            ) : (
                                                '❌ Decline'
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : null}
                        </div>
                        
                        {invitations.length > 0 && (
                            <div className="section-divider">
                                <hr />
                                <h4>All Your Invitations</h4>
                            </div>
                        )}
                    </div>
                )}

                {/* REGULAR INVITATIONS LIST */}
                {invitations.length === 0 && !directInvitation ? (
                    <div className="empty-invitations">
                        <div className="empty-icon">📨</div>
                        <h3>No pending invitations</h3>
                        <p>You don't have any pending workspace invitations at the moment.</p>
                        <button
                            onClick={() => navigate('/workspaces')}
                            className="btn btn-primary"
                        >
                            Go to Workspaces
                        </button>
                    </div>
                ) : invitations.length > 0 ? (
                    <div className="invitations-list-container">
                        {!directInvitation && (
                            <div className="invitations-header">
                                <h3>Pending Invitations ({invitations.length})</h3>
                                <div className="invitations-header-actions">
                                    <button
                                        onClick={fetchAllInvitations}
                                        className="btn btn-outline btn-small"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="invitations-grid">
                            {invitations.map(invitation => (
                                <div key={invitation.id} className="invitation-card">
                                    <div className="invitation-header">
                                        <div className="workspace-icon">🏢</div>
                                        <div className="workspace-info">
                                            <h4>{invitation.workspaceName}</h4>
                                            <div className="invitation-meta">
                                                <span className="role-badge">
                                                    {invitation.role}
                                                </span>
                                                <span className="inviter">
                                                    Invited by: {invitation.invitedByEmail}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="invitation-details">
                                        <div className="detail-item">
                                            <span className="label">Invitation ID:</span>
                                            <span className="value">{invitation.id.substring(0, 8)}...</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Expires:</span>
                                            <span className="value">
                                                {formatDate(invitation.expiresAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="invitation-actions">
                                        <button
                                            onClick={() => handleAcceptInvitation(invitation)}
                                            className={`btn btn-success ${acceptingId === invitation.id ? 'loading' : ''}`}
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
                                            onClick={() => handleDeclineInvitation(invitation)}
                                            className={`btn btn-outline ${decliningId === invitation.id ? 'loading' : ''}`}
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
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </BaseLayout>
    );
}

export default WorkspaceInvitationsListPage;