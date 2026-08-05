import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaqCategoryDto, FaqItemDto, ContactContentDto } from "@/app/services/websiteContentApi";
import { ChevronDown, HelpCircle, Phone, Mail, Search } from "lucide-react";

interface FAQSectionProps {
  faqs?: FaqItemDto[];
  categoriesData?: FaqCategoryDto[];
  contactData?: ContactContentDto;
}

interface RenderCategory {
  id: string;
  title: string;
  items: { question: string; answer: string }[];
}

const defaultFaqData: RenderCategory[] = [
  {
    id: "renting",
    title: "Renting Medical Equipment",
    items: [
      {
        question: "How do I know whether I should rent or buy medical equipment?",
        answer: "It depends on how long you'll need the equipment. If it's for short-term recovery or rehabilitation, renting is often the most practical choice. For long-term or permanent use, purchasing may be more suitable. Our platform helps you explore the best option based on your needs.",
      },
      {
        question: "Which medical equipment is available for rent?",
        answer: "We offer a wide range of medical equipment on weekly and monthly rental plans, including hospital beds, wheelchairs, oxygen concentrators, patient lifts, rehabilitation equipment, and more. Availability may vary by location.",
      },
      {
        question: "What rental durations do you offer?",
        answer: "Medical equipment can be rented on a weekly or monthly basis, depending on your requirements and the product's availability.",
      },
      {
        question: "What happens if I need the equipment for a longer period?",
        answer: "No problem. You can request an extension before your rental period ends, and we'll help you continue the rental based on availability.",
      },
      {
        question: "How do I return rented equipment?",
        answer: "Once your rental period is complete, simply schedule a pickup through our support team. We'll arrange collection at your convenience.",
      },
    ],
  },
  {
    id: "purchasing",
    title: "Purchasing Medical Equipment",
    items: [
      {
        question: "Can I purchase the equipment instead of renting it?",
        answer: "Yes. Many of our medical equipment products are also available for purchase. If buying is a better option for a particular product, you'll be able to see that directly while browsing.",
      },
      {
        question: "Do purchased products come with a warranty?",
        answer: "Yes. Purchased medical equipment includes manufacturer warranty coverage where applicable, along with details on what's covered at the time of order.",
      },
      {
        question: "Are your medical products certified and genuine?",
        answer: "Yes. We supply genuine medical equipment and chemicals sourced from trusted manufacturers and authorized suppliers.",
      },
      {
        question: "How do I choose the right medical equipment?",
        answer: "Each product includes detailed specifications and recommended use cases. If you're unsure, our experts can help you select the most suitable equipment based on your medical needs.",
      },
    ],
  },
  {
    id: "chemicals",
    title: "Laboratory Chemicals",
    items: [
      {
        question: "Do you rent laboratory chemicals?",
        answer: "No. All laboratory and industrial chemicals are available for purchase only. Chemicals are never offered on rent due to safety and regulatory requirements.",
      },
      {
        question: "Are laboratory chemicals safe to handle and transport?",
        answer: "Yes. All chemicals are sourced from authorized suppliers and packaged to meet safety and regulatory standards for secure handling and transport.",
      },
      {
        question: "How are laboratory chemicals packaged?",
        answer: "All chemicals are packed according to safety standards using appropriate containers and labels to ensure secure transportation and storage.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery & Support",
    items: [
      {
        question: "Are the rental medical equipment sanitized before delivery?",
        answer: "Absolutely. Every rental item is thoroughly cleaned, sanitized, inspected, and tested before it reaches you to ensure safety and hygiene.",
      },
      {
        question: "Is installation included with rented equipment?",
        answer: "Yes. For equipment that requires setup, our team will install it and explain how to use it safely at the time of delivery.",
      },
      {
        question: "What if the equipment stops working during my rental?",
        answer: "If you experience any technical issue during the rental period, contact our support team immediately. We'll inspect the equipment and arrange a repair or replacement if required.",
      },
      {
        question: "Do you deliver to my location?",
        answer: "We provide delivery across our serviceable areas. Enter your location during the inquiry or checkout process to check availability.",
      },
      {
        question: "How quickly can my order be delivered?",
        answer: "Delivery timelines depend on product availability and your location. Our team will provide an estimated delivery schedule once your order is confirmed.",
      },
      {
        question: "How do I know if a product is available in my city?",
        answer: "Simply enter your delivery location or contact our team to check product availability in your area.",
      },
      {
        question: "How can I contact BlinksMed if I need assistance?",
        answer: "You can reach our support team by phone or email. We're here to help you choose the right products and answer any questions before or after your order.",
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & Payments",
    items: [
      {
        question: "Can I place an order online?",
        answer: "Yes. You can browse products, compare options, and submit your purchase or rental request directly through the Customer Portal.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept multiple secure payment methods, including UPI, credit cards, debit cards, net banking, and other supported online payment options.",
      },
      {
        question: "Can businesses, hospitals, and clinics order in bulk?",
        answer: "Yes. We support bulk orders for hospitals, clinics, laboratories, healthcare institutions, and corporate customers. Please contact our sales team for customized pricing.",
      },
      {
        question: "Can I return medical equipment or chemicals after purchase?",
        answer: "Return eligibility depends on the product category and condition. Due to safety regulations, certain products and chemicals may not be eligible for return once delivered. Please review our return policy or contact our team for assistance.",
      },
    ],
  },
];

export const FAQSection = ({ faqs, categoriesData, contactData }: FAQSectionProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const phone = "+91 8511225390";
  const email = "info@blinksmed.com";

  const handleEmailClick = (emailAddress: string, e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = `mailto:${emailAddress}`;
    setTimeout(() => {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${emailAddress}`, '_blank');
    }, 300);
  };

  let renderedCategories: RenderCategory[] = defaultFaqData;

  if (faqs && faqs.length > 0) {
    const published = faqs.filter((f) => f.isPublished);
    const catMap = new Map<string, { title: string; items: { question: string; answer: string }[] }>();

    published.forEach((item) => {
      const cName = item.categoryName || "General";
      if (!catMap.has(cName)) {
        catMap.set(cName, { title: cName, items: [] });
      }
      catMap.get(cName)!.items.push({ question: item.question, answer: item.answer });
    });

    renderedCategories = Array.from(catMap.entries()).map(([cName, val], i) => ({
      id: `cat_${i}`,
      title: val.title,
      items: val.items,
    }));
  }

  const filteredCategories = renderedCategories
    .map((category) => {
      const matchingItems = category.items.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
      });
      return {
        ...category,
        items: matchingItems,
      };
    })
    .filter((category) => category.items.length > 0);

  // Default active category to first available
  useEffect(() => {
    if (filteredCategories.length > 0) {
      if (!activeCategoryId || !filteredCategories.some((c) => c.id === activeCategoryId)) {
        setActiveCategoryId(filteredCategories[0].id);
      }
    }
  }, [filteredCategories, activeCategoryId]);

  const toggleItem = (itemKey: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const activeCategory =
    filteredCategories.find((c) => c.id === activeCategoryId) || filteredCategories[0];

  const hasResults = filteredCategories.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <section id="faqs" className="scroll-target section-block">
      <div className="section-inner reveal">
        <div className="eyebrow" style={{ justifyContent: "center" }}>
          FREQUENTLY ASKED QUESTIONS
        </div>
        <h2 className="display" style={{ fontSize: "clamp(32px,4vw,44px)", fontWeight: 400, textAlign: "center" }}>
          Answers when you need <span style={{ color: "var(--teal-mid)", fontStyle: "italic" }}>clarity.</span>
        </h2>
        <p className="sub" style={{ textAlign: "center", marginLeft: "auto", marginRight: "auto", maxWidth: "720px", textWrap: "balance" }}>
          Rentals, purchases, chemicals, delivery, and support: everything in one place.
        </p>

        {/* Search Bar */}
        <div className="faq-search-wrap">
          <input
            type="text"
            id="faqSearch"
            className="faq-search-input"
            placeholder="Search questions… e.g. wheelchair, oxygen, delivery, payment"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Left & Right Split Q&A Layout */}
        {hasResults ? (
          <div className="faq-split-layout">
            {/* Left Category Menu */}
            <div className="faq-left-menu">
              {filteredCategories.map((cat) => {
                const isActive = cat.id === activeCategory?.id;
                return (
                  <button
                    key={cat.id}
                    className={`faq-category-btn ${isActive ? "active" : ""}`}
                    onClick={() => setActiveCategoryId(cat.id)}
                  >
                    <span>{cat.title}</span>
                    <span className="faq-category-count">{cat.items.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Q&A Content Panel */}
            <div className="faq-right-content">
              {isSearching ? (
                // Searching mode: show matching questions across matching categories
                filteredCategories.map((cat) => (
                  <div key={cat.id} className="space-y-3 mb-6">
                    <div className="faq-active-header">
                      <h3>{cat.title}</h3>
                    </div>
                    {cat.items.map((item, idx) => {
                      const itemKey = `${cat.id}_${idx}`;
                      const isOpen = openItems[itemKey] ?? true; // Open matches by default
                      return (
                        <div key={idx} className={`faq-qa-card ${isOpen ? "is-open" : ""}`}>
                          <button className="faq-qa-question" onClick={() => toggleItem(itemKey)}>
                            <span>{item.question}</span>
                            <span className="faq-qa-icon">
                              <ChevronDown className="w-4 h-4" />
                            </span>
                          </button>
                          {isOpen && <div className="faq-qa-answer">{item.answer}</div>}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                // Normal mode: show active category questions
                activeCategory && (
                  <div>
                    <div className="faq-active-header">
                      <h3>{activeCategory.title}</h3>
                    </div>
                    <div className="space-y-3">
                      {activeCategory.items.map((item, idx) => {
                        const itemKey = `${activeCategory.id}_${idx}`;
                        const isOpen = openItems[itemKey] ?? idx === 0; // First item open by default
                        return (
                          <div key={idx} className={`faq-qa-card ${isOpen ? "is-open" : ""}`}>
                            <button className="faq-qa-question" onClick={() => toggleItem(itemKey)}>
                              <span>{item.question}</span>
                              <span className="faq-qa-icon">
                                <ChevronDown className="w-4 h-4" />
                              </span>
                            </button>
                            {isOpen && <div className="faq-qa-answer">{item.answer}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <p className="faq-empty-state" style={{ display: "block" }}>
            No questions match your search. Try a different keyword, or contact us directly below.
          </p>
        )}

        {/* CTA Panel */}
        <div className="cta-panel">
          <h3>Still need help?</h3>
          <p>Can't find what you're looking for? Reach out directly and we'll answer any question.</p>
          <div className="btn-row" style={{ justifyContent: "center", marginTop: "20px" }}>
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="btn btn-secondary"
              style={{ background: "transparent", color: "var(--white)", borderColor: "rgba(255,255,255,0.4)" }}
            >
              Call {phone}
            </a>
            <a
              href={`mailto:${email}`}
              onClick={(e) => handleEmailClick(email, e)}
              className="btn btn-secondary"
              style={{ background: "transparent", color: "var(--white)", borderColor: "rgba(255,255,255,0.4)", cursor: "pointer" }}
            >
              Email Us
            </a>
            <Link to="/customer/shop" className="btn btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
