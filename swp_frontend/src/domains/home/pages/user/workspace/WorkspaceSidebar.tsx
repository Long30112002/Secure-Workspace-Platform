import React from 'react';
import './WorkspaceDashboard.css';

interface WorkspaceSidebarProps {
  activeTab: 'feed' | 'members' | 'files' | 'settings';
  onTabChange: (tab: 'feed' | 'members' | 'files' | 'settings') => void;
  user: {
    email?: string;
    name?: string;
    id?: number;
  };
  postsCount: number;
  isAdmin: boolean;
}

const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  onTabChange,
  user,
  postsCount,
  isAdmin
}) => {
  const getMemberRole = () => {
    return 'MEMBER';
  };

  return (
    <aside className="workspace-sidebar">
      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">CONTENT</h3>
          <button
            className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => onTabChange('feed')}
          >
            <span className="nav-icon">📝</span>
            <span className="nav-text">Feed & Posts</span>
            <span className="nav-badge">{postsCount}</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => onTabChange('members')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-text">Members</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => onTabChange('files')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-text">Files & Documents</span>
          </button>
          {isAdmin && (
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onTabChange('settings')}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
            </button>
          )}
        </div>

        <div className="nav-section">
          <h3 className="nav-section-title">DISCUSSION</h3>
          <button className="nav-item">
            <span className="nav-icon">💬</span>
            <span className="nav-text"># general</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon">🎮</span>
            <span className="nav-text"># random</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon">❓</span>
            <span className="nav-text"># help</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            <span>{user?.email?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
          <div className="user-details">
            <div className="user-name">{user?.email?.split('@')[0] || 'User'}</div>
            <div className="user-role">{getMemberRole()}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default WorkspaceSidebar;