// auth/pages/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiService } from "../../../services/api/axiosConfig";
import ResetPasswordForm from "../components/ResetPasswordForm/ResetPasswordForm";

function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [token, setToken] = useState("");
    const [isValidating, setIsValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [email, setEmail] = useState("");
    const [validationError, setValidationError] = useState("");

    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');
        if (tokenFromUrl) {
            setToken(tokenFromUrl);
            validateToken(tokenFromUrl);
        } else {
            setValidationError("Invalid reset link");
            setIsValidating(false);
        }
    }, [searchParams]);

    const validateToken = async (token: string) => {
        try {
            const response = await apiService.validateResetToken(token);
            setTokenValid(true);
            setEmail(response.data?.email || response?.email || "");
        } catch (error) {
            setTokenValid(false);
            setValidationError("Reset link is invalid or has expired");
        } finally {
            setIsValidating(false);
        }
    };
    
    // _email: string, password: string, extraData?: any
    const handleSubmit = async (_email: string, password: string, extraData?: any) => {
        try {
            const response = await apiService.resetPassword(
                extraData?.token || token,
                password,
                extraData?.confirmPassword || password
            );

            return {
                message: response.message || "Password reset successful! Redirecting to login...",
                redirectTo: '/login',
                user: null
            };

        } catch (error: any) {
            throw error;
        }
    };

    if (isValidating) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card">
                    <div className="loading-state">
                        <div className="spinner-large"></div>
                        <h3>Validating reset link...</h3>
                        <p>Please wait while we verify your reset link</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!tokenValid && !isValidating) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card">
                    <div className="error-state">
                        <div className="error-icon">❌</div>
                        <h2>Invalid Reset Link</h2>
                        <p className="error-message">{validationError}</p>
                        <div className="action-buttons">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/forgot-password')}
                            >
                                Request New Link
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>

            <ResetPasswordForm
                token={token}
                email={email}
                title="Set New Password"
                onSubmit={handleSubmit}
                buttonText="Reset Password"
            />
        </>
    );
}

export default ResetPasswordPage;