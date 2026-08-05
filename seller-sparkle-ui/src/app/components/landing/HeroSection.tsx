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
          <div className="hero-image flex items-center justify-center p-4 md:p-6" aria-hidden="true">
            {data?.heroImageUrl ? (
              <div className="relative w-full h-full min-h-[260px] max-h-[520px] flex items-center justify-center overflow-hidden rounded-2xl">
                <img
                  src={data.heroImageUrl}
                  alt="Hero Banner"
                  className="w-full h-full max-h-[480px] object-contain rounded-2xl shadow-sm border border-black/5 transition-all duration-300"
                />
              </div>
            ) : (
              <svg viewBox="0 0 800 640" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f3ebe0" />
                    <stop offset="100%" stopColor="#e9dcc8" />
                  </linearGradient>
                  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e2cfb2" />
                    <stop offset="100%" stopColor="#d3b98f" />
                  </linearGradient>
                </defs>
                <rect width="800" height="460" fill="url(#wall)" />
                <rect y="460" width="800" height="180" fill="url(#floor)" />
                <rect x="40" y="60" width="220" height="340" rx="6" fill="#f7f2ea" opacity="0.6" />
                <g transform="translate(120,330)">
                  <path d="M20 40 Q10 -20 70 -30 Q130 -20 120 40 L120 90 L20 90 Z" fill="#efe6d3" stroke="#cbb894" strokeWidth="3" />
                  <rect x="20" y="90" width="480" height="70" rx="10" fill="#1a6b56" />
                  <rect x="30" y="150" width="470" height="20" rx="6" fill="#d8c6a4" />
                </g>
              </svg>
            )}
          </div>
        </div>

        <div className="service-grid services-3col" style={{ marginTop: "16px" }}>
          {features.map((feat, idx) => (
            <article key={feat.id ?? idx} className="service-card">
              <div className="service-icon">
                {renderFeatureIcon(feat.iconName, feat.customIconUrl)}
              </div>
              <h4 style={{ fontSize: "16px", fontWeight: "700", marginTop: "16px", marginBottom: "6px", color: "var(--ink)" }}>
                {feat.title}
              </h4>
              <p style={{ fontSize: "13.5px", color: "var(--gray-600)", lineHeight: "1.5", margin: 0 }}>
                {feat.subtitle}
              </p>
            </article>
          ))}
        </div>
      </div>
      <div className="trust">
        <div className="trust-label">{trustLabel}</div>
      </div>
    </div>
  );
};
