import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    requireAuth?: boolean;
    isAuthRoute?: boolean;
}

function ProtectedRoute({
    children,
    requiredRole,
    requireAuth = false,
    isAuthRoute = false
}: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();

    // Hiển thị loading state
    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (isAuthRoute && user) {
        const redirectPath = user.role === 'ADMIN' ? '/admin/homepage' : '/homepage';
        return (
            <Navigate
                to={redirectPath}
                replace
            />
        );
    }

    if (requireAuth && !user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user && user.role !== requiredRole) {
        return <Navigate to="/homepage" replace />;
    }

    return <>{children}</>
}
export default ProtectedRoute;