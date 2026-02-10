import BaseLayout from "../../../shared/components/layout/BaseLayout";
import { useAuth } from "../../auth/context/AuthContext"
import ProfileContent from "../component/ProfileContent";

function ProfilePage() {
    const { user, logout, isLoading } = useAuth();

    const handleLogout = () => {
        logout();
    };

    if (isLoading) {
        return (
            <BaseLayout
                user={user}
                onLogout={handleLogout}
                showHeader={true}
                showFooter={true}
            >
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading profile...</p>
                </div>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout
            user={user}
            onLogout={handleLogout}
            showHeader={true}
            showFooter={true}
            className="profile-page"
        >
            <ProfileContent />
        </BaseLayout>
    )
}

export default ProfilePage
