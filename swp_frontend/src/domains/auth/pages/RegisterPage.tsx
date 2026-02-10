import { useState } from "react";
import RegisterForm from "../components/RegisterForm/RegisterForm";
import { apiService } from "../../../services/api/axiosConfig";

function RegisterPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const result = await apiService.register(email, password);
            // console.log('Register API response:', result.message);

            return {
                message: result.message || 'Registration successful',
                user: result?.user,
                redirectTo: result?.redirectTo || '/login',
                showTutorial: result?.showTutorial !== undefined
                    ? result.showTutorial
                    : true,
            };

        } catch (error: any) {
            console.error('Registration failed: ', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <RegisterForm
                onSubmit={handleRegister}
                isLoading={isLoading}
            />
        </>
    )
}
export default RegisterPage;
