// LoginPage.tsx
import { useState } from "react";
import LoginForm from "../components/LoginForm/LoginForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    // LoginPage.tsx - Thêm debug
    const handleLogin = async (email: string, password: string, rememberMe?: boolean) => {
        setIsLoading(true);

        try {
            console.log('Attempting login...');

            // ENDPOINT: /api/auth/login
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password, rememberMe }),
            });

            console.log('Login response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Login failed with status ${response.status}`);
            }

            const result = await response.json();
            console.log('Login result:', result);

            if (result.success && result.data?.user) {
                await login(email, password, rememberMe);

                const redirectTo = result.data.redirectTo || '/homepage';
                navigate(redirectTo);

                return { message: 'Login successful', user: result.data.user };
            } else {
                throw new Error(result.message || 'Login failed');
            }

        } catch (error: any) {
            throw new Error(error.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };
    return <LoginForm onSubmit={handleLogin} isLoading={isLoading} />;
}

export default LoginPage;