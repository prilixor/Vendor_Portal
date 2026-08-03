import { cn } from "@/app/helpers/utils";

type BrandMarkProps = {
  className?: string;
  /** Outer box size (Tailwind). Default matches previous 36px tile. */
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl";
  alt?: string;
};

const sizeClass = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
} as const;

const roundClass = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
} as const;

/** BlinksMed logo mark for headers, sidebars, and auth panels. */
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
      width={size === "lg" ? 44 : size === "sm" ? 32 : 36}
      height={size === "lg" ? 44 : size === "sm" ? 32 : 36}
      className={cn(
        "shrink-0 object-cover bg-white shadow-sm ring-1 ring-black/5",
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
        width={96}
        height={96}
        className="h-24 w-24 rounded-2xl object-cover shadow-md ring-1 ring-border"
        decoding="async"
      />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
