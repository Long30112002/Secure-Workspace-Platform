import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import MessageToast from "../ui/Toast/MessageToast";
import "./BaseLayout.css";
import Header from "./Header";
import Footer from "./Footer";
import { WorkspaceInvitationListener } from "../../../domains/home/pages/user/management/WorkspaceInvitationListener";
import { ToastContainer } from "../../../domains/home/pages/user/management/ToastContainer";

interface BaseLayoutProps {
    children: ReactNode;
    showWelcomeToast?: boolean;
    autoRedirect?: {
        enabled: boolean;
        delay: number;
        to: string;
    };
    user?: any;
    onLogout?: () => void;
    showHeader?: boolean;
    showFooter?: boolean;
    className?: string;
}

function BaseLayout({
    children,
    showWelcomeToast = true,
    autoRedirect,
    user,
    onLogout,
    showHeader = true,
    showFooter = true,
    className = "",
}: BaseLayoutProps) {
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
    const location = useLocation();

    useEffect(() => {
        const state = location.state as {
            fromAuth?: boolean;
            successMessage?: string;
            user?: any;
            showTutorial?: boolean;
        };

        if (state?.fromAuth && state?.successMessage && showWelcomeToast) {
            setToastMessage(state.successMessage);
            setToastType("success");

            // Clear state để không hiển thị lại khi refresh
            window.history.replaceState({}, document.title);
        }

        if (autoRedirect?.enabled) {
            const timer = setTimeout(() => {
                window.location.href = autoRedirect.to;
            }, autoRedirect.delay);

            return () => clearTimeout(timer);
        }
    }, [location.state, showWelcomeToast, autoRedirect]);

    const handleCloseToast = () => {
        setToastMessage("");
    };

    return (
        <div className={`base-layout ${className}`}>
            {/* Add WorkspaceInvitationListener for real-time notifications */}
            <WorkspaceInvitationListener />

            {/* Custom Toast Container */}
            <ToastContainer />

            {/* Legacy MessageToast for backward compatibility */}
            {toastMessage && (
                <MessageToast
                    type={toastType === 'info' ? 'success' : toastType}
                    message={toastMessage}
                    title={toastType === 'success' ? "Success!" : "Info"}
                    duration={4000}
                    onClose={handleCloseToast}
                />
            )}

            {showHeader && (
                < Header user={user} onLogout={onLogout} />
            )}
            <main className="layout-main">
                {children}
            </main>

            {showFooter && (
                <Footer />
            )}
        </div>
    );
}

export default BaseLayout;