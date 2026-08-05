import { HowItWorksSectionDto, HowItWorksStepDto } from "@/app/services/websiteContentApi";
import {
  UserCheck,
  Search,
  CheckCircle2,
  ShoppingBag,
  Truck,
  Stethoscope,
  FlaskConical,
  Building2,
  Wrench,
} from "lucide-react";

interface HowItWorksSectionProps {
  data?: HowItWorksSectionDto;
}

const DEFAULT_STEPS: HowItWorksStepDto[] = [
  {
    stepNumber: 1,
    title: "Create an Account",
    description: "Sign up on the Customer Portal in minutes.",
    iconName: "UserCheck",
    sortOrder: 1,
    isActive: true,
  },
  {
    stepNumber: 2,
    title: "Browse Solutions",
    description: "Explore equipment and chemical categories.",
    iconName: "Search",
    sortOrder: 2,
    isActive: true,
  },
  {
    stepNumber: 3,
    title: "Choose Rent or Buy",
    description: "Pick the option that fits your timeline.",
    iconName: "CheckCircle2",
    sortOrder: 3,
    isActive: true,
  },
  {
    stepNumber: 4,
    title: "Place Your Order",
    description: "Confirm details and complete secure payment.",
    iconName: "ShoppingBag",
    sortOrder: 4,
    isActive: true,
  },
  {
    stepNumber: 5,
    title: "Delivery & Support",
    description: "We deliver, set up, and stay reachable.",
    iconName: "Truck",
    sortOrder: 5,
    isActive: true,
  },
];

export const HowItWorksSection = ({ data }: HowItWorksSectionProps) => {
  const eyebrow = data?.header?.eyebrow || "HOW IT WORKS";
  const title = data?.header?.title || "From browsing to ";
  const accentText = data?.header?.accentText || "delivery.";
  const subtitle = data?.header?.subtitle || "Five simple steps to get the equipment and supplies you need.";

  const rawSteps = data?.steps && data.steps.length > 0 ? data.steps : DEFAULT_STEPS;
  const activeSteps = rawSteps
    .filter((s) => s.isActive !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const renderStepIcon = (iconName?: string, customUrl?: string) => {
    if (customUrl) {
      return (
        <img
          src={customUrl}
          alt="step icon"
          style={{ width: "28px", height: "28px", objectFit: "contain" }}
        />
      );
    }

    switch (iconName) {
      case "UserCheck":
        return <UserCheck style={{ width: "24px", height: "24px" }} />;
      case "Search":
        return <Search style={{ width: "24px", height: "24px" }} />;
      case "CheckCircle2":
        return <CheckCircle2 style={{ width: "24px", height: "24px" }} />;
      case "ShoppingBag":
        return <ShoppingBag style={{ width: "24px", height: "24px" }} />;
      case "Truck":
        return <Truck style={{ width: "24px", height: "24px" }} />;
      case "Stethoscope":
        return <Stethoscope style={{ width: "24px", height: "24px" }} />;
      case "FlaskConical":
        return <FlaskConical style={{ width: "24px", height: "24px" }} />;
      case "Building2":
        return <Building2 style={{ width: "24px", height: "24px" }} />;
      default:
        return <Wrench style={{ width: "24px", height: "24px" }} />;
    }
  };

  return (
    <section id="how-it-works" className="scroll-target section-block cream reveal">
      <div className="section-inner">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="display" style={{ fontSize: "clamp(32px,4vw,44px)", fontWeight: 400 }}>
          {title}
          {accentText && (
            <span style={{ color: "var(--teal-mid)", fontStyle: "italic", marginLeft: title.endsWith(" ") ? "0" : "6px" }}>
              {accentText}
            </span>
          )}
        </h2>
        <p className="sub">{subtitle}</p>

        <div
          className="service-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
            gap: "16px",
            marginTop: "48px",
          }}
        >
          {activeSteps.map((step, idx) => (
            <article key={step.id || idx} className="service-card" style={{ textAlign: "center" }}>
              <div
                className="service-icon"
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {renderStepIcon(step.iconName, step.customIconUrl)}
              </div>
              <h4>
                {idx + 1}. {step.title}
              </h4>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
