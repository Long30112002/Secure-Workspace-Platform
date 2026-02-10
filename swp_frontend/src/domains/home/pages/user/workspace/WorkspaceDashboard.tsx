import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../auth/context/AuthContext';
import BaseLayout from '../../../../../shared/components/layout/BaseLayout';
import './WorkspaceDashboard.css';
import { useNotification } from '../../context/NotificationContext';
import { useWebSocket } from '../../context/WebSocketContext';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceSidebar from './WorkspaceSidebar';
import NewMemberBanner from './NewMemberBanner';
import WorkspaceQuickStats from './WorkspaceQuickStats';
import WorkspaceMembersPanel from './WorkspaceMembersPanel';
import FilePreviewer from './FilePreviewer';

interface WorkspaceData {
    id: string;
    name: string;
    description: string;
    subdomain: string;
    owner: {
        id: number;
        email: string;
        name: string;
    };
    stats: {
        totalMembers: number;
        totalPosts: number;
        activeMembers: number;
        onlineMembers: number;
    };
    createdAt: string;
}

interface WorkspacePost {
    id: string;
    title: string;
    content: string;
    author: {
        id: number;
        name: string;
        email: string;
        avatar?: string;
    };
    createdAt: string;
    updatedAt: string;
    likes: number;
    comments: number;
    attachments: Array<{
        id: string;
        name: string;
        type: string;
        url: string;
        size: number;
    }>;
    isPinned: boolean;
    hasLiked?: boolean;
}

interface WorkspaceMember {
    id: string;
    userId: number;
    email: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'MEMBER';
    status: 'online' | 'offline' | 'away';
    lastActive: string;
}

interface WorkspaceFile {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
    uploadedBy: {
        id: number;
        name: string;
        email: string;
    };
    uploadedAt: string;
    downloads: number;
    description?: string;
    tags: string[];
    isPublic: boolean;
}

function WorkspaceDashboard() {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useNotification();
    const { workspaceSocket, joinWorkspace, leaveWorkspace, isConnected } = useWebSocket();

    void isConnected; // To avoid unused variable warning

    // State
    const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
    const [posts, setPosts] = useState<WorkspacePost[]>([]);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'files' | 'settings'>('feed');
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [showMembersPanel, setShowMembersPanel] = useState(true);

    // New post form
    const [newPost, setNewPost] = useState({
        title: '',
        content: ''
    });
    const [posting, setPosting] = useState(false);

    // Online sessions
    const [onlineMembers, setOnlineMembers] = useState<Set<number>>(new Set());

    // comment
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [commentContent, setCommentContent] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [postComments, setPostComments] = useState<Record<string, any[]>>({});

    //File
    const [files, setFiles] = useState<WorkspaceFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    void loadingFiles; // To avoid unused variable warning

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileDescription, setFileDescription] = useState('');
    const [fileTags, setFileTags] = useState<string[]>(['document', 'work']);
    const [currentTag, setCurrentTag] = useState('');
    const [fileFilter, setFileFilter] = useState<'all' | 'images' | 'documents' | 'videos' | 'audio'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'downloads'>('date');

    const [previewMethod, setPreviewMethod] = useState<'microsoft' | 'google'>('microsoft');
    void previewMethod; // To avoid unused variable warning

    // File size formatter
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get file icon based on type
    const getFileIcon = (type: string): string => {
        if (type.startsWith('image/')) return '🖼️';
        if (type.includes('pdf')) return '📄';
        if (type.includes('word') || type.includes('document')) return '📝';
        if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
        if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
        if (type.includes('zip') || type.includes('compressed')) return '📦';
        if (type.includes('audio/')) return '🎵';
        if (type.includes('video/')) return '🎬';
        if (type.includes('text/')) return '📃';
        return '📎';
    };

    // Simulate file upload
    const handleUploadFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            showToast('Please select a file to upload', 'error');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('description', fileDescription);
        formData.append('tags', fileTags.join(','));
        formData.append('isPublic', 'true');

        try {
            const response = await fetch(
                `http://localhost:3000/api/workspace/${workspaceId}/files/upload`,
                {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                }
            );

            const data = await response.json();

            if (data.success) {
                showToast('File uploaded successfully!', 'success');
                setShowUploadModal(false);
                setSelectedFile(null);
                setFileDescription('');
                setFileTags([]);
                fetchWorkspaceFiles(); // Refresh files list
            } else {
                showToast(data.message || 'Failed to upload file', 'error');
            }
        } catch (error) {
            showToast('Failed to upload file', 'error');
        } finally {
            setUploading(false);
        }
    };

    // Simulate download
    const handleDownloadFile = (fileId: string, fileName: string) => {
        showToast(`Downloading ${fileName}...`, 'info');

        // Tạo link download trực tiếp
        const downloadUrl = `http://localhost:3000/api/workspace/${workspaceId}/files/${fileId}/download`;

        // Mở link trong tab mới (cho phép download)
        window.open(downloadUrl, '_blank');

        fetch(`http://localhost:3000/api/workspace/${workspaceId}/files/${fileId}/track-download`, {
            method: 'POST',
            credentials: 'include',
        });
    };

    // Simulate delete
    const handleDeleteFile = async (fileId: string, fileName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:3000/api/workspace/${workspaceId}/files/${fileId}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                showToast(data.message || 'File deleted successfully', 'success');

                // Remove file from state
                setFiles(files.filter(file => file.id !== fileId));
            } else {
                const errorData = await response.json();
                showToast(errorData.message || 'Failed to delete file', 'error');
            }
        } catch (error) {
            console.error('Delete file error:', error);
            showToast('Failed to delete file', 'error');
        }
    };

    const handlePreviewFile = async (fileId: string, fileName: string, fileType: string) => {
        try {
            showToast(`Loading preview for ${fileName}...`, 'info');

            // Lấy thông tin preview
            const previewResponse = await fetch(
                `http://localhost:3000/api/workspace/${workspaceId}/files/${fileId}/preview`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!previewResponse.ok) {
                throw new Error('Preview not available');
            }

            const previewData = await previewResponse.json();

            console.log('Preview data:', previewData);

            if (previewData.success && previewData.data.canPreview) {
                if (previewData.data.previewData?.embedUrl) {
                    openPreviewModal({
                        ...previewData.data,
                        fileId,
                        fileName,
                        fileType,
                    });
                } else {
                    // Fallback: dùng download URL
                    openPreviewModal({
                        ...previewData.data,
                        fileId,
                        fileName,
                        fileType,
                        embedUrl: previewData.data.downloadUrl,
                    });
                }
            } else {
                if (window.confirm('This file type cannot be previewed. Would you like to download it instead?')) {
                    handleDownloadFile(fileId, fileName);
                }
            }
        } catch (error) {
            console.error('Preview error:', error);
            showToast('Preview not available', 'error');
        }
    };

    // State cho preview modal
    const [previewModal, setPreviewModal] = useState<{
        isOpen: boolean;
        fileData: any;
    }>({
        isOpen: false,
        fileData: null,
    });


    const openPreviewModal = (fileData: any) => {
        if (!fileData.canPreview) {
            showToast('Preview is not available for this file type', 'error');
            return;
        }

        setPreviewModal({
            isOpen: true,
            fileData: {
                ...fileData,
                fileId: fileData.fileId || '',
            },
        });
    };

    const closePreviewModal = () => {
        setPreviewModal({ isOpen: false, fileData: null });
        setPreviewMethod('microsoft');
    };

    // Tag management
    const handleAddTag = () => {
        if (currentTag.trim() && !fileTags.includes(currentTag.trim())) {
            setFileTags([...fileTags, currentTag.trim()]);
            setCurrentTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setFileTags(fileTags.filter(tag => tag !== tagToRemove));
    };

    // Filter and sort files
    const filteredFiles = files.filter(file => {
        if (fileFilter === 'all') return true;
        if (fileFilter === 'images' && file.type.startsWith('image/')) return true;
        if (fileFilter === 'documents' && (
            file.type.includes('pdf') ||
            file.type.includes('word') ||
            file.type.includes('excel') ||
            file.type.includes('text') ||
            file.type.includes('document')
        )) return true;
        if (fileFilter === 'videos' && file.type.startsWith('video/')) return true;
        if (fileFilter === 'audio' && file.type.startsWith('audio/')) return true;
        return false;
    });

    const sortedFiles = [...filteredFiles].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'size':
                return b.size - a.size;
            case 'downloads':
                return b.downloads - a.downloads;
            case 'date':
            default:
                return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
    });

    const filterCurrentUser = (member: WorkspaceMember) => {
        return member.userId !== user?.id;
    };

    const isAdmin = () => {
        const role = getMemberRole();
        return ['OWNER', 'ADMIN'].includes(role);
    };

    useEffect(() => {
        const checkCookies = () => {
            // Kiểm tra từng cookie
            const cookies = document.cookie.split(';');
            cookies.forEach(cookie => {
                const [key, value] = cookie.trim().split('=');
                if (key && value) {
                    console.log(`🍪 ${key}: ${value.substring(0, 20)}...`);
                }
            });
        };
        checkCookies();
    }, []);

    useEffect(() => {
        if (workspaceId) {
            fetchWorkspaceData();
        }
    }, [workspaceId]);

    useEffect(() => {
        if (!workspaceSocket || !workspaceId) return;

        const handleConnect = () => {
            if (workspaceId) {
                joinWorkspace(workspaceId);
                setTimeout(() => {
                    if (workspaceSocket.connected && workspaceId) {
                        workspaceSocket.emit('get-online-users', workspaceId);
                    }
                }, 500);
            }
        };

        const handleDisconnect = () => {
            console.log('🔌 WorkspaceDashboard: Socket disconnected');
        };

        // WebSocket listeners cho online status
        const handleOnlineUsers = (data: { users: number[] }) => {
            setOnlineMembers(new Set(data.users));
        };

        const handleUserOnline = (data: { userId: number }) => {
            setOnlineMembers(prev => new Set([...prev, data.userId]));

            // Update member status in local state
            setMembers(prev => prev.map(member =>
                member.userId === data.userId
                    ? { ...member, status: 'online' }
                    : member
            ));
        };

        const handleUserOffline = (data: { userId: number }) => {
            setOnlineMembers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.userId);
                return newSet;
            });

            // Update member status in local state
            setMembers(prev => prev.map(member =>
                member.userId === data.userId
                    ? { ...member, status: 'offline' }
                    : member
            ));
        };

        const handleUserAway = (data: { userId: number }) => {
            setMembers(prev => prev.map(member =>
                member.userId === data.userId
                    ? { ...member, status: 'away' }
                    : member
            ));
        };

        // Listen for connection events
        workspaceSocket.on('connect', handleConnect);
        workspaceSocket.on('disconnect', handleDisconnect);

        // Listen for online status events
        workspaceSocket.on('online-users:list', handleOnlineUsers);
        workspaceSocket.on('user:online', handleUserOnline);
        workspaceSocket.on('user:offline', handleUserOffline);
        workspaceSocket.on('user:away', handleUserAway);

        // Join workspace nếu đã kết nối
        if (workspaceSocket.connected && workspaceId) {
            joinWorkspace(workspaceId);

            // Request online users
            setTimeout(() => {
                workspaceSocket.emit('get-online-users', workspaceId);
            }, 1000);
        }

        return () => {
            // Remove event listeners
            workspaceSocket.off('connect', handleConnect);
            workspaceSocket.off('disconnect', handleDisconnect);
            workspaceSocket.off('online-users:list', handleOnlineUsers);
            workspaceSocket.off('user:online', handleUserOnline);
            workspaceSocket.off('user:offline', handleUserOffline);
            workspaceSocket.off('user:away', handleUserAway);

            // Leave workspace
            if (workspaceId) {
                leaveWorkspace(workspaceId);
            }
        };
    }, [workspaceSocket, workspaceId, joinWorkspace, leaveWorkspace]);

    const fetchWorkspaceData = async () => {
        setLoading(true);
        try {
            // Fetch workspace dashboard data
            const workspaceRes = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/dashboard`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!workspaceRes.ok) {
                throw new Error('Failed to fetch workspace data');
            }

            const workspaceData = await workspaceRes.json();

            if (workspaceData.success) {
                setWorkspace(workspaceData.data);

                // Fetch posts
                const postsRes = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/posts?limit=20`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (postsRes.ok) {
                    const postsData = await postsRes.json();
                    if (postsData.success) setPosts(postsData.data);
                }

                // Fetch active members
                const membersRes = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/members/active`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (membersRes.ok) {
                    const membersData = await membersRes.json();
                    if (membersData.success) setMembers(membersData.data);
                }
            } else {
                showToast(workspaceData.message || 'Không thể tải dữ liệu workspace', 'error');
            }

        } catch (error) {
            showToast('Không thể tải dữ liệu workspace', 'error');
            // Fallback to mock data on error (optional)
            // setWorkspace(MOCK_WORKSPACE);
            // setPosts(MOCK_POSTS);
            // setMembers(MOCK_MEMBERS as WorkspaceMember[]);
        } finally {
            setLoading(false);
        }

    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPost.title.trim() || !newPost.content.trim()) {
            showToast('Vui lòng nhập tiêu đề và nội dung', 'error');
            return;
        }

        setPosting(true);
        try {
            const response = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: newPost.title,
                    content: newPost.content,
                    workspaceId
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('The post has been successfully created.!', 'success');
                setNewPost({ title: '', content: '' });
                setShowCreatePost(false);
                fetchWorkspaceData();
            } else {
                showToast(data.message || 'Unable to create a post.', 'error');
            }
        } catch (error) {
            showToast('Unable to create a post.', 'error');
            setPosting(false);
        }
    };

    const handleToggleLike = async (postId: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/posts/${postId}/toggle-like`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                setPosts(posts.map(post => {
                    if (post.id === postId) {
                        return {
                            ...post,
                            likes: data.data.likes,
                            hasLiked: data.data.hasLiked
                        };
                    }
                    return post;
                }));
                showToast(data.message, 'success');
            } else {
                showToast('Failed to toggle like', 'error');
            }
        } catch (error) {
            showToast('Failed to toggle like', 'error');
        }
    };

    const handleViewPost = (postId: string) => {
        navigate(`/workspace/${workspaceId}/posts/${postId}`);
    };

    const getMemberRole = () => {
        const member = members.find(m => m.userId === user?.id);
        return member?.role || 'MEMBER';
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPostId || !commentContent.trim()) return;

        setPostingComment(true);
        try {
            const response = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/posts/${selectedPostId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ content: commentContent })
            });

            const data = await response.json();
            if (data.success) {
                showToast('Comment added successfully!', 'success');
                setCommentContent('');
                setShowCommentModal(false);

                // Cập nhật comment count và danh sách comment
                setPosts(posts.map(post => {
                    if (post.id === selectedPostId) {
                        return {
                            ...post,
                            comments: post.comments + 1
                        };
                    }
                    return post;
                }));

                // Thêm comment mới vào state
                const newComment = data.data;
                setPostComments(prev => ({
                    ...prev,
                    [selectedPostId]: [...(prev[selectedPostId] || []), newComment]
                }));
            } else {
                showToast(data.message || 'Failed to add comment', 'error');
            }
        } catch (error) {
            showToast('Failed to add comment', 'error');
        } finally {
            setPostingComment(false);
        }
    };

    const handleViewComments = async (postId: string) => {
        try {
            // Fetch comments nếu chưa có
            if (!postComments[postId]) {
                const response = await fetch(`http://localhost:3000/api/workspace/${workspaceId}/posts/${postId}`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data.commentsList) {
                        setPostComments(prev => ({
                            ...prev,
                            [postId]: data.data.commentsList
                        }));
                    }
                }
            }

            setSelectedPostId(postId);
            setShowCommentModal(true);
        } catch (error) {
            showToast('Failed to load comments', 'error');
        }
    };

    const filteredMembers = members.filter(filterCurrentUser);

    const onlineMembersCount = members.filter(m =>
        m.userId !== user?.id && (onlineMembers.has(m.userId) || m.status === 'online')
    ).length;

    const getMemberStatus = (member: WorkspaceMember) => {
        const isOnline = onlineMembers.has(member.userId);
        return isOnline ? 'online' : member.status;
    };

    const fetchWorkspaceFiles = async () => {
        if (!workspaceId) return;

        setLoadingFiles(true);
        try {
            const response = await fetch(
                `http://localhost:3000/api/workspace/${workspaceId}/files?type=${fileFilter}&sortBy=${sortBy}`,
                {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setFiles(data.data.files || []);
                }
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
            // Fallback to mock data if needed
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'files') {
            fetchWorkspaceFiles();
        }
    }, [activeTab, fileFilter, sortBy]);

    const canPreviewFileType = (fileType: string): boolean => {
        const previewableTypes = [
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/webp', 'image/svg+xml', 'image/bmp',

            // PDF
            'application/pdf',

            // Text files
            'text/plain', 'text/html', 'text/css', 'text/javascript',
            'text/markdown', 'text/xml',

            // Code files
            'application/json', 'application/xml',

            // Office documents (có thể preview nếu có converter)
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];

        // Check exact match or prefix match (e.g., image/*)
        return previewableTypes.some(type => {
            // Exact match
            if (fileType === type) return true;

            // Prefix match for categories like image/*
            if (type.endsWith('/*')) {
                const category = type.replace('/*', '');
                return fileType.startsWith(category + '/');
            }

            // Wildcard match
            if (type.includes('*')) {
                const regex = new RegExp('^' + type.replace(/\*/g, '.*') + '$');
                return regex.test(fileType);
            }

            return false;
        });
    };

    if (loading) {
        return (
            <BaseLayout>
                <div className="workspace-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading workspace...</p>
                </div>
            </BaseLayout>
        );
    }

    if (!workspace) {
        return (
            <BaseLayout>
                <div className="workspace-not-found">
                    <h2>Unable to like the post</h2>
                    <p>This workspace does not exist, or you do not have permission to access it.</p>
                    <button onClick={() => navigate('/workspaces')} className="btn btn-primary">
                        Return to the workspace list
                    </button>
                </div>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout>
            <div className="workspace-dashboard-container">
                {/* Header */}
                <WorkspaceHeader
                    workspace={workspace}
                    workspaceId={workspaceId || ''}
                    onlineMembersCount={onlineMembersCount}
                    onCreatePost={() => setShowCreatePost(true)}
                    onToggleMembersPanel={() => setShowMembersPanel(!showMembersPanel)}
                />

                <div className="workspace-main-layout">
                    {/* Sidebar */}
                    <WorkspaceSidebar
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        user={user || {}}
                        postsCount={posts.length}
                        isAdmin={isAdmin()}
                    />

                    {/* Main Content */}
                    <main className="workspace-main-content">
                        {/* Welcome Banner for New Members */}
                        <NewMemberBanner
                            show={members.some(m => m.userId === user?.id && new Date().getTime() - new Date(m.lastActive).getTime() < 3600000)}
                            workspaceName={workspace.name}
                            onCreatePost={() => setShowCreatePost(true)}
                        />

                        {/* Quick Stats */}
                        <WorkspaceQuickStats
                            stats={workspace.stats}
                            posts={posts}
                            workspace={workspace}
                        />

                        {/* Tab Content */}
                        <div className="tab-content">
                            {activeTab === 'feed' && (
                                <div className="feed-tab">
                                    {/* Create Post Button */}
                                    <div className="create-post-button-container">
                                        <button
                                            className="btn-create-post"
                                            onClick={() => setShowCreatePost(true)}
                                        >
                                            <div className="user-avatar">
                                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <span>What do you want to share?</span>
                                        </button>
                                    </div>

                                    {/* Posts List */}
                                    <div className="posts-section">
                                        <h3 className="section-title">
                                            {posts.filter(p => p.isPinned).length > 0 ? '📌 Pinned post' : '📝 Recent posts'}
                                        </h3>

                                        {posts.length === 0 ? (
                                            <div className="empty-posts">
                                                <div className="empty-icon">📝</div>
                                                <h4>No posts yet</h4>
                                                <p>Be the first to share in this workspace!</p>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => setShowCreatePost(true)}
                                                >
                                                    Create First Post
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="posts-list">
                                                {posts.map(post => (
                                                    <div
                                                        key={post.id}
                                                        className={`post-card ${post.isPinned ? 'pinned' : ''}`}
                                                    >
                                                        {post.isPinned && (
                                                            <div className="pinned-badge">📌 Pinned</div>
                                                        )}
                                                        <div className="post-header">
                                                            <div className="author-info">
                                                                <div className="author-avatar">
                                                                    <span>{post.author.name.charAt(0)}</span>
                                                                </div>
                                                                <div className="author-details">
                                                                    <div className="author-name">{post.author.name}</div>
                                                                    <div className="post-time">
                                                                        {new Date(post.createdAt).toLocaleDateString('vi-VN', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <h4 className="post-title">{post.title}</h4>
                                                        <div className="post-content">
                                                            {post.content}
                                                        </div>

                                                        {post.attachments.length > 0 && (
                                                            <div className="post-attachments">
                                                                <div className="attachments-label">Attachments:</div>
                                                                <div className="attachments-list">
                                                                    {post.attachments.slice(0, 3).map(attachment => (
                                                                        <a
                                                                            key={attachment.id}
                                                                            href={attachment.url}
                                                                            className="attachment-item"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            📎 {attachment.name}
                                                                        </a>
                                                                    ))}
                                                                    {post.attachments.length > 3 && (
                                                                        <div className="more-attachments">
                                                                            + {post.attachments.length - 3} more files
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="post-actions">
                                                            <button
                                                                className={`action-btn like-btn ${post.hasLiked ? 'liked' : ''}`}
                                                                onClick={() => handleToggleLike(post.id)}
                                                            >
                                                                {post.hasLiked ? '❤️' : '👍'} {post.likes}
                                                            </button>
                                                            <button
                                                                className="action-btn comment-btn"
                                                                onClick={() => handleViewComments(post.id)}
                                                            >
                                                                💬 {post.comments}
                                                            </button>
                                                            <button
                                                                className="action-btn view-btn"
                                                                onClick={() => handleViewPost(post.id)}
                                                            >
                                                                👁️ See details
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'members' && (
                                <div className="members-tab">
                                    <h3>👥 Thành viên ({filteredMembers.length})</h3>
                                    <div className="members-list-tab">
                                        {filteredMembers.map(member => (
                                            <div key={member.id} className="member-card">
                                                <div className="member-avatar">
                                                    <span>{member.name.charAt(0)}</span>
                                                    <span className={`status-dot ${getMemberStatus(member)}`}></span>
                                                </div>
                                                <div className="member-info">
                                                    <div className="member-name">{member.name}</div>
                                                    <div className="member-email">{member.email}</div>
                                                    <div className="member-role">{member.role}</div>
                                                </div>
                                                <div className="member-last-active">
                                                    {getMemberStatus(member) === 'online' ? '🟢 Online' :
                                                        getMemberStatus(member) === 'away' ? '🟡 Away' :
                                                            `⚫ ${new Date(member.lastActive).toLocaleDateString('vi-VN')}`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'files' && (
                                <div className="files-tab">
                                    {/* Header với Upload Button */}
                                    <div className="files-header">
                                        <div className="header-left">
                                            <h3>📁 Files and Documents ({files.length})</h3>
                                            <p>All files shared in this workspace</p>
                                        </div>
                                        <div className="header-right">
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => setShowUploadModal(true)}
                                            >
                                                <span className="btn-icon">📤</span>
                                                Upload File
                                            </button>
                                        </div>
                                    </div>

                                    {/* Filters và Sort Controls */}
                                    <div className="files-controls">
                                        <div className="filter-buttons">
                                            <button
                                                className={`filter-btn ${fileFilter === 'all' ? 'active' : ''}`}
                                                onClick={() => setFileFilter('all')}
                                            >
                                                All Files
                                            </button>
                                            <button
                                                className={`filter-btn ${fileFilter === 'images' ? 'active' : ''}`}
                                                onClick={() => setFileFilter('images')}
                                            >
                                                🖼️ Images
                                            </button>
                                            <button
                                                className={`filter-btn ${fileFilter === 'documents' ? 'active' : ''}`}
                                                onClick={() => setFileFilter('documents')}
                                            >
                                                📄 Documents
                                            </button>
                                            <button
                                                className={`filter-btn ${fileFilter === 'videos' ? 'active' : ''}`}
                                                onClick={() => setFileFilter('videos')}
                                            >
                                                🎬 Videos
                                            </button>
                                            <button
                                                className={`filter-btn ${fileFilter === 'audio' ? 'active' : ''}`}
                                                onClick={() => setFileFilter('audio')}
                                            >
                                                🎵 Audio
                                            </button>
                                        </div>

                                        <div className="sort-dropdown">
                                            <label>Sort by:</label>
                                            <select
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value as any)}
                                                className="sort-select"
                                            >
                                                <option value="date">📅 Date (Newest)</option>
                                                <option value="name">🔤 Name (A-Z)</option>
                                                <option value="size">📊 Size (Largest)</option>
                                                <option value="downloads">⬇️ Downloads</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Files Grid/List View */}
                                    {sortedFiles.length === 0 ? (
                                        <div className="files-empty-state">
                                            <div className="empty-icon">📁</div>
                                            <h4>No files yet</h4>
                                            <p>Upload your first file to get started</p>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => setShowUploadModal(true)}
                                            >
                                                📤 Upload First File
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="files-grid">
                                                {sortedFiles.map(file => (
                                                    <div key={file.id} className="file-card">
                                                        <div className="file-header">
                                                            <div className="file-icon">{getFileIcon(file.type)}</div>
                                                            <div className="file-info">
                                                                <h4 className="file-name" title={file.name}>
                                                                    {file.name.length > 30
                                                                        ? file.name.substring(0, 30) + '...'
                                                                        : file.name}
                                                                </h4>
                                                                <div className="file-meta">
                                                                    <span className="meta-item">{formatFileSize(file.size)}</span>
                                                                    <span className="meta-separator">•</span>
                                                                    <span className="meta-item">⬇️ {file.downloads}</span>
                                                                    <span className="meta-separator">•</span>
                                                                    <span className="meta-item">
                                                                        {new Date(file.uploadedAt).toLocaleDateString('vi-VN')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="file-actions">
                                                                <button
                                                                    className="action-btn"
                                                                    onClick={() => handleDownloadFile(file.id, file.name)}
                                                                    title="Download"
                                                                >
                                                                    ⬇️
                                                                </button>
                                                                {isAdmin() && (
                                                                    <button
                                                                        className="action-btn danger"
                                                                        onClick={() => handleDeleteFile(file.id, file.name)}
                                                                        title="Delete"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {file.description && (
                                                            <div className="file-description">
                                                                {file.description}
                                                            </div>
                                                        )}

                                                        <div className="file-footer">
                                                            <div className="file-uploader">
                                                                <div className="uploader-avatar">
                                                                    {file.uploadedBy.name.charAt(0)}
                                                                </div>
                                                                <div className="uploader-info">
                                                                    <div className="uploader-name">{file.uploadedBy.name}</div>
                                                                    <div className="uploader-email">{file.uploadedBy.email}</div>
                                                                </div>
                                                            </div>

                                                            {file.tags.length > 0 && (
                                                                <div className="file-tags">
                                                                    {file.tags.slice(0, 3).map(tag => (
                                                                        <span key={tag} className="tag">
                                                                            #{tag}
                                                                        </span>
                                                                    ))}
                                                                    {file.tags.length > 3 && (
                                                                        <span className="tag-more">
                                                                            +{file.tags.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <a
                                                            href="#"
                                                            className={`file-preview-link ${canPreviewFileType(file.type) ? 'preview-available' : 'preview-unavailable'}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (canPreviewFileType(file.type)) {
                                                                    handlePreviewFile(file.id, file.name, file.type);
                                                                } else {
                                                                    showToast('This file type cannot be previewed. Download to view.', 'info');
                                                                }
                                                            }}
                                                            title={canPreviewFileType(file.type)
                                                                ? "Preview this file"
                                                                : "Preview not available for this file type"}
                                                        >
                                                            🔍 {canPreviewFileType(file.type) ? 'Preview File' : 'Preview Not Available'}
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* File Statistics */}
                                            <div className="files-stats">
                                                <div className="stats-item">
                                                    <span className="stats-label">Total Files:</span>
                                                    <span className="stats-value">{files.length}</span>
                                                </div>
                                                <div className="stats-item">
                                                    <span className="stats-label">Total Size:</span>
                                                    <span className="stats-value">
                                                        {formatFileSize(files.reduce((acc, file) => acc + file.size, 0))}
                                                    </span>
                                                </div>
                                                <div className="stats-item">
                                                    <span className="stats-label">Total Downloads:</span>
                                                    <span className="stats-value">
                                                        {files.reduce((acc, file) => acc + file.downloads, 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Upload File Modal */}
                                    {showUploadModal && (
                                        <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
                                            <div className="upload-modal" onClick={e => e.stopPropagation()}>
                                                <div className="modal-header">
                                                    <h3>📤 Upload File</h3>
                                                    <button
                                                        className="close-btn"
                                                        onClick={() => !uploading && setShowUploadModal(false)}
                                                        disabled={uploading}
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                <form onSubmit={handleUploadFile}>
                                                    {/* File Upload Area */}
                                                    <div className="upload-area">
                                                        <input
                                                            type="file"
                                                            id="file-upload"
                                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                            className="file-input"
                                                            accept="*/*"
                                                            disabled={uploading}
                                                        />
                                                        <label htmlFor="file-upload" className="upload-dropzone">
                                                            {selectedFile ? (
                                                                <div className="selected-file">
                                                                    <div className="file-icon">{getFileIcon(selectedFile.type)}</div>
                                                                    <div className="file-details">
                                                                        <div className="file-name">{selectedFile.name}</div>
                                                                        <div className="file-size">
                                                                            {formatFileSize(selectedFile.size)}
                                                                        </div>
                                                                    </div>
                                                                    {!uploading && (
                                                                        <button
                                                                            type="button"
                                                                            className="remove-file-btn"
                                                                            onClick={() => setSelectedFile(null)}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="upload-icon">📤</div>
                                                                    <h4>Drop file here or click to browse</h4>
                                                                    <p>Maximum file size: 100MB</p>                                                                </>
                                                            )}
                                                        </label>
                                                    </div>

                                                    {/* File Description */}
                                                    <div className="form-group file_description">
                                                        <label>Description (optional)</label>
                                                        <textarea
                                                            placeholder="Add a description for this file..."
                                                            value={fileDescription}
                                                            onChange={(e) => setFileDescription(e.target.value)}
                                                            rows={3}
                                                            disabled={uploading}
                                                        />
                                                    </div>

                                                    {/* File Tags */}
                                                    <div className="form-group">
                                                        <label>Tags</label>
                                                        <div className="tags-input">
                                                            <input
                                                                type="text"
                                                                placeholder="Add tags (press Enter or click Add)"
                                                                value={currentTag}
                                                                onChange={(e) => setCurrentTag(e.target.value)}
                                                                onKeyPress={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleAddTag();
                                                                    }
                                                                }}
                                                                disabled={uploading}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline btn-small"
                                                                onClick={handleAddTag}
                                                                disabled={uploading}
                                                            >
                                                                Add
                                                            </button>
                                                        </div>
                                                        {fileTags.length > 0 && (
                                                            <div className="tags-list">
                                                                {fileTags.map(tag => (
                                                                    <span key={tag} className="tag">
                                                                        #{tag}
                                                                        {!uploading && (
                                                                            <button
                                                                                type="button"
                                                                                className="tag-remove"
                                                                                onClick={() => handleRemoveTag(tag)}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Privacy Settings */}
                                                    <div className="form-group">
                                                        <label>Visibility</label>
                                                        <div className="privacy-options">
                                                            <label className="privacy-option">
                                                                <input
                                                                    type="radio"
                                                                    name="privacy"
                                                                    value="public"
                                                                    defaultChecked
                                                                    disabled={uploading}
                                                                />
                                                                <span className="privacy-label">
                                                                    <span className="privacy-icon">🌍</span>
                                                                    Public - All workspace members can access
                                                                </span>
                                                            </label>
                                                            <label className="privacy-option">
                                                                <input
                                                                    type="radio"
                                                                    name="privacy"
                                                                    value="private"
                                                                    disabled={uploading}
                                                                />
                                                                <span className="privacy-label">
                                                                    <span className="privacy-icon">🔒</span>
                                                                    Private - Only admins can access
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="modal-actions">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            onClick={() => !uploading && setShowUploadModal(false)}
                                                            disabled={uploading}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            className="btn btn-primary"
                                                            disabled={uploading || !selectedFile}
                                                        >
                                                            {uploading ? (
                                                                <>
                                                                    <span className="uploading-spinner"></span>
                                                                    Uploading...
                                                                </>
                                                            ) : 'Upload File'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'settings' && isAdmin() && (
                                <div className="settings-tab">
                                    <h3>⚙️ Workspace Settings</h3>
                                    <div className="settings-section">
                                        <h4>Workspace Information</h4>
                                        <div className="settings-form">
                                            <div className="form-group">
                                                <label>Workspace Name:</label>
                                                <input type="text" value={workspace.name} readOnly />
                                            </div>
                                            <div className="form-group">
                                                <label>Subdomain:</label>
                                                <input type="text" value={workspace.subdomain} readOnly />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="settings-section danger-zone">
                                        <h4>Danger Zone</h4>
                                        <button className="btn btn-danger" onClick={() => showToast('Tính năng đang phát triển', 'info')}>
                                            🚫 Delete workspace
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </main>

                    {/* Members Panel */}
                    {showMembersPanel && (
                        <WorkspaceMembersPanel
                            members={members}
                            onlineMembers={onlineMembers}
                            currentUserId={user?.id}
                            onClose={() => setShowMembersPanel(false)}
                        />
                    )}
                </div>

                {/* Create Post Modal */}
                {showCreatePost && (
                    <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
                        <div className="create-post-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Create a new post</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowCreatePost(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <form onSubmit={handleCreatePost}>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        placeholder="Post title..."
                                        value={newPost.title}
                                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <textarea
                                        placeholder="Post content..."
                                        value={newPost.content}
                                        onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                                        rows={6}
                                        required
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => setShowCreatePost(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={posting || !newPost.title.trim() || !newPost.content.trim()}
                                    >
                                        {posting ? 'Posting...' : 'Post'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showCommentModal && selectedPostId && (
                    <div className="modal-overlay" onClick={() => setShowCommentModal(false)}>
                        <div className="comment-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Comments</h3>
                                <button
                                    className="close-btn"
                                    onClick={() => setShowCommentModal(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="comments-list">
                                {postComments[selectedPostId]?.length > 0 ? (
                                    postComments[selectedPostId].map((comment: any) => (
                                        <div key={comment.id} className="comment-item">
                                            <div className="comment-author">
                                                <div className="author-avatar">
                                                    {comment.author.name.charAt(0)}
                                                </div>
                                                <div className="author-info">
                                                    <div className="author-name">{comment.author.name}</div>
                                                    <div className="comment-time">
                                                        {new Date(comment.createdAt).toLocaleDateString('vi-VN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="comment-content">
                                                {comment.content}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-comments">No comments yet. Be the first to comment!</div>
                                )}
                            </div>

                            <form onSubmit={handleAddComment} className="comment-form">
                                <textarea
                                    placeholder="Write a comment..."
                                    value={commentContent}
                                    onChange={(e) => setCommentContent(e.target.value)}
                                    rows={3}
                                    required
                                />
                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => setShowCommentModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={postingComment || !commentContent.trim()}
                                    >
                                        {postingComment ? 'Posting...' : 'Post Comment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {previewModal.isOpen && previewModal.fileData && (
                    <div className="modal-overlay" onClick={closePreviewModal}>
                        <div className="preview-modal" onClick={e => e.stopPropagation()}>
                            <FilePreviewer
                                fileUrl={`http://localhost:3000/api/workspace/${workspaceId}/files/${previewModal.fileData.fileId}/download`}
                                fileName={previewModal.fileData.fileName}
                                fileType={previewModal.fileData.fileType}
                                onClose={closePreviewModal}
                            />
                        </div>
                    </div>
                )}
            </div>
        </BaseLayout>
    );
}

export default WorkspaceDashboard;