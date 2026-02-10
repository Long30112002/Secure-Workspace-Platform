import BaseAuthForm from "../BaseAuthForm/BaseAuthForm";

interface Props {
    title?: string;
    onSubmit?: (email: string, password: string, extraData?: any) => Promise<{
        message: string;
        user?: any;
        redirectTo?: string;
        showTutorial?: boolean;
    }>;
    buttonText?: string;
    isLoading?: boolean;
    externalErrorMessage?: string;
    onExternalErrorClose?: () => void;
}


function ForgotPasswordForm({
    title = "Reset Your Password",
    onSubmit,
    buttonText = "Send Reset Link",
    isLoading = false,
    externalErrorMessage,
    onExternalErrorClose
}: Props) {

    return (
        <BaseAuthForm
            title={title}
            onSubmit={onSubmit}
            buttonText={buttonText}
            isLoading={isLoading}
            mode="forgot-password"
            externalErrorMessage={externalErrorMessage}
            onExternalErrorClose={onExternalErrorClose}
            databaseOptimization={{
                enabled: true,
                minLoadingTime: 2000,
                minRequestInterval: 2000,
                cooldownPeriod: 1000
            }}
        />
    )
}

export default ForgotPasswordForm;
