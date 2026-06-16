import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/helpers/utils";

const sections = [
  { id: "introduction", title: "Introduction" },
  { id: "eligibility", title: "Vendor Eligibility" },
  { id: "security", title: "Account & Security" },
  { id: "responsibilities", title: "Vendor Responsibilities" },
  { id: "verification", title: "Verification & Approval" },
  { id: "prohibited", title: "Prohibited Activities" },
  { id: "privacy", title: "Data & Privacy" },
  { id: "termination", title: "Termination & Suspension" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "changes", title: "Changes to Terms" },
  { id: "contact", title: "Contact Information" },
];

const TermsAndConditions = () => {
  const [activeSection, setActiveSection] = useState("introduction");
  const navigate = useNavigate();

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    const observerOptions = {
      root: null,
      rootMargin: "-10% 0px -70% 0px", // Focus on the top portion of the viewport
      threshold: 0
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    // Special handling for the bottom of the page to ensure last sections activate
    const handleBottomScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        setActiveSection(sections[sections.length - 1].id);
      }
    };

    window.addEventListener("scroll", handleBottomScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleBottomScroll);
    };
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
      {/* Refined Minimal Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-sm">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">Vendor Portal</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Legal Documentation</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          
          {/* Sidebar TOC - Optimized Sticky Aside */}
          <aside className="hidden lg:block w-64 shrink-0 sticky top-[80px] h-fit self-start">
            <div className="space-y-8 pr-2">
              <nav className="flex flex-col gap-1">
                <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Sections</p>
                {sections.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-200",
                      activeSection === s.id
                        ? "bg-primary/[0.06] text-primary shadow-sm ring-1 ring-primary/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] transition-colors",
                        activeSection === s.id ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
                      )}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {s.title}
                    </span>
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-all duration-300",
                      activeSection === s.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
                    )} />
                  </button>
                ))}
              </nav>

              {/* Compact Need Help Card - Stable Icon Positioning */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 relative overflow-hidden group min-h-[140px] flex flex-col justify-between">
                <div className="absolute -top-1 -right-1 p-4 opacity-10 group-hover:opacity-20 transition-all duration-300 pointer-events-none">
                  <FileText className="h-14 w-14 rotate-12" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">Need Help?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Questions about these terms? Our team is here to assist.
                  </p>
                </div>
                <Button asChild className="w-full text-xs h-9 font-semibold shadow-sm hover:shadow-md transition-all duration-200 bg-primary text-primary-foreground" size="sm">
                  <Link to="/contact-us">Contact Support</Link>
                </Button>
              </div>
            </div>
          </aside>

          {/* Content - Increased Width, Improved Spacing */}
          <div className="flex-1 max-w-4xl lg:pl-4">
            <div className="mb-14 relative">
              <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground mb-4">
                Terms & Conditions
              </h1>
              <div className="h-1.5 w-20 bg-gradient-primary rounded-full mb-6"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-muted-foreground">
                <p className="text-lg leading-relaxed max-w-2xl">
                  Please review these terms carefully to understand your rights and responsibilities as a vendor on our platform.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit shrink-0">
                  Updated: May 13, 2026
                </div>
              </div>
            </div>

            <div className="space-y-16">
              <section id="introduction" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">01.</span>
                  Introduction
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] space-y-5">
                  <p>
                    Welcome to the Prilixor Vendor Portal. These Terms & Conditions ("Terms") govern your access to and use of our platform, 
                    including onboarding, product management, and fulfillment services.
                  </p>
                  <p>
                    By registering or using the portal, you agree to be bound by these Terms. If you represent a business entity, 
                    you confirm you have the authority to bind that entity to this agreement.
                  </p>
                </div>
              </section>

              <section id="eligibility" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">02.</span>
                  Vendor Eligibility
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] space-y-5">
                  <p>To participate as a vendor, you must maintain compliance with the following:</p>
                  <ul className="grid gap-3 pl-1">
                    {[
                      "Legally registered business entity or licensed professional.",
                      "Accurate and verifiable documentation during registration.",
                      "Single active account per business unless authorized.",
                      "Compliance with all local and national trade laws."
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="security" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">03.</span>
                  Account & Security
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] space-y-5">
                  <p>
                    Account security is your primary responsibility. Prilixor employs robust encryption, but vendor-side 
                    credential management is critical for platform integrity.
                  </p>
                  <div className="p-5 rounded-xl bg-muted/30 border border-border/50">
                    <p className="font-semibold text-foreground mb-2 text-sm">Key Security Policies:</p>
                    <ul className="space-y-2 text-sm">
                      <li>• Multi-factor authentication is strongly recommended.</li>
                      <li>• Mandatory email verification for all administrative actions.</li>
                      <li>• Immediate reporting of suspected unauthorized access is required.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section id="responsibilities" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">04.</span>
                  Vendor Responsibilities
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] space-y-5">
                  <p>
                    Vendors are expected to maintain professional standards in product quality and data accuracy. 
                    Misrepresentation of goods or service capabilities may lead to immediate suspension.
                  </p>
                  <p>
                    All uploaded business documents must be kept current. Expired licenses or tax documents 
                    must be replaced within 5 business days of expiration.
                  </p>
                </div>
              </section>

              <section id="verification" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">05.</span>
                  Verification & Approval
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch]">
                  <p>
                    The onboarding process involves rigorous manual and automated verification. 
                    Approval is granted on a per-vendor basis and is not guaranteed upon submission 
                    of initial registration data.
                  </p>
                </div>
              </section>

              <section id="prohibited" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">06.</span>
                  Prohibited Activities
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] p-6 rounded-2xl bg-red-500/[0.02] border border-red-500/10">
                  <p className="text-red-600 font-semibold mb-4 text-sm">Violation of these policies will result in permanent account termination:</p>
                  <ul className="grid gap-3">
                    {[
                      "Listing counterfeit or unauthorized replicas.",
                      "Providing fraudulent business credentials.",
                      "Attempting to scrape or harvest system data.",
                      "Bypassing platform payment or communication systems."
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-2 h-1 w-2 shrink-0 rounded-full bg-red-400"></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="privacy" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">07.</span>
                  Data & Privacy
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch]">
                  <p>
                    We collect business data solely for operational needs. For detailed information on data 
                    handling, please refer to our <Link to="/privacy-policy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>. 
                    We utilize enterprise-grade security to ensure your business intelligence remains confidential.
                  </p>
                </div>
              </section>

              <section id="termination" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">08.</span>
                  Termination & Suspension
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch]">
                  <p>
                    Prilixor reserves the right to suspend accounts for investigations or terminate access 
                    for breaches of these Terms. Vendors may terminate their account by providing 30 days 
                    written notice, subject to fulfillment of existing orders.
                  </p>
                </div>
              </section>

              <section id="liability" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">09.</span>
                  Limitation of Liability
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] p-5 border-l-2 border-primary/20 italic bg-primary/[0.01]">
                  <p>
                    Our total liability for any claim arising out of these Terms shall not exceed the 
                    total commissions paid by the vendor to Prilixor during the 12 months preceding 
                    the claim.
                  </p>
                </div>
              </section>

              <section id="changes" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">10.</span>
                  Changes to Terms
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch]">
                  <p>
                    Platform evolution may require term updates. Changes will be posted here with a new 
                    effective date. Continued use of the portal after updates constitutes your 
                    acknowledgment and acceptance of the revised Terms.
                  </p>
                </div>
              </section>

              <section id="contact" className="scroll-mt-24 group">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-4 text-foreground group-hover:text-primary transition-colors">
                  <span className="text-primary/40 font-mono text-sm">11.</span>
                  Contact Information
                </h2>
                <div className="text-[15px] text-muted-foreground leading-[1.8] max-w-[75ch] p-8 rounded-3xl bg-muted/20 border border-border/40">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Inquiries</p>
                      <p className="font-semibold text-foreground">vendors@prilixor.com</p>
                      <p className="text-sm">+1 (555) 012-3456</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Operational Hours</p>
                      <p className="text-sm">Monday — Friday</p>
                      <p className="text-sm italic">9:00 AM — 6:00 PM EST</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            
            <footer className="mt-24 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 pb-12">
              <p className="text-[12px] text-muted-foreground/60">© 2026 Prilixor Inc. All rights reserved.</p>
              <div className="flex items-center gap-8">
                <Link to="/privacy-policy" className="text-[12px] font-medium text-muted-foreground/60 hover:text-primary transition-colors">Privacy Policy</Link>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsAndConditions;
