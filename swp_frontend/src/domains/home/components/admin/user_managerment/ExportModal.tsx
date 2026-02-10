import React, { useState } from 'react';
import './ExportModal.css';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUsers: string[];
    onExportSuccess?: () => void;
}

type ExportFormat = 'csv' | 'excel' | 'json';

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, selectedUsers, onExportSuccess }) => {
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [exportMode, setExportMode] = useState<'all' | 'selected' | 'filtered'>(
        selectedUsers.length > 0 ? 'selected' : 'all'
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = () => {
        setLoading(true);
        setError(null);

        try {
            if (exportMode === 'selected' && selectedUsers.length > 0) {
                // Export selected users
                handleSelectedExport();
            } else {
                // Export all users
                handleAllExport();
            }

            if (onExportSuccess) {
                setTimeout(() => onExportSuccess(), 500);
            }

            setTimeout(() => {
                setLoading(false);
                onClose();
            }, 1000);

        } catch (error: any) {
            console.error('Export error:', error);
            setError(error.message || 'Export failed. Please try again.');
            setLoading(false);
        }
    };

    const handleSelectedExport = () => {
        if (format === 'json') {
            // JSON export
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/user-management/export/selected/json';
            form.target = '_blank';
            form.style.display = 'none';

            // Gửi userIds dưới dạng JSON string
            const userIdsInput = document.createElement('input');
            userIdsInput.type = 'hidden';
            userIdsInput.name = 'userIds';
            userIdsInput.value = JSON.stringify(selectedUsers);
            form.appendChild(userIdsInput);

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        } else {
            // CSV/Excel export
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/user-management/export/selected/file';
            form.target = '_blank';
            form.style.display = 'none';

            // Gửi userIds dưới dạng JSON string
            const userIdsInput = document.createElement('input');
            userIdsInput.type = 'hidden';
            userIdsInput.name = 'userIds';
            userIdsInput.value = JSON.stringify(selectedUsers);
            form.appendChild(userIdsInput);

            // Gửi format
            const formatInput = document.createElement('input');
            formatInput.type = 'hidden';
            formatInput.name = 'format';
            formatInput.value = format;
            form.appendChild(formatInput);

            console.log('Sending export request:', {
                userIds: selectedUsers,
                format: format
            });

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        }
    };

    const handleAllExport = () => {
        const params = new URLSearchParams({
            format: format,
            includeDeleted: includeDeleted.toString()
        });

        const url = `/api/user-management/export?${params}`;
        window.open(url, '_blank');
    };

    // Render format button
    const renderFormatButton = (targetFormat: ExportFormat, icon: string, name: string, desc: string) => {
        const isActive = format === targetFormat;
        const fileInfo = getFileSizeInfo(targetFormat);

        return (
            <button
                key={targetFormat}
                className={`format-option ${isActive ? 'active' : ''}`}
                onClick={() => setFormat(targetFormat)}
                type="button"
            >
                <div className="format-icon">{icon}</div>
                <div className="format-info">
                    <span className="format-name">{name}</span>
                    <span className="format-desc">{desc}</span>
                    <span
                        className="format-size"
                        style={{
                            color: fileInfo.color,
                            fontWeight: isActive ? '600' : '400'
                        }}
                    >
                        {fileInfo.size}
                    </span>
                </div>
            </button>
        );
    };

    const getFileSizeInfo = (targetFormat: ExportFormat) => {
        switch (targetFormat) {
            case 'csv':
                return { size: '10-100KB', color: '#10b981' };
            case 'excel':
                return { size: '50-500KB', color: '#3b82f6' };
            case 'json':
                return { size: '20-200KB', color: '#8b5cf6' };
            default:
                return { size: 'N/A', color: '#6b7280' };
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="export-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Export Users</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-content">
                    <div className="export-section">
                        <div className="export-mode">
                            <h3>Export Range</h3>
                            <div className="mode-options">
                                <label className="mode-option">
                                    <input
                                        type="radio"
                                        name="exportMode"
                                        value="all"
                                        checked={exportMode === 'all'}
                                        onChange={(e) => setExportMode(e.target.value as any)}
                                        disabled={selectedUsers.length > 0}
                                    />
                                    <div className="option-content">
                                        <span className="option-title">All Users</span>
                                        <span className="option-desc">Export all users in the system</span>
                                    </div>
                                </label>

                                <label className="mode-option">
                                    <input
                                        type="radio"
                                        name="exportMode"
                                        value="selected"
                                        checked={exportMode === 'selected'}
                                        onChange={(e) => setExportMode(e.target.value as any)}
                                    />
                                    <div className="option-content">
                                        <span className="option-title">Selected Users</span>
                                        <span className="option-desc">
                                            {selectedUsers.length > 0
                                                ? `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`
                                                : 'No users selected'}
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="export-format">
                            <h3>Export Format</h3>
                            <div className="format-options">
                                {renderFormatButton('csv', '📄', 'CSV', 'Comma separated values')}
                                {renderFormatButton('excel', '📊', 'Excel', 'Microsoft Excel format')}
                                {renderFormatButton('json', '{ }', 'JSON', 'JavaScript Object Notation')}
                            </div>
                            <div className="format-note">
                                <small>Selected format: <strong>{format.toUpperCase()}</strong></small>
                            </div>
                        </div>

                        <div className="export-options">
                            <h3>Options</h3>
                            <label className="option-checkbox">
                                <input
                                    type="checkbox"
                                    checked={includeDeleted}
                                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                                />
                                <span>Include deleted users</span>
                            </label>
                        </div>

                        {error && (
                            <div className="export-error">
                                <h4>❌ Export Error:</h4>
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="export-preview">
                            <h3>Export Summary</h3>
                            <div className="preview-content">
                                <div className="preview-header">
                                    <span>Exporting:</span>
                                    <span className="preview-count">
                                        {exportMode === 'selected'
                                            ? `${selectedUsers.length} selected user${selectedUsers.length !== 1 ? 's' : ''}`
                                            : 'All users'}
                                    </span>
                                </div>

                                <div className="preview-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Format:</span>
                                        <span className="detail-value format-badge">{format.toUpperCase()}</span>
                                    </div>

                                    <div className="detail-row">
                                        <span className="detail-label">Include deleted:</span>
                                        <span className="detail-value">{includeDeleted ? 'Yes' : 'No'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="btn-export"
                        onClick={handleExport}
                        disabled={loading || (exportMode === 'selected' && selectedUsers.length === 0)}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Exporting...
                            </>
                        ) : (
                            `Export as ${format.toUpperCase()}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;