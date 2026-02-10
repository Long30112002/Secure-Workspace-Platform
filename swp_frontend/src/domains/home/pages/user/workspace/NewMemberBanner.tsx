import React from 'react';
import './WorkspaceDashboard.css';

interface NewMemberBannerProps {
  show: boolean;
  workspaceName: string;
  onCreatePost: () => void;
}

const NewMemberBanner: React.FC<NewMemberBannerProps> = ({ 
  show, 
  workspaceName, 
  onCreatePost 
}) => {
  if (!show) return null;

  return (
    <div className="new-member-banner">
      <div className="welcome-icon">🎉</div>
      <div className="welcome-content">
        <h3>Welcome to {workspaceName}!</h3>
        <p>
          You've joined this workspace. Introduce yourself to everyone
          or explore recent posts.
        </p>
      </div>
      <button
        className="btn btn-outline"
        onClick={onCreatePost}
      >
        📝 Introduce yourself
      </button>
    </div>
  );
};

export default NewMemberBanner;