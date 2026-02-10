import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreateWorkspacePage.css';
import { useAuth } from '../../../../auth/context/AuthContext';
import BaseLayout from '../../../../../shared/components/layout/BaseLayout';

function CreateWorkspacePage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        subdomain: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Workspace name is required');
            return;
        }

        if (!formData.subdomain.trim()) {
            setError('Subdomain is required');
            return;
        }

        // Validate subdomain format
        const subdomainRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!subdomainRegex.test(formData.subdomain)) {
            setError('Subdomain can only contain lowercase letters, numbers, and hyphens');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:3000/api/workspace/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: formData.name,
                    subdomain: formData.subdomain.toLowerCase()
                })
            });

            const result = await response.json();

            if (result.success) {
                // Redirect to homepage với state để hiển thị workspace mới
                navigate('/homepage', {
                    state: {
                        workspaceCreated: true,
                        workspaceName: result.data.name,
                        workspaceId: result.data.id,
                        message: `Workspace "${result.data.name}" created successfully!`
                    }
                });
            } else {
                setError(result.message || 'Failed to create workspace');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseLayout>
            <div className="create-workspace-page">
                <div className="create-workspace-card">
                    <div className="card-header">
                        <h2>Create New Workspace</h2>
                        <p className="card-subtitle">
                            Create a new workspace for your team or project
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="workspace-form">
                        {error && (
                            <div className="error-alert">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="name">Workspace Name *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Acme Corp Team"
                                className="form-input"
                                disabled={loading}
                            />
                            <p className="form-help">This will be the display name of your workspace</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="subdomain">Subdomain *</label>
                            <div className="subdomain-input">
                                <input
                                    type="text"
                                    id="subdomain"
                                    name="subdomain"
                                    value={formData.subdomain}
                                    onChange={handleChange}
                                    placeholder="acme-corp"
                                    className="form-input"
                                    disabled={loading}
                                />
                                <span className="domain-suffix">.yourapp.com</span>
                            </div>
                            <p className="form-help">
                                Lowercase letters, numbers, and hyphens only.
                                This will be your workspace URL: <strong>{formData.subdomain || 'acme'}.yourapp.com</strong>
                            </p>
                        </div>

                        <div className="form-group">
                            <label>Workspace Owner</label>
                            <div className="owner-info">
                                <div className="owner-avatar">
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="owner-details">
                                    <div className="owner-email">{user?.email}</div>
                                    <div className="owner-role">You will be the Workspace Owner</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={() => navigate('/workspaces')}
                                className="btn btn-outline"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Creating...' : 'Create Workspace'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="info-section">
                    <h3>What is a Workspace?</h3>
                    <ul className="info-list">
                        <li>✓ A separate environment for your team or project</li>
                        <li>✓ Complete data isolation from other workspaces</li>
                        <li>✓ Custom settings and configurations</li>
                        <li>✓ Invite team members with different roles</li>
                        <li>✓ Manage billing and subscriptions separately</li>
                    </ul>
                </div>
            </div>
        </BaseLayout>
    );
}

export default CreateWorkspacePage;