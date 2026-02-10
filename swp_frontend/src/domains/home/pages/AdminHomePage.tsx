import BaseLayout from "../../../shared/components/layout/BaseLayout";
import AdminHomeContent from "../components/homeContent/AdminHomeContext";
import { useAuth } from "../../auth/context/AuthContext";

function AdminHomePage() {
    const { user, logout } = useAuth();

    return (
        <BaseLayout
            user={user}
            onLogout={logout}
            showWelcomeToast={true}
            showHeader={true}
            showFooter={true}
            className="admin-home-page"
        >
            <AdminHomeContent />
        </BaseLayout>
    );
}

export default AdminHomePage;