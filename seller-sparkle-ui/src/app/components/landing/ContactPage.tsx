import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { ContactSection } from "./ContactSection";
import { websiteContentApi } from "@/app/services/websiteContentApi";

export const ContactPage = () => {
  const { data } = useQuery({
    queryKey: ["publicWebsiteContent"],
    queryFn: () => websiteContentApi.getPublicContent(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

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
