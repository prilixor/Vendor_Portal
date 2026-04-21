import { ReactNode } from "react";
import { Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";

export const AuthLayout = ({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) => (
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
          <p className="text-sm font-bold leading-tight">Vendor Portal</p>
          <p className="text-xs text-white/70">Marketplace command center</p>
        </div>
      </div>

      <div className="relative max-w-md space-y-8">
        <div>
          <h2 className="text-4xl font-bold leading-tight">Run your rental business with confidence.</h2>
          <p className="mt-3 text-white/80">
            Onboard fast, list products, manage inventory, and track every order — all from one beautifully crafted portal.
          </p>
        </div>
        <div className="space-y-4">
          {[
            { icon: ShieldCheck, title: "Verified onboarding", desc: "Step-by-step KYC with document review." },
            { icon: Zap, title: "Real-time inventory", desc: "Stock movement and reservations in one view." },
            { icon: BarChart3, title: "Operations insights", desc: "Service areas, hours, and overrides at a glance." },
          ].map(({ icon: Icon, title, desc }) => (
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

      <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Vendor Portal. All rights reserved.</p>
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
