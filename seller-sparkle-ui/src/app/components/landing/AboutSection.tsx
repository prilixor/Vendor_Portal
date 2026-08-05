import { AboutContentDto } from "@/app/services/websiteContentApi";

interface AboutSectionProps {
  data?: AboutContentDto;
}

const renderAudienceIcon = (iconName?: string, customUrl?: string) => {
  if (customUrl) {
    return <img src={customUrl} alt="Icon" className="h-6 w-6 object-contain" />;
  }

  switch (iconName) {
    case "Users":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 21a6 6 0 0112 0M13 21a5 5 0 018.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "Building2":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 21V9l8-5 8 5v12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 21v-6h4v6M10 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "Hospital":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 21V9l6-4 6 4v12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 21v-5h4v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "FlaskConical":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M9 2h6M10 2v5l-6 11a2 2 0 002 3h12a2 2 0 002-3l-6-11V2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "Stethoscope":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 3v6a4 4 0 008 0V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 3H4M14 3h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 13a3 3 0 11-6 0c0-2 1-3 1-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "Activity":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="7" cy="18" r="3.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="19" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 18V8h3l4 6h4M10 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Microscope":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M10 3h4v4l3 6a2 2 0 01-2 3H9a2 2 0 01-2-3l3-6V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 21h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 21a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
};

export const AboutSection = ({ data }: AboutSectionProps) => {
  const bannerTitle = data?.bannerTitle || "A simpler way to access";
  const bannerAccent = data?.bannerAccent || "healthcare products.";
  const bannerSub =
    data?.bannerSub ||
    "We exist to make sourcing healthcare products safer and more transparent, so hospitals, clinics, and families can rely on every supplier we work with.";

  const missionTitle = data?.missionTitle || "Our Mission";
  const missionText =
    data?.missionText ||
    "To make healthcare products more accessible through technology, trusted suppliers, and a seamless customer experience, removing the friction from renting, buying, and sourcing what care requires.";

  const visionTitle = data?.visionTitle || "Our Vision";
  const visionText =
    data?.visionText ||
    "To become one of the most trusted healthcare marketplaces, simplifying how medical equipment and laboratory products are accessed by individuals and institutions alike.";

  const defaultAudiences = [
    { title: "Individuals", description: "Personal access to home healthcare equipment.", iconName: "User" },
    { title: "Families", description: "Equipment for caring for a loved one at home.", iconName: "Users" },
    { title: "Hospitals", description: "Reliable equipment sourcing at institutional scale.", iconName: "Building2" },
    { title: "Clinics", description: "Flexible rental and purchase options for daily practice.", iconName: "Hospital" },
    { title: "Laboratories", description: "Trusted sourcing for laboratory chemicals.", iconName: "FlaskConical" },
    { title: "Healthcare Professionals", description: "Quick access to trusted equipment and supplies.", iconName: "Stethoscope" },
    { title: "Rehabilitation Centers", description: "Mobility and recovery equipment, rented or bought.", iconName: "Activity" },
    { title: "Research Organizations", description: "Consistent supply of laboratory-grade chemicals.", iconName: "Microscope" },
  ];

  const audiences = data?.audiences && data.audiences.length > 0 ? data.audiences : defaultAudiences;

  return (
    <section id="about" className="scroll-target section-block cream reveal">
      <div className="page-banner">
        <div className="eyebrow">ABOUT US</div>
        <h2>
          {bannerTitle} <span className="accent">{bannerAccent}</span>
        </h2>
        <p className="sub">{bannerSub}</p>
      </div>

      <div className="section-inner" style={{ paddingTop: "24px" }}>
        {/* MISSION & VISION */}
        <div className="compare">
          <div className="compare-card">
            <h4>{missionTitle}</h4>
            <p style={{ color: "var(--gray-600)", lineHeight: "1.6" }}>{missionText}</p>
          </div>
          <div className="compare-card">
            <h4>{visionTitle}</h4>
            <p style={{ color: "var(--gray-600)", lineHeight: "1.6" }}>{visionText}</p>
          </div>
        </div>

        {/* WHO WE SERVE */}
        <div className="services-head" style={{ marginTop: "24px" }}>
          <h3>
            Who we <span className="accent" style={{ color: "var(--teal-mid)", fontStyle: "italic" }}>serve.</span>
          </h3>
        </div>
        <div className="service-grid">
          {audiences.map((item, idx) => (
            <article key={item.id ?? idx} className="service-card">
              <div className="service-icon">{renderAudienceIcon(item.iconName, item.customIconUrl)}</div>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
