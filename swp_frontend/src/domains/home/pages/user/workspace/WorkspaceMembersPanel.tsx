import React from 'react';
import './WorkspaceDashboard.css';

interface Member {
  id: string;
  userId: number;
  name: string;
  status?: string;
}

interface WorkspaceMembersPanelProps {
  members: Member[];
  onlineMembers: Set<number>;
  currentUserId?: number;
  onClose: () => void;
}

const WorkspaceMembersPanel: React.FC<WorkspaceMembersPanelProps> = ({
  members,
  onlineMembers,
  currentUserId,
  onClose
}) => {
  const filteredMembers = members.filter(member => member.userId !== currentUserId);

  const getMemberStatus = (member: Member) => {
    const isOnline = onlineMembers.has(member.userId);
    return isOnline ? 'online' : member.status || 'offline';
  };

  return (
    <aside className="workspace-members-panel">
      <div className="members-header">
        <h3>👥 Members ({filteredMembers.length})</h3>
        <button
          className="close-btn"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="members-list-panel">
        {filteredMembers.map(member => (
          <div key={member.id} className="member-item">
            <div className="member-avatar">
              <span>{member.name.charAt(0)}</span>
              <span className={`status-indicator ${getMemberStatus(member)}`}></span>
            </div>
            <div className="member-details">
              <div className="member-name">{member.name}</div>
              <div className="member-status">
                {getMemberStatus(member) === 'online' ? '🟢 Online' :
                  getMemberStatus(member) === 'away' ? '🟡 Away' : '⚫ Offline'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default WorkspaceMembersPanel;