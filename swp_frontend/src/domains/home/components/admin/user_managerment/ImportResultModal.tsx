import React, { useState } from 'react';
import './ImportResultModal.css';

interface ImportResultModalProps {
    isOpen: boolean;
    result: any;
    onClose: () => void;
    onRetry?: () => void;
}

const ImportResultModal: React.FC<ImportResultModalProps> = ({ isOpen, result, onClose, onRetry }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'errors' | 'successes'>('summary');
    const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

    if (!isOpen || !result) return null;

    const { data } = result;
    
    // Tính toán statistics
    const stats = {
        total: data.totalRows || data.total || 0,
        success: data.successCount || 0,
        failed: data.failed || 0,
        created: data.created || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        successRate: data.totalRows ? Math.round((data.successCount / data.totalRows) * 100) : 0
    };

    // Group errors by reason
    const errorGroups = data.errors?.reduce((groups: any, error: any) => {
        const reason = error.reason;
        if (!groups[reason]) {
            groups[reason] = { count: 0, errors: [] };
        }
        groups[reason].count++;
        groups[reason].errors.push(error);
        return groups;
    }, {}) || {};

    // Export errors to CSV
    const exportErrorsToCSV = () => {
        if (!data.errors || data.errors.length === 0) return;
        
        const headers = ['Row', 'Email', 'Error Reason', 'Details', 'Suggestion'];
        const rows = data.errors.map((error: any) => [
            error.row,
            error.email,
            error.reason,
            error.details || '',
            error.suggestion || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `import-errors-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    // Export successes to CSV
    const exportSuccessesToCSV = () => {
        if (!data.successes || data.successes.length === 0) return;
        
        const headers = ['Row', 'Email', 'Action', 'Temporary Password', 'Changes'];
        const rows = data.successes.map((success: any) => [
            success.row,
            success.email,
            success.action,
            success.temporaryPassword || '',
            success.changes ? JSON.stringify(success.changes) : ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `import-successes-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    // Export full report
    const exportFullReport = () => {
        const report = {
            summary: stats,
            errors: data.errors || [],
            successes: data.successes || [],
            timestamp: new Date().toISOString(),
            executionTime: data.executionTimeMs ? `${data.executionTimeMs}ms` : 'N/A'
        };
        
        const content = exportFormat === 'csv' 
            ? convertToCSV(report)
            : JSON.stringify(report, null, 2);
        
        const blob = new Blob([content], { 
            type: exportFormat === 'csv' ? 'text/csv' : 'application/json' 
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `import-report-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const convertToCSV = (_report: any) => {
        // Simplified CSV conversion
        const sections = [];
        
        // Summary section
        sections.push('=== IMPORT SUMMARY ===');
        sections.push(['Metric', 'Value'].join(','));
        sections.push(['Total Rows', stats.total].join(','));
        sections.push(['Successful', stats.success].join(','));
        sections.push(['Failed', stats.failed].join(','));
        sections.push(['Created', stats.created].join(','));
        sections.push(['Updated', stats.updated].join(','));
        sections.push(['Skipped', stats.skipped].join(','));
        sections.push(['Success Rate', `${stats.successRate}%`].join(','));
        sections.push(['Execution Time', data.executionTimeMs ? `${data.executionTimeMs}ms` : 'N/A'].join(','));
        
        // Errors section
        if (data.errors && data.errors.length > 0) {
            sections.push('\n=== ERRORS ===');
            sections.push(['Row', 'Email', 'Reason', 'Details', 'Suggestion'].join(','));
            data.errors.forEach((error: any) => {
                sections.push([
                    error.row,
                    error.email,
                    error.reason,
                    error.details || '',
                    error.suggestion || ''
                ].map(cell => `"${cell}"`).join(','));
            });
        }
        
        // Successes section
        if (data.successes && data.successes.length > 0) {
            sections.push('\n=== SUCCESSES ===');
            sections.push(['Row', 'Email', 'Action', 'Temporary Password', 'Changes'].join(','));
            data.successes.forEach((success: any) => {
                sections.push([
                    success.row,
                    success.email,
                    success.action,
                    success.temporaryPassword || '',
                    success.changes ? JSON.stringify(success.changes) : ''
                ].map(cell => `"${cell}"`).join(','));
            });
        }
        
        return sections.join('\n');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="import-result-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 Import Results</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        📈 Summary
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
                        onClick={() => setActiveTab('errors')}
                        disabled={!data.errors || data.errors.length === 0}
                    >
                        ❌ Errors ({data.errors?.length || 0})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'successes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('successes')}
                        disabled={!data.successes || data.successes.length === 0}
                    >
                        ✅ Successes ({data.successes?.length || 0})
                    </button>
                </div>

                <div className="modal-content">
                    {activeTab === 'summary' && (
                        <div className="summary-section">
                            {/* Stats Cards */}
                            <div className="stats-grid">
                                <div className="stat-card total">
                                    <div className="stat-icon">📋</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.total}</div>
                                        <div className="stat-label">Total Rows</div>
                                    </div>
                                </div>
                                
                                <div className="stat-card success">
                                    <div className="stat-icon">✅</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.success}</div>
                                        <div className="stat-label">Successful</div>
                                        <div className="stat-percentage">{stats.successRate}%</div>
                                    </div>
                                </div>
                                
                                <div className="stat-card failed">
                                    <div className="stat-icon">❌</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.failed}</div>
                                        <div className="stat-label">Failed</div>
                                        <div className="stat-percentage">
                                            {Math.round((stats.failed / stats.total) * 100)}%
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="stat-card created">
                                    <div className="stat-icon">🆕</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.created}</div>
                                        <div className="stat-label">Created</div>
                                    </div>
                                </div>
                                
                                <div className="stat-card updated">
                                    <div className="stat-icon">✏️</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.updated}</div>
                                        <div className="stat-label">Updated</div>
                                    </div>
                                </div>
                                
                                <div className="stat-card skipped">
                                    <div className="stat-icon">⏭️</div>
                                    <div className="stat-content">
                                        <div className="stat-value">{stats.skipped}</div>
                                        <div className="stat-label">Skipped</div>
                                    </div>
                                </div>
                            </div>

                            {/* Execution Time */}
                            {data.executionTimeMs && (
                                <div className="execution-time">
                                    <span className="time-label">Execution Time:</span>
                                    <span className="time-value">
                                        {data.executionTimeMs > 1000 
                                            ? `${(data.executionTimeMs / 1000).toFixed(2)}s`
                                            : `${data.executionTimeMs}ms`
                                        }
                                    </span>
                                </div>
                            )}

                            {/* Error Breakdown */}
                            {Object.keys(errorGroups).length > 0 && (
                                <div className="error-breakdown">
                                    <h4>Error Breakdown:</h4>
                                    <div className="error-categories">
                                        {Object.entries(errorGroups).map(([reason, group]: [string, any]) => (
                                            <div key={reason} className="error-category">
                                                <span className="error-reason">{reason}</span>
                                                <span className="error-count">{group.count} rows</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="quick-actions">
                                <button 
                                    className="action-btn export-errors"
                                    onClick={exportErrorsToCSV}
                                    disabled={!data.errors || data.errors.length === 0}
                                >
                                    📥 Export Errors
                                </button>
                                <button 
                                    className="action-btn view-details"
                                    onClick={() => setActiveTab('errors')}
                                    disabled={!data.errors || data.errors.length === 0}
                                >
                                    🔍 View Error Details
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'errors' && data.errors && (
                        <div className="errors-section">
                            <div className="section-header">
                                <h4>Error Details ({data.errors.length} errors)</h4>
                                <div className="section-actions">
                                    <button 
                                        className="export-btn" 
                                        onClick={exportErrorsToCSV}
                                        disabled={data.errors.length === 0}
                                    >
                                        📥 Export All
                                    </button>
                                </div>
                            </div>
                            
                            <div className="errors-table-container">
                                <table className="errors-table">
                                    <thead>
                                        <tr>
                                            <th>Row</th>
                                            <th>Email</th>
                                            <th>Error Reason</th>
                                            <th>Details</th>
                                            <th>Suggestion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.errors.map((error: any, index: number) => (
                                            <tr key={index} className="error-row">
                                                <td className="row-number">{error.row}</td>
                                                <td className="email-cell">
                                                    <span className="email-text">{error.email}</span>
                                                </td>
                                                <td className="reason-cell">
                                                    <span className={`reason-badge ${error.reason?.toLowerCase().replace('_', '-')}`}>
                                                        {error.reason}
                                                    </span>
                                                </td>
                                                <td className="details-cell">{error.details}</td>
                                                <td className="suggestion-cell">{error.suggestion}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'successes' && data.successes && (
                        <div className="successes-section">
                            <div className="section-header">
                                <h4>Successful Imports ({data.successes.length} rows)</h4>
                                <div className="section-actions">
                                    <button 
                                        className="export-btn" 
                                        onClick={exportSuccessesToCSV}
                                        disabled={data.successes.length === 0}
                                    >
                                        📥 Export All
                                    </button>
                                </div>
                            </div>
                            
                            <div className="action-breakdown">
                                <div className="action-stats">
                                    <span className="action-stat created">
                                        <span className="stat-label">Created:</span>
                                        <span className="stat-value">{stats.created}</span>
                                    </span>
                                    <span className="action-stat updated">
                                        <span className="stat-label">Updated:</span>
                                        <span className="stat-value">{stats.updated}</span>
                                    </span>
                                    <span className="action-stat skipped">
                                        <span className="stat-label">Skipped:</span>
                                        <span className="stat-value">{stats.skipped}</span>
                                    </span>
                                </div>
                            </div>
                            
                            <div className="successes-table-container">
                                <table className="successes-table">
                                    <thead>
                                        <tr>
                                            <th>Row</th>
                                            <th>Email</th>
                                            <th>Action</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.successes.map((success: any, index: number) => (
                                            <tr key={index} className={`success-row ${success.action}`}>
                                                <td className="row-number">{success.row}</td>
                                                <td className="email-cell">{success.email}</td>
                                                <td className="action-cell">
                                                    <span className={`action-badge ${success.action}`}>
                                                        {success.action}
                                                    </span>
                                                </td>
                                                <td className="details-cell">
                                                    {success.temporaryPassword && (
                                                        <div className="temp-password">
                                                            <strong>Temp Password:</strong> {success.temporaryPassword}
                                                        </div>
                                                    )}
                                                    {success.changes && (
                                                        <div className="changes">
                                                            {Object.entries(success.changes).map(([key, value]) => (
                                                                <div key={key} className="change-item">
                                                                    <span className="change-key">{key}:</span>
                                                                    <span className="change-value">{JSON.stringify(value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="export-options">
                        <select 
                            value={exportFormat}
                            onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                            className="format-select"
                        >
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                        </select>
                        <button 
                            className="btn-download-report"
                            onClick={exportFullReport}
                        >
                            📊 Download Full Report
                        </button>
                    </div>
                    
                    <div className="action-buttons">
                        {onRetry && (
                            <button 
                                className="btn-retry"
                                onClick={onRetry}
                            >
                                🔄 Retry Failed
                            </button>
                        )}
                        <button className="btn-close" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportResultModal;