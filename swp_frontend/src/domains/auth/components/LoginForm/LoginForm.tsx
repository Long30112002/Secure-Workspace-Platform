
import BaseAuthForm from "../BaseAuthForm/BaseAuthForm";

interface Props {
    title?: string;
    onSubmit?: (email: string, password: string) => Promise<{
        message: string;
        user?: any;
        redirectTo?: string;
        showTutorial?: boolean;
    }>;
    buttonText?: string;
    isLoading?: boolean;
}


function LoginForm({
    title = "Login Page",
    onSubmit,
    buttonText = "Login",
    isLoading = false }: Props) {

    return (
        <>
            <BaseAuthForm
                title={title}
                onSubmit={onSubmit}
                buttonText={buttonText}
                isLoading={isLoading}
                mode="login"
                databaseOptimization={{
                    enabled: false,
                    minLoadingTime: 2000,
                    minRequestInterval: 2000,
                    cooldownPeriod: 1000
                }}
            >
            </BaseAuthForm>
        </>

    );
}

export default LoginForm;