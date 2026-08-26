import { useEffect, useState, useRef, useCallback } from "react";
import "./landing.css";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { HeroSection } from "./HeroSection";
import { AboutSection } from "./AboutSection";
import { ServicesSection } from "./ServicesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { RentVsBuySection } from "./RentVsBuySection";
import { ContactSection } from "./ContactSection";
import { FAQSection } from "./FAQSection";
import { useQuery } from "@tanstack/react-query";
import { websiteContentApi } from "@/app/services/websiteContentApi";

const sectionIds = ["home", "about", "services", "how-it-works", "rent-or-buy", "contact"];

export const Home = () => {
  const [activeSection, setActiveSection] = useState("home");
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<number | null>(null);

  // Fetch API-driven dynamic public content
  const { data, isLoading } = useQuery({
    queryKey: ["publicWebsiteContent"],
    queryFn: () => websiteContentApi.getPublicContent(),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    retry: 1,
  });

  const handleSectionClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isClickScrollingRef.current = true;

    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
    }

    if (sectionId === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        const headerOffset = 80;
        const offsetPosition = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }

    // Lock scroll spy while smooth scroll is taking place so underline doesn't flicker
    clickTimeoutRef.current = window.setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 900);
  }, []);

  useEffect(() => {
    // Scroll reveal observer
    const revealEls = document.querySelectorAll(".reveal");
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => revealObs.observe(el));

    // ScrollSpy listener for reliable section activation on manual scroll
    const handleScrollSpy = () => {
      if (isClickScrollingRef.current) return;

      const headerOffset = 130;
      const scrollPosition = window.scrollY + headerOffset;

      // Top of page
      if (window.scrollY < 80) {
        setActiveSection("home");
        return;
      }

      // Bottom of page
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        setActiveSection("contact");
        return;
      }

      let currentSection = "home";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollPosition >= top) {
            currentSection = id;
          }
        }
      }
      setActiveSection(currentSection);
    };

    handleScrollSpy();
    window.addEventListener("scroll", handleScrollSpy, { passive: true });

    // Hash link scrolling if navigated with hash
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      if (sectionIds.includes(id)) {
        setTimeout(() => {
          handleSectionClick(id);
        }, 150);
      }
    }

    return () => {
      revealObs.disconnect();
      window.removeEventListener("scroll", handleScrollSpy);
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [handleSectionClick]);

  return (
    <div className="bm-landing-body">
      <div className="bm-bg" aria-hidden="true">
        <span className="bm-orb bm-orb--1"></span>
        <span className="bm-orb bm-orb--2"></span>
      </div>

      <LandingHeader
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
        settings={data?.settings}
      />

      <main>
        <HeroSection data={data?.home} />
        {data?.settings?.showAboutSection !== false && <AboutSection data={data?.about} />}
        {data?.settings?.showServicesSection !== false && <ServicesSection data={data?.services} />}
        {data?.settings?.showHowItWorksSection !== false && <HowItWorksSection data={data?.howItWorks} />}
        {data?.settings?.showRentVsBuySection !== false && <RentVsBuySection data={data?.rentVsBuy} />}
        {data?.settings?.showFaqSection !== false && <FAQSection faqs={data?.faqs} categoriesData={data?.faqCategories} contactData={data?.contact} />}
        {data?.settings?.showContactSection !== false && <ContactSection data={data?.contact} />}
      </main>

      <LandingFooter />
    </div>
  );
};

export default Home;
