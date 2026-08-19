import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn, retryOriginalOnImageError } from "@/app/helpers/utils";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type ZoomableImageStageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Reset zoom/pan when this changes (e.g. image index). */
  resetKey?: string | number;
  showControls?: boolean;
  showHint?: boolean;
};

/** Pinch, wheel, drag-pan, and double-click zoom for catalog/product previews. */
export function ZoomableImageStage({
  src,
  alt = "",
  className,
  resetKey,
  showControls = true,
  showHint = true,
}: ZoomableImageStageProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const maxPanFor = useCallback((z: number) => {
    const stage = stageRef.current;
    if (!stage || z <= 1) return { x: 0, y: 0 };
    const { clientWidth: w, clientHeight: h } = stage;
    return {
      x: ((z - 1) * w) / 2,
      y: ((z - 1) * h) / 2,
    };
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pinchRef.current = null;
    dragRef.current = null;
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

  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (resetKey === prevResetKey.current) return;
    prevResetKey.current = resetKey;
    resetZoom();
  }, [resetKey, resetZoom]);

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

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      {showControls ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-border/80 bg-background/90 p-1 shadow-sm backdrop-blur-sm">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoomCentered(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[2.75rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
            {zoom.toFixed(1)}×
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setZoomCentered(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className={cn(
          "relative min-h-[40dvh] flex-1 overflow-hidden touch-none sm:min-h-[50dvh]",
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
        <div className="flex h-full w-full items-center justify-center p-3">
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-[min(72dvh,780px)] max-w-full select-none object-contain"
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

      {showHint ? (
        <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/85 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
          Scroll, pinch, or double-click to zoom
          {zoom > 1 ? " · drag to pan" : ""}
        </p>
      ) : null}
    </div>
  );
}
