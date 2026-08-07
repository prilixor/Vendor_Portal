import { cn } from "@/app/helpers/utils";

type BrandMarkProps = {
  className?: string;
  /** Outer box size (Tailwind). Default matches previous 36px tile. */
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl";
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
  alt = "BlinksMed",
}: BrandMarkProps) {
  return (
    <img
      src="/branding/blinksmed-logo.png"
      alt={alt}
      width={size === "lg" ? 56 : size === "sm" ? 36 : 44}
      height={size === "lg" ? 56 : size === "sm" ? 36 : 44}
      className={cn(
        "shrink-0 object-contain bg-white shadow-sm ring-1 ring-black/5 dark:ring-white/10",
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
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6">
      <img
        src="/branding/blinksmed-logo.png"
        alt="BlinksMed"
        width={144}
        height={144}
        className="h-36 w-36 rounded-2xl object-contain bg-white p-2 shadow-md ring-1 ring-border dark:ring-white/10"
        decoding="async"
      />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
