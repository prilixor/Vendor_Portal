import { useEffect } from "react";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { FAQSection } from "./FAQSection";

export const FAQPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    const revealEls = document.querySelectorAll(".reveal");
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }, []);

  return (
    <div className="bm-landing-body">
      <div className="bm-bg" aria-hidden="true">
        <span className="bm-orb bm-orb--1"></span>
        <span className="bm-orb bm-orb--2"></span>
      </div>

      <LandingHeader activeSection="faqs" />

      <main style={{ paddingTop: "20px" }}>
        <FAQSection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default FAQPage;
