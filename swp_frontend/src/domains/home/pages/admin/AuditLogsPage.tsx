// features/audit/pages/AuditLogsPage.tsx
import React from 'react';
// import './AuditLogsPage.css';
import Header from '../../../../shared/components/layout/Header';
import AuditLogs from '../../components/admin/user_managerment/AuditLogs';
import Footer from '../../../../shared/components/layout/Footer';

const AuditLogsPage: React.FC = () => {
  return (
    <div className="audit-logs-page">
      <Header />
      <main className="audit-content">
        <div className="container">
          <AuditLogs />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuditLogsPage;