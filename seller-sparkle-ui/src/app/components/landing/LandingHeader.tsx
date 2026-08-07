import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/app/components/shared/BrandMark";
import { WebsiteSettingsDto } from "@/app/services/websiteContentApi";

interface LandingHeaderProps {
  activeSection?: string;
  onSectionClick?: (sectionId: string) => void;
  settings?: WebsiteSettingsDto;
}

export const LandingHeader = ({ activeSection = "home", onSectionClick, settings }: LandingHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const isHomePath = location.pathname === "/";

  const getNavClass = (sectionId: string, pagePath?: string) => {
    if (isHomePath) {
      return activeSection === sectionId ? "nav-link active" : "nav-link";
    }
    if (pagePath && location.pathname === pagePath) {
      return "nav-link active";
    }
    return "nav-link";
  };

  const handleNavClick = (e: React.MouseEvent, sectionId: string, pagePath?: string) => {
    setIsMobileMenuOpen(false);
    if (isHomePath) {
      e.preventDefault();
      if (onSectionClick) {
        onSectionClick(sectionId);
      }
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (pagePath && location.pathname === pagePath) {
      // Stay on page
    } else {
      e.preventDefault();
      navigate(`/#${sectionId}`);
    }
  };

  return (
    <header className={`site-header ${isScrolled ? "is-scrolled" : ""}`} id="siteHeader">
      <Link to="/" className="logo" id="logoHome" onClick={() => setIsMobileMenuOpen(false)} aria-label="BlinksMed home">
        {/* Full lockup already includes BLINKSMED + Buy | Rent | Care */}
        <BrandMark size="lg" className="logo-mark shadow-none h-14 w-14 sm:h-16 sm:w-16" />
      </Link>

      <nav className={`main-nav ${isMobileMenuOpen ? "is-open" : ""}`} aria-label="Primary">
        <a href="/#home" className={getNavClass("home", "/")} onClick={(e) => handleNavClick(e, "home", "/")}>
          Home
        </a>
        {settings?.showAboutSection !== false && (
          <a href="/#about" className={getNavClass("about", "/about")} onClick={(e) => handleNavClick(e, "about", "/about")}>
            About Us
          </a>
        )}
        {settings?.showServicesSection !== false && (
          <a href="/#services" className={getNavClass("services")} onClick={(e) => handleNavClick(e, "services")}>
            Services
          </a>
        )}
        {settings?.showHowItWorksSection !== false && (
          <a href="/#how-it-works" className={getNavClass("how-it-works")} onClick={(e) => handleNavClick(e, "how-it-works")}>
            How It Works
          </a>
        )}
        {settings?.showRentVsBuySection !== false && (
          <a href="/#rent-or-buy" className={getNavClass("rent-or-buy")} onClick={(e) => handleNavClick(e, "rent-or-buy")}>
            Rent vs Buy
          </a>
        )}
        {settings?.showContactSection !== false && (
          <a href="/#contact" className={getNavClass("contact", "/contact")} onClick={(e) => handleNavClick(e, "contact", "/contact")}>
            Contact
          </a>
        )}
      </nav>

      <div className="nav-right">
        <Link to="/customer/shop" className="cta-btn" id="getStartedBtn">
          Get Started
        </Link>
        <button
          type="button"
          className="mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
    </header>
  );
};
