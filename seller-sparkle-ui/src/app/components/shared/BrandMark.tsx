import { useEffect } from "react";
import { cn } from "@/app/helpers/utils";
import { BRAND_LOGO_AUTH_SRC, BRAND_LOGO_SRC, BRAND_MARK_SRC } from "@/app/helpers/brandArt";
import { PageLoader } from "@/app/components/shared/PageLoader";
import { dismissBootSplash } from "@/app/helpers/bootSplash";

type BrandMarkProps = {
  className?: string;
  /** Height of the lockup. Width follows the official side-by-side artwork. */
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl";
  /** `onBrand` is a light plate for purple/gradient marketing panels. */
  tone?: "default" | "onBrand";
  /** `lockup` = new side-by-side. `auth` = live stacked tile (login only). `mark` = icon only. */
  variant?: "lockup" | "auth" | "mark";
  alt?: string;
};

const lockupSizeClass = {
  sm: "h-8 w-auto max-w-[148px]",
  md: "h-9 w-auto max-w-[176px]",
  lg: "h-10 w-auto max-w-[200px] sm:h-12 sm:max-w-[228px]",
} as const;

/** Same square tile as live login. */
const authSizeClass = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

const markSizeClass = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
} as const;

const roundClass = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
} as const;

/** Official BlinksMed artwork for web headers, sidebars, and auth. */
export function BrandMark({
  className,
  size = "md",
  rounded = "xl",
  tone = "default",
  variant = "lockup",
  alt = "BlinksMed",
}: BrandMarkProps) {
  const isAuth = variant === "auth";
  const isLockup = variant === "lockup";
  const src = isAuth ? BRAND_LOGO_AUTH_SRC : isLockup ? BRAND_LOGO_SRC : BRAND_MARK_SRC;
  const width = isAuth
    ? size === "lg" ? 56 : size === "sm" ? 36 : 44
    : isLockup
      ? size === "lg" ? 220 : size === "sm" ? 148 : 176
      : size === "lg" ? 44 : size === "sm" ? 32 : 36;
  const height = isAuth
    ? size === "lg" ? 56 : size === "sm" ? 36 : 44
    : isLockup
      ? size === "lg" ? 48 : size === "sm" ? 32 : 36
      : size === "lg" ? 44 : size === "sm" ? 32 : 36;
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn(
        "shrink-0 overflow-hidden object-contain",
        isLockup ? "object-left" : "object-center",
        isAuth || (!isLockup && tone === "onBrand")
          ? "bg-white p-1 shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-white/45"
          : isLockup
            ? tone === "onBrand"
              ? "bg-white/95 px-2 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-white/45"
              : "dark:bg-white dark:px-2 dark:py-0.5"
            : "bg-white p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        isAuth ? authSizeClass[size] : isLockup ? lockupSizeClass[size] : markSizeClass[size],
        isLockup ? "rounded-md" : roundClass[rounded],
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
      <PageLoader label={label} size="lg" artwork="mark" className="min-h-0 py-0" />
    </div>
  );
}
