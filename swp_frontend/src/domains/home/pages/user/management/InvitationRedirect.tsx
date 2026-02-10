import { useEffect } from 'react';
import { useAuth } from '../../../../auth/context/AuthContext';
import BaseLayout from '../../../../../shared/components/layout/BaseLayout';
import './InvitationRedirect.css';
import { useNavigate, useParams } from 'react-router-dom';

function InvitationRedirect() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        const processRedirect = async () => {
            if (!code) {
                navigate('/workspace/invitations');
                return;
            }

            try {
                const token = code;

                const response = await fetch(`http://localhost:3000/api/workspace/invite/validate?token=${token}`, {
                    credentials: 'include'
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Invalid invitation');
                }

                if (user?.email !== data.data.email) {
                    navigate(`/workspace/invitations?error=${encodeURIComponent(`This invitation is for ${data.data.email}`)}`);
                    return;
                }

                navigate(`/workspace/invitations?token=${token}&direct=true`, {
                    replace: true
                });

            } catch (error: any) {
                console.error('Invitation redirect error:', error);
                navigate(`/workspace/invitations?error=${encodeURIComponent(error.message || 'Invalid invitation')}`);
            }
        };

        // Add slight delay for better UX
        const timer = setTimeout(() => {
            processRedirect();
        }, 800);

        return () => clearTimeout(timer);
    }, [code, navigate, user]);

    return (
        <BaseLayout>
            <div className="invitation-redirect-container">
                <div className="redirect-card">
                    <div className="redirect-icon">📨</div>
                    <div className="loading-spinner"></div>
                    <h2 className="redirect-title">Processing Invitation</h2>
                    <p className="redirect-subtitle">
                        Validating your invitation and preparing workspace access...
                    </p>
                    <div className="redirect-progress">
                        <div className="redirect-progress-bar"></div>
                    </div>
                </div>
            </div>
        </BaseLayout>
    );
}

export default InvitationRedirect;