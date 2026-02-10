import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface User {
    id?: number;
    email: string;
    role?: string;
    createdAt?: string;
    name?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
    logout: () => Promise<void>;
    updateUser: (userData: Partial<User>) => void;
    
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            if (!mounted) return;

            try {
                const response = await fetch('http://localhost:3000/api/auth/check', {
                    method: 'GET',
                    credentials: 'include'
                });

                if (!response.ok) {
                    setUser(null);
                    localStorage.removeItem('user');
                    return;
                }

                const result = await response.json();
                const authData = result.data || result;

                if (authData.authenticated === true && authData.user) {
                    setUser(authData.user);
                    localStorage.setItem('user', JSON.stringify(authData.user));
                    return;
                }

                setUser(null);
                localStorage.removeItem('user');

            } catch (error) {
                if (!localStorage.getItem('user')) {
                    setUser(null);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        return () => {
            mounted = false;
        };
    }, []);

    const login = async (email: string, password: string, rememberMe?: boolean) => {
        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, rememberMe: rememberMe || false }),
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const result = await response.json();

            if (result.success && result.data?.user) {
                const userData = result.data.user;
                setUser(userData);
                localStorage.setItem('user', JSON.stringify(userData));

                if (result.data.redirectTo) {
                    window.location.href = result.data.redirectTo;
                }

                return result;
            } else {
                throw new Error(result.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await fetch('http://localhost:3000/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            localStorage.removeItem('user');
        }
    };

    const updateUser = (userData: Partial<User>) => {
        if (user) {
            const updatedUser = { ...user, ...userData };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    };


    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}



export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}