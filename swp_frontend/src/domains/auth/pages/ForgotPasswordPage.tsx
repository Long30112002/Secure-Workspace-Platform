import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiService } from '../../../services/api/axiosConfig';
import ForgotPasswordForm from '../components/ForgotPasswordForm/ForgotPasswordForm';

function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [success, setSuccess] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async (email: string) => {
        try {
            const response = await apiService.forgotPassword(email);

            // Lưu email và message để hiển thị ở success state
            setEmail(email);
            setMessage(response.message || 'Reset link sent to your email');
            setSuccess(true);

            // Return success result
            return {
                message: response.message || "Reset link sent successfully!",
                redirectTo: '/login',
                user: null,
            };

        } catch (error: any) {
            throw error;
        }
    };

    if (success) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="success-state">
                        <div className="success-icon">✅</div>
                        <h2>Check Your Email</h2>
                        <p className="success-message">{message}</p>
                        <p className="instruction">
                            We've sent a password reset link to <strong>{email}</strong>
                        </p>
                        <div className="security-tips">
                            <h4>📧 Email Not Showing Up?</h4>
                            <ul>
                                <li>Check your spam or junk folder</li>
                                <li>Make sure you entered the correct email</li>
                                <li>Wait a few minutes and try again</li>
                            </ul>
                        </div>
                        <div className="action-buttons">
                            <button
                                className="login-btn"
                                onClick={() => navigate('/login')}
                            >
                                Back to Login
                            </button>
                            <button
                                className="auth-btn outline"
                                onClick={() => {
                                    setSuccess(false);
                                    setEmail("");
                                }}
                            >
                                Try Another Email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ForgotPasswordForm
            title="Reset Your Password"
            onSubmit={handleSubmit}
            buttonText="Send Reset Link"
        />
    )
}

export default ForgotPasswordPage
