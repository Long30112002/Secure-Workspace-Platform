import "./BaseAuthForm.css"
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MessageToast from "../../../../shared/components/ui/Toast/MessageToast";
// import "../../../../shared/components/css/errors.css";
import validators from "../../shared/utils/Validator";

export interface AuthFormProps {
    title?: string;
    onSubmit?: (email: string, password: string, rememberMe?: boolean, extraData?: any) => Promise<{
        message: string;
        user?: any;
        redirectTo?: string;
        showTutorial?: boolean;
    }>;
    buttonText?: string;
    isLoading?: boolean;
    mode: 'login' | 'register' | 'reset-password' | 'forgot-password';

    //Them props cho reset password
    token?: string;
    emailForReset?: string

    externalErrorMessage?: string;
    onExternalErrorClose?: () => void;

    //Databse optimization
    databaseOptimization?: {
        enabled?: boolean;
        minLoadingTime?: number;
        minRequestInterval?: number;
        cooldownPeriod?: number;
    };
}

function BaseAuthForm({
    title = "Authentication",
    onSubmit,
    buttonText = "Submit",
    isLoading = false,
    mode = 'login',

    // Thêm props cho reset password
    token = "",
    emailForReset = "",

    externalErrorMessage,
    onExternalErrorClose,

    databaseOptimization = {
        enabled: true,
        minLoadingTime: 2000,
        minRequestInterval: 2000,
        cooldownPeriod: 1000,
    }
}: AuthFormProps) {

    const navigate = useNavigate();
    const isSubmittingRef = useRef(false);
    const submitStartTimeRef = useRef<number>(0);
    const optimization = databaseOptimization;

    const [email, setEmail] = useState(mode === 'reset-password' ? emailForReset : "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [isButtonLoading, setIsButtonLoading] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);
    const [rememberMe, setRememberMe] = useState(() => {
        const saved = localStorage.getItem('rememberMe');
        return saved === 'true';
    });
    const [savedEmail, setSavedEmail] = useState(() => {
        const email = localStorage.getItem('savedEmail')
        return email || '';
    });

    //Clear message after timeout
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage("");
                setErrorMessage("");
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    //Timer countdown effect
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isButtonLoading && remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime(prev => {
                    const newTime = prev - 100;
                    if (newTime <= 0) {
                        if (interval) clearInterval(interval);
                        return 0;
                    }
                    return newTime;
                });
            }, 100);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isButtonLoading, remainingTime]);

    //DATABASE OPTIMIZATION: Throttling check
    const checkThrottling = () => {
        if (!optimization.enabled) return { shouldThrottle: false, message: '' };

        const now = Date.now();
        const timeSinceLastRequest = now - submitStartTimeRef.current;
        const MIN_REQUEST_INTERVAL = optimization.minRequestInterval || 2000;

        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && submitStartTimeRef.current !== 0) {
            const waitSeconds = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
            console.log(`Database throttling: Please wait ${waitSeconds}s`);

            return {
                shouldThrottle: true,
                message: `Please wait ${waitSeconds} seconds before trying again`,
            };
        }
        return { shouldThrottle: false, message: '' };
    };

    // DATABASE OPTIMIZATION: Apply minimum loading time
    const applyMinimumLoadingTime = async <T,>(promise: Promise<T>): Promise<T> => {
        if (!optimization.enabled) return promise;

        const MIN_LOADING_TIME = optimization.minLoadingTime || 2000;
        const startTime = Date.now();

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), MIN_LOADING_TIME + 5000)
            );

            const [result] = await Promise.race([
                Promise.all([
                    promise,
                    new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME))
                ]),
                timeoutPromise
            ]);


            return result;

        } catch (error) {
            // Nếu lỗi xảy ra trước 2s, vẫn đợi cho đủ thời gian
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < MIN_LOADING_TIME) {
                const remainingTimeToWait = MIN_LOADING_TIME - elapsedTime;
                console.log(`Waiting additional ${remainingTimeToWait}ms for database protection`);
                await new Promise(resolve => setTimeout(resolve, remainingTimeToWait));
            }
            throw error;
        }
    };

    // Khi component mount, load saved email nếu rememberMe = true
    useEffect(() => {
        if (mode === 'login' && rememberMe && savedEmail) {
            setEmail(savedEmail);
        }
    }, [mode, rememberMe, savedEmail]);

    // Xử lý khi rememberMe thay đổi
    const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        setRememberMe(isChecked);

        //Nếu bỏ bạn, xóa saved email
        if (!isChecked) {
            localStorage.removeItem('savedEmail');
            setSavedEmail('');
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmittingRef.current || isButtonLoading) {
            console.log('Preventing double submission');
            return;
        }

        //Clear previous messages
        setErrorMessage("");
        setEmailError("");
        setPasswordError("");
        setConfirmPasswordError("");

        //Validate - cho tung mode
        if (mode === 'reset-password') {
            const passwordValidationError = validators.passwordStrong(password);
            const confirmPasswordValidationError = validators.confirmPassword(password, confirmPassword);

            if (passwordValidationError || confirmPasswordValidationError) {
                setPasswordError(passwordValidationError);
                setConfirmPasswordError(confirmPasswordValidationError);
                return;
            }

        }
        else if (mode === 'forgot-password') {
            const emailValidationError = validators.email(email);
            if (emailValidationError) {
                setEmailError(emailValidationError);
                return;
            }
        }
        else {
            //Validate - cho password va email
            const emailValidationError = validators.email(email);
            const passwordValidationError = validators.password(password);

            let confirmPasswordValidationError = "";

            if (mode === 'register') {
                confirmPasswordValidationError = validators.confirmPassword(password, confirmPassword);
            }

            if (emailValidationError || passwordValidationError || confirmPasswordValidationError) {
                setEmailError(emailValidationError);
                setPasswordError(passwordValidationError);

                if (confirmPasswordValidationError) setConfirmPasswordError(confirmPasswordValidationError);
                return;
            }
        }

        // DATABASE OPTIMIZATION 1: Throttling check
        const throttlingCheck = checkThrottling();
        if (throttlingCheck.shouldThrottle) {
            setEmailError(throttlingCheck.message);
            return;
        }

        // DATABASE OPTIMIZATION 2: Start loading với minimum time
        submitStartTimeRef.current = Date.now();
        isSubmittingRef.current = true;
        setIsButtonLoading(true);
        setRemainingTime(optimization.minLoadingTime || 2000);

        //Đảm bảo minimum loading time
        const loadingStartTime = Date.now();
        try {
            if (onSubmit) {
                const extraData = {
                    ...(mode === 'register' && { confirmPassword }),
                    ...(mode === 'reset-password' && {
                        confirmPassword,
                        token,
                        email: emailForReset,
                    }),
                    ...(mode === 'forgot-password' && { email })
                }

                // DATABASE OPTIMIZATION 3: Áp dụng minimum loading time 2s
                const apiPromise = onSubmit(
                    mode === 'reset-password' ? emailForReset : email,
                    password,
                    rememberMe,
                    extraData,
                );


                const result = await applyMinimumLoadingTime(apiPromise);


                // XỬ LÝ KHÁC NHAU CHO LOGIN vs REGISTER
                if (mode === 'login') {
                    //Neu chon vao remember
                    if (rememberMe && email) {
                        localStorage.setItem('rememberMe', 'true');
                        localStorage.setItem('savedEmail', email);
                    } else {
                        localStorage.removeItem('rememberMe');
                        localStorage.removeItem('savedEmail');
                    }


                    // LOGIN: Redirect ngay, không show message ở form
                    const redirectTo = result.redirectTo || '/homepage';
                    navigate(redirectTo, {
                        state: {
                            fromAuth: true,
                            successMessage: result.message || "Login successful!",
                            user: result.user,
                            showTutorial: result.showTutorial
                        }
                    })

                } else if (mode === 'register') {
                    const successMsg = result.message || "Registration successful!";
                    setSuccessMessage(successMsg);

                    setTimeout(() => {
                        const redirectTo = result.redirectTo || '/login';
                        navigate(redirectTo, {
                            state: {
                                fromRegister: true,
                                email: email,
                                successMessage: "Please login with your new account"
                            }
                        })
                    }, 5300)

                } else if (mode === 'reset-password') {
                    const successMsg = result.message || "Password reset successful!";
                    setSuccessMessage(successMsg);
                    setTimeout(() => {
                        const redirectTo = result.redirectTo || '/login';
                        navigate(redirectTo, {
                            state: {
                                fromResetPassword: true,
                                successMsg: "Password reset successful! Please login with your new password.",
                            }
                        })
                    }, 5300)
                } else if (mode === 'forgot-password') {
                    const successMsg = result.message || "Reset link sent successfully!";
                    setSuccessMessage(successMsg);
                }
            }

        } catch (error: any) {
            console.log(`${mode} error`, error);

            const errorCode = error.code || '';
            const errorMessage = error.message || 'An error occured';

            console.log(`Processing error - Code: ${errorCode}, Message: ${errorMessage}`);

            //Xu ly loi cho tung truong hop
            if (mode === 'register') {
                if (error === 'ACCOUNT_INACTIVE') {
                    setEmailError(errorMessage);
                }
                else if (errorCode === 'EMAIL_EXISTS') {
                    setEmailError(errorMessage);
                }
                else {
                    setErrorMessage(errorMessage);
                }
            }
            else if (mode === 'login') {
                // if (errorCode === 'EMAIL_NOT_VERIFIED') {
                //     setErrorMessage(errorMessage);
                // }
                // else if (errorCode === 'INVALID_CREDENTIALS') {
                //     setErrorMessage("Invalid email or password");
                // }
                // else {
                setErrorMessage(errorMessage);
                // }
            }
            else if (mode === 'reset-password') {
                // if (errorCode === 'WEAK_PASSWORD') {
                //     setErrorMessage(error.details || 'Password is too weak');
                // }
                // else if (errorCode === 'PASSWORD_MISMATCH') {
                //     setErrorMessage("Passwords do not match");
                // }
                // else {
                setErrorMessage(errorMessage);
                // }
            }
            else if (mode === 'forgot-password') {
                // if (errorCode === 'USER_NOT_FOUND') {
                //     setEmailError(errorMessage);
                // } else {
                setErrorMessage(errorMessage);
                // }
            }

            // QUAN TRỌNG: DATABASE OPTIMIZATION - Thêm cooldown period
            if (optimization.enabled && optimization.cooldownPeriod) {
                const COOLDOWN = optimization.cooldownPeriod;
                submitStartTimeRef.current = Date.now() + COOLDOWN;
                console.log(`Applied cooldown period: ${COOLDOWN}ms`);
            }
        } finally {
            // Đảm bảo minimum loading time đã đủ
            if (optimization.enabled && optimization.minLoadingTime) {
                const elapsedTime = Date.now() - loadingStartTime;
                const minTime = optimization.minLoadingTime;

                if (elapsedTime < minTime) {
                    // Chờ thêm thời gian còn lại
                    const remainingTime = minTime - elapsedTime;
                    console.log(`Waiting additional ${remainingTime}ms for minimum loading time`);
                    await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
            }

            // Reset tất cả loading states
            isSubmittingRef.current = false;
            setIsButtonLoading(false);
            setRemainingTime(0);
        }
    };

    const isOverallLoading = isLoading || isButtonLoading;

    return (
        <>
            {/* Xem lai co su dung khong -> xoa */}
            {externalErrorMessage && (
                <MessageToast
                    type="error"
                    message={externalErrorMessage}
                    title="Action Required"
                    duration={5000}
                    onClose={onExternalErrorClose}
                    showProgress={true}
                />
            )}

            {(mode === 'register' || mode === 'reset-password' || mode === 'forgot-password') && successMessage && (
                <MessageToast
                    type="success"
                    message={successMessage}
                    title="Success!"
                    duration={5000}
                    onClose={() => setSuccessMessage('')}
                />
            )}

            {errorMessage && !emailError && !passwordError && !confirmPasswordError && (
                <MessageToast
                    type="error"
                    message={errorMessage}
                    title="Oops!"
                    duration={5000}
                    onClose={() => setErrorMessage('')}
                />
            )}

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="company-logo">
                            {/* <div className="logo-icon"></div> */}
                        </div>
                        <h2>{title}</h2>
                        <p>
                            {mode === 'login' && 'Please sign in to your corporate account'}
                            {mode === 'register' && 'Please register for your corporate account'}
                            {mode === 'reset-password' && 'Create a new password for your account'}
                            {mode === 'forgot-password' && 'Enter your email to reset your password'}
                        </p>

                        {/* Hiển thị email cho reset password mode */}
                        {mode === 'reset-password' && emailForReset && (
                            <p className="user-email-info">
                                Account: <span className="email-masked">{emailForReset}</span>
                            </p>
                        )}
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit} noValidate>

                        {/* Email Field - chỉ hiện cho login/register/forgot-password */}
                        {(mode === 'login' || mode === 'register' || mode === 'forgot-password') && (
                            <div className="form-group">
                                <div className={`input-wrapper ${emailError ? "error" : ""}`}>
                                    <input
                                        type="email"
                                        value={email}
                                        name="email"
                                        placeholder=" "
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (emailError) setEmailError("");
                                        }}
                                        required
                                        autoComplete="email"
                                        disabled={isOverallLoading}
                                    />

                                    <label htmlFor="email">Business Email</label>
                                    <span className="input-border"></span>
                                </div>
                                {emailError && (
                                    <span className="error-message show" >
                                        {emailError}
                                    </span>
                                )}
                            </div>)}

                        {/* Password */}
                        {mode !== 'forgot-password' && <div className="form-group">
                            <div className={`input-wrapper password-wrapper ${passwordError ? "error" : ""}`}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (passwordError) setPasswordError("");
                                    }}
                                    placeholder=" "
                                    required
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /* // Dùng "new-password" thay "current-password" cho registration */
                                    disabled={isOverallLoading}
                                />

                                <label htmlFor="password">
                                    {mode === 'reset-password' ? 'New Password' : 'Password'}
                                </label>

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Toggle password visibility"
                                    disabled={isOverallLoading}
                                >
                                    <span className={`toggle-icon ${showPassword ? "show-password" : ""}`}></span>
                                </button>

                                <span className="input-border"></span>

                            </div>
                            {passwordError && (
                                <span className={`error-message ${passwordError ? "show" : ""}`} id="passwordError">
                                    {passwordError}
                                </span>
                            )}
                        </div>}

                        {/* Confirm Password Field - hiện cho register và reset-password */}
                        {(mode === 'register' || mode === 'reset-password') && (
                            <div className="form-group">
                                <div className={`input-wrapper password-wrapper ${confirmPasswordError ? "error" : ""}`}>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            if (confirmPasswordError) setConfirmPasswordError("");
                                            // if (passwordError) setConfirmPasswordError("");
                                        }}
                                        placeholder=" "
                                        required
                                        autoComplete="new-password"
                                        disabled={isOverallLoading}
                                    />
                                    <label htmlFor="password">Confirm Password</label>

                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        aria-label="Toggle password visibility"
                                        disabled={isOverallLoading}
                                    >
                                        <span className={`toggle-icon ${showConfirmPassword ? "show-password" : ""}`}></span>
                                    </button>
                                    <span className="input-border"></span>
                                </div>
                                {confirmPasswordError && (
                                    <span className={`error-message ${confirmPasswordError ? "show" : ""}`}>
                                        {confirmPasswordError}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Remember signin */}
                        {mode === 'login' && (
                            <div className="form-options">
                                <div className="remember-wrapper">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        name="remember"
                                        checked={rememberMe}
                                        onChange={handleRememberMeChange}
                                        disabled={isOverallLoading}
                                    />
                                    <label htmlFor="remember" className="checkbox-label">
                                        <span className="checkbox-custom"></span>
                                        Keep me signed in
                                    </label>
                                </div>
                                <Link to="/forgot-password" className="forgot-password">Reset password</Link>
                            </div>
                        )}

                        {/* Help Text - chỉ hiện cho forgot-password */}
                        {mode === 'forgot-password' && (
                            <div className="help-text">
                                <p>
                                    You'll receive an email with a link to reset your password.
                                    The link expires in 24 hours.
                                </p>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            className={`login-btn ${isOverallLoading ? "loading" : ""}`}
                            disabled={isOverallLoading}
                        >
                            {isOverallLoading ? (
                                <>
                                    <span className="btn-loader"></span>
                                    Processing...{remainingTime > 0 && `(${(remainingTime / 1000).toFixed(1)}s)`}
                                </>
                            ) : (
                                buttonText
                            )}
                        </button>

                        {/* Loading info với Database Optimization message*/}
                        {isOverallLoading && optimization.enabled && (
                            <div className="loading-info">
                                <small>
                                    <i>
                                        Optimizing database performance ({optimization.minLoadingTime ? optimization.minLoadingTime / 1000 : 2}s minimum)...
                                    </i>
                                </small>
                            </div>
                        )}

                        {/* <!-- Switch  buttons --> */}
                        <div className="auth-switch">
                            {
                                mode === 'login' ? (
                                    <p>Don't have a account? <Link to="/register">Sign up</Link></p>
                                ) : mode === 'register' ? (
                                    <p>Already have a account? <Link to="/login">Sign in</Link></p>
                                ) : mode === 'reset-password' ? (
                                    <p>Remember your password? <Link to="/login">Sign in</Link></p>
                                ) : mode === 'forgot-password' ? (
                                    <p>Remember your password? <Link to="/login">Sign in</Link></p>
                                ) : null
                            }
                        </div>

                    </form>

                    {(
                        <>
                            <div className="divider">
                                <span>or sign in with</span>
                            </div>

                            <div className="sso-options">
                                <button type="button" className="sso-btn azure-btn">
                                    <span className="sso-icon azure-icon"></span>
                                    <span>Microsoft Azure AD</span>
                                </button>
                                <button type="button" className="sso-btn okta-btn">
                                    <span className="sso-icon okta-icon"></span>
                                    <span>Okta</span>
                                </button>
                            </div>
                        </>)}

                    <div className="footer-links">
                        <a href="#" className="footer-link">Privacy Policy</a>
                        <span className="separator">•</span>
                        <a href="#" className="footer-link">Terms of Service</a>
                        <span className="separator">•</span>
                        <a href="#" className="footer-link">Support</a>
                    </div>
                </div>
            </div>
        </>
    );
};

export default BaseAuthForm;
