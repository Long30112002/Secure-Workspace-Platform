import BaseAuthForm from "../BaseAuthForm/BaseAuthForm";

interface Props {
    token: string;
    email: string;
    title?: string;
    onSubmit?: (email: string, newPassword: string, extraData?: any) => Promise<{
        message: string;
        user?: any;
        redirectTo?: string;
        showTutorial?: boolean;
    }>;
    buttonText?: string;
    isLoading?: boolean;
}

function ResetPasswordForm({
    token,
    email,
    title = "Set new password",
    onSubmit,
    buttonText = "Reset Password",
    isLoading = false,
}: Props) {
    return (
        <BaseAuthForm
            title={title}
            onSubmit={onSubmit}
            buttonText={buttonText}
            isLoading={isLoading}
            mode="reset-password"
            token={token}
            emailForReset={email}
            databaseOptimization={{
                enabled: true,
                minLoadingTime: 2000,
                minRequestInterval: 2000,
                cooldownPeriod: 1000
            }}
        />
    );
}

export default ResetPasswordForm;