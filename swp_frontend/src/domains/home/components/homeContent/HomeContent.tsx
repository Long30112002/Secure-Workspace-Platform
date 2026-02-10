import { useAuth } from "../../../auth/context/AuthContext";
import "./HomeContent.css";
import { useWorkspace } from "../../pages/context/WorkspaceContext";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function HomeContent() {
    const { user, isLoading } = useAuth();
    const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
    const location = useLocation();
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [newWorkspaceInfo, setNewWorkspaceInfo] = useState<{ name: string; id: string; } | null>(null);

    // Xử lý khi vừa tạo workspace xong
    useEffect(() => {
        const state = location.state as any;
        if (state?.workspaceCreated && state?.workspaceName) {
            setNewWorkspaceInfo({
                name: state.workspaceName,
                id: state.workspaceId
            });
            setShowSuccessToast(true);

            // Auto switch to new workspace
            if (state.workspaceId) {
                setTimeout(() => {
                    switchWorkspace(state.workspaceId);
                }, 1000);
            }

            // Clear state để không hiển thị lại
            window.history.replaceState({}, document.title);
        }
    }, [location.state, switchWorkspace]);

    if (isLoading) {
        return <div className="loading">Loading...</div>;
    }

    const isLoggedIn = !!user;

    return (
        <div className="home-content">
            {/* Hero Section */}

            {showSuccessToast && newWorkspaceInfo && (
                <div className="success-toast">
                    <div className="toast-content">
                        <span className="toast-icon">🎉</span>
                        <div>
                            <div className="toast-title">Workspace Created!</div>
                            <div className="toast-message">
                                Your workspace "{newWorkspaceInfo.name}" has been created successfully.
                            </div>
                        </div>
                        <button
                            className="toast-close"
                            onClick={() => setShowSuccessToast(false)}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Enterprise SaaS Platform
                        <span className="hero-highlight">Built for Scale</span>
                    </h1>
                    <p className="hero-subtitle">
                        Multi-tenant platform with granular RBAC, enterprise security,
                        and real-time analytics for teams of all sizes.
                    </p>

                    <div className="hero-stats">
                        <div className="stat">
                            <div className="stat-number">99.9%</div>
                            <div className="stat-label">Uptime SLA</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">∞</div>
                            <div className="stat-label">Scalability</div>
                        </div>
                        <div className="stat">
                            <div className="stat-number">24/7</div>
                            <div className="stat-label">Support</div>
                        </div>
                    </div>

                    <div className="hero-actions">
                        {isLoggedIn ? (
                            <>
                                <Link to={getDashboardPath(user?.role)} className="btn btn-primary btn-large btn-with-icon">
                                    <span>🚀</span> Go to Dashboard
                                </Link>
                                <Link to="/docs" className="btn btn-outline btn-large">
                                    📚 Documentation
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/register" className="btn btn-primary btn-large btn-with-icon">
                                    <span>✨</span> Start Free Trial
                                </Link>
                                <Link to="/demo" className="btn btn-outline btn-large">
                                    🎬 Book a Demo
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="hero-visual">
                    <div className="platform-preview">
                        <div className="preview-header">
                            <div className="preview-dots">
                                <div className="dot red"></div>
                                <div className="dot yellow"></div>
                                <div className="dot green"></div>
                            </div>
                            <div className="preview-title">SaaS Platform Dashboard</div>
                        </div>
                        <div className="preview-content">
                            <div className="preview-sidebar">
                                <div className="sidebar-item active">🏠 Dashboard</div>
                                <div className="sidebar-item">👥 Users</div>
                                <div className="sidebar-item">📊 Analytics</div>
                                <div className="sidebar-item">⚙️ Settings</div>
                                <div className="sidebar-item">🔐 Security</div>
                            </div>
                            <div className="preview-main">
                                <div className="preview-card">
                                    <div className="preview-card-title">Active Users</div>
                                    <div className="preview-chart"></div>
                                </div>
                                <div className="preview-card">
                                    <div className="preview-card-title">Revenue</div>
                                    <div className="preview-chart"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Welcome Card for Logged-in Users */}
            {isLoggedIn && user && (
                <div className="welcome-card">
                    <div className="welcome-header">
                        <div className="welcome-user">
                            <div className="welcome-avatar">
                                {getInitials(user.email)}
                            </div>
                            <div>
                                <h2>Welcome back, {user.email?.split('@')[0]}!</h2>
                                <p className="welcome-email">{user.email}</p>

                                {/* Hiển thị thông báo workspace mới tạo */}
                                {newWorkspaceInfo && (
                                    <div className="new-workspace-alert">
                                        <span className="alert-icon">🏢</span>
                                        <span>
                                            New workspace "<strong>{newWorkspaceInfo.name}</strong>" is ready!
                                        </span>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* THÊM WORKSPACE SELECTOR */}
                        <div className="workspace-selector-section">
                            <div className="workspace-selector">
                                <label>Current Workspace:</label>
                                <select
                                    value={currentWorkspace?.id || ''}
                                    onChange={(e) => {
                                        switchWorkspace(e.target.value);
                                        setNewWorkspaceInfo(null)
                                    }}
                                    className="workspace-dropdown"
                                >
                                    <option value="">Select a workspace</option>
                                    {workspaces.map(workspace => (
                                        <option key={workspace.id} value={workspace.id}>
                                            {workspace.name} ({getRoleDisplay(workspace.role)})
                                            {newWorkspaceInfo?.id === workspace.id && " ✨ NEW"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {currentWorkspace && (
                                <div className="current-workspace-info">
                                    <span className="workspace-badge">
                                        🏢 {currentWorkspace.name}
                                        {newWorkspaceInfo?.id === currentWorkspace.id && " ✨"}
                                    </span>
                                    <span className="plan-badge">
                                        {currentWorkspace.plan === 'pro' ? '⭐ PRO' :
                                            currentWorkspace.plan === 'enterprise' ? '🚀 ENTERPRISE' : '🆓 FREE'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Welcome Actions*/}
                    <div className="welcome-actions">
                        <Link
                            to={currentWorkspace ? `/workspace/${currentWorkspace.id}/dashboard` : '/workspaces'}
                            className={`welcome-action-card ${newWorkspaceInfo ? 'highlight' : ''} ${currentWorkspace ? 'primary' : ''}`}
                        >
                            <div className="action-icon">
                                {newWorkspaceInfo ? "✨" : "🚀"}
                            </div>
                            <div className="action-content">
                                <div className="action-title">
                                    {newWorkspaceInfo
                                        ? `Explore ${newWorkspaceInfo.name}`
                                        : currentWorkspace
                                            ? `Go to ${currentWorkspace.name}`
                                            : 'Go to Dashboard'}
                                </div>
                                <div className="action-description">
                                    {newWorkspaceInfo
                                        ? `Start using your new workspace`
                                        : currentWorkspace
                                            ? `Access ${currentWorkspace.name} workspace`
                                            : 'Select a workspace first'}
                                </div>
                            </div>
                        </Link>

                        <Link to="/workspaces" className="welcome-action-card">
                            <div className="action-icon">🏢</div>
                            <div className="action-content">
                                <div className="action-title">Manage Workspaces</div>
                                <div className="action-description">
                                    View all {workspaces.length} workspaces
                                </div>
                            </div>
                        </Link>

                        <Link to="/workspace/create" className="welcome-action-card">
                            <div className="action-icon">+</div>
                            <div className="action-content">
                                <div className="action-title">Create New Workspace</div>
                                <div className="action-description">
                                    Start another team or project
                                </div>
                            </div>
                        </Link>

                    </div>
                </div>
            )}

            {/* Trusted By Section */}
            <div className="trusted-section">
                <div className="section-header">
                    <h2>Trusted by Industry Leaders</h2>
                    <p className="section-subtitle">
                        Join thousands of teams transforming their business
                    </p>
                </div>
                <div className="trusted-logos">
                    {['TechCorp', 'GlobalBank', 'HealthPlus', 'EduTech', 'RetailPro', 'FinanceX'].map((logo, index) => (
                        <div key={index} className="trusted-logo">
                            <div className="logo-placeholder">{logo}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Features Section */}
            <div className="features-section">
                <div className="section-header">
                    <h2>Everything You Need in One Platform</h2>
                    <p className="section-subtitle">
                        Comprehensive features for modern enterprises
                    </p>
                </div>

                <div className="features-grid">
                    <FeatureCard
                        icon="🏢"
                        title="Multi-Tenant Architecture"
                        desc="Fully isolated workspaces with separate databases for maximum security"
                        features={["Data isolation", "Custom domains", "Separate billing", "Tenant admin"]}
                    />
                    <FeatureCard
                        icon="🎯"
                        title="Granular RBAC"
                        desc="Precise permissions for SUPER_ADMIN, ADMIN, MODERATOR, USER roles"
                        features={["Role hierarchy", "Permission sets", "Audit trails", "Impersonation"]}
                    />
                    <FeatureCard
                        icon="🔐"
                        title="Enterprise Security"
                        desc="Bank-level security with compliance certifications"
                        features={["SSO/SAML", "2FA/MFA", "Audit logs", "GDPR/CCPA"]}
                    />
                    <FeatureCard
                        icon="📊"
                        title="Real-time Analytics"
                        desc="Comprehensive dashboards and custom reports"
                        features={["Live metrics", "Custom reports", "Data export", "API access"]}
                    />
                    <FeatureCard
                        icon="⚡"
                        title="High Performance"
                        desc="Global infrastructure with auto-scaling"
                        features={["99.9% SLA", "Global CDN", "Auto-scaling", "Redis cache"]}
                    />
                    <FeatureCard
                        icon="🔄"
                        title="API-First Platform"
                        desc="Extensive APIs and webhooks for integrations"
                        features={["REST APIs", "Webhooks", "SDKs", "Zapier"]}
                    />
                </div>
            </div>

            {/* Use Cases */}
            <div className="usecases-section">
                <div className="section-header">
                    <h2>Perfect for Your Use Case</h2>
                    <p className="section-subtitle">
                        Tailored solutions for different industries
                    </p>
                </div>
                <div className="usecases-grid">
                    <UseCaseCard
                        title="SaaS Companies"
                        description="White-label platform for your customers"
                        features={["Brand customization", "Multi-tenant", "Usage billing"]}
                        icon="☁️"
                    />
                    <UseCaseCard
                        title="Enterprise Teams"
                        description="Internal tools for large organizations"
                        features={["Department isolation", "Compliance", "Internal billing"]}
                        icon="🏢"
                    />
                    <UseCaseCard
                        title="Startups"
                        description="Quick setup with scalable infrastructure"
                        features={["Rapid onboarding", "Pay-as-you-grow", "Scalable"]}
                        icon="🚀"
                    />
                    <UseCaseCard
                        title="Agencies"
                        description="Manage multiple client accounts"
                        features={["Client portals", "Unified billing", "Resource management"]}
                        icon="🎯"
                    />
                </div>
            </div>

            {/* Testimonials */}
            <div className="testimonials-section">
                <div className="section-header">
                    <h2>What Our Customers Say</h2>
                    <p className="section-subtitle">
                        Join thousands of satisfied teams
                    </p>
                </div>
                <div className="testimonials-grid">
                    <TestimonialCard
                        quote="This platform transformed how we manage our multi-tenant SaaS. The RBAC system is unmatched."
                        author="Sarah Chen"
                        role="CTO, TechStart Inc."
                        rating={5}
                    />
                    <TestimonialCard
                        quote="Enterprise-grade security with startup flexibility. Perfect for our growing team."
                        author="Michael Rodriguez"
                        role="VP Engineering, GlobalBank"
                        rating={5}
                    />
                    <TestimonialCard
                        quote="The multi-tenant architecture saved us months of development time. Highly recommended!"
                        author="David Park"
                        role="Founder, HealthPlus"
                        rating={5}
                    />
                </div>
            </div>

            {/* Pricing Preview (only for guests) */}
            {!isLoggedIn && (
                <div className="pricing-preview">
                    <div className="section-header">
                        <h2>Simple, Transparent Pricing</h2>
                        <p className="section-subtitle">
                            Start free, scale as you grow. No hidden fees.
                        </p>
                    </div>
                    <div className="pricing-cards">
                        <PricingCard
                            title="Starter"
                            price="$0"
                            period="forever"
                            features={[
                                "1 Workspace",
                                "Up to 5 users",
                                "Basic RBAC",
                                "Community support",
                                "1GB storage"
                            ]}
                            ctaText="Get Started Free"
                            ctaLink="/register"
                            variant="basic"
                        />
                        <PricingCard
                            title="Pro"
                            price="$49"
                            period="per month"
                            featured={true}
                            features={[
                                "Up to 10 workspaces",
                                "Unlimited users",
                                "Advanced RBAC",
                                "Priority support",
                                "Custom branding",
                                "100GB storage",
                                "API access",
                                "Audit logs"
                            ]}
                            ctaText="Start Free Trial"
                            ctaLink="/register?plan=pro"
                            variant="pro"
                        />
                        <PricingCard
                            title="Enterprise"
                            price="Custom"
                            period="custom pricing"
                            features={[
                                "Unlimited workspaces",
                                "Dedicated infrastructure",
                                "SLA 99.9%",
                                "24/7 phone support",
                                "Custom integrations",
                                "SSO/SAML",
                                "Custom contracts",
                                "Training & onboarding"
                            ]}
                            ctaText="Contact Sales"
                            ctaLink="/contact"
                            variant="enterprise"
                        />
                    </div>
                </div>
            )}

            {/* FAQ Section */}
            <div className="faq-section">
                <div className="section-header">
                    <h2>Frequently Asked Questions</h2>
                    <p className="section-subtitle">
                        Everything you need to know about our platform
                    </p>
                </div>
                <div className="faq-grid">
                    <FAQItem
                        question="What is multi-tenancy?"
                        answer="Multi-tenancy allows multiple customers (tenants) to use the same application instance while keeping their data completely isolated. Each tenant has their own database schema or separate database."
                    />
                    <FAQItem
                        question="How does RBAC work?"
                        answer="Role-Based Access Control (RBAC) provides granular permissions: SUPER_ADMIN (full system), ADMIN (user management), MODERATOR (content review), USER (regular access). Each role has specific capabilities."
                    />
                    <FAQItem
                        question="Can I customize the platform?"
                        answer="Yes! Our platform supports white-labeling, custom domains, branding, and extensive API access for complete customization."
                    />
                    <FAQItem
                        question="Is there a free trial?"
                        answer="Yes! All paid plans include a 14-day free trial with full access to all features. No credit card required."
                    />
                </div>
            </div>

            {/* Final CTA */}
            <div className="final-cta">
                <div className="cta-content">
                    <h2>Ready to Scale Your Business?</h2>
                    <p>Join 10,000+ teams using our enterprise platform</p>

                    <div className="cta-metrics">
                        <div className="metric">
                            <div className="metric-number">99.9%</div>
                            <div className="metric-label">Uptime</div>
                        </div>
                        <div className="metric">
                            <div className="metric-number">24/7</div>
                            <div className="metric-label">Support</div>
                        </div>
                        <div className="metric">
                            <div className="metric-number">10K+</div>
                            <div className="metric-label">Teams</div>
                        </div>
                    </div>

                    <div className="cta-actions">
                        {isLoggedIn ? (
                            <>
                                <Link to={getDashboardPath(user?.role)} className="btn btn-primary btn-large btn-with-icon">
                                    <span>🚀</span> Launch Dashboard
                                </Link>
                                <Link to="/docs" className="btn btn-outline btn-large">
                                    📚 Read Documentation
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/register" className="btn btn-primary btn-large btn-with-icon">
                                    <span>✨</span> Start Free Trial
                                </Link>
                                <Link to="/demo" className="btn btn-outline btn-large">
                                    🎬 Schedule a Demo
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="cta-note">
                        <span className="note-icon">✅</span>
                        <span>No credit card required • 14-day free trial • Cancel anytime</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper functions
const getDashboardPath = (role?: string) => {
    switch (role) {
        case 'SUPER_ADMIN': return '/super-admin/dashboard';
        case 'ADMIN': return '/admin/dashboard';
        case 'MODERATOR': return '/moderator/dashboard';
        default: return '/dashboard';
    }
};

const getRoleDisplay = (role?: string) => {
    switch (role) {
        case 'SUPER_ADMIN': return '🔥 SUPER ADMIN';
        case 'ADMIN': return '🛠 ADMIN';
        case 'MODERATOR': return '🛡 MODERATOR';
        case 'USER': return '👤 USER';
        default: return role || 'GUEST';
    }
};

// const getRoleHint = (role?: string) => {
//     switch (role) {
//         case 'SUPER_ADMIN': return 'Full system control and access';
//         case 'ADMIN': return 'User management and operations';
//         case 'MODERATOR': return 'Content review and moderation';
//         case 'USER': return 'Workspace access and collaboration';
//         default: return 'Limited guest access';
//     }
// };

// const getDashboardDescription = (role?: string) => {
//     switch (role) {
//         case 'SUPER_ADMIN': return 'System control panel and global settings';
//         case 'ADMIN': return 'User management and system operations';
//         case 'MODERATOR': return 'Content review and reports dashboard';
//         default: return 'Your personal workspace dashboard';
//     }
// };

const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
};

// Component: Feature Card with features list
const FeatureCard = ({
    icon,
    title,
    desc,
    features
}: {
    icon: string;
    title: string;
    desc: string;
    features: string[];
}) => (
    <div className="feature-card">
        <div className="feature-icon">{icon}</div>
        <h3>{title}</h3>
        <p className="feature-description">{desc}</p>
        <ul className="feature-list">
            {features.map((feature, index) => (
                <li key={index}>
                    <span className="check-icon">✓</span>
                    {feature}
                </li>
            ))}
        </ul>
    </div>
);

// Component: Use Case Card
const UseCaseCard = ({
    title,
    description,
    features,
    icon
}: {
    title: string;
    description: string;
    features: string[];
    icon: string;
}) => (
    <div className="usecase-card">
        <div className="usecase-icon">{icon}</div>
        <h3>{title}</h3>
        <p className="usecase-description">{description}</p>
        <ul className="usecase-features">
            {features.map((feature, index) => (
                <li key={index}>{feature}</li>
            ))}
        </ul>
    </div>
);

// Component: Testimonial Card
const TestimonialCard = ({
    quote,
    author,
    role,
    rating
}: {
    quote: string;
    author: string;
    role: string;
    rating: number;
}) => (
    <div className="testimonial-card">
        <div className="testimonial-rating">
            {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
        </div>
        <p className="testimonial-quote">"{quote}"</p>
        <div className="testimonial-author">
            <div className="author-name">{author}</div>
            <div className="author-role">{role}</div>
        </div>
    </div>
);

// Component: Pricing Card
const PricingCard = ({
    title,
    price,
    period,
    featured,
    features,
    ctaText,
    ctaLink,
    variant
}: {
    title: string;
    price: string;
    period: string;
    featured?: boolean;
    features: string[];
    ctaText: string;
    ctaLink: string;
    variant: string;
}) => (
    <div className={`pricing-card ${featured ? 'featured' : ''} ${variant}`}>
        {featured && <div className="featured-badge">Most Popular</div>}
        <div className="pricing-header">
            <h3>{title}</h3>
            <div className="price-display">
                <span className="price-amount">{price}</span>
                <span className="price-period">{period}</span>
            </div>
        </div>
        <ul className="pricing-features">
            {features.map((feature, index) => (
                <li key={index}>
                    <span className="feature-check">✓</span>
                    {feature}
                </li>
            ))}
        </ul>
        <Link to={ctaLink} className={`pricing-button ${featured ? 'btn-primary' : 'btn-outline'}`}>
            {ctaText}
        </Link>
    </div>
);

// Component: FAQ Item
const FAQItem = ({
    question,
    answer
}: {
    question: string;
    answer: string;
}) => (
    <div className="faq-item">
        <h3 className="faq-question">{question}</h3>
        <p className="faq-answer">{answer}</p>
    </div>
);


export default HomeContent;