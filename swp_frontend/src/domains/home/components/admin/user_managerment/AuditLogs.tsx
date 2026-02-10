import React, { useState, useEffect, useCallback } from 'react';
import './AuditLogs.css';
import { apiService } from '../../../../../services/api/axiosConfig';

interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId?: number;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    admin: {
        id: number;
        email: string;
        role: string;
    };
}

interface AuditStats {
    total: number;
    today: number;
    topActions: Array<{
        action: string;
        count: number;
    }>;
}


const AuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [showRawJson, setShowRawJson] = useState(false);

    // Di chuyển các hàm helper ra ngoài, KHÔNG dùng this
    const formatKey = (key: string): string => {
        const keyMap: Record<string, string> = {
            email: 'Email Address',
            role: 'User Role',
            status: 'Account Status',
            name: 'Full Name',
            usersCount: 'Number of Users',
            userIds: 'User IDs',
            importCount: 'Imported Users',
            sampleEmails: 'Sample Emails',
            sendWelcomeEmail: 'Send Welcome Email',
            updateExisting: 'Update Existing Users',
            message: 'Result Message',
            statistics: 'Statistics',
            updatedCount: 'Users Updated',
            deletedCount: 'Users Deleted',
            temporaryPassword: 'Temporary Password',
        };

        return keyMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    };

    // Helper function để render value thân thiện
    const renderValue = (key: string, value: any): React.ReactNode => {
        if (value === null || value === undefined) {
            return <span className="value-null">N/A</span>;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                return <span className="value-empty">Empty</span>;
            }

            if (key === 'userIds' || key === 'sampleEmails') {
                return (
                    <div className="value-array">
                        {value.map((item, index) => (
                            <span key={index} className="array-item">
                                {typeof item === 'object' ? JSON.stringify(item) : item.toString()}
                            </span>
                        ))}
                    </div>
                );
            }

            return <span className="value-count">{value.length} items</span>;
        }

        if (typeof value === 'object') {
            return (
                <div className="value-object">
                    {Object.entries(value).map(([k, v]) => (
                        <div key={k} className="object-row">
                            <span className="object-key">{formatKey(k)}:</span>
                            <span className="object-value">{renderValue(k, v)}</span>
                        </div>
                    ))}
                </div>
            );
        }

        if (typeof value === 'boolean') {
            return (
                <span className={`value-boolean ${value ? 'true' : 'false'}`}>
                    {value ? '✓ Yes' : '✗ No'}
                </span>
            );
        }

        if (key.includes('password') || key.includes('token')) {
            return <span className="value-sensitive">••••••••</span>;
        }

        return <span className="value-text">{value.toString()}</span>;
    };

    const fetchAuditLogs = useCallback(async (pageNum: number = 1) => {
        setLoading(true);
        try {
            const response = await apiService.request(`/api/audit-logs/my-logs?page=${pageNum}&limit=20`);

            if (response.success) {
                setLogs(response.data.logs);
                setPage(response.data.meta.page);
                setTotalPages(response.data.meta.totalPages);
            } else {
                throw new Error(response.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAuditStats = useCallback(async () => {
        try {
            const response = await apiService.request('/api/audit-logs/my-logs/stats');
            if (response.success) {
                setStats(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch audit stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchAuditLogs();
        fetchAuditStats();
    }, [fetchAuditLogs, fetchAuditStats]);

    const getActionColor = (action: string) => {
        const dangerousActions = ['DELETE_USER', 'BULK_DELETE_USERS', 'FORCE_DELETE_USER'];
        const warningActions = ['UPDATE_USER', 'BULK_UPDATE_USERS', 'IMPORT_USERS'];
        const infoActions = ['CREATE_USER', 'RESTORE_USER', 'VERIFY_EMAIL', 'UNLOCK_USER'];
        const safeActions = ['EXPORT_USERS', 'RESET_PASSWORD'];

        if (dangerousActions.includes(action)) return '#ef4444';
        if (warningActions.includes(action)) return '#f59e0b';
        if (infoActions.includes(action)) return '#3b82f6';
        if (safeActions.includes(action)) return '#10b981';

        return '#6b7280';
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE_USER': return '🆕';
            case 'UPDATE_USER': return '✏️';
            case 'DELETE_USER': return '🗑️';
            case 'RESTORE_USER': return '🔄';
            case 'BULK_DELETE_USERS': return '⚠️🗑️';
            case 'BULK_UPDATE_USERS': return '⚠️✏️';
            case 'UNLOCK_USER': return '🔓';
            case 'VERIFY_EMAIL': return '✅';
            case 'IMPORT_USERS': return '📥';
            case 'EXPORT_USERS': return '📤';
            case 'RESET_PASSWORD': return '🔑';
            default: return '📝';
        }
    };

    const formatActionText = (action: string) => {
        return action
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const handleViewDetails = async (logId: number) => {
        try {
            const response = await apiService.request(`/api/audit-logs/my-logs/${logId}`);
            if (response.success) {
                setSelectedLog(response.data.log);
                setShowRawJson(false); // Reset khi mở modal mới
            }
        } catch (err) {
            console.error('Failed to fetch log details:', err);
        }
    };

    const closeDetailsModal = () => {
        setSelectedLog(null);
        setShowRawJson(false);
    };

    // Phân tích details để lấy structured data
    const parseLogDetails = (details: any) => {
        if (!details) return null;

        // Nếu details đã được format sẵn theo structure mới
        if (details.summary || details.request || details.response) {
            return details;
        }

        // Nếu là format cũ (requestBody, response, duration)
        return {
            summary: generateSummaryFromOldFormat(details),
            request: formatOldRequest(details.requestBody),
            response: formatOldResponse(details.response),
            metadata: {
                duration: details.duration ? `${details.duration}ms` : 'N/A',
                timestamp: new Date().toLocaleString('vi-VN'),
                itemsProcessed: details.requestBody?.userIds?.length ||
                    details.requestBody?.users?.length || 1,
            }
        };
    };

    const generateSummaryFromOldFormat = (details: any): string => {
        if (!details.requestBody) return 'Action performed';

        const req = details.requestBody;

        if (req.users && Array.isArray(req.users)) {
            const count = req.users.length;
            return `Imported ${count} user${count !== 1 ? 's' : ''}`;
        }

        if (req.userIds && Array.isArray(req.userIds)) {
            const count = req.userIds.length;
            if (details.action?.includes('DELETE')) {
                return `Deleted ${count} user${count !== 1 ? 's' : ''}`;
            }
            return `Processed ${count} user${count !== 1 ? 's' : ''}`;
        }

        if (req.email) {
            if (details.action === 'CREATE_USER') {
                return `Created user: ${req.email}`;
            }
            if (details.action === 'UPDATE_USER') {
                return `Updated user: ${req.email}`;
            }
            return `User: ${req.email}`;
        }

        return 'Action performed';
    };

    const formatOldRequest = (requestBody: any): Record<string, any> => {
        if (!requestBody || Object.keys(requestBody).length === 0) {
            return { note: 'No request data' };
        }

        const formatted: Record<string, any> = {};

        if (requestBody.email) formatted.email = requestBody.email;
        if (requestBody.role) formatted.role = requestBody.role;
        if (requestBody.isActive !== undefined) {
            formatted.status = requestBody.isActive ? 'Active' : 'Inactive';
        }
        if (requestBody.firstName || requestBody.lastName) {
            formatted.name = `${requestBody.firstName || ''} ${requestBody.lastName || ''}`.trim();
        }
        if (requestBody.userIds && Array.isArray(requestBody.userIds)) {
            formatted.usersCount = requestBody.userIds.length;
            formatted.userIds = requestBody.userIds.slice(0, 3);
            if (requestBody.userIds.length > 3) {
                formatted.note = `...and ${requestBody.userIds.length - 3} more`;
            }
        }
        if (requestBody.users && Array.isArray(requestBody.users)) {
            formatted.importCount = requestBody.users.length;
        }
        if (requestBody.sendWelcomeEmail !== undefined) {
            formatted.sendWelcomeEmail = requestBody.sendWelcomeEmail;
        }
        if (requestBody.updateExisting !== undefined) {
            formatted.updateExisting = requestBody.updateExisting;
        }

        return formatted;
    };

    const formatOldResponse = (response: any): Record<string, any> => {
        if (!response) return { note: 'No response data' };

        const formatted: Record<string, any> = {};

        if (response.message) formatted.message = response.message;

        if (response.data) {
            if (response.data.user) {
                formatted.user = {
                    id: response.data.user.id,
                    email: response.data.user.email,
                    role: response.data.user.role,
                    status: response.data.user.isActive ? 'Active' : 'Inactive',
                };
            }

            if (response.data.totalRows !== undefined) {
                formatted.statistics = {
                    total: response.data.totalRows,
                    success: response.data.successCount || response.data.created || 0,
                    failed: response.data.failed || 0,
                    updated: response.data.updated || 0,
                    skipped: response.data.skipped || 0,
                };
            }

            if (response.data.updatedCount !== undefined) {
                formatted.updatedCount = response.data.updatedCount;
            }

            if (response.data.deletedCount !== undefined) {
                formatted.deletedCount = response.data.deletedCount;
            }

            if (response.data.temporaryPassword) {
                formatted.temporaryPassword = '****** (sent to user)';
            }
        }

        return formatted;
    };

    if (loading && logs.length === 0) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading audit logs...</p>
            </div>
        );
    }

    // Parse details khi selectedLog có
    const parsedDetails = selectedLog?.details ? parseLogDetails(selectedLog.details) : null;

    return (
        <div className="audit-logs-container">
            {/* Header */}
            <div className="audit-header">
                <h2>📋 My Audit Logs</h2>
                <p className="audit-subtitle">View your activity history</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="audit-stats">
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">Total Actions</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📅</div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.today}</div>
                            <div className="stat-label">Today</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⚡</div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {stats.topActions[0]?.count || 0}
                            </div>
                            <div className="stat-label">
                                {stats.topActions[0]?.action?.replace(/_/g, ' ') || 'No Activity'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="audit-filters">
                <button className="filter-btn active">All Actions</button>
                <button className="filter-btn">User Management</button>
                <button className="filter-btn">Today</button>
                <button className="filter-btn">This Week</button>
            </div>

            {/* Audit Logs Table */}
            <div className="audit-table-container">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th>Action</th>
                            <th>Details</th>
                            <th>Entity</th>
                            <th>IP Address</th>
                            <th>Timestamp</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => {
                            // Parse details để hiển thị trong bảng
                            const parsedDetails = parseLogDetails(log.details);

                            return (
                                <tr key={log.id} className={`audit-row ${log.action}`}>
                                    <td>
                                        <div className="action-cell">
                                            <span
                                                className="action-icon"
                                                style={{ color: getActionColor(log.action) }}
                                            >
                                                {getActionIcon(log.action)}
                                            </span>
                                            <span className="action-text">
                                                {formatActionText(log.action)}
                                            </span>
                                            <span
                                                className="action-badge"
                                                style={{
                                                    backgroundColor: getActionColor(log.action),
                                                    color: 'white'
                                                }}
                                            >
                                                {log.entityType}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="details-cell">
                                        <div className="details-preview">
                                            {/* Hiển thị summary nếu có */}
                                            {parsedDetails?.summary && (
                                                <div className="summary-preview">
                                                    <span className="summary-icon">📋</span>
                                                    <span className="summary-text">{parsedDetails.summary}</span>
                                                </div>
                                            )}

                                            {/* Hiển thị email nếu có */}
                                            {parsedDetails?.request?.email && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">User:</span>
                                                    <span className="preview-value">{parsedDetails.request.email}</span>
                                                </div>
                                            )}

                                            {/* Hiển thị số lượng nếu là bulk operation */}
                                            {parsedDetails?.request?.usersCount && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">Count:</span>
                                                    <span className="preview-value">{parsedDetails.request.usersCount} users</span>
                                                </div>
                                            )}

                                            {/* Hiển thị import count */}
                                            {parsedDetails?.request?.importCount && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">Imported:</span>
                                                    <span className="preview-value">{parsedDetails.request.importCount} users</span>
                                                </div>
                                            )}

                                            {/* Hiển thị role change */}
                                            {parsedDetails?.request?.role && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">Role:</span>
                                                    <span className="preview-value badge-role">{parsedDetails.request.role}</span>
                                                </div>
                                            )}

                                            {/* Hiển thị status change */}
                                            {parsedDetails?.request?.status && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">Status:</span>
                                                    <span className={`preview-value badge-status ${parsedDetails.request.status.toLowerCase()}`}>
                                                        {parsedDetails.request.status}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Hiển thị statistics preview */}
                                            {parsedDetails?.response?.statistics && (
                                                <div className="stats-preview">
                                                    <span className="stat-preview success">
                                                        ✓{parsedDetails.response.statistics.success}
                                                    </span>
                                                    {parsedDetails.response.statistics.failed > 0 && (
                                                        <span className="stat-preview failed">
                                                            ✗{parsedDetails.response.statistics.failed}
                                                        </span>
                                                    )}
                                                    {parsedDetails.response.statistics.updated > 0 && (
                                                        <span className="stat-preview updated">
                                                            ↻{parsedDetails.response.statistics.updated}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Hiển thị message ngắn */}
                                            {parsedDetails?.response?.message && (
                                                <div className="message-preview">
                                                    {parsedDetails.response.message.substring(0, 50)}
                                                    {parsedDetails.response.message.length > 50 ? '...' : ''}
                                                </div>
                                            )}

                                            {/* Fallback: hiển thị duration nếu không có gì khác */}
                                            {!parsedDetails?.summary && log.details?.duration && (
                                                <div className="detail-preview-row">
                                                    <span className="preview-label">Duration:</span>
                                                    <span className="preview-value">{log.details.duration}ms</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {log.entityId ? (
                                            <span className="entity-id">ID: {log.entityId}</span>
                                        ) : (
                                            <span className="no-entity">N/A</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="ip-cell">
                                            <span className="ip-address">{log.ipAddress || 'N/A'}</span>
                                            {log.userAgent && (
                                                <span className="user-agent-hint" title={log.userAgent}>
                                                    📱
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="timestamp-cell">
                                        {formatDate(log.createdAt)}
                                    </td>
                                    <td>
                                        <button
                                            className="view-details-btn"
                                            onClick={() => handleViewDetails(log.id)}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="audit-pagination">
                    <button
                        className="page-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        Previous
                    </button>
                    <span className="page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="page-btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Details Modal */}
            {selectedLog && (
                <div className="audit-details-modal" onClick={closeDetailsModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Audit Log Details</h3>
                            <button className="close-btn" onClick={closeDetailsModal}>×</button>
                        </div>
                        <div className="modal-body">
                            {/* Basic Information */}
                            <div className="details-section">
                                <h4>Basic Information</h4>
                                <div className="detail-row">
                                    <span className="detail-label">Action:</span>
                                    <span
                                        className="detail-value"
                                        style={{ color: getActionColor(selectedLog.action) }}
                                    >
                                        {getActionIcon(selectedLog.action)} {formatActionText(selectedLog.action)}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Entity Type:</span>
                                    <span className="detail-value">{selectedLog.entityType}</span>
                                </div>
                                {selectedLog.entityId && (
                                    <div className="detail-row">
                                        <span className="detail-label">Entity ID:</span>
                                        <span className="detail-value">{selectedLog.entityId}</span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">Timestamp:</span>
                                    <span className="detail-value">{formatDate(selectedLog.createdAt)}</span>
                                </div>
                            </div>

                            {/* Parsed Details Section */}
                            {parsedDetails && (
                                <div className="details-section">
                                    <h4>Action Details</h4>

                                    {/* Summary Card */}
                                    {parsedDetails.summary && (
                                        <div className="summary-card">
                                            <div className="summary-icon">📋</div>
                                            <div className="summary-text">{parsedDetails.summary}</div>
                                        </div>
                                    )}

                                    {/* Request Details */}
                                    {parsedDetails.request && Object.keys(parsedDetails.request).length > 0 && (
                                        <div className="detail-section">
                                            <h5>📥 Request Information</h5>
                                            <div className="detail-grid">
                                                {Object.entries(parsedDetails.request).map(([key, value]) => (
                                                    <div key={key} className="detail-item">
                                                        <span className="detail-label">{formatKey(key)}:</span>
                                                        <span className="detail-value">
                                                            {renderValue(key, value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Response Details */}
                                    {parsedDetails.response && Object.keys(parsedDetails.response).length > 0 && (
                                        <div className="detail-section">
                                            <h5>📤 Response Information</h5>
                                            <div className="detail-grid">
                                                {Object.entries(parsedDetails.response).map(([key, value]) => (
                                                    <div key={key} className="detail-item">
                                                        <span className="detail-label">{formatKey(key)}:</span>
                                                        <span className="detail-value">
                                                            {renderValue(key, value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Statistics Card */}
                                            {parsedDetails.response.statistics && (
                                                <div className="statistics-card">
                                                    <h6>📊 Import Statistics</h6>
                                                    <div className="stats-grid">
                                                        <div className="stat-item total">
                                                            <span className="stat-label">Total</span>
                                                            <span className="stat-value">
                                                                {parsedDetails.response.statistics.total}
                                                            </span>
                                                        </div>
                                                        <div className="stat-item success">
                                                            <span className="stat-label">Success</span>
                                                            <span className="stat-value">
                                                                {parsedDetails.response.statistics.success}
                                                            </span>
                                                        </div>
                                                        <div className="stat-item failed">
                                                            <span className="stat-label">Failed</span>
                                                            <span className="stat-value">
                                                                {parsedDetails.response.statistics.failed}
                                                            </span>
                                                        </div>
                                                        <div className="stat-item updated">
                                                            <span className="stat-label">Updated</span>
                                                            <span className="stat-value">
                                                                {parsedDetails.response.statistics.updated || 0}
                                                            </span>
                                                        </div>
                                                        {parsedDetails.response.statistics.skipped > 0 && (
                                                            <div className="stat-item skipped">
                                                                <span className="stat-label">Skipped</span>
                                                                <span className="stat-value">
                                                                    {parsedDetails.response.statistics.skipped}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Metadata */}
                                    {parsedDetails.metadata && (
                                        <div className="metadata-section">
                                            <h5>📅 Metadata</h5>
                                            <div className="metadata-grid">
                                                <div className="metadata-item">
                                                    <span className="metadata-label">⏱️ Duration:</span>
                                                    <span className="metadata-value">{parsedDetails.metadata.duration}</span>
                                                </div>
                                                <div className="metadata-item">
                                                    <span className="metadata-label">🕒 Timestamp:</span>
                                                    <span className="metadata-value">{parsedDetails.metadata.timestamp}</span>
                                                </div>
                                                {parsedDetails.metadata.itemsProcessed > 1 && (
                                                    <div className="metadata-item">
                                                        <span className="metadata-label">📦 Items Processed:</span>
                                                        <span className="metadata-value">
                                                            {parsedDetails.metadata.itemsProcessed}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Raw JSON Toggle */}
                                    <div className="raw-json-toggle">
                                        <button
                                            className="toggle-btn"
                                            onClick={() => setShowRawJson(!showRawJson)}
                                        >
                                            {showRawJson ? '▲ Hide Raw JSON' : '▼ Show Raw JSON'}
                                        </button>
                                        {showRawJson && (
                                            <div className="json-viewer">
                                                <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Technical Information */}
                            <div className="details-section">
                                <h4>Technical Information</h4>
                                <div className="detail-row">
                                    <span className="detail-label">IP Address:</span>
                                    <span className="detail-value">{selectedLog.ipAddress || 'N/A'}</span>
                                </div>
                                {selectedLog.userAgent && (
                                    <div className="detail-row">
                                        <span className="detail-label">User Agent:</span>
                                        <span className="detail-value">{selectedLog.userAgent}</span>
                                    </div>
                                )}
                            </div>

                            {/* Performed By */}
                            <div className="details-section">
                                <h4>Performed By</h4>
                                <div className="admin-info">
                                    <div className="admin-avatar">
                                        {selectedLog.admin.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="admin-details">
                                        <div className="admin-email">{selectedLog.admin.email}</div>
                                        <div className="admin-role">{selectedLog.admin.role}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-close" onClick={closeDetailsModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;