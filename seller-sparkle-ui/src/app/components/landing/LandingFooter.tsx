import { Link } from "react-router-dom";
import { MessageCircle, Phone, Mail } from "lucide-react";

export const LandingFooter = () => {
  const handleEmailClick = (email: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = `mailto:${email}`;
    setTimeout(() => {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank');
    }, 300);
  };

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <h5>Company</h5>
          <Link to="/about">About</Link>
          <a href="/#how-it-works">How It Works</a>
          <Link to="/contact">Contact</Link>
        </div>
        <div className="footer-col">
          <h5>Solutions</h5>
          <a href="/#services">Medical Equipment</a>
          <a href="/#services">Laboratory Chemicals</a>
          <a href="/#rent-or-buy">Rent vs Buy</a>
        </div>
        <div className="footer-col">
          <h5>Support</h5>
          <Link to="/faq">FAQs</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
        </div>
        <div className="footer-col">
          <h5>Portal</h5>
          <Link to="/customer/shop">Customer Portal</Link>
        </div>
        <div className="footer-col">
          <h5>Contact Us</h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            <a
              href="https://wa.me/918511225390"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-contact-item"
              style={{ color: "#25d366", fontWeight: 600 }}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>WhatsApp: +91 8511225390</span>
            </a>

            <a
              href="tel:+918511225390"
              className="footer-contact-item"
              style={{ color: "#ffffff", fontWeight: 600 }}
            >
              <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--teal-accent)" }} />
              <span>Call: +91 8511225390</span>
            </a>

            <a
              href="mailto:info@blinksmed.com"
              onClick={(e) => handleEmailClick("info@blinksmed.com", e)}
              className="footer-contact-item"
              style={{ cursor: "pointer" }}
            >
              <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--teal-accent)" }} />
              <span>Business: info@blinksmed.com</span>
            </a>

            <a
              href="mailto:support@blinksmed.in"
              onClick={(e) => handleEmailClick("support@blinksmed.in", e)}
              className="footer-contact-item"
              style={{ cursor: "pointer" }}
            >
              <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--teal-accent)" }} />
              <span>Support: support@blinksmed.in</span>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div>© BlinksMed. Simplified healthcare for everyone.</div>
        <div>Medical equipment rental · Buy medical equipment · Laboratory supplies</div>
      </div>
    </footer>
  );
};
