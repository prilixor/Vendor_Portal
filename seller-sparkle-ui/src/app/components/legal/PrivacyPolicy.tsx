import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/app/helpers/utils";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10">
      {/* Refined Minimal Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-sm">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight">Vendor Portal</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Privacy Standards</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 lg:py-16 px-4 lg:px-8 max-w-4xl">
        {/* Refined Hero Section */}
        <div className="mb-14 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary mb-4 ring-1 ring-primary/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground mb-3">
            Privacy Policy
          </h1>
          <div className="h-1.5 w-16 bg-gradient-primary rounded-full mx-auto mb-6"></div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your trust is our priority. We are committed to transparency and the highest standards of data protection.
          </p>
        </div>

        {/* Improved Cards Section */}
        <div className="grid gap-6 md:grid-cols-2 mb-16">
          <div className="group p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold mb-2">Secure Storage</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We employ enterprise-grade encryption to safeguard your sensitive business documents and personal data.
            </p>
          </div>
          <div className="group p-5 rounded-2xl border bg-card shadow-sm hover:shadow-md hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Eye className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold mb-2">Total Transparency</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We only collect data that is strictly necessary for vendor verification and secure platform operations.
            </p>
          </div>
        </div>

        {/* Content Sections with Improved Spacing & Hierarchy */}
        <div className="space-y-14">
          <section className="group">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-border to-transparent"></div>
            </div>
            <div className="text-[15px] text-muted-foreground leading-[1.8] space-y-4">
              <p>To provide a secure and efficient ecosystem, we collect essential information during your engagement with the portal:</p>
              <ul className="grid gap-4 mt-6">
                {[
                  { title: "Business Details", desc: "Legal entity name, Tax ID, business licenses, and official registration files." },
                  { title: "Contact Data", desc: "Names, professional email addresses, and phone numbers of authorized staff." },
                  { title: "Financial Assets", desc: "Bank account details required for secure transaction processing and payouts." },
                  { title: "Portal Usage", desc: "Technical data including IP addresses, login logs, and interaction metrics." }
                ].map((item, i) => (
                  <li key={i} className="flex gap-4 p-4 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground block text-sm mb-1">{item.title}</span>
                      <span className="text-sm leading-normal">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="group">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-xl font-bold text-foreground">2. How We Use Your Data</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-border to-transparent"></div>
            </div>
            <div className="grid gap-4">
              {[
                { icon: <Database className="h-4 w-4" />, text: "Rigorous vendor verification and approval workflows" },
                { icon: <Globe className="h-4 w-4" />, text: "Real-time synchronization of product listings and inventory" },
                { icon: <Lock className="h-4 w-4" />, text: "Processing encrypted payments and financial settlements" },
                { icon: <ShieldCheck className="h-4 w-4" />, text: "Proactive fraud prevention and platform monitoring" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/30 hover:border-primary/20 transition-all group/item">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border shadow-sm text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-bold text-foreground">3. Data Disclosure</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-border to-transparent"></div>
            </div>
            <div className="text-[15px] text-muted-foreground leading-[1.8] space-y-4 max-w-[75ch]">
              <p>
                BlinksMed operates on a zero-sale data policy. Your business intelligence is never sold to third parties. 
                Disclosure occurs only under strictly defined operational requirements:
              </p>
              <ul className="grid gap-2 pl-1">
                {[
                  "Payment gateways for secure transaction clearing.",
                  "Fulfillment partners for essential logistics data.",
                  "Regulatory bodies when legally compelled by valid process."
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 items-center">
                    <ChevronRight className="h-3 w-3 text-primary/40" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="p-8 rounded-[2rem] bg-gradient-to-br from-primary/[0.04] to-transparent border border-primary/10 relative overflow-hidden">
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] text-primary">
              <ShieldCheck size={160} />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Privacy Support</h2>
            <p className="text-muted-foreground mb-6 max-w-lg leading-relaxed">
              Our dedicated privacy team is available to address your concerns or handle data rights requests.
            </p>
            <a 
              href="mailto:privacy@blinksmed.com" 
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow hover:opacity-90 transition-all"
            >
              Contact Privacy Team
            </a>
          </section>
        </div>

        <div className="mt-20 pt-10 border-t flex flex-col sm:flex-row items-center justify-between gap-6 pb-12">
          <p className="text-xs text-muted-foreground/60 font-medium">
            © 2026 BlinksMed Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
             <Link to="/terms-and-conditions" className="text-xs font-bold text-muted-foreground/60 hover:text-primary transition-colors">Terms of Service</Link>
             <span className="text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest underline underline-offset-4 decoration-primary/30">May 13, 2026</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
