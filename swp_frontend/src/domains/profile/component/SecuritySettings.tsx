import { useState, type ChangeEvent, type FormEvent } from "react";
import "./ProfileContent.css";
import { apiService } from "../../../services/api/axiosConfig";
import MessageToast from "../../../shared/components/ui/Toast/MessageToast";
import validators from "../../auth/shared/utils/Validator";

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface Errors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface ShowPassword {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

interface ToastState {
  show: boolean;
  type: "success" | "error" | "info";
  message: string;
}

function SecuritySettings() {
  const [formData, setFormData] = useState<FormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState<ShowPassword>({
    current: false,
    new: false,
    confirm: false
  });

  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: "info",
    message: ""
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name as keyof Errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const togglePasswordVisibility = (field: keyof ShowPassword) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateForm = (): Errors => {
    const newErrors: Errors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    const passwordError = validators.passwordStrong(formData.newPassword);
    if (passwordError) {
      newErrors.newPassword = passwordError;
    }

    const confirmError = validators.confirmPassword(formData.newPassword, formData.confirmPassword);
    if (confirmError) {
      newErrors.confirmPassword = confirmError;
    }

    return newErrors;
  };

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: "info", message: "" });
    }, 5000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);

      await apiService.changePassword(
        formData.currentPassword,
        formData.newPassword,
        formData.confirmPassword,
      );

      // Reset form on success
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      showToast("success", "Password changed successfully!");

    } catch (error: any) {
      console.error("Failed to change password:", error);
      let errorMessage = "Failed to change password. Please try again.";

      if (error.message.includes("Current password is incorrect")) {
        setErrors(prev => ({
          ...prev,
          currentPassword: "Current password is incorrect",
        }));
        errorMessage = "Current password is incorrect";
      }
      else if (error.message.includes("do not match")) {
        setErrors(prev => ({
          ...prev,
          confirmPassword: "New password and confirm password do not match"
        }));
        errorMessage = "Passwords do not match";
      }
      else if (error.message.includes("400") || error.message.includes("Bad Request")) {
        errorMessage = "Invalid request. Please check your inputs.";
      }
      else if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        errorMessage = "Session expired. Please login again.";
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }

      else if (error.message.includes("429") || error.message.includes("Too Many Requests")) {
        errorMessage = "Too many attempts. Please try again later.";
      }
      showToast("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="security-settings">
      {toast.show && (
        <MessageToast
          type={toast.type}
          message={toast.message}
          title={toast.type === "success" ? "Success!" : "Error"}
          duration={5000}
          onClose={() => setToast({ show: false, type: "info", message: "" })}
        />
      )}

      <h2>Security Settings</h2>
      <p className="security-description">
        Change your password and manage security preferences.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="currentPassword">Current Password *</label>
              <div className="password-wrapper">
                <input
                  type={showPassword.current ? "text" : "password"}
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter your current password"
                  className={errors.currentPassword ? "error" : ""}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility("current")}
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  <span className={`toggle-icon ${showPassword.current ? "show-password" : ""}`}></span>
                </button>
              </div>
            </div>
            {errors.currentPassword && (
              <span className="error-message">{errors.currentPassword}</span>
            )}
          </div>

          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="newPassword">New Password *</label>
              <div className="password-wrapper">
                <input
                  type={showPassword.new ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password (min. 6 characters)"
                  className={errors.newPassword ? "error" : ""}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility("new")}
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  <span className={`toggle-icon ${showPassword.new ? "show-password" : ""}`}></span>
                </button>
              </div>
              {errors.newPassword && (
                <span className="error-message">{errors.newPassword}</span>
              )}
            </div>
          </div>


          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="confirmPassword">Confirm New Password *</label>
              <div className="password-wrapper">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your new password"
                  className={errors.confirmPassword ? "error" : ""}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility("confirm")}
                  aria-label="Toggle password visibility"
                  disabled={loading}
                >
                  <span className={`toggle-icon ${showPassword.confirm ? "show-password" : ""}`}></span>
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-message">{errors.confirmPassword}</span>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="save-btn primary-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="btn-loader"></span>
                Changing Password...
              </>
            ) : (
              "Change Password"
            )}
          </button>

          <button
            type="button"
            className="cancel-btn secondary-btn"
            onClick={() => {
              setFormData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
              });
              setErrors({});
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  )
}

export default SecuritySettings;