import React from 'react';
import './WorkspaceDashboard.css';

interface StatCardProps {
    icon: string;
    number: number | string;
    label: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, number, label }) => (
    <div className="stat-card">
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
            <div className="stat-number">{number}</div>
            <div className="stat-label">{label}</div>
        </div>
    </div>
);

interface WorkspaceQuickStatsProps {
    stats: {
        totalPosts: number;
        activeMembers: number;
    };
    posts: Array<{ comments: number }>;
    workspace: {
        createdAt: string;
    };
}

const WorkspaceQuickStats: React.FC<WorkspaceQuickStatsProps> = ({
    stats,
    posts,
    workspace
}) => {
    const totalComments = posts.reduce((acc, post) => acc + post.comments, 0);

    return (
        <div className="workspace-quick-stats">
            <StatCard
                icon="📝"
                number={stats.totalPosts}
                label="Post"
            />
            <StatCard
                icon="👥"
                number={stats.activeMembers}
                label="Members"
            />
            <StatCard
                icon="💬"
                number={totalComments}
                label="Comments"
            />
            <StatCard
                icon="📅"
                number={new Date(workspace.createdAt).toLocaleDateString('vi-VN')}
                label="Created Date"
            />
        </div>
    );
};

export default WorkspaceQuickStats;