import { useEffect, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import PersonalInfoForm from "./PersonalInfoForm";
import SecuritySettings from "./SecuritySettings";
import AvatarUploader from "./AvatarUploader";
import MessageToast from "../../../shared/components/ui/Toast/MessageToast";
import { apiService } from "../../../services/api/axiosConfig";
const API_BASE_URL = 'http://localhost:3000';

interface ProfileData {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    bio?: string;
    avatarUrl?: string;
    role?: string;
    isEmailVerified?: boolean;
    createdAt?: string;
    lastLoginAt?: string;
}

interface ToastState {
    show: boolean;
    type: "success" | "error" | "info";
    message: string;
}

function ProfileContent() {
    const { user, isLoading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<string>("personal");
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<ToastState>({ show: false, type: "info", message: "" });


    useEffect(() => {
        if (!authLoading && user) {
            fetchProfile();
        } else if (!authLoading && !user) {
            showToast("error", "Please login to view profile");
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        }
    }, [authLoading, user]);

    useEffect(() => {
        if (!user) {
            showToast("error", "Please login first");
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
            return;
        }

        fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        try {
            setLoading(true);

            const result = await apiService.getProfile();

            // Kiểm tra cấu trúc response
            if (result && result.data) {
                setProfileData(result.data);
            } else if (result && result.id) {
                setProfileData(result);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error: any) {
            if (error.message.includes('401') || error.message.includes('Authentication')) {
                showToast("error", "Session expired. Please login again.");

                setTimeout(() => {
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }, 2000);
            } else {
                showToast("error", error.message || "Failed to load profile data");
            }
        } finally {
            setLoading(false);
        }
    };


    const showToast = (type: "success" | "error" | "info", message: string) => {
        setToast({ show: true, type, message });
        setTimeout(() => {
            setToast({ show: false, type: "info", message: "" });
        }, 5000);
    };

    const handleSaveProfile = async (data: ProfileData) => {
        try {
            await apiService.updateProfile({
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                bio: data.bio,
            });

            setProfileData(prev => ({ ...prev, ...data }));
            showToast("success", "Profile updated successfully!");
        } catch (error: any) {
            showToast("error", error.message || "Failed to update profile");
        }
    };

    const handleAvatarUploaded = (avatarUrl: string | null) => {
        setProfileData(prev => ({ ...prev, avatarUrl: avatarUrl || undefined }));
        showToast("success", "Avatar updated successfully!");
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner"></div>
                <p>Loading your profile...</p>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {toast.show && (
                <MessageToast
                    type={toast.type}
                    message={toast.message}
                    title={toast.type === "success" ? "Success!" : "Error"}
                    duration={5000}
                    onClose={() => setToast({ show: false, type: "info", message: "" })}
                />
            )}

            <div className="profile-header">
                <div className="avatar-section">
                    <AvatarUploader
                        currentAvatar={profileData?.avatarUrl
                            ? profileData.avatarUrl.startsWith('http')
                                ? profileData.avatarUrl
                                : `${API_BASE_URL}${profileData.avatarUrl}`
                            : null
                        }
                        onUploadComplete={handleAvatarUploaded}
                    />
                    <div className="user-basic-info">
                        <h1>{profileData?.firstName} {profileData?.lastName}</h1>
                        <p className="user-email">{profileData?.email}</p>
                        <div className="user-meta">
                            <span className="badge verified">
                                ✅ Email Verified
                            </span>
                            <span className="badge role">
                                {profileData?.role}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="account-info">
                    <div className="info-card">
                        <h3>Account Info</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Member Since:</span>
                                <span className="value">{formatDate(profileData?.createdAt)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Last Login:</span>
                                <span className="value">{formatDate(profileData?.lastLoginAt)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Email Status:</span>
                                <span className="value status-verified">
                                    {profileData?.isEmailVerified ? "Verified" : "Not Verified"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="profile-tabs">
                <button
                    className={`tab-btn ${activeTab === "personal" ? "active" : ""}`}
                    onClick={() => setActiveTab("personal")}
                >
                    <span className="tab-icon">👤</span>
                    Personal Info
                </button>
                <button
                    className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
                    onClick={() => setActiveTab("security")}
                >
                    <span className="tab-icon">🔒</span>
                    Security
                </button>
                <button
                    className={`tab-btn ${activeTab === "preferences" ? "active" : ""}`}
                    onClick={() => setActiveTab("preferences")}
                >
                    <span className="tab-icon">⚙️</span>
                    Preferences
                </button>
            </div>

            <div className="tab-content">
                {activeTab === "personal" && (
                    <PersonalInfoForm
                        profileData={profileData}
                        onSave={handleSaveProfile}
                    />
                )}

                {activeTab === "security" && (
                    <SecuritySettings />
                )}

                {activeTab === "preferences" && (
                    <div className="preferences-tab">
                        <h2>Preferences</h2>
                        <p>Coming soon...</p>
                    </div>
                )}
            </div>
        </div>
    );

}

export default ProfileContent;