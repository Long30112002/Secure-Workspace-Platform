import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function AutoLoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const autoLogin = async () => {
            try {
                const accessToken = searchParams.get('accessToken');
                const refreshToken = searchParams.get('refreshToken');
                const userId = searchParams.get('userId');
                const userEmail = searchParams.get('userEmail');
                const userRole = searchParams.get('userRole');
                const message = searchParams.get('message');

                //Kiem tra tokens
                if (!accessToken || !refreshToken || !userId || !userEmail) {
                    throw new Error('Invalid verification link');
                }

                //Lu tokens vao localStorage
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', refreshToken);

                //Luu user info
                const userData = {
                    id: parseInt(userId),
                    email: decodeURIComponent(userEmail),
                    role: userRole || 'user',
                    createAt: new Date().toISOString(),
                };
                localStorage.setItem('user', JSON.stringify(userData));

                //Log thanh cong
                console.log('Auto-login successful', {
                    userId,
                    email: decodeURIComponent(userEmail),
                })

                //Cho 2s de thong bao
                setTimeout(() => {
                    navigate('/homepage', {
                        state: {
                            successMessage: decodeURIComponent(message || 'Email verified and logged in successfully!'),
                            user: userData,
                            autoLogin: true,
                        }
                    });
                }, 2000);

            } catch (error: any) {
                console.error('Auto-login failed:', error);
                setError(error.message || 'Auto-login failed. Please try logging in manually.');
                setLoading(false);

                // Redirect đến login sau 3 giây nếu có lỗi
                setTimeout(() => {
                    navigate('/login', {
                        state: {
                            errorMessage: 'Auto-login failed. Please login manually.'
                        }
                    });
                }, 3000);
            }
        }
        autoLogin();
    }, [searchParams, navigate]);

    return (
        <div className="auto-login-container">
            <div className="auto-login-card">
                {loading ? (
                    <>
                        <div className="loading-spinner"></div>
                        <h2>Completing Verification...</h2>
                        <p>Your email has been verified. Logging you in...</p>
                        <div className="progress-bar">
                            <div className="progress-fill"></div>
                        </div>
                    </>
                ) : error ? (
                    <>
                        <div className="error-icon">❌</div>
                        <h2>Verification Failed</h2>
                        <p className="error-message">{error}</p>
                        <p>Redirecting to login page...</p>
                        <button
                            className="retry-btn"
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </button>
                    </>
                ): null}
            </div>
        </div>
    )
}

export default AutoLoginPage
