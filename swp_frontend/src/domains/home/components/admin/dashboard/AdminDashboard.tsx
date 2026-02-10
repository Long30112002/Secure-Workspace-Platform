function AdminDashboard({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
    return (
        <div className="admin-dashboard">
            <div className="page-header">
                <h1>{isSuperAdmin ? 'Super Admin' : 'Admin'} Dashboard</h1>
                <p>System administration and management</p>
            </div>

            <div className="admin-stats">
                <div className="stat-card">
                    <div className="stat-label">Total Users</div>
                    <div className="stat-value">1,245</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active Today</div>
                    <div className="stat-value">856</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Storage Used</div>
                    <div className="stat-value">2.4 TB</div>
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;