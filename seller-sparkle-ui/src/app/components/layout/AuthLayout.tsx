import { ReactNode, useEffect, useState } from "react";
import { BarChart3, Moon, ShieldCheck, Sun, Zap } from "lucide-react";
import { BrandMark } from "@/app/components/shared/BrandMark";
import { BackLink } from "@/app/components/shared/BackLink";
import { Button } from "@/app/components/ui/button";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  portalType?: "vendor" | "customer" | "admin";
  backTo?: string;
  backLabel?: string;
}

const portalContent = {
  vendor: {
    brandTitle: "Vendor Portal",
    brandSubtitle: "Marketplace command center",
    heroTitle: "Run your rental business with confidence.",
    heroDesc:
      "Onboard fast, list products, manage inventory, and track every order — all from one beautifully crafted portal.",
    features: [
      { icon: ShieldCheck, title: "Verified onboarding", desc: "Step-by-step KYC with document review." },
      { icon: Zap, title: "Real-time inventory", desc: "Stock movement and reservations in one view." },
      { icon: BarChart3, title: "Operations insights", desc: "Service areas, hours, and overrides at a glance." },
    ],
  },
  customer: {
    brandTitle: "Customer Portal",
    brandSubtitle: "Rent equipment with ease",
    heroTitle: "Find and rent medical equipment instantly.",
    heroDesc:
      "Browse the BlinksMed catalog, compare prices, manage your bookings, and get fast delivery directly to your doorstep.",
    features: [
      { icon: ShieldCheck, title: "Verified Equipment", desc: "Every item quality-checked before delivery." },
      { icon: Zap, title: "Transparent Pricing", desc: "Clear daily/monthly rental rates and deposit details." },
      { icon: BarChart3, title: "Fast Delivery", desc: "Doorstep delivery, installation, and pickup options." },
    ],
  },
  admin: {
    brandTitle: "Admin Portal",
    brandSubtitle: "Marketplace management center",
    heroTitle: "Manage the marketplace with efficiency.",
    heroDesc:
      "Review vendor applications, manage customer orders, audit activity logs, and configure platform settings in one unified console.",
    features: [
      { icon: ShieldCheck, title: "Vendor Verification", desc: "Review uploaded KYC documents and bank accounts." },
      { icon: Zap, title: "Catalog Control", desc: "Manage product categories and listing visibility." },
      { icon: BarChart3, title: "Audit & Security", desc: "Track administrator actions and system audit logs." },
    ],
  },
};

export const AuthLayout = ({
  children,
  title,
  subtitle,
  portalType = "vendor",
  backTo,
  backLabel,
}: AuthLayoutProps) => {
  const content = portalContent[portalType] || portalContent.vendor;
  const [dark, setDark] = useState(() =>
    typeof document === "undefined" ? false : document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="auth-shell relative flex min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-background transition-colors duration-300">
      <div className="auth-grain pointer-events-none absolute inset-0 z-[1] hidden dark:block" aria-hidden />

      {/* Left — brand panel. Stack logo + copy; leftover space sits above the footer. */}
      <div className="auth-brand-panel relative z-[2] hidden w-[46%] flex-col overflow-hidden p-10 text-white lg:flex xl:p-12">
        <div className="auth-brand-mesh absolute inset-0" />
        <div className="absolute -right-28 -top-28 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl dark:hidden" />
        <div className="absolute -bottom-36 -left-24 h-[28rem] w-[28rem] rounded-full bg-white/[0.08] blur-3xl dark:hidden" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 dark:ring-0" />
        <div className="pointer-events-none absolute inset-y-8 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent dark:block" />

        <div className="relative flex items-center gap-3.5">
          <BrandMark size="lg" rounded="2xl" tone="onBrand" />
          <div>
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-white dark:text-zinc-100">
              {content.brandTitle}
            </p>
            <p className="mt-0.5 text-xs font-medium text-white/70 dark:text-zinc-400">{content.brandSubtitle}</p>
          </div>
        </div>

        <div className="relative mt-10 max-w-[28rem] space-y-7 xl:mt-12">
          <div>
            <h2 className="text-[2.05rem] font-semibold leading-[1.18] tracking-tight text-white xl:text-[2.2rem] dark:font-medium dark:tracking-[-0.03em] dark:text-zinc-50">
              {content.heroTitle}
            </h2>
            <p className="mt-3.5 text-[15px] leading-relaxed text-white/80 dark:leading-[1.65] dark:text-zinc-400">
              {content.heroDesc}
            </p>
          </div>
          <div className="space-y-3.5">
            {content.features.map(({ icon: Icon, title: featureTitle, desc }) => (
              <div key={featureTitle} className="flex items-start gap-3.5 dark:gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-sm ring-1 ring-white/15 backdrop-blur-[2px] dark:h-8 dark:w-8 dark:rounded-md dark:bg-white/[0.045] dark:text-zinc-300 dark:shadow-none dark:ring-white/[0.08] dark:backdrop-blur-0">
                  <Icon className="h-4 w-4 dark:h-3.5 dark:w-3.5" strokeWidth={2.25} />
                </div>
                <div className="pt-0.5 dark:pt-0">
                  <p className="text-sm font-semibold text-white dark:font-medium dark:text-zinc-200">{featureTitle}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-white/70 dark:text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-auto pt-10 text-[11px] font-medium tracking-wide text-white/55 dark:text-zinc-500">
          © {new Date().getFullYear()} {content.brandTitle}. All rights reserved.
        </p>
      </div>

      {/* Right — form. Top-aligned with the brand column so tall pages (register) do not float. */}
      <div className="relative z-[2] flex w-full justify-center overflow-y-auto px-5 pb-10 pt-14 sm:px-8 lg:w-[54%] lg:items-start lg:px-10 lg:pb-12 lg:pt-12">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setDark((v) => !v)}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="absolute right-4 top-4 z-10 h-9 w-9 rounded-full border border-border/80 bg-card/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground sm:right-6 sm:top-6 dark:h-8 dark:w-8 dark:rounded-md dark:border-transparent dark:bg-transparent dark:shadow-none dark:backdrop-blur-0 dark:hover:bg-white/[0.06]"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="auth-form relative w-full max-w-[420px] animate-fade-in">
          {backTo && (
            <div className="mb-6">
              <BackLink to={backTo} label={backLabel ?? "Back"} />
            </div>
          )}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <BrandMark size="md" rounded="xl" />
            <p className="text-sm font-semibold text-foreground">{content.brandTitle}</p>
          </div>
          <div className="mb-6">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.8rem] dark:font-medium dark:tracking-[-0.03em] dark:text-zinc-50">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground dark:text-[13.5px] dark:text-zinc-400">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
