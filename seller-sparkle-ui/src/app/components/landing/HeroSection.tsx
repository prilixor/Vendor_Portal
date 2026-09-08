import { Link } from "react-router-dom";
import { HomeContentDto } from "@/app/services/websiteContentApi";
import { ShieldCheck, CalendarRange, Headphones, Sparkles } from "lucide-react";

interface HeroSectionProps {
  data?: HomeContentDto;
}

const renderFeatureIcon = (iconName?: string, customUrl?: string) => {
  if (customUrl) {
    return <img src={customUrl} alt="Icon" className="h-6 w-6 object-contain" />;
  }

  switch (iconName) {
    case "CalendarRange":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9.5h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.5 14l2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Headphones":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="2.5" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="17.5" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M19.5 19v1a2 2 0 01-2 2h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      // ShieldCheck / default
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
};

export const HeroSection = ({ data }: HeroSectionProps) => {
  const heroTitle = data?.heroTitle || "A trusted marketplace for";
  const heroAccent = data?.heroAccent || "medical equipment & supplies.";
  const heroSubtitle =
    data?.heroSubtitle ||
    "BlinksMed connects you with verified suppliers to rent or purchase medical equipment and source laboratory chemicals, all through one simple, trusted platform. Delivery, setup, and expert support are included at every step.";

  const primaryCtaLabel = data?.primaryCtaLabel || "Get Started";
  const primaryCtaLink = data?.primaryCtaLink || "/customer/shop";
  const secondaryCtaLabel = data?.secondaryCtaLabel || "Learn How It Works";
  const secondaryCtaLink = data?.secondaryCtaLink || "#how-it-works";
  const trustLabel = data?.trustLabel || "TRUSTED BY HEALTHCARE PROFESSIONALS, CLINICS, HOSPITALS & LABORATORIES";

  const defaultFeatures = [
    { title: "Verified Suppliers", subtitle: "Every partner vetted for quality", iconName: "ShieldCheck" },
    { title: "Flexible Rental Options", subtitle: "Weekly, monthly, or ownership", iconName: "CalendarRange" },
    { title: "Expert Customer Support", subtitle: "Guidance at every step", iconName: "Headphones" },
  ];

  const features = data?.features && data.features.length > 0 ? data.features : defaultFeatures;

  return (
    <div id="home" className="scroll-target">
      <div className="hero-wrap">
        <div className="hero hero-animate">
          <div className="hero-copy">
            <h1 className="display-head">
              {heroTitle}<br />
              <span className="accent">{heroAccent}</span>
            </h1>
            <p className="sub">{heroSubtitle}</p>
            <div className="btn-row">
              <Link to={primaryCtaLink} className="btn btn-primary">
                {primaryCtaLabel}
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href={secondaryCtaLink} className="btn btn-secondary">
                {secondaryCtaLabel}
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
          <div className="hero-image" aria-hidden="true">
            {data?.heroImageUrl ? (
              <img
                src={data.heroImageUrl}
                alt=""
                className="hero-photo"
              />
            ) : (
              <svg className="hero-photo" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="heroNavy" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#012363" />
                    <stop offset="100%" stopColor="#052a72" />
                  </linearGradient>
                  <linearGradient id="heroGlow" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3fa40b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3fa40b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect width="800" height="520" fill="url(#heroNavy)" />
                <rect width="800" height="520" fill="url(#heroGlow)" />
                <g fill="none" stroke="#9ad15a" strokeWidth="10" opacity="0.85">
                  <circle cx="250" cy="250" r="118" />
                  <circle cx="250" cy="250" r="78" strokeWidth="6" opacity="0.55" />
                </g>
                <rect x="430" y="88" width="280" height="168" rx="14" fill="#0a3a8a" stroke="#7ec63a" strokeWidth="2" />
                <rect x="448" y="108" width="244" height="20" rx="6" fill="#3fa40b" opacity="0.85" />
                <rect x="448" y="140" width="180" height="10" rx="4" fill="#cfe7b6" opacity="0.7" />
                <rect x="448" y="160" width="210" height="10" rx="4" fill="#cfe7b6" opacity="0.45" />
                <rect x="448" y="180" width="140" height="10" rx="4" fill="#cfe7b6" opacity="0.45" />
                <rect x="448" y="208" width="88" height="24" rx="12" fill="#3fa40b" />
                <rect x="546" y="208" width="72" height="24" rx="12" fill="#ffffff" opacity="0.18" />
                <rect x="430" y="280" width="130" height="150" rx="12" fill="#0a3a8a" />
                <rect x="580" y="280" width="130" height="150" rx="12" fill="#0a3a8a" />
                <path d="M495 310v80M445 350h100" stroke="#3fa40b" strokeWidth="6" strokeLinecap="round" />
                <circle cx="645" cy="355" r="28" fill="none" stroke="#9ad15a" strokeWidth="6" />
                <text x="448" y="126" fill="#ffffff" fontSize="13" fontFamily="Inter, Arial, sans-serif" fontWeight="700">BLINKSMED</text>
              </svg>
            )}
          </div>
        </div>

        <div className="service-grid services-3col hero-features">
          {features.map((feat, idx) => (
            <article key={feat.id ?? idx} className="service-card">
              <div className="service-icon">
                {renderFeatureIcon(feat.iconName, feat.customIconUrl)}
              </div>
              <h4>
                {feat.title}
              </h4>
              <p>
                {feat.subtitle}
              </p>
            </article>
          ))}
        </div>
        <div className="trust">
          <div className="trust-label">{trustLabel}</div>
        </div>
      </div>
    </div>
  );
};
