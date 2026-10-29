import { useEffect } from "react";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { ContactSection } from "./ContactSection";
import { usePublicWebsiteContent } from "@/app/hooks/usePublicWebsiteContent";

export const ContactPage = () => {
  const { data } = usePublicWebsiteContent();

  useEffect(() => {
    window.scrollTo(0, 0);
    const revealEls = document.querySelectorAll(".reveal");
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }, [data]);

  return (
    <div className="bm-landing-body">
      <div className="bm-bg" aria-hidden="true">
        <span className="bm-orb bm-orb--1"></span>
        <span className="bm-orb bm-orb--2"></span>
      </div>

      <LandingHeader activeSection="contact" settings={data?.settings} />

      <main className="contact-page-main">
        <ContactSection data={data?.contact} />
      </main>

      <LandingFooter />
    </div>
  );
};

export default ContactPage;
