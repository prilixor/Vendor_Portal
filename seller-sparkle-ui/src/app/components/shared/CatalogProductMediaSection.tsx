import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, ImageIcon, ImageOff, Shield } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { cn, imageSrcCandidates, retryOriginalOnImageError } from "@/app/helpers/utils";
import {
  CatalogProductDocumentsList,
  type CatalogDocumentItem,
} from "@/app/components/shared/CatalogProductDocumentsList";
import { ZoomableImageStage } from "@/app/components/shared/ZoomableImageStage";

export type CatalogImageItem = {
  id?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  isPrimary?: boolean;
  displayOrder?: number;
};

function sortCatalogImages(images: CatalogImageItem[]): CatalogImageItem[] {
  return [...images]
    .filter((img) => img.imageUrl?.trim() || img.thumbnailUrl?.trim())
    .sort((a, b) => {
      const primaryDelta = Number(!!b.isPrimary) - Number(!!a.isPrimary);
      if (primaryDelta !== 0) return primaryDelta;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
}

function catalogImageDisplayUrl(img: CatalogImageItem): string | null {
  const thumb = img.thumbnailUrl?.trim();
  const full = img.imageUrl?.trim();
  if (thumb) return thumb;
  if (full) return full;
  return null;
}

function CatalogImageTile({
  img,
  index,
  onPreview,
}: {
  img: CatalogImageItem;
  index: number;
  onPreview: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const candidates = useMemo(
    () => imageSrcCandidates(img.thumbnailUrl ?? img.imageUrl, img.imageUrl),
    [img.imageUrl, img.thumbnailUrl],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const url = candidates[candidateIndex];

  return (
    <button
      type="button"
      onClick={onPreview}
      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 text-left transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`View catalog photo ${index + 1}${img.isPrimary ? " (primary)" : ""}`}
    >
      {broken || !url ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/30 px-2 text-center">
          <ImageOff className="h-6 w-6 text-muted-foreground/70" />
          <span className="text-[10px] text-muted-foreground">Unavailable</span>
        </div>
      ) : (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          onError={(e) => {
            if (candidateIndex + 1 < candidates.length) {
              setCandidateIndex((i) => i + 1);
              return;
            }
            retryOriginalOnImageError(e);
            if (e.currentTarget.dataset.thumbFallback === "1") {
              setBroken(true);
            }
          }}
        />
      )}
      {img.isPrimary ? (
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
          Primary
        </span>
      ) : null}
    </button>
  );
}

function CatalogImagePreviewDialog({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: CatalogImageItem[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const activeIndex = index ?? 0;
  const img = index != null ? images[activeIndex] : null;
  const url = img ? catalogImageDisplayUrl(img) ?? img.imageUrl?.trim() ?? null : null;
  const fullUrl = img?.imageUrl?.trim() ?? url;
  const hasMultiple = images.length > 1;

  const goTo = (next: number) => {
    if (images.length === 0) return;
    onIndexChange((next + images.length) % images.length);
  };

  return (
    <Dialog open={index != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 pr-12">
          <div>
            <p className="text-sm font-semibold">Catalog photo</p>
            {img?.isPrimary ? (
              <p className="text-xs text-muted-foreground">
                Primary image · uploaded by Admin
                {hasMultiple ? ` · ${activeIndex + 1} of ${images.length}` : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Uploaded by Admin
                {hasMultiple ? ` · ${activeIndex + 1} of ${images.length}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col bg-muted/20">
          {fullUrl ? (
            <ZoomableImageStage src={fullUrl} resetKey={`${activeIndex}-${fullUrl}`} />
          ) : (
            <div className="flex min-h-[40dvh] flex-1 flex-col items-center justify-center gap-2 text-muted-foreground sm:min-h-[50dvh]">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm">Preview unavailable</p>
            </div>
          )}
          {hasMultiple ? (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background"
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background"
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {fullUrl ? (
            <Button type="button" asChild>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                Open in tab
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only Admin catalog photos for vendor surfaces. */
export function CatalogProductImagesGrid({
  images,
  className,
}: {
  images: CatalogImageItem[];
  className?: string;
}) {
  const sorted = sortCatalogImages(images);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (sorted.length === 0) return null;

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
        {sorted.map((img, index) => (
          <CatalogImageTile
            key={img.id ?? `${img.imageUrl}-${index}`}
            img={img}
            index={index}
            onPreview={() => setPreviewIndex(index)}
          />
        ))}
      </div>
      <CatalogImagePreviewDialog
        images={sorted}
        index={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onIndexChange={setPreviewIndex}
      />
    </>
  );
}

function CatalogThumbPreview({
  images,
  limit,
  overlap,
  sizeClass,
}: {
  images: CatalogImageItem[];
  limit: number;
  overlap?: boolean;
  sizeClass: string;
}) {
  const shown = images.slice(0, limit);
  const extra = Math.max(0, images.length - shown.length);

  return (
    <div className={cn("flex items-center", overlap ? "-space-x-2" : "gap-1.5")}>
      {shown.map((img, index) => {
        const url = catalogImageDisplayUrl(img);
        const isLast = index === shown.length - 1;
        return (
          <div
            key={img.id ?? `${img.imageUrl}-${index}`}
            className={cn(
              "relative overflow-hidden rounded-lg border-2 border-background bg-muted shadow-sm",
              sizeClass,
            )}
            style={overlap ? { zIndex: shown.length - index } : undefined}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {isLast && extra > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-semibold text-white">
                +{extra}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Compact row — opens photos & documents in a separate dialog (keeps edit forms short). */
export function CatalogMediaLauncher({
  images = [],
  documents = [],
  title = "Catalog media",
}: {
  images?: CatalogImageItem[];
  documents?: CatalogDocumentItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const sortedImages = sortCatalogImages(images);
  const docItems = documents.filter((d) => d.fileUrl?.trim());
  const hasImages = sortedImages.length > 0;
  const hasDocs = docItems.length > 0;
  const hasMedia = hasImages || hasDocs;

  const summaryParts = [
    hasImages ? `${sortedImages.length} photo${sortedImages.length === 1 ? "" : "s"}` : null,
    hasDocs ? `${docItems.length} document${docItems.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  if (!hasMedia) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2.5 text-xs text-muted-foreground">
        Admin has not uploaded catalog photos or documents for this product yet.
      </p>
    );
  }

  const defaultTab = hasImages ? "photos" : "documents";
  const fileIcon = (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-10 sm:w-10">
      <FileText className="h-5 w-5" />
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.03] sm:flex-row sm:items-center sm:gap-3 sm:px-3.5 sm:py-3"
      >
        <div className="flex items-center justify-between gap-3 sm:contents">
          <div className="min-w-0 sm:shrink-0">
            {hasImages ? (
              <>
                <div className="sm:hidden">
                  <CatalogThumbPreview images={sortedImages} limit={4} sizeClass="h-11 w-11" />
                </div>
                <div className="hidden sm:block">
                  <CatalogThumbPreview images={sortedImages} limit={4} overlap sizeClass="h-10 w-10" />
                </div>
              </>
            ) : (
              fileIcon
            )}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:hidden" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-normal">
              <Shield className="mr-1 h-3 w-3" />
              Read-only
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{summaryParts.join(" · ")}</p>
        </div>

        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(88dvh,760px)] w-[calc(100vw-1.25rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 text-left sm:px-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Official product photos and documents uploaded by Admin. You can view and download but not edit them.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {hasImages && hasDocs ? (
              <Tabs defaultValue={defaultTab} className="space-y-3">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
                  <TabsTrigger value="photos" className="py-2 text-xs sm:text-sm">
                    Photos ({sortedImages.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="py-2 text-xs sm:text-sm">
                    Documents ({docItems.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="photos" className="mt-0">
                  <CatalogProductImagesGrid images={sortedImages} />
                </TabsContent>
                <TabsContent value="documents" className="mt-0">
                  <CatalogProductDocumentsList
                    documents={docItems}
                    variant="vendor"
                    density="compact"
                    showVendorNote={false}
                  />
                </TabsContent>
              </Tabs>
            ) : hasImages ? (
              <CatalogProductImagesGrid images={sortedImages} />
            ) : (
              <CatalogProductDocumentsList
                documents={docItems}
                variant="vendor"
                density="compact"
                showVendorNote={false}
              />
            )}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Combined Admin catalog photos + documents (inline — use launcher in compact forms). */
export function CatalogMediaSection({
  images = [],
  documents = [],
  title = "Catalog media",
}: {
  images?: CatalogImageItem[];
  documents?: CatalogDocumentItem[];
  title?: string;
}) {
  const sortedImages = sortCatalogImages(images);
  const docItems = documents.filter((d) => d.fileUrl?.trim());
  const hasImages = sortedImages.length > 0;
  const hasDocs = docItems.length > 0;

  if (!hasImages && !hasDocs) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-muted/15 px-3.5 py-6 text-center sm:px-4">
        <ImageIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No catalog media yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Admin has not uploaded product photos or documents for this catalog item.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        <Badge variant="secondary" className="font-normal">
          <Shield className="mr-1 h-3 w-3" />
          Read-only
        </Badge>
      </div>

      <div className="space-y-4">
        {hasImages ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Photos
              <span className="ml-1.5 tabular-nums text-foreground/80">({sortedImages.length})</span>
            </p>
            <CatalogProductImagesGrid images={sortedImages} />
          </div>
        ) : null}

        {hasImages && hasDocs ? <div className="border-t border-border/70" /> : null}

        {hasDocs ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Documents
              <span className="ml-1.5 tabular-nums text-foreground/80">({docItems.length})</span>
            </p>
            <CatalogProductDocumentsList
              documents={docItems}
              variant="vendor"
              density="compact"
              showVendorNote={false}
              emptyText="Admin has not uploaded catalog documents for this product yet."
            />
          </div>
        ) : null}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Shield className="h-3 w-3 shrink-0" />
        Uploaded by Admin — vendors can view but not change these files.
      </p>
    </section>
  );
}
