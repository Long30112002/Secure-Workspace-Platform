import React, { useState, useRef } from 'react';
import './ImportModal.css';
import { apiService } from '../../../../../services/api/axiosConfig';
import ImportResultModal from './ImportResultModal';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess?: (resultData: any) => void;
}

type ImportMethod = 'csv' | 'json' | 'manual';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
    const [activeTab, setActiveTab] = useState<ImportMethod>('csv');
    const [file, setFile] = useState<File | null>(null);
    const [jsonData, setJsonData] = useState<string>('');
    const [manualUsers, setManualUsers] = useState<Array<{ email: string; firstName: string; lastName: string; role: string }>>([
        { email: '', firstName: '', lastName: '', role: 'USER' }
    ]);
    const [options, setOptions] = useState({
        sendWelcomeEmail: true,
        updateExisting: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [importResultData, setImportResultData] = useState<any>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleManualUserChange = (index: number, field: string, value: string) => {
        const updatedUsers = [...manualUsers];
        updatedUsers[index] = { ...updatedUsers[index], [field]: value };
        setManualUsers(updatedUsers);
    };

    const addManualUser = () => {
        setManualUsers([...manualUsers, { email: '', firstName: '', lastName: '', role: 'USER' }]);
    };

    const removeManualUser = (index: number) => {
        if (manualUsers.length > 1) {
            const updatedUsers = manualUsers.filter((_, i) => i !== index);
            setManualUsers(updatedUsers);
        }
    };

    const validateManualUsers = () => {
        for (const user of manualUsers) {
            if (!user.email) {
                throw new Error('Email is required for all users');
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(user.email)) {
                throw new Error(`Invalid email format: ${user.email}`);
            }
        }
        return true;
    };

    const handleImportCSV = async () => {
        if (!file) {
            throw new Error('Please select a csv file');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('sendWelcomeEmail', options.sendWelcomeEmail.toString());
        formData.append('updateExisting', options.updateExisting.toString());

        const result = await apiService.request('/api/user-management/import/csv', {
            method: 'POST',
            headers: {}, // Không set Content-Type, browser sẽ tự động set với boundary
            body: formData,
        });

        return result;
    }

    const handleImportJSON = async () => {
        if (!jsonData.trim()) {
            throw new Error('Please enter JSON data');
        }

        try {
            const users = JSON.parse(jsonData);
            if (!Array.isArray(users)) {
                throw new Error('JSON must be an array of users');
            }

            const usersStringArray = users.map(user => JSON.stringify(user));

            const importData = {
                users: usersStringArray,
                sendWelcomeEmail: options.sendWelcomeEmail,
                updateExisting: options.updateExisting
            };
            const result = await apiService.request('/api/user-management/import', {
                method: 'POST',
                body: JSON.stringify(importData),
            });

            return result;
        } catch (parseError: any) {
            throw new Error(`Invalid JSON format: ${parseError.message}`);
        }
    }

    const handleImportManual = async () => {
        validateManualUsers();

        const usersStringArray = manualUsers.map(user => JSON.stringify(user));

        const importData = {
            users: usersStringArray,
            sendWelcomeEmail: options.sendWelcomeEmail,
            updateExisting: options.updateExisting
        };

        const result = await apiService.request('/api/user-management/import', {
            method: 'POST',
            body: JSON.stringify(importData),
        });

        return result;
    }

    const handleImport = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setImportResult(null);

        try {
            let result;

            switch (activeTab) {
                case 'csv':
                    result = await handleImportCSV();
                    break;
                case 'json':
                    result = await handleImportJSON();
                    break;
                case 'manual':
                    result = await handleImportManual();
                    break;
                default:
                    throw new Error('Invalid import method');
            }

            // Kiểm tra response từ server
            if (result.success === false) {
                throw new Error(result.message || 'Import failed');
            }

            setImportResultData(result.data);
            setShowResultModal(true);

            // Gọi callback nếu có
            if (onImportSuccess) {
                onImportSuccess(result.data);
            }

            return result;
        } catch (error: any) {
            console.error('Import error:', error);
            setError(error.message || 'An error occurred during import');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            await handleImport();
        } catch (error: any) {
            console.error('Submit error:', error);
        }
    };

    const resetForm = () => {
        setFile(null);
        setJsonData('');
        setManualUsers([{ email: '', firstName: '', lastName: '', role: 'USER' }]);
        setError(null);
        setSuccess(null);
        setImportResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const downloadCSVTemplate = async () => {
        try {
            // Tạo template CSV đơn giản
            const headers = ['email', 'firstName', 'lastName', 'role'];
            const sampleData = [
                ['user1@example.com', 'John', 'Doe', 'USER'],
                ['user2@example.com', 'Jane', 'Smith', 'ADMIN'],
                ['user3@example.com', 'Bob', 'Johnson', 'USER']
            ];

            const csvContent = [
                headers.join(','),
                ...sampleData.map(row => row.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'user-import-template.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading template:', error);
            alert('Error downloading template');
        }
    };


    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="import-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Import Users</h2>
                    <button className="close-btn" onClick={handleClose}>×</button>
                </div>

                <div className="modal-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
                        onClick={() => setActiveTab('csv')}
                    >
                        📁 CSV File
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                        onClick={() => setActiveTab('json')}
                    >
                        📄 JSON Data
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        ✍️ Manual Entry
                    </button>
                </div>

                <div className="modal-content">
                    {activeTab === 'csv' && (
                        <div className="import-section">
                            <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                                <div className="upload-icon">📁</div>
                                <p>Click to upload CSV file</p>
                                <p className="file-name">{file ? file.name : 'No file selected'}</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            <div className="file-requirements">
                                <h4>CSV Format Requirements:</h4>
                                <ul>
                                    <li>Required columns: <code>email</code></li>
                                    <li>Optional columns: <code>firstName</code>, <code>lastName</code>, <code>role</code></li>
                                    <li>Roles: USER, ADMIN, SUPER_ADMIN, MODERATOR</li>
                                    <li>Max file size: 10MB</li>
                                </ul>
                                <button
                                    onClick={downloadCSVTemplate}
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
                                    {
                                        "email": "user1@example.com",
                                        "firstName": "John",
                                        "lastName": "Doe",
                                        "role": "USER"
                                    },
                                    {
                                        "email": "user2@example.com",
                                        "firstName": "Jane",
                                        "lastName": "Smith",
                                        "role": "ADMIN"
                                    }
                                ], null, 2)}
                                rows={10}
                            />
                            <div className="json-example">
                                <h4>JSON Format:</h4>
                                <pre>
                                    {`[
  {
    "email": "string (required)",
    "firstName": "string (optional)",
    "lastName": "string (optional)",
    "role": "USER | ADMIN | SUPER_ADMIN | MODERATOR"
  }
]`}
                                </pre>
                            </div>
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <div className="import-section">
                            <div className="manual-users-list">
                                {manualUsers.map((user, index) => (
                                    <div key={index} className="manual-user-row">
                                        <button
                                            className="remove-user-btn"
                                            onClick={() => removeManualUser(index)}
                                            disabled={manualUsers.length === 1}
                                        >
                                            ×
                                        </button>

                                        <div className="user-fields">
                                            <input
                                                type="email"
                                                placeholder="Email *"
                                                value={user.email}
                                                onChange={(e) => handleManualUserChange(index, 'email', e.target.value)}
                                                required
                                            />
                                            <input
                                                type="text"
                                                placeholder="First Name"
                                                value={user.firstName}
                                                onChange={(e) => handleManualUserChange(index, 'firstName', e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Last Name"
                                                value={user.lastName}
                                                onChange={(e) => handleManualUserChange(index, 'lastName', e.target.value)}
                                            />
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleManualUserChange(index, 'role', e.target.value)}
                                            >
                                                <option value="USER">USER</option>
                                                <option value="ADMIN">ADMIN</option>
                                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                                <option value="MODERATOR">MODERATOR</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="add-user-btn" onClick={addManualUser}>
                                + Add Another User
                            </button>
                        </div>
                    )}

                    <div className="import-options">
                        <label className="option-checkbox">
                            <input
                                type="checkbox"
                                checked={options.sendWelcomeEmail}
                                onChange={(e) => setOptions({ ...options, sendWelcomeEmail: e.target.checked })}
                            />
                            <span>Send welcome email with temporary password</span>
                        </label>
                        <label className="option-checkbox">
                            <input
                                type="checkbox"
                                checked={options.updateExisting}
                                onChange={(e) => setOptions({ ...options, updateExisting: e.target.checked })}
                            />
                            <span>Update existing users (if email exists)</span>
                        </label>
                    </div>

                    {error && (
                        <div className="import-error">
                            <h4>❌ Import Errors:</h4>
                            <pre>{error}</pre>
                        </div>
                    )}

                    {success && (
                        <div className="import-success">
                            <h4>✅ Import Successful!</h4>
                            <p>{success}</p>
                            {importResult && (
                                <div className="import-details">
                                    <p><strong>Total:</strong> {importResult.total || importResult.totalRows || 0}</p>
                                    <p><strong>Created:</strong> {importResult.created || 0}</p>
                                    <p><strong>Updated:</strong> {importResult.updated || 0}</p>
                                    <p><strong>Skipped:</strong> {importResult.skipped || 0}</p>
                                    <p><strong>Failed:</strong> {importResult.failed || 0}</p>
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
                        onClick={handleSubmit}
                        disabled={loading || (activeTab === 'csv' && !file) || (activeTab === 'json' && !jsonData.trim())}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Importing...
                            </>
                        ) : (
                            'Start Import'
                        )}
                    </button>
                </div>
                <ImportResultModal
                    isOpen={showResultModal}
                    result={importResultData}
                    onClose={() => setShowResultModal(false)}
                    onRetry={() => {
                        setShowResultModal(false);
                        handleSubmit();
                    }}
                />
            </div>


        </div>
    );
};

export default ImportModal;