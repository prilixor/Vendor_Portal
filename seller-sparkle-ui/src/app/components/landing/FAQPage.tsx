import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { FAQSection } from "./FAQSection";
import { websiteContentApi } from "@/app/services/websiteContentApi";

export const FAQPage = () => {
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

      <LandingHeader activeSection="faqs" settings={data?.settings} />

      <main style={{ paddingTop: "20px" }}>
        <FAQSection faqs={data?.faqs} categoriesData={data?.faqCategories} contactData={data?.contact} />
      </main>

      <LandingFooter />
    </div>
  );
};

export default FAQPage;
