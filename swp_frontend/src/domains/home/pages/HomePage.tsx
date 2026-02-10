import { useNavigate } from "react-router-dom";
import HomeContent from "../components/homeContent/HomeContent";
import { useCallback } from "react";
import BaseLayout from "../../../shared/components/layout/BaseLayout";
import { useAuth } from "../../auth/context/AuthContext";

function HomePage() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/homepage", { replace: true });
  }, [logout, navigate]);


  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <BaseLayout
      user={user}
      onLogout={handleLogout}
      showWelcomeToast={true}
      showFooter={true}
      className="home-page"
    >
      <HomeContent />
    </BaseLayout>
  );
}

export default HomePage;