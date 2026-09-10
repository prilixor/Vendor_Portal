import { useEffect } from "react";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { AboutSection } from "./AboutSection";
import { usePublicWebsiteContent } from "@/app/hooks/usePublicWebsiteContent";

export const AboutPage = () => {
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

      <LandingHeader activeSection="about" settings={data?.settings} />

      <main>
        <AboutSection data={data?.about} />
      </main>

      <LandingFooter />
    </div>
  );
};

export default AboutPage;
