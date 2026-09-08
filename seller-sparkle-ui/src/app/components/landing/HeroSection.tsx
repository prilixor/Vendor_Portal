import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HomeContentDto } from "@/app/services/websiteContentApi";
import { cn } from "@/app/helpers/utils";

interface HeroSectionProps {
  data?: HomeContentDto;
  /** True after the public CMS query has resolved at least once. */
  cmsReady?: boolean;
}

const PRODUCT_HERO_SLIDES = [
  { src: "/branding/blinksmed-hero-equipment.jpg", label: "Hospital equipment" },
  { src: "/branding/blinksmed-hero-homecare.jpg", label: "Home care rentals" },
  { src: "/branding/blinksmed-hero-lab.jpg", label: "Laboratory chemicals" },
] as const;

const HERO_FADE_MS = 1400;
const HERO_HOLD_MS = 5200;

type HeroSlide = { src: string; label: string };

function HeroProductShowcase({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || slides.length < 2) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, HERO_HOLD_MS + HERO_FADE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, slides.length]);

  useEffect(() => {
    slides.forEach((slide) => {
      const img = new Image();
      img.src = slide.src;
    });
  }, [slides]);

  useEffect(() => {
    setActive(0);
  }, [slides]);

  return (
    <div className="hero-showcase">
      {slides.map((slide, index) => (
        <figure
          key={`${slide.src}-${slide.label}-${index}`}
          className={cn("hero-showcase-slide", index === active && "is-active")}
        >
          <img src={slide.src} alt="" className="hero-photo is-ready" decoding="async" />
        </figure>
      ))}
      <div className="hero-showcase-veil" />
      <p className="hero-showcase-caption">{slides[active]?.label}</p>
    </div>
  );
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

export const HeroSection = ({ data, cmsReady = false }: HeroSectionProps) => {
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
  const slides = useMemo(() => {
    const cmsSlides = (data?.heroSlides ?? [])
      .filter((s) => s.imageUrl && s.label?.trim())
      .slice(0, 5)
      .map((s) => ({ src: s.imageUrl, label: s.label.trim() }));
    return cmsSlides.length > 0 ? cmsSlides : [...PRODUCT_HERO_SLIDES];
  }, [data?.heroSlides]);

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
            <HeroProductShowcase slides={slides} />
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
