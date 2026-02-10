import { useState, type ChangeEvent, type FormEvent, type JSX } from "react";
import "./ProfileContent.css";

interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  [key: string]: any;
}

interface PersonalInfoFormProps {
  profileData: ProfileData | null;
  onSave: (data: ProfileData) => Promise<void>;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
}

interface Errors {
  firstName?: string;
  phone?: string;
  bio?: string;
  [key: string]: string | undefined;
}

function PersonalInfoForm({ profileData, onSave }: PersonalInfoFormProps): JSX.Element {
  const [formData, setFormData] = useState<FormData>({
    firstName: profileData?.firstName || "",
    lastName: profileData?.lastName || "",
    email: profileData?.email || "",
    phone: profileData?.phone || "",
    bio: profileData?.bio || "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  }
  const validateForm = (): Errors => {
    const newErrors: Errors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (formData.phone && !/^[+]?[\d\s\-()]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = "Bio cannot exceed 500 characters";
    }

    return newErrors;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="personal-info-form">
      <h2>Personal Information</h2>
      <p className="form-description">
        Update your personal details and contact information.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">

          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                className={errors.firstName ? "error" : ""}
                disabled={loading}
              />
              {errors.firstName && (
                <span className="error-message">{errors.firstName}</span>
              )}
            </div>
          </div>

          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                disabled={loading}
              />
            </div>
          </div>

          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                readOnly
                className="read-only"
                title="Email cannot be changed"
              />
              <small className="field-note">
                Contact support to change your email address
              </small>
            </div>
          </div>


          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
                className={errors.phone ? "error" : ""}
                disabled={loading}
              />
              {errors.phone && (
                <span className="error-message">{errors.phone}</span>
              )}
            </div>
          </div>

          {/* Div này để tránh global css */}
          <div className="per-info">
            <div className="form-group full-width">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell us a little about yourself..."
                rows={4}
                maxLength={500}
                className={errors.bio ? "error" : ""}
                disabled={loading}
              />
              <div className="textarea-footer">
                <span className={`char-count ${formData.bio.length > 450 ? "warning" : ""}`}>
                  {formData.bio.length}/500
                </span>
                {errors.bio && (
                  <span className="error-message">{errors.bio}</span>
                )}
              </div>
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
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>

          <button
            type="button"
            className="cancel-btn secondary-btn"
            onClick={() => setFormData({
              firstName: profileData?.firstName || "",
              lastName: profileData?.lastName || "",
              email: profileData?.email || "",
              phone: profileData?.phone || "",
              bio: profileData?.bio || "",
            })}
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

export default PersonalInfoForm;
