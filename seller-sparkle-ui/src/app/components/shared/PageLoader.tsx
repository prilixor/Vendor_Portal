import { useId } from "react";
import { cn } from "@/app/helpers/utils";

type PageLoaderSize = "sm" | "md" | "lg";

type PageLoaderProps = {
  label?: string;
  className?: string;
  size?: PageLoaderSize;
  /** `logo` = full lockup (splash). `mark` = icon only (in-page). */
  artwork?: "mark" | "logo";
};

const sizeMap = {
  sm: { box: 72, logo: 36, stroke: 2.25, radius: 30 },
  md: { box: 132, logo: 64, stroke: 3, radius: 56 },
  lg: { box: 168, logo: 80, stroke: 3.25, radius: 72 },
} as const;

/** Branded in-page loader. Header stays visible. */
export function PageLoader({
  label,
  className,
  size = "md",
  artwork = "mark",
}: PageLoaderProps) {
  const rawId = useId().replace(/:/g, "");
  const gid = (name: string) => `bm-loader-${name}-${rawId}`;
  const { box, logo, stroke, radius } = sizeMap[size];
  const cx = box / 2;
  const innerR = Math.max(radius - 10, 18);
  const sparkR = radius + 8;

  return (
    <div
      className={cn(
        "flex min-h-[280px] w-full flex-col items-center justify-center gap-6 py-16",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <div className="relative" style={{ width: box + 36, height: box + 36 }}>
        <div
          className="bm-loader-aurora pointer-events-none absolute inset-[-12%] rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, hsl(var(--primary) / 0.42), transparent 58%), radial-gradient(circle at 70% 75%, hsl(152 60% 42% / 0.22), transparent 52%)",
          }}
          aria-hidden
        />

        <div
          className="pointer-events-none absolute inset-[14%] rounded-full bg-background/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_18px_50px_-20px_hsl(var(--primary)/0.45)] backdrop-blur-md dark:bg-card/30"
          aria-hidden
        />

        <div className="bm-loader-orbit pointer-events-none absolute inset-0" aria-hidden>
          {[0, 120, 240].map((deg, i) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `rotate(${deg}deg) translateY(-${sparkR}px)` }}
            >
              <span
                className="bm-loader-spark block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                style={{ animationDelay: `${i * 0.22}s` }}
              />
            </span>
          ))}
        </div>

        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          viewBox={`0 0 ${box} ${box}`}
          width={box}
          height={box}
          aria-hidden
        >
          <defs>
            <linearGradient id={gid("arc")} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="55%" stopColor="hsl(var(--primary-glow))" />
              <stop offset="100%" stopColor="hsl(152 60% 48%)" />
            </linearGradient>
            <linearGradient id={gid("soft")} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary-glow) / 0.9)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.15)" />
            </linearGradient>
            <filter id={gid("glow")} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary) / 0.16)"
            strokeWidth={stroke}
          />

          <g className="bm-loader-ring-rev" style={{ transformOrigin: `${cx}px ${cx}px` }}>
            <circle
              cx={cx}
              cy={cx}
              r={innerR}
              fill="none"
              stroke={`url(#${gid("soft")})`}
              strokeWidth={Math.max(stroke - 0.75, 1.5)}
              strokeLinecap="round"
              strokeDasharray={`${Math.round(innerR * 0.9)} ${Math.round(innerR * 5.2)}`}
              opacity={0.85}
            />
          </g>

          <g
            className="bm-loader-ring"
            style={{ transformOrigin: `${cx}px ${cx}px` }}
            filter={`url(#${gid("glow")})`}
          >
            <circle
              cx={cx}
              cy={cx}
              r={radius}
              fill="none"
              stroke={`url(#${gid("arc")})`}
              strokeWidth={stroke + 0.4}
              strokeLinecap="round"
              strokeDasharray={`${Math.round(radius * 1.55)} ${Math.round(radius * 4.7)}`}
            />
            <circle
              cx={cx}
              cy={cx - radius}
              r={stroke + 0.8}
              fill="hsl(var(--primary-glow))"
            />
          </g>
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bm-loader-breathe relative overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_10px_28px_-12px_hsl(var(--primary)/0.55)] ring-1 ring-black/5 dark:ring-white/15">
            <img
              src={artwork === "logo" ? "/branding/blinksmed-logo.png" : "/branding/blinksmed-mark.png"}
              alt=""
              width={logo}
              height={logo}
              className="block object-contain object-center"
              decoding="async"
            />
            <span
              className="bm-loader-sheen pointer-events-none absolute inset-y-[-20%] left-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {label ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="bm-loader-dot h-1.5 w-1.5 rounded-full bg-primary"
                style={{ animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Empty slot while the global branded overlay is showing — avoids a second spinner. */
export function PageLoaderSlot({ className }: { className?: string }) {
  return <div className={cn("min-h-[16rem]", className)} aria-busy="true" aria-label="Loading" />;
}
