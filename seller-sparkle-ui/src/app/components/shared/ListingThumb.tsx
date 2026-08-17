import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn, imageSrcCandidates } from "@/app/helpers/utils";

type ListingThumbProps = {
  src?: string | null;
  /** Used only if src (and its original file) fail to load — e.g. Admin catalog photo. */
  fallbackSrc?: string | null;
  alt?: string;
  className?: string;
  size?: "sm" | "md";
};

/** Compact list-row thumbnail with icon fallback when missing/broken. */
export function ListingThumb({
  src,
  fallbackSrc,
  alt = "",
  className,
  size = "md",
}: ListingThumbProps) {
  const candidates = imageSrcCandidates(src, fallbackSrc);
  const [index, setIndex] = useState(0);
  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  useEffect(() => {
    setIndex(0);
  }, [src, fallbackSrc]);

  const url = candidates[index];

  if (!url) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-soft",
          box,
          className,
        )}
      >
        <ImageIcon className="h-4 w-4 text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/50", box, className)}>
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => {
          if (index + 1 < candidates.length) setIndex(index + 1);
          else setIndex(candidates.length);
        }}
      />
    </div>
  );
}
