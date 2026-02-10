import { useState, useRef } from "react";
import "./WorkspaceImportModal.css"
import { useNotification } from "../../context/NotificationContext";
interface WorkspaceImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    workspaceName: string;
    onImportSuccess?: (resultData: any) => void;
    onRefreshInvitations: () => void;
}

interface ImportProcessingResult {
    totalRows: number;
    invited: number;
    skipped: number;
    failed: number;
    errors: Array<{
        row: number;
        email: string;
        reason: string;
        details?: string;
    }>;
    successes: Array<{
        row: number;
        email: string;
        action: string;
        role?: string;
    }>;
    executionTimeMs?: number;
}

const WorkspaceImportModal: React.FC<WorkspaceImportModalProps> = ({
    isOpen,
    onClose,
    workspaceId,
    workspaceName,
    onImportSuccess,
    onRefreshInvitations
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [jsonData, setJsonData] = useState<string>('');
    const [manualEmails, setManualEmails] = useState<string[]>(['']);
    const [options, setOptions] = useState({
        defaultRole: 'MEMBER',
        sendInvitationEmail: true,
        skipPendingInvitations: true,
        skipExistingMembers: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<ImportProcessingResult | null>(null);
    const [activeTab, setActiveTab] = useState<'csv' | 'json' | 'manual'>('csv');
    const { showToast } = useNotification();


    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleManualEmailChange = (index: number, value: string) => {
        const updatedEmails = [...manualEmails];
        updatedEmails[index] = value;
        setManualEmails(updatedEmails);
    };

    const addManualEmail = () => {
        setManualEmails([...manualEmails, '']);
    };

    const removeManualEmail = (index: number) => {
        if (manualEmails.length > 1) {
            const updatedEmails = manualEmails.filter((_, i) => i !== index);
            setManualEmails(updatedEmails);
        }
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    };

    const extractEmailsFromFile = async (file: File): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    // Tìm tất cả email trong nội dung file
                    // const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    const emails = content.match(emailRegex) || [];

                    // Lọc email hợp lệ và loại bỏ trùng lặp
                    const validEmails = [...new Set(
                        emails
                            .map(email => email.toLowerCase().trim())
                            .filter(email => validateEmail(email))
                    )];

                    console.log('Valid emails:', validEmails); // Debug log

                    if (validEmails.length === 0) {
                        console.log('Content was:', content); // Debug
                    }

                    resolve(validEmails);
                } catch (err) {
                    console.error('Error extracting emails:', err);
                    reject(new Error('Failed to extract emails from file'));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        })
    }

    const sendBulkInvitations = async (emails: string[]) => {
        setLoading(true);
        setError(null);
        setImportResult(null);

        try {
            // Get auth token
            const token = localStorage.getItem('access_token') || '';

            // Call new bulk API
            const response = await fetch(`http://localhost:3000/api/workspace/bulk-invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    emails: emails, // Limit to 100 emails
                    workspaceId,
                    role: options.defaultRole,
                    sendInvitationEmail: options.sendInvitationEmail,
                    skipExistingMembers: options.skipExistingMembers,
                    skipPendingInvitations: options.skipPendingInvitations
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            if (!data.success) {
                throw new Error(data.message || 'Bulk invitation failed');
            }

            // Map response to our format
            const results: ImportProcessingResult = {
                totalRows: data.data.total,
                invited: data.data.invited,
                skipped: data.data.skipped,
                failed: data.data.failed,
                errors: data.data.details.failed.map((f: any) => ({
                    row: 0,
                    email: f.email,
                    reason: f.error,
                    details: f.error
                })),
                successes: [
                    ...data.data.details.invited.map((i: any) => ({
                        row: 0,
                        email: i.email,
                        action: 'invited' as const,
                        invitationId: i.invitationId
                    })),
                    ...data.data.details.skipped.map((s: any) => ({
                        row: 0,
                        email: s.email,
                        action: 'skipped' as const,
                        reason: s.reason
                    }))
                ],
                executionTimeMs: data.data.executionTimeMs
            };

            setImportResult(results);

            // Show success toast
            showToast(
                `✅ Bulk invitation completed in ${(data.data.executionTimeMs / 1000).toFixed(2)}s! ` +
                `${results.invited} invited, ${results.skipped} skipped, ${results.failed} failed`,
                'success'
            );

            // Refresh data
            if (onImportSuccess) onImportSuccess(results);
            if (onRefreshInvitations) onRefreshInvitations();

        } catch (err: any) {
            console.error('Bulk invite error:', err);
            setError(err.message || 'Failed to process bulk invitation');
            showToast(`❌ ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleImportCSV = async () => {
        if (!file) {
            setError('Please select a file');
            return;
        }

        try {
            const emails = await extractEmailsFromFile(file);

            if (emails.length === 0) {
                setError('No valid emails found in the file');
                return;
            }

            await sendBulkInvitations(emails);
        } catch (err: any) {
            setError(err.message || 'Failed to process file');
        }
    };

    const handleImportJSON = async () => {
        if (!jsonData.trim()) {
            setError('Please enter JSON data');
            return;
        }

        try {
            const data = JSON.parse(jsonData);
            let emails: string[] = [];

            if (Array.isArray(data)) {
                // Nếu là mảng string (email)
                if (data.every(item => typeof item === 'string')) {
                    emails = data.map(email => email.toLowerCase().trim()).filter(validateEmail);
                }
                // Nếu là mảng object có property email
                else if (data.every(item => typeof item === 'object')) {
                    emails = data
                        .map(item => item.email || item.Email || item.EMAIL)
                        .filter(Boolean)
                        .map(email => email.toLowerCase().trim())
                        .filter(validateEmail);
                }
            } else if (typeof data === 'object' && data.emails) {
                // Nếu object có property emails
                emails = Array.isArray(data.emails)
                    ? data.emails.map((email: string) => email.toLowerCase().trim()).filter(validateEmail)
                    : [];
            }

            if (emails.length === 0) {
                setError('No valid emails found in JSON data');
                return;
            }

            await sendBulkInvitations(emails);
        } catch (err: any) {
            setError(`Invalid JSON format: ${err.message}`);
        }
    };

    const handleImportManual = async () => {
        const validEmails = manualEmails
            .map(email => email.trim())
            .filter(email => email !== '')
            .filter(validateEmail);

        if (validEmails.length === 0) {
            setError('Please enter at least one valid email address');
            return;
        }

        await sendBulkInvitations(validEmails);
    }

    const handleImport = async () => {
        switch (activeTab) {
            case 'csv':
                await handleImportCSV();
                break;
            case 'json':
                await handleImportJSON();
                break;
            case 'manual':
                await handleImportManual();
                break;
        }
    };

    const downloadTemplate = () => {
        // Tạo template CSV đơn giản chỉ có email
        const csvContent = `email\nuser1@example.com\nuser2@example.com\nuser3@example.com`;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workspaceName.replace(/\s+/g, '-').toLowerCase()}-invitations-template.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const resetForm = () => {
        setFile(null);
        setJsonData('');
        setManualEmails(['']);
        setError(null);
        setImportResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="workspace-import-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Bulk Invite Members to "{workspaceName}"</h2>
                    <button className="close-btn" onClick={handleClose}>×</button>
                </div>

                <div className="modal-content">
                    <div className="import-description">
                        <p>Invite multiple members at once by uploading a file or entering emails.</p>
                        <p><strong>Note:</strong> This will send invitation emails to each address.</p>
                    </div>

                    <div className="modal-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
                            onClick={() => setActiveTab('csv')}
                        >
                            📁 File Upload
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                            onClick={() => setActiveTab('json')}
                        >
                            📄 JSON
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                            onClick={() => setActiveTab('manual')}
                        >
                            ✍️ Manual Entry
                        </button>
                    </div>

                    {activeTab === 'csv' && (
                        <div className="import-section">
                            <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                                <div className="upload-icon">📁</div>
                                <p>Click to upload file (CSV, Excel, or text)</p>
                                <p className="file-name">{file ? file.name : 'No file selected'}</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.xls,.txt"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            <div className="file-requirements">
                                <h4>File Requirements:</h4>
                                <ul>
                                    <li>File can contain emails in any column</li>
                                    <li>System will automatically extract all email addresses</li>
                                    <li>Supported formats: CSV, Excel, text files</li>
                                    <li>Max file size: 10MB</li>
                                </ul>
                                <button
                                    onClick={downloadTemplate}
                                    className="download-template"
                                >
                                    📥 Download CSV Template
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'json' && (
                        <div className="import-section">
                            <textarea
                                className="json-input"
                                value={jsonData}
                                onChange={(e) => setJsonData(e.target.value)}
                                placeholder={JSON.stringify([
                                    "user1@example.com",
                                    "user2@example.com",
                                    "user3@example.com"
                                ], null, 2)}
                                rows={6}
                            />
                            <div className="json-example">
                                <h4>JSON Format Examples:</h4>
                                <pre>
                                    {`// Simple array of emails
["user1@example.com", "user2@example.com"]

// Array of objects with emails
[
  {"email": "user1@example.com"},
  {"email": "user2@example.com"}
]

// Object with emails array
{"emails": ["user1@example.com", "user2@example.com"]}`}
                                </pre>
                            </div>
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <div className="import-section">
                            <div className="manual-emails-list">
                                {manualEmails.map((email, index) => (
                                    <div key={index} className="manual-email-row">
                                        <button
                                            className="remove-btn"
                                            onClick={() => removeManualEmail(index)}
                                            disabled={manualEmails.length === 1}
                                        >
                                            ×
                                        </button>
                                        <input
                                            type="email"
                                            placeholder="Enter email address"
                                            value={email}
                                            onChange={(e) => handleManualEmailChange(index, e.target.value)}
                                            className="email-input"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button className="add-btn" onClick={addManualEmail}>
                                + Add Another Email
                            </button>
                        </div>
                    )}

                    <div className="import-options">
                        <div className="form-group">
                            <label>Default Role for Invited Members:</label>
                            <select
                                value={options.defaultRole}
                                onChange={(e) => setOptions({ ...options, defaultRole: e.target.value })}
                                className="form-select"
                            >
                                <option value="MEMBER">Member</option>
                                <option value="VIEWER">Viewer</option>
                                <option value="EDITOR">Editor</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>

                        <label className="option-checkbox">
                            <input
                                type="checkbox"
                                checked={options.sendInvitationEmail}
                                onChange={(e) => setOptions({ ...options, sendInvitationEmail: e.target.checked })}
                            />
                            <span>Send invitation email to each address</span>
                        </label>

                        <label className="option-checkbox">
                            <input
                                type="checkbox"
                                checked={options.skipPendingInvitations}
                                onChange={(e) => setOptions({ ...options, skipPendingInvitations: e.target.checked })}
                            />
                            <span>Skip emails with pending invitations</span>
                        </label>

                        <label className="option-checkbox">
                            <input
                                type="checkbox"
                                checked={options.skipExistingMembers}
                                onChange={(e) => setOptions({ ...options, skipExistingMembers: e.target.checked })}
                            />
                            <span>Skip existing workspace members</span>
                        </label>
                    </div>

                    {error && (
                        <div className="import-error">
                            <h4>❌ Error:</h4>
                            <p>{error}</p>
                        </div>
                    )}

                    {importResult && (
                        <div className="import-result">
                            <h4>📊 Import Results:</h4>
                            <div className="result-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Total Emails:</span>
                                    <span className="stat-value">{importResult.totalRows}</span>
                                </div>
                                <div className="stat-item success">
                                    <span className="stat-label">Invitations Sent:</span>
                                    <span className="stat-value">{importResult.invited}</span>
                                </div>
                                <div className="stat-item warning">
                                    <span className="stat-label">Skipped:</span>
                                    <span className="stat-value">{importResult.skipped}</span>
                                </div>
                                <div className="stat-item error">
                                    <span className="stat-label">Failed:</span>
                                    <span className="stat-value">{importResult.failed}</span>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="errors-list">
                                    <h5>Failed Invitations:</h5>
                                    {importResult.errors.slice(0, 5).map((err, index) => (
                                        <div key={index} className="error-item">
                                            <span className="error-email">{err.email}</span>
                                            <span className="error-reason">({err.reason})</span>
                                        </div>
                                    ))}
                                    {importResult.errors.length > 5 && (
                                        <p className="more-errors">
                                            ... and {importResult.errors.length - 5} more failed
                                        </p>
                                    )}
                                </div>
                            )}

                            {importResult.successes.length > 0 && (
                                <div className="success-list">
                                    <h5>✅ Successful Invitations:</h5>
                                    {importResult.successes.slice(0, 5).map((success, index) => (
                                        <div key={index} className="success-item">
                                            <span>{success.email}</span>
                                            <span className="success-role">({success.role})</span>
                                        </div>
                                    ))}
                                    {importResult.successes.length > 5 && (
                                        <p className="more-successes">
                                            ... and {importResult.successes.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={handleClose}>
                        Cancel
                    </button>
                    
                    <button
                        className="btn-import"
                        onClick={handleImport}
                        disabled={loading ||
                            (activeTab === 'csv' && !file) ||
                            (activeTab === 'json' && !jsonData.trim()) ||
                            (activeTab === 'manual' && manualEmails.every(e => !e.trim()))}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Sending Invitations...
                            </>
                        ) : (
                            'Send Invitations'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


export default WorkspaceImportModal;
