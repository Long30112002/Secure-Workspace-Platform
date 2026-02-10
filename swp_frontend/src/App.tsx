import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, AuthProvider } from "./domains/auth/context/AuthContext";
import AutoLoginPage from "./domains/auth/pages/AutoLoginPage";
import ForgotPasswordPage from "./domains/auth/pages/ForgotPasswordPage";
import LoginPage from "./domains/auth/pages/LoginPage";
import RegisterPage from "./domains/auth/pages/RegisterPage";
import ResetPasswordPage from "./domains/auth/pages/ResetPasswordPage";
import ProtectedRoute from "./domains/home/components/ProtectedRoute";
import AuditLogsPage from "./domains/home/pages/admin/AuditLogsPage";
import AdminHomePage from "./domains/home/pages/AdminHomePage";
import HomePage from "./domains/home/pages/HomePage";
import ProfilePage from "./domains/profile/pages/ProfilePage";
import { WorkspaceProvider } from "./domains/home/pages/context/WorkspaceContext";
import WorkspacesPage from "./domains/home/pages/user/management/WorkspacesPage";
import WorkspaceManagement from "./domains/home/pages/user/management/WorkspaceManagement";
import WorkspaceInvitationsListPage from "./domains/home/pages/user/management/WorkspaceInvitationsListPage"; // Thêm import
import CreateWorkspacePage from "./domains/home/pages/user/management/CreateWorkspacePage";
import { NotificationProvider } from "./domains/home/pages/context/NotificationContext";
import "./App.css";
import AdminUsersManagement from "./domains/home/components/admin/user_managerment/AdminUsersManagement";
import NotificationsPage from "./domains/home/pages/user/management/NotificationsPage";
import InvitationRedirect from "./domains/home/pages/user/management/InvitationRedirect";
import WorkspaceDashboard from "./domains/home/pages/user/workspace/WorkspaceDashboard";
import { WebSocketProvider } from "./domains/home/pages/context/WebSocketContext";

// Component auto-refresh token
function TokenRefresher() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      try {
        await fetch('http://localhost:3000/api/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });
      } catch (error) {
        console.log('Auto-refresh failed');
      }
    };

    refreshToken();
    const intervalId = setInterval(refreshToken, 4 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <WorkspaceProvider>
          <NotificationProvider>
            <Router>
              <TokenRefresher />
              <Routes>
                {/* Public routes - ai cũng vào được */}
                <Route path="/" element={<HomePage />} />
                <Route path="/homepage" element={<HomePage />} />

                {/* Auth routes - chỉ cho người CHƯA login */}
                <Route path="/login" element={
                  <ProtectedRoute isAuthRoute>
                    <LoginPage />
                  </ProtectedRoute>
                } />

                <Route path="/register" element={
                  <ProtectedRoute isAuthRoute>
                    <RegisterPage />
                  </ProtectedRoute>
                } />

                <Route path="/forgot-password" element={
                  <ProtectedRoute isAuthRoute>
                    <ForgotPasswordPage />
                  </ProtectedRoute>
                } />

                <Route path="/reset-password" element={
                  <ProtectedRoute isAuthRoute>
                    <ResetPasswordPage />
                  </ProtectedRoute>
                } />

                <Route path="/auto-login" element={
                  <ProtectedRoute isAuthRoute>
                    <AutoLoginPage />
                  </ProtectedRoute>
                } />

                <Route path="/notifications" element={
                  <ProtectedRoute requireAuth>
                    <NotificationsPage />
                  </ProtectedRoute>
                } />

                {/* Workspace routes */}
                <Route path="/workspaces" element={
                  <ProtectedRoute requireAuth>
                    <WorkspacesPage />
                  </ProtectedRoute>
                } />

                <Route path="/workspace/create" element={
                  <ProtectedRoute requireAuth>
                    <CreateWorkspacePage />
                  </ProtectedRoute>
                } />

                <Route path="/workspace/:workspaceId/dashboard" element={
                  <ProtectedRoute requireAuth>
                    <WorkspaceDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/workspace/:workspaceId/management" element={
                  <ProtectedRoute requireAuth>
                    <WorkspaceManagement />
                  </ProtectedRoute>
                } />

                <Route path="/workspace/join" element={
                  <ProtectedRoute requireAuth>
                    <WorkspaceInvitationsListPage />
                  </ProtectedRoute>
                } />

                <Route path="/workspace/invitations" element={
                  <ProtectedRoute requireAuth>
                    <WorkspaceInvitationsListPage />
                  </ProtectedRoute>
                } />

                <Route path="/join/:code" element={
                  <ProtectedRoute requireAuth>
                    <InvitationRedirect />
                  </ProtectedRoute>
                } />

                <Route path="/invite/:code" element={
                  <ProtectedRoute requireAuth>
                    <InvitationRedirect />
                  </ProtectedRoute>
                } />

                {/* Admin route - cần login VÀ role ADMIN */}
                <Route path="/admin/homepage" element={
                  <ProtectedRoute requireAuth requiredRole="ADMIN">
                    <AdminHomePage />
                  </ProtectedRoute>
                } />

                <Route path="/admin/profile" element={
                  <ProtectedRoute requireAuth requiredRole="ADMIN">
                    <ProfilePage />
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute requireAuth>
                    <ProfilePage />
                  </ProtectedRoute>
                } />

                <Route path="/admin/users" element={
                  <ProtectedRoute requireAuth requiredRole="ADMIN">
                    <AdminUsersManagement />
                  </ProtectedRoute>
                } />

                <Route path="/admin/audit-logs" element={
                  <ProtectedRoute requireAuth requiredRole="ADMIN">
                    <AuditLogsPage />
                  </ProtectedRoute>
                } />

                {/* Redirect 404 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </NotificationProvider>
        </WorkspaceProvider>
      </WebSocketProvider>
    </AuthProvider >
  );
}

export default App;