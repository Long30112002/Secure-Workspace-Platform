import React, { useState } from 'react';
import './ImportToast.css';

interface ImportToastProps {
    result: any;
    onShowDetails: () => void;
    onClose: () => void;
}

const ImportToast: React.FC<ImportToastProps> = ({ result, onShowDetails, onClose }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!result) return null;

    const data = result.data || result;

    // Tính toán stats
    const stats = {
        total: data.totalRows || data.total || 0,
        success: data.successCount || 0,
        failed: data.failed || 0,
        created: data.created || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        successRate: data.totalRows ? Math.round((data.successCount / data.totalRows) * 100) : 0
    };

    return (
        <div
            className={`import-toast ${isExpanded ? 'expanded' : ''}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onClick={onShowDetails}
        >
            {/* Close button - chỉ hiển thị khi expanded */}
            {isExpanded && (
                <button
                    className="toast-close-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    title="Close notification"
                >
                    ✕
                </button>
            )}

            {/* Mini view (khi không hover) */}
            <div className="toast-mini">
                <div className="toast-icon">📊</div>
                <div className="toast-summary">
                    <div className="toast-title">Import Results</div>
                    <div className="toast-stats-mini">
                        <span>{stats.total} users</span>
                        <span className="success-count"> • {stats.success} ✓</span>
                        {stats.failed > 0 && (
                            <span className="error-count"> • {stats.failed} ✗</span>
                        )}
                    </div>
                </div>
                {!isExpanded && (
                    <div className="toast-hint">Hover for details</div>
                )}
            </div>

            {/* Expanded view (khi hover) */}
            {isExpanded && (
                <div className="toast-expanded">
                    <div className="expanded-header">
                        <div className="toast-icon-large">📊</div>
                        <div>
                            <div className="toast-title-large">Import Results</div>
                            <div className="toast-subtitle">Click to view full report</div>
                        </div>
                    </div>

                    <div className="expanded-stats">
                        <div className="stat-row">
                            <span className="stat-label">Total:</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                        {stats.created > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">✅ Created:</span>
                                <span className="stat-value">{stats.created}</span>
                            </div>
                        )}
                        {stats.updated > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">✏️ Updated:</span>
                                <span className="stat-value">{stats.updated}</span>
                            </div>
                        )}
                        {stats.skipped > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">⏭️ Skipped:</span>
                                <span className="stat-value">{stats.skipped}</span>
                            </div>
                        )}
                        {stats.failed > 0 && (
                            <div className="stat-row error">
                                <span className="stat-label">❌ Failed:</span>
                                <span className="stat-value">{stats.failed}</span>
                            </div>
                        )}
                    </div>

                    {data.errors && data.errors.length > 0 && (
                        <div className="error-preview">
                            <div className="error-preview-title">Errors preview:</div>
                            {data.errors.slice(0, 2).map((error: any, index: number) => (
                                <div key={index} className="error-preview-item">
                                    <span className="error-row">Row {error.row}:</span>
                                    <span className="error-reason">{error.reason}</span>
                                </div>
                            ))}
                            {data.errors.length > 2 && (
                                <div className="more-errors">
                                    +{data.errors.length - 2} more errors
                                </div>
                            )}
                        </div>
                    )}

                    <div className="expanded-actions">
                        <button
                            className="view-details-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowDetails();
                            }}
                        >
                            View Full Report
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportToast;