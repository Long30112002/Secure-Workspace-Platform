import { useRef, useState, type ChangeEvent } from "react";
import "./ProfileContent.css";
import defaultAvatar from "./../../../assets/avatar.jpg";
import { apiService } from "../../../services/api/axiosConfig";

interface AvatarUploaderProps {
  currentAvatar: string | null;
  onUploadComplete: (avatarUrl: string | null) => void;
}

const DEFAULT_AVATAR = defaultAvatar;
const API_BASE_URL = 'http://localhost:3000';

function AvatarUploader({ currentAvatar, onUploadComplete }: AvatarUploaderProps) {
  const [avatar, setAvatar] = useState<string>
    (currentAvatar
      ? currentAvatar.startsWith('http')
        ? currentAvatar
        : `${API_BASE_URL}${currentAvatar}`
      : DEFAULT_AVATAR
    );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("avatar", file);

      //Goi api tu thuc te
      const response = await apiService.uploadAvatar(formData);

      if (response.data?.avatarUrl) {
        const avatarUrl = response.data.avatarUrl;
        const fullAvatarUrl = avatarUrl.startsWith('http')
          ? avatarUrl
          : `${API_BASE_URL}${avatarUrl}`;

        setAvatar(fullAvatarUrl);
        onUploadComplete(fullAvatarUrl);
      }

    } catch (error: any) {
      setError(error.message || "Failed to upload avatar");
      console.error("Upload error: ", error);
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }

  }


  const handleRemoveAvatar = () => {
    setAvatar(DEFAULT_AVATAR);
    onUploadComplete(null);
  };

  return (
    <div className="avatar-uploader">
      <div className="avatar-container" onClick={handleAvatarClick}>
        {avatar ? (
          <img
            src={avatar}
            alt="Profile avatar"
            className="avatar-image"
            onLoad={() => console.log('Image loaded successfully!')}
            onError={(e) => {
              console.error('Image failed to load!');
              console.error('Image URL:', avatar);
              console.error('Error:', e);
            }}
          />
        ) : (
          <div className="avatar-placeholder">
            <span className="placeholder-icon">👤</span>
          </div>
        )}

        {uploading && (
          <div className="avatar-overlay">
            <div className="upload-spinner"></div>
          </div>
        )}
      </div>

      <div className="avatar-actions">
        <button
          type="button"
          className="avatar-btn upload-btn"
          onClick={handleAvatarClick}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Change Avatar"}
        </button>

        {avatar && (
          <button
            type="button"
            className="avatar-btn remove-btn"
            onClick={handleRemoveAvatar}
            disabled={uploading}
          >
            Remove
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: "none" }}
      />

      {error && (
        <div className="avatar-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <p className="avatar-help">
        Click the avatar to upload a new image (max 5MB)
      </p>
    </div>
  );
}

export default AvatarUploader;
