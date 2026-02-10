export const VALIDATION_CONFIG = {
    EMAIL: {
        regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        maxLength: 254,
    },
    PASSWORD: {
        minLength: 6, // For backward compatibility
        strongMinLength: 8, // For reset password
        requireUppercase: false, // Can enable later
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
    }
} as const;


export const validateEmail = (email: string): string => {
    if (!email.trim()) return "Email is required";
    if (!VALIDATION_CONFIG.EMAIL.regex.test(email)) return "Invalid email format";
    return "";
};


export const validatePassword = (password: string): string => {
    if (!password.trim()) return "Password is required";
    if (password.length < VALIDATION_CONFIG.PASSWORD.minLength) {
        return `Password must be at least ${VALIDATION_CONFIG.PASSWORD.minLength} characters`;
    }
    return "";
};

export const validatePasswordStrong = (password: string): string => {
    if (!password.trim()) return "Password is required";

    if (password.length < VALIDATION_CONFIG.PASSWORD.strongMinLength) {
        return `Password must be at least ${VALIDATION_CONFIG.PASSWORD.strongMinLength} characters`;
    }

    const errors: string[] = [];
    if (!/[A-Z]/.test(password)) errors.push("uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("lowercase letter");
    if (!/\d/.test(password)) errors.push("number");
    if (!/[^a-zA-Z0-9]/.test(password)) {
        errors.push("special character");
    }

    return errors.length > 0
        ? `Must contain at least one ${errors.join(", ")}`
        : "";
};

export const validateConfirmPassword = (
    password: string,
    confirmPassword: string
): string => {
    if (!confirmPassword.trim()) return "Please confirm your password";
    if (password !== confirmPassword) return "Passwords do not match";
    return "";
};

export const validators = {
    email: validateEmail,
    password: validatePassword,
    passwordStrong: validatePasswordStrong,
    confirmPassword: validateConfirmPassword,
} as const;

export default validators;