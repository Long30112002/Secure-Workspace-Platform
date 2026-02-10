// shared/components/layout/Footer.tsx
import { useState } from "react";
import "./Footer.css";

function Footer() {
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            console.log("Subscribed with email:", email);
            setSubscribed(true);
            setEmail("");
            setTimeout(() => setSubscribed(false), 3000);
        }
    };

    const footerLinks = {
        product: [
            { label: "Features", path: "/features" },
            { label: "Pricing", path: "/pricing" },
            { label: "API Docs", path: "/api-docs" },
            { label: "Changelog", path: "/changelog" },
        ],
        company: [
            { label: "About Us", path: "/about" },
            { label: "Careers", path: "/careers" },
            { label: "Blog", path: "/blog" },
            { label: "Press", path: "/press" },
        ],
        support: [
            { label: "Help Center", path: "/help" },
            { label: "Contact Us", path: "/contact" },
            { label: "Documentation", path: "/docs" },
            { label: "Status", path: "/status" },
        ],
        legal: [
            { label: "Privacy Policy", path: "/privacy" },
            { label: "Terms of Service", path: "/terms" },
            { label: "Cookie Policy", path: "/cookies" },
            { label: "GDPR", path: "/gdpr" },
        ],
    };

    const socialLinks = [
        { icon: "🐦", label: "Twitter", url: "https://twitter.com" },
        { icon: "💼", label: "LinkedIn", url: "https://linkedin.com" },
        { icon: "📘", label: "Facebook", url: "https://facebook.com" },
        { icon: "📷", label: "Instagram", url: "https://instagram.com" },
        { icon: "📺", label: "YouTube", url: "https://youtube.com" },
    ];

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-grid">
                    {/* Company Info */}
                    <div className="footer-section company-info">
                        <h3>Nexus Platform</h3>
                        <p className="company-description">
                            Building the future of digital experiences. Our platform
                            empowers businesses with cutting-edge technology and
                            intuitive design.
                        </p>

                        {/* Newsletter */}
                        <form className="newsletter-form" onSubmit={handleSubscribe}>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="newsletter-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <button type="submit" className="newsletter-btn">
                                {subscribed ? "Subscribed! 🎉" : "Subscribe"}
                            </button>
                        </form>

                        {/* Social Links */}
                        <div className="social-links">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.url}
                                    className="social-link"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={social.label}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div className="footer-section">
                        <h3>Product</h3>
                        <ul className="footer-links-home">
                            {footerLinks.product.map((link) => (
                                <li key={link.label}>
                                    <a href={link.path}>{link.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div className="footer-section">
                        <h3>Company</h3>
                        <ul className="footer-links-home">
                            {footerLinks.company.map((link) => (
                                <li key={link.label}>
                                    <a href={link.path}>{link.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div className="footer-section">
                        <h3>Support</h3>
                        <ul className="footer-links-home">
                            {footerLinks.support.map((link) => (
                                <li key={link.label}>
                                    <a href={link.path}>{link.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Footer Bottom */}
                <div className="footer-bottom">
                    <div className="copyright">
                        © {new Date().getFullYear()} Nexus Platform. All rights reserved.
                    </div>
                    <div className="legal-links">
                        {footerLinks.legal.map((link) => (
                            <a key={link.label} href={link.path}>
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;