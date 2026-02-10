import { useState, useEffect } from "react";
import "./UserModal.css";
import type { User } from "./user.types";

interface UserModalProps {
    isOpen: boolean;
    type: 'add' | 'edit' | 'delete' | 'bulk';
    user: User | null;
    selectedCount: number;
    onClose: () => void;
    onSave: (userData: Partial<User>) => void;
    onDelete: () => void;
    currentAdminRole?: User['role'];
    currentUserId?: string | number;
}

const UserModal = ({
    isOpen,
    type,
    user,
    selectedCount,
    onClose,
    onSave,
    onDelete,
    currentAdminRole = 'ADMIN',
    currentUserId = ''
}: UserModalProps) => {
    const [formData, setFormData] = useState({
        email: '',
        role: 'USER' as User['role'],
        isActive: true,
        isEmailVerified: false,
        profile: {
            firstName: '',
            lastName: '',
            phone: ''
        }
    });

    const [errors, setErrors] = useState({
        email: '',
        firstName: ''
    });

    // Initialize form data when modal opens or user changes
    useEffect(() => {
        if (type === 'add') {
            setFormData({
                email: '',
                role: 'USER',
                isActive: true,
                isEmailVerified: false,
                profile: {
                    firstName: '',
                    lastName: '',
                    phone: ''
                }
            });
        } else if (type === 'edit' && user) {
            setFormData({
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                isEmailVerified: user.isEmailVerified,
                profile: {
                    firstName: user.profile?.firstName || '',
                    lastName: user.profile?.lastName || '',
                    phone: user.profile?.phone || ''
                }
            });
        }
    }, [type, user]);

    const validateForm = () => {
        const newErrors = {
            email: '',
            firstName: ''
        };

        // Chỉ validate email khi thêm mới
        if (type === 'add') {
            if (!formData.email) {
                newErrors.email = 'Email is required';
            } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
                newErrors.email = 'Email is invalid';
            }
        }

        if (!formData.profile.firstName) {
            newErrors.firstName = 'First name is required';
        }

        setErrors(newErrors);
        return !newErrors.email && !newErrors.firstName;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            onSave(formData);
            setFormData({
                email: '',
                role: 'USER',
                isActive: true,
                isEmailVerified: false,
                profile: {
                    firstName: '',
                    lastName: '',
                    phone: ''
                }
            });
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => {
            if (field.startsWith('profile.')) {
                const profileField = field.split('.')[1] as keyof typeof prev.profile;
                return {
                    ...prev,
                    profile: {
                        ...prev.profile,
                        [profileField]: value
                    }
                };
            }
            return {
                ...prev,
                [field]: field === 'isActive' || field === 'isEmailVerified'
                    ? value === 'true'
                    : value
            };
        });

        if (errors[field as keyof typeof errors]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    // Hàm kiểm tra xem có thể thay đổi role không
    const canChangeRole = (targetRole: User['role']): boolean => {
        if (currentAdminRole === 'SUPER_ADMIN') {
            return true;
        }

        if (currentAdminRole === 'ADMIN') {
            const allowedRoles: User['role'][] = ['USER', 'MODERATOR', 'GUEST'];
            return allowedRoles.includes(targetRole);
        }

        return false;
    };

    // Hàm kiểm tra xem có thể thay đổi status không
    // Không cho phép admin tự đổi status của chính mình thành inactive
    const canChangeStatus = (): boolean => {
        // Nếu đang chỉnh sửa chính mình, không cho phép đổi thành inactive
        if (type === 'edit' && user && currentUserId &&
            (user.id === currentUserId || user.id.toString() === currentUserId.toString())) {
            return false; // Không thể thay đổi status của chính mình
        }
        return true;
    };

    // Hàm lấy các role có thể chọn
    const getAvailableRoles = (): User['role'][] => {
        if (currentAdminRole === 'SUPER_ADMIN') {
            return ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'USER', 'GUEST'];
        }
        return ['USER', 'MODERATOR', 'GUEST'];
    };

    // Helper để render role options
    const renderRoleOptions = () => {
        const availableRoles = getAvailableRoles();

        return availableRoles.map(role => (
            <option
                key={role}
                value={role}
                disabled={!canChangeRole(role)}
            >
                {role === 'SUPER_ADMIN' ? 'Super Admin' :
                    role === 'ADMIN' ? 'Admin' :
                        role === 'MODERATOR' ? 'Moderator' :
                            role === 'USER' ? 'User' : 'Guest'}
            </option>
        ));
    };

    // Kiểm tra xem có đang chỉnh sửa chính mình không
    const isEditingSelf = (() => {
        if (type !== 'edit' || !user || !currentUserId) {
            return false;
        }

        // So sánh cả hai trường hợp (string vs number)
        const userId = user.id;
        const currentId = currentUserId;

        // Convert cả hai về string để so sánh
        const userIdStr = userId.toString();
        const currentIdStr = currentId.toString();

        return userIdStr === currentIdStr;
    })();

    if (!isOpen) return null;

    const getModalTitle = () => {
        switch (type) {
            case 'add': return 'Add New User';
            case 'edit': return isEditingSelf ? 'Edit My Profile' : 'Edit User';
            case 'delete': return 'Delete User';
            case 'bulk': return 'Bulk Delete Users';
            default: return '';
        }
    };

    const getModalIcon = () => {
        switch (type) {
            case 'add': return '➕';
            case 'edit': return isEditingSelf ? '👤' : '✏️';
            case 'delete': return '🗑️';
            case 'bulk': return '⚠️';
            default: return '';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="modal-header">
                    <div className="modal-title">
                        <span className="modal-icon">{getModalIcon()}</span>
                        {getModalTitle()}
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="modal-body">
                    {type === 'delete' && user && (
                        <div className="delete-confirmation">
                            <div className="warning-icon">⚠️</div>
                            <h4>Are you sure you want to delete this user?</h4>
                            <div className="user-to-delete">
                                <div className="user-avatar-large">
                                    {user.profile?.firstName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                    {user.profile?.lastName?.charAt(0) || ''}
                                </div>
                                <div className="user-details">
                                    <div className="user-name">
                                        {user.profile?.firstName && user.profile?.lastName
                                            ? `${user.profile.firstName} ${user.profile.lastName}`
                                            : user.email.split('@')[0]}
                                    </div>
                                    <div className="user-email">{user.email}</div>
                                    <div className="user-modal"><div className="user-role">{user.role}</div></div>
                                </div>
                            </div>
                            <div className="warning-message">
                                This action cannot be undone. All user data will be permanently deleted.
                            </div>
                        </div>
                    )}

                    {type === 'bulk' && (
                        <div className="bulk-delete-confirmation">
                            <div className="warning-icon">⚠️</div>
                            <h4>Delete {selectedCount} users?</h4>
                            <div className="warning-message">
                                You are about to delete {selectedCount} user{selectedCount !== 1 ? 's' : ''}.
                                This action cannot be undone.
                            </div>
                            <div className="bulk-delete-tips">
                                <div className="tip-item">
                                    <span className="tip-icon">ℹ️</span>
                                    All user data will be permanently removed
                                </div>
                                <div className="tip-item">
                                    <span className="tip-icon">ℹ️</span>
                                    Associated sessions and profiles will be deleted
                                </div>
                                <div className="tip-item">
                                    <span className="tip-icon">⚠️</span>
                                    This action cannot be reversed
                                </div>
                            </div>
                        </div>
                    )}

                    {(type === 'add' || type === 'edit') && (
                        <form onSubmit={handleSubmit} className="user-form">
                            <div className="form-section">
                                <h4>Basic Information</h4>
                                <div className="user-modal">
                                    <div className="form-group">
                                        <label htmlFor="email">
                                            Email Address {type === 'add' ? '*' : ''}
                                            {errors.email && <span className="error-text"> - {errors.email}</span>}
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            placeholder="user@example.com"
                                            className={errors.email ? 'error' : ''}
                                            disabled={type === 'edit'}
                                            readOnly={type === 'edit'}
                                        />
                                        {type === 'edit' && (
                                            <div className="field-description">
                                                Email cannot be changed
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="user-modal">
                                        <div className="form-group">
                                            <label htmlFor="firstName">
                                                First Name *
                                                {errors.firstName && <span className="error-text"> - {errors.firstName}</span>}
                                            </label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                value={formData.profile.firstName}
                                                onChange={(e) => handleInputChange('profile.firstName', e.target.value)}
                                                placeholder="John"
                                                className={errors.firstName ? 'error' : ''}
                                            />
                                        </div>
                                    </div>

                                    <div className="user-modal">
                                        <div className="form-group">
                                            <label htmlFor="lastName">Last Name</label>
                                            <input
                                                type="text"
                                                id="lastName"
                                                value={formData.profile.lastName}
                                                onChange={(e) => handleInputChange('profile.lastName', e.target.value)}
                                                placeholder="Doe"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="user-modal">
                                    <div className="form-group">
                                        <label htmlFor="phone">Phone Number</label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            value={formData.profile.phone}
                                            onChange={(e) => handleInputChange('profile.phone', e.target.value)}
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h4>Account Settings</h4>
                                <div className="form-row">
                                    <div className="user-modal">
                                        <div className="form-group">
                                            <label htmlFor="role">Role</label>
                                            <select
                                                id="role"
                                                value={formData.role}
                                                onChange={(e) => handleInputChange('role', e.target.value)}
                                                disabled={type === 'edit' && !canChangeRole(formData.role)}
                                            >
                                                {renderRoleOptions()}
                                            </select>
                                            {type === 'edit' && !canChangeRole(formData.role) && (
                                                <div className="field-description">
                                                    Role cannot be changed to ADMIN or SUPER_ADMIN
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="user-modal">
                                        <div className="form-group">
                                            <label htmlFor="status">Status</label>
                                            <select
                                                id="status"
                                                value={formData.isActive.toString()}
                                                onChange={(e) => handleInputChange('isActive', e.target.value)}
                                                disabled={!canChangeStatus()} // Disable nếu đang sửa chính mình
                                            >
                                                <option value="true">Active</option>
                                                <option value="false" disabled={isEditingSelf}>
                                                    Inactive {isEditingSelf ? '(Not allowed for yourself)' : ''}
                                                </option>
                                            </select>
                                            {isEditingSelf && (
                                                <div className="field-description">
                                                    You cannot deactivate your own account
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="user-modal">
                                    <div className="form-group checkbox-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.isEmailVerified}
                                                onChange={(e) => handleInputChange('isEmailVerified', e.target.checked.toString())}
                                            />
                                            <span className="checkbox-custom"></span>
                                            Email Verified
                                        </label>
                                        <div className="checkbox-description">
                                            User can access email-protected features
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {type === 'add' && (
                                <div className="form-section">
                                    <h4>Password Settings</h4>
                                    <div className="user-modal">
                                        <div className="form-group">
                                            <label htmlFor="password">Initial Password</label>
                                            <input
                                                type="password"
                                                id="password"
                                                placeholder="Leave empty to generate random password"
                                                disabled
                                            />
                                            <div className="field-description">
                                                A random password will be generated and sent to the user's email
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="modal-footer">
                    {type === 'delete' || type === 'bulk' ? (
                        <>
                            <button
                                className="btn-secondary"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-danger"
                                onClick={onDelete}
                            >
                                Delete {type === 'bulk' ? `${selectedCount} Users` : 'User'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn-secondary"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSubmit}
                                type="submit"
                            >
                                {type === 'add' ? 'Create User' : 'Save Changes'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserModal;