import { useState } from "react";
import { RentVsBuyContentDto } from "@/app/services/websiteContentApi";
import { HelpCircle, ChevronRight, ArrowRight, CalendarRange, Building } from "lucide-react";

interface RentVsBuySectionProps {
  data?: RentVsBuyContentDto;
}

export const RentVsBuySection = ({ data }: RentVsBuySectionProps) => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const eyebrow = data?.eyebrow || "RENT OR BUY";
  const title = data?.title || "Choose what fits your";
  const accentText = data?.accentText || "care timeline.";
  const subtitle =
    data?.subtitle ||
    "Rent medical equipment on weekly or monthly plans for shorter recovery periods. Buy when long-term ownership is the practical choice. We help you compare options without making it confusing.";

  const features = data?.features && data.features.length > 0 ? data.features : [
    { id: "1", featureLabel: "Upfront cost", weeklyValue: "Lowest", monthlyValue: "Low", purchaseValue: "Full price" },
    { id: "2", featureLabel: "Ownership", weeklyValue: "No", monthlyValue: "No", purchaseValue: "Yes" },
    { id: "3", featureLabel: "Maintenance", weeklyValue: "Included", monthlyValue: "Included", purchaseValue: "Buyer's responsibility" },
    { id: "4", featureLabel: "Best for", weeklyValue: "Short recovery", monthlyValue: "Extended recovery", purchaseValue: "Long-term or institutional use" },
  ];

  const cards = data?.cards && data.cards.length > 0 ? data.cards : [
    { id: "1", title: "When should I rent?", description: "For recovery, rehabilitation, or any short-to-medium term need where flexibility matters more than ownership." },
    { id: "2", title: "When should I buy?", description: "For ongoing or chronic care, or when institutions need equipment on a permanent basis." },
  ];

  const activeCard = cards[activeCardIndex] || cards[0];

  return (
    <section id="rent-or-buy" className="scroll-target section-block cream reveal">
      <div className="section-inner">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="display" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", fontSize: "40px", fontWeight: 400 }}>
          {title} <span style={{ color: "var(--teal-mid)", fontStyle: "italic" }}>{accentText}</span>
        </h2>
        <p className="sub" style={{ maxWidth: "640px" }}>
          {subtitle}
        </p>

        {/* Feature Comparison Table */}
        <table className="rent-table">
          <thead>
            <tr>
              <th>&nbsp;</th>
              <th>Weekly rental</th>
              <th>Monthly rental</th>
              <th>Purchase</th>
            </tr>
          </thead>
          <tbody>
            {features.map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td>{item.featureLabel}</td>
                <td>{item.weeklyValue}</td>
                <td>{item.monthlyValue}</td>
                <td>{item.purchaseValue}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Standalone Decision Making Box */}
        <div className="rent-decision-row">
          <div className="rent-decision-grid">
            <div className="rent-decision-card">
              <div className="rent-decision-left">
                <span className="rent-decision-icon rental-icon">
                  <CalendarRange className="w-5 h-5" />
                </span>
                <div className="rent-decision-text">
                  <span className="rent-decision-tag">Short-term use</span>
                  <span className="rent-decision-title">Temporary Need</span>
                </div>
              </div>
              <div className="rent-decision-arrow">
                <ArrowRight className="w-4 h-4" />
              </div>
              <div className="rent-decision-result rental-badge">
                Rental
              </div>
            </div>

            <div className="rent-decision-card">
              <div className="rent-decision-left">
                <span className="rent-decision-icon purchase-icon">
                  <Building className="w-5 h-5" />
                </span>
                <div className="rent-decision-text">
                  <span className="rent-decision-tag">Long-term use</span>
                  <span className="rent-decision-title">Permanent Care</span>
                </div>
              </div>
              <div className="rent-decision-arrow">
                <ArrowRight className="w-4 h-4" />
              </div>
              <div className="rent-decision-result purchase-badge">
                Purchase
              </div>
            </div>
          </div>
        </div>

        {/* Left & Right Q&A Split Layout */}
        <div className="faq-split-layout" style={{ marginTop: "20px" }}>
          {/* Left Questions Menu */}
          <div className="faq-left-menu">
            {cards.map((card, idx) => {
              const isActive = idx === activeCardIndex;
              return (
                <button
                  key={card.id ?? idx}
                  className={`faq-category-btn ${isActive ? "active" : ""}`}
                  onClick={() => setActiveCardIndex(idx)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <HelpCircle className="w-4 h-4 opacity-75 shrink-0" />
                    <span>{card.title}</span>
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? "translate-x-1" : "opacity-40"}`} />
                </button>
              );
            })}
          </div>

          {/* Right Q&A Content Panel */}
          <div className="faq-right-content">
            {activeCard && (
              <div className="faq-qa-card is-open" style={{ padding: "24px 28px" }}>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "8px", height: "24px", background: "var(--teal-mid)", borderRadius: "4px", display: "inline-block" }}></span>
                  {activeCard.title}
                </h3>
                <p style={{ color: "var(--gray-600)", lineHeight: "1.65", fontSize: "15px", margin: 0 }}>
                  {activeCard.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
