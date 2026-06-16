import { ReactNode } from "react";
import { Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  portalType?: "vendor" | "customer" | "admin";
}

const portalContent = {
  vendor: {
    brandTitle: "Vendor Portal",
    brandSubtitle: "Marketplace command center",
    heroTitle: "Run your rental business with confidence.",
    heroDesc: "Onboard fast, list products, manage inventory, and track every order — all from one beautifully crafted portal.",
    features: [
      { icon: ShieldCheck, title: "Verified onboarding", desc: "Step-by-step KYC with document review." },
      { icon: Zap, title: "Real-time inventory", desc: "Stock movement and reservations in one view." },
      { icon: BarChart3, title: "Operations insights", desc: "Service areas, hours, and overrides at a glance." },
    ]
  },
  customer: {
    brandTitle: "Customer Portal",
    brandSubtitle: "Rent equipment with ease",
    heroTitle: "Find and rent medical equipment instantly.",
    heroDesc: "Browse catalogs from verified local vendors, compare prices, manage your bookings, and get fast delivery directly to your doorstep.",
    features: [
      { icon: ShieldCheck, title: "Verified Vendors", desc: "Only trusted, KYC-approved suppliers." },
      { icon: Zap, title: "Transparent Pricing", desc: "Clear daily/monthly rental rates and deposit details." },
      { icon: BarChart3, title: "Fast Delivery", desc: "Doorstep delivery, installation, and pickup options." },
    ]
  },
  admin: {
    brandTitle: "Admin Portal",
    brandSubtitle: "Marketplace management center",
    heroTitle: "Manage the marketplace with efficiency.",
    heroDesc: "Review vendor applications, manage customer orders, audit activity logs, and configure platform settings in one unified console.",
    features: [
      { icon: ShieldCheck, title: "Vendor Verification", desc: "Review uploaded KYC documents and bank accounts." },
      { icon: Zap, title: "Catalog Control", desc: "Manage product categories and listing visibility." },
      { icon: BarChart3, title: "Audit & Security", desc: "Track administrator actions and system audit logs." },
    ]
  }
};

export const AuthLayout = ({ children, title, subtitle, portalType = "vendor" }: AuthLayoutProps) => {
  const content = portalContent[portalType] || portalContent.vendor;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left — brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-primary p-12 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{content.brandTitle}</p>
            <p className="text-xs text-white/70">{content.brandSubtitle}</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight">{content.heroTitle}</h2>
            <p className="mt-3 text-white/80">{content.heroDesc}</p>
          </div>
          <div className="space-y-4">
            {content.features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-white/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} {content.brandTitle}. All rights reserved.</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
