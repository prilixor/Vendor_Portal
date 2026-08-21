import { useState } from "react";
import { Link } from "react-router-dom";
import { ContactContentDto } from "@/app/services/websiteContentApi";
import { Check } from "lucide-react";

interface ContactSectionProps {
  data?: ContactContentDto;
}

export const ContactSection = ({ data }: ContactSectionProps) => {
  const [copied, setCopied] = useState(false);

  const heroTitle = data?.heroTitle || "We are here to";
  const heroAccent = data?.heroAccent || "help.";
  const heroSub = data?.heroSub || "Reach our team directly. We respond quickly to every enquiry.";

  const phone = data?.phone || "+91 8511225390";
  const businessEmail = "info@blinksmed.com";
  const supportEmail = "support@blinksmed.in";
  const operatingHours = data?.operatingHours || "Mon – Sat, 8:00 AM – 8:00 PM IST";
  const institutionalNote =
    data?.institutionalNote ||
    "For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly.";

  const ctaTitle = data?.ctaTitle || "Ready to rent or purchase medical equipment?";
  const ctaDescription = data?.ctaDescription || "Enter the Customer Portal to browse, compare, and place your order.";
  const ctaButtonText = data?.ctaButtonText || "Get Started";
  const ctaButtonLink = data?.ctaButtonLink || "/customer/shop";

  const handleCallClick = (e: React.MouseEvent) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);
    window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
  };

  const handleEmailClick = (email: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = `mailto:${email}`;
    setTimeout(() => {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, "_blank");
    }, 300);
  };

  return (
    <section id="contact" className="scroll-target section-block reveal" style={{ position: "relative" }}>
      {copied && (
        <div className="contact-toast">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Calling {phone} · Number copied</span>
        </div>
      )}

      <div className="section-inner">
        <div className="contact-hero">
          <div className="contact-hero-copy">
            <div className="eyebrow">CONTACT US</div>
            <h2 className="display contact-display">
              {heroTitle} <span className="contact-accent">{heroAccent}</span>
            </h2>
            <p className="sub">{heroSub}</p>
          </div>
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            onClick={handleCallClick}
            title={`Call Us (${phone})`}
            aria-label={`Call ${phone}`}
            className="contact-visual"
          >
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle className="contact-ping" cx="100" cy="100" r="34" fill="none" stroke="var(--teal-mid)" strokeWidth="2" />
              <circle className="contact-ping delay" cx="100" cy="100" r="34" fill="none" stroke="var(--teal-mid)" strokeWidth="2" />
              <g className="contact-icon-float">
                <circle cx="100" cy="100" r="34" fill="var(--teal-dark)" />
                <path d="M89 92c3.5 7 8.5 12 15.5 15.5l4-4c.7-.7 1.7-1 2.5-.5 2.5 1 5 1.5 8 1.5 1.3 0 2 .8 2 2v6c0 1.3-.8 2-2 2-19 0-34-15-34-34 0-1.3.8-2 2-2h6c1.3 0 2 .8 2 2 0 3 .5 5.5 1.5 8 .3.8 0 1.8-.5 2.5l-4 4z" fill="#ffffff" transform="translate(-1,-1)" />
              </g>
            </svg>
          </a>
        </div>

        <div className="contact-cards">
          <article className="contact-card">
            <div className="contact-card-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" fill="currentColor" />
              </svg>
            </div>
            <div className="contact-card-main">
              <h4>Call Us</h4>
              <a
                className="contact-value"
                href={`tel:${phone.replace(/\s+/g, "")}`}
                onClick={handleCallClick}
              >
                {phone}
              </a>
              <div className="contact-pills">
                <a
                  className="contact-pill"
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  onClick={handleCallClick}
                >
                  Call now
                </a>
                <a
                  className="contact-pill contact-pill--ghost"
                  href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </article>

          <article className="contact-card">
            <div className="contact-card-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M4 6.5l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="contact-card-main">
              <h4>Email Us</h4>
              <div className="contact-lines">
                <div className="contact-line">
                  <span>Business</span>
                  <a
                    href={`mailto:${businessEmail}`}
                    onClick={(e) => handleEmailClick(businessEmail, e)}
                  >
                    {businessEmail}
                  </a>
                </div>
                <div className="contact-line">
                  <span>Support</span>
                  <a
                    href={`mailto:${supportEmail}`}
                    onClick={(e) => handleEmailClick(supportEmail, e)}
                  >
                    {supportEmail}
                  </a>
                </div>
              </div>
            </div>
          </article>

          <article className="contact-card">
            <div className="contact-card-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="contact-card-main">
              <h4>Business Hours</h4>
              <p className="contact-value contact-value--muted">{operatingHours}</p>
              <p className="contact-hint">We reply to calls and email during these hours.</p>
            </div>
          </article>
        </div>

        <p className="institutional-note">{institutionalNote}</p>

        <div className="cta-panel">
          <h3>{ctaTitle}</h3>
          <p>{ctaDescription}</p>
          <Link to={ctaButtonLink} className="btn btn-primary">
            {ctaButtonText}
          </Link>
        </div>
      </div>
    </section>
  );
};
