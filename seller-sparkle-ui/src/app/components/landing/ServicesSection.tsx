import { ServicesHeaderDto } from "@/app/services/websiteContentApi";

interface ServicesSectionProps {
  data?: ServicesHeaderDto;
}

const renderServiceIcon = (iconName?: string, customUrl?: string) => {
  if (customUrl) {
    return <img src={customUrl} alt="Icon" className="h-6 w-6 object-contain" />;
  }

  switch (iconName) {
    case "FlaskConical":
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M9 2h6M10 2v5l-6 11a2 2 0 002 3h12a2 2 0 002-3l-6-11V2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "Layers":
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Truck":
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M1 7h13v9H1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M14 10h4l3 3v3h-7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "Building2":
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M4 21V9l8-5 8 5v12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 21v-6h4v6M10 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "ShieldCheck":
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: "30px", height: "30px" }}>
          <path d="M2 17h20M4 17V9a2 2 0 012-2h4a2 2 0 012 2v2M12 11V9a2 2 0 012-2h4a2 2 0 012 2v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
  }
};

export const ServicesSection = ({ data }: ServicesSectionProps) => {
  const eyebrow = data?.eyebrow || "OUR SERVICES";
  const title = data?.title || "Medical equipment & ";
  const accentText = data?.accentText || "laboratory supplies.";
  const subtitle = data?.subtitle || "Rent or buy equipment. Buy lab chemicals. All in one place.";

  const defaultServices = [
    { title: "Medical Equipment", description: "Hospital beds, wheelchairs, oxygen concentrators, and more. Available for rent or purchase.", iconName: "Stethoscope" },
    { title: "Laboratory Chemicals", description: "Quality reagents and consumables for labs. Available for purchase only.", iconName: "FlaskConical" },
    { title: "Healthcare Marketplace", description: "One platform connecting customers with trusted, verified suppliers.", iconName: "Layers" },
    { title: "Delivery & Support", description: "Reliable assistance throughout the customer journey, from order to setup.", iconName: "Truck" },
    { title: "Bulk Procurement", description: "Solutions for hospitals, clinics, laboratories, and institutions.", iconName: "Building2" },
    { title: "Verified Suppliers", description: "Every supplier is vetted before they can list products on the platform.", iconName: "ShieldCheck" },
  ];

  const services = data?.services && data.services.length > 0 ? data.services : defaultServices;

  return (
    <section id="services" className="scroll-target section-block reveal">
      <div className="section-inner">
        <div className="page-banner" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h2>
            {title} <span className="accent">{accentText}</span>
          </h2>
          <p className="sub">{subtitle}</p>
        </div>

        <div className="service-grid services-3col" style={{ gap: "18px", marginTop: "40px" }}>
          {services.map((srv, idx) => (
            <article key={srv.id ?? idx} className="service-card" style={{ textAlign: "center" }}>
              <div
                className="service-icon"
                style={{ width: "64px", height: "64px", borderRadius: "16px", margin: "0 auto 18px" }}
              >
                {renderServiceIcon(srv.iconName, srv.customIconUrl)}
              </div>
              <h4>{srv.title}</h4>
              <p>{srv.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
