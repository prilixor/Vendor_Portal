import { useEffect } from "react";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { ContactSection } from "./ContactSection";

export const ContactPage = () => {
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

      <LandingHeader activeSection="contact" />

      <main style={{ paddingTop: "20px" }}>
        <ContactSection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default ContactPage;
