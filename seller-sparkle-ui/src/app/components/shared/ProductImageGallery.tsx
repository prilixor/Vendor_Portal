import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { cn, retryOriginalOnImageError } from "@/app/helpers/utils";

type ProductImageGalleryProps = {
  images: string[];
  alt?: string;
  className?: string;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Marketplace-style product gallery with hover preview + centered lightbox zoom.
 */
export function ProductImageGallery({ images, alt = "Product", className }: ProductImageGalleryProps) {
  const [imgIx, setImgIx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState("50% 50%");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const safeImages = images.length > 0 ? images : [];
  const current = safeImages[imgIx % Math.max(safeImages.length, 1)];

  const maxPanFor = useCallback((z: number) => {
    const stage = stageRef.current;
    if (!stage || z <= 1) return { x: 0, y: 0 };
    const { clientWidth: w, clientHeight: h } = stage;
    // Keep at least ~20% of the stage covered by the image while panning.
    return {
      x: ((z - 1) * w) / 2,
      y: ((z - 1) * h) / 2,
    };
  }, []);

  const setZoomCentered = useCallback(
    (nextZoom: number) => {
      const z = clamp(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
      setZoom(z);
      if (z <= 1) {
        setPan({ x: 0, y: 0 });
        return;
      }
      const limit = maxPanFor(z);
      setPan((p) => ({
        x: clamp(p.x, -limit.x, limit.x),
        y: clamp(p.y, -limit.y, limit.y),
      }));
    },
    [maxPanFor],
  );

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pinchRef.current = null;
    dragRef.current = null;
  };

  const openLightbox = (index = imgIx) => {
    if (safeImages.length === 0) return;
    setImgIx(index);
    resetZoom();
    setLightboxOpen(true);
  };

  const changeImage = useCallback(
    (next: number) => {
      if (safeImages.length === 0) return;
      setImgIx((next + safeImages.length) % safeImages.length);
      resetZoom();
    },
    [safeImages.length],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") changeImage(imgIx - 1);
      if (e.key === "ArrowRight") changeImage(imgIx + 1);
      if (e.key === "+" || e.key === "=") setZoomCentered(zoom + ZOOM_STEP);
      if (e.key === "-") setZoomCentered(zoom - ZOOM_STEP);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, imgIx, changeImage, setZoomCentered, zoom]);

  const onHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  const onWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoomCentered(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const stage = e.currentTarget as HTMLElement;
    stage.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { dist, zoom };
      dragRef.current = null;
      return;
    }

    if (zoom <= 1) return;
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / Math.max(pinchRef.current.dist, 1);
      setZoomCentered(pinchRef.current.zoom * ratio);
      return;
    }

    if (!dragRef.current || zoom <= 1) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const limit = maxPanFor(zoom);
    setPan({
      x: clamp(dragRef.current.panX + dx, -limit.x, limit.x),
      y: clamp(dragRef.current.panY + dy, -limit.y, limit.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  if (safeImages.length === 0) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-lg border bg-muted/40", className)}>
        <div className="aspect-[4/3] w-full lg:aspect-square" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No photos</div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 space-y-2.5", className)}>
      <button
        type="button"
        onClick={() => openLightbox(imgIx)}
        className="group relative block w-full overflow-hidden rounded-lg border border-border/80 bg-muted/35 text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open image zoom viewer"
      >
        <div className="relative aspect-[4/3] w-full lg:aspect-square">
          <div
            className="absolute inset-3 overflow-hidden sm:inset-4 lg:inset-[1.125rem]"
            onMouseMove={onHoverMove}
            onMouseLeave={() => setOrigin("50% 50%")}
          >
            <img
              src={current}
              alt={alt}
              className="customer-catalog-media-img pointer-events-none absolute inset-0 h-full w-full object-contain object-center transition-transform duration-150 ease-out md:group-hover:scale-[1.85]"
              style={{ transformOrigin: origin, maxWidth: "none", maxHeight: "none" }}
              loading="lazy"
              decoding="async"
              onError={retryOriginalOnImageError}
            />
          </div>
        </div>
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
          <Search className="h-3 w-3" />
          <span className="sm:hidden">Tap to zoom</span>
          <span className="hidden sm:inline">Click to zoom</span>
        </span>
      </button>

      {safeImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {safeImages.map((url, i) => (
            <button
              key={`thumb-${i}`}
              type="button"
              onClick={() => setImgIx(i)}
              onDoubleClick={() => openLightbox(i)}
              className={cn(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/40",
                i === imgIx ? "border-primary ring-1 ring-primary/40" : "border-border/70 hover:border-foreground/30",
              )}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={url}
                alt=""
                className="customer-catalog-media-img absolute inset-0 h-full w-full object-contain object-center"
                style={{ maxWidth: "none", maxHeight: "none" }}
                loading="lazy"
                decoding="async"
                onError={retryOriginalOnImageError}
              />
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={lightboxOpen}
        onOpenChange={(open) => {
          setLightboxOpen(open);
          if (!open) resetZoom();
        }}
      >
        <DialogContent
          className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0 sm:max-w-none [&>button.absolute]:hidden"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{alt} image viewer</DialogTitle>

          <div className="z-20 flex items-center justify-between gap-3 bg-black/80 px-3 py-2.5 text-white backdrop-blur-sm">
            <p className="text-sm font-medium text-white/85">
              {imgIx + 1} / {safeImages.length}
              {zoom > 1 ? ` · ${zoom.toFixed(1)}×` : ""}
            </p>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setZoomCentered(zoom - ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setZoomCentered(zoom + ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setLightboxOpen(false);
                  resetZoom();
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            {safeImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition hover:bg-black/75"
                  onClick={() => changeImage(imgIx - 1)}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition hover:bg-black/75"
                  onClick={() => changeImage(imgIx + 1)}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            )}

            <div
              ref={stageRef}
              className={cn(
                "absolute inset-0 overflow-hidden touch-none",
                zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
              )}
              onWheel={onWheelZoom}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={() => {
                if (zoom > 1) resetZoom();
                else setZoomCentered(2);
              }}
            >
              {/* Centered zoom stage — scale from the middle so the photo never jumps off-screen */}
              <div className="flex h-full w-full items-center justify-center p-3">
                <img
                  src={safeImages[imgIx]}
                  alt={alt}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: dragRef.current || pinchRef.current ? "none" : "transform 120ms ease-out",
                    willChange: "transform",
                  }}
                  onError={retryOriginalOnImageError}
                />
              </div>
            </div>
          </div>

          {safeImages.length > 1 && (
            <div className="z-20 flex justify-center gap-2 overflow-x-auto bg-black/80 px-3 py-2.5 backdrop-blur-sm">
              {safeImages.map((url, i) => (
                <button
                  key={`lb-thumb-${i}`}
                  type="button"
                  onClick={() => changeImage(i)}
                  className={cn(
                    "relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 bg-white/5",
                    i === imgIx ? "border-white" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <img src={url} alt="" className="h-full w-full object-contain" onError={retryOriginalOnImageError} />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
