import "./UserActions.css";

interface UserActionsProps {
    onAddUser: () => void;
    onExportUsers: () => void;
    onImportUsers: () => void;
    onGenerateReport: () => void;
    selectedCount?: number;
}

const UserActions = ({
    onAddUser,
    onExportUsers,
    onImportUsers,
    onGenerateReport,
    selectedCount = 0,
}: UserActionsProps) => {
    return (
        <div className="user-actions-section">
            <div className="actions-header">
                <h3>Quick Actions</h3>
                {selectedCount > 0 && (
                    <span className="selected-badge">
                        {selectedCount} selected
                    </span>
                )}
            </div>
            <div className="actions-grid">
                <button
                    className="action-card"
                    onClick={onAddUser}
                >
                    <div className="action-icon">➕</div>
                    <div className="action-label">Add New User</div>
                    <div className="action-desc">Create a new user account</div>
                </button>

                <button
                    className="action-card"
                    onClick={onExportUsers}
                >
                    <div className="action-icon">📤</div>
                    <div className="action-label">Export Users</div>
                    <div className="action-desc">
                        {selectedCount > 0
                            ? `Export ${selectedCount} selected`
                            : 'Export to CSV/Excel/JSON'}
                    </div>
                </button>

                <button
                    className="action-card"
                    onClick={onImportUsers}
                >
                    <div className="action-icon">📥</div>
                    <div className="action-label">Import Users</div>
                    <div className="action-desc">Bulk import from CSV/JSON</div>
                </button>

                <button
                    className="action-card"
                    onClick={onGenerateReport}
                >
                    <div className="action-icon">📊</div>
                    <div className="action-label">Generate Report</div>
                    <div className="action-desc">User analytics report</div>
                </button>

                <button
                    className="action-card"
                    onClick={() => alert('Coming soon!')}
                >
                    <div className="action-icon">🔄</div>
                    <div className="action-label">Bulk Update</div>
                    <div className="action-desc">Update multiple users</div>
                </button>

                <button
                    className="action-card"
                    onClick={() => alert('Coming soon!')}
                >
                    <div className="action-icon">📧</div>
                    <div className="action-label">Send Email</div>
                    <div className="action-desc">Email selected users</div>
                </button>
            </div>
        </div>
    );
};

export default UserActions;