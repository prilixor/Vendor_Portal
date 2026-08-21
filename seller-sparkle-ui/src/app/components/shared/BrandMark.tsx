import { useEffect } from "react";
import { cn } from "@/app/helpers/utils";
import { PageLoader } from "@/app/components/shared/PageLoader";
import { dismissBootSplash } from "@/app/helpers/bootSplash";

type BrandMarkProps = {
  className?: string;
  /** Outer box size (Tailwind). Default matches previous 36px tile. */
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl";
  /** `onBrand` is a glass-white tile for purple/gradient marketing panels. */
  tone?: "default" | "onBrand";
  alt?: string;
};

const sizeClass = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

const roundClass = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
} as const;

/** Full BlinksMed logo (icon + wordmark + tagline) for headers, sidebars, and auth. */
export function BrandMark({
  className,
  size = "md",
  rounded = "xl",
  tone = "default",
  alt = "BlinksMed",
}: BrandMarkProps) {
  return (
    <img
      src="/branding/blinksmed-logo.png"
      alt={alt}
      width={size === "lg" ? 56 : size === "sm" ? 36 : 44}
      height={size === "lg" ? 56 : size === "sm" ? 36 : 44}
      className={cn(
        "shrink-0 object-contain object-center",
        tone === "onBrand"
          ? "bg-white p-1 shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-white/45"
          : "bg-white p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        sizeClass[size],
        roundClass[rounded],
        className,
      )}
      decoding="async"
    />
  );
}

/** Full-screen branded loader while auth/session hydrates. */
export function BrandBootSplash({ label = "Loading BlinksMed…" }: { label?: string }) {
  useEffect(() => {
    dismissBootSplash();
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <PageLoader label={label} size="lg" artwork="logo" className="min-h-0 py-0" />
    </div>
  );
}
