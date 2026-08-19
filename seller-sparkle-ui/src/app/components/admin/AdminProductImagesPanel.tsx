import { useState } from "react";
import { ImageOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FileUploadZone } from "@/app/components/shared/FileUploadZone";
import { ProductImageDto } from "@/app/services/adminApi";
import { cn } from "@/app/helpers/utils";
import { retryOriginalOnImageError } from "@/app/helpers/utils";

interface AdminProductImagesPanelProps {
  title?: string;
  productId?: string | null;
  images: ProductImageDto[];
  /** True only for the first load when there are no images yet. */
  loading: boolean;
  uploading: boolean;
  busyImageId?: string | null;
  newImageUrl: string;
  newImageIsPrimary: boolean;
  onNewImageUrlChange: (value: string) => void;
  onNewImageIsPrimaryChange: (value: boolean) => void;
  onUploadFiles: (files: File[]) => void | Promise<void>;
  onAddFromUrl: (url: string) => void | Promise<void>;
  onSetPrimary: (imageId: string) => void | Promise<void>;
  onDelete: (imageId: string) => void | Promise<void>;
}

function AdminProductImageTile({
  img,
  index,
  locked,
  busy,
  onSetPrimary,
  onDelete,
}: {
  img: ProductImageDto;
  index: number;
  locked: boolean;
  busy: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-muted/20",
        busy && "opacity-70",
      )}
    >
      <div className="aspect-square w-full">
        {broken ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/40 px-2 text-center">
            <ImageOff className="h-7 w-7 text-muted-foreground/70" />
            <span className="text-[10px] text-muted-foreground">Preview unavailable</span>
          </div>
        ) : (
          <img
            src={img.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.thumbFallback !== "1") {
                retryOriginalOnImageError(e);
                if (el.dataset.thumbFallback === "1") return;
              }
              setBroken(true);
            }}
          />
        )}
      </div>

      {img.isPrimary ? (
        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
          Primary
        </span>
      ) : null}

      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent p-2 pt-6 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          {!img.isPrimary ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 flex-1 px-2 text-[10px]"
              disabled={locked}
              onClick={onSetPrimary}
            >
              Set primary
            </Button>
          ) : (
            <span className="flex-1" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 bg-black/20 text-white hover:bg-destructive/90 hover:text-white"
            disabled={locked}
            onClick={onDelete}
            aria-label={`Delete image ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminProductImagesPanel({
  title = "Product images",
  productId,
  images,
  loading,
  uploading,
  busyImageId = null,
  newImageUrl,
  newImageIsPrimary,
  onNewImageUrlChange,
  onNewImageIsPrimaryChange,
  onUploadFiles,
  onAddFromUrl,
  onSetPrimary,
  onDelete,
}: AdminProductImagesPanelProps) {
  const locked = uploading || busyImageId != null;
  const showInitialSkeleton = loading && images.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold">{title}</Label>
        {productId && images.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {images.length} image{images.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {!productId ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Create the product first, then reopen this step to add images.
        </p>
      ) : (
        <>
          <FileUploadZone
            multiple
            accept="image/*"
            label="Upload images"
            hint="PNG, JPG, JPEG, WEBP · Select multiple files at once"
            showPreview={false}
            loading={uploading}
            disabled={locked || loading}
            onFilesSelected={(files) => void onUploadFiles(files)}
          />

          <details className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Advanced — paste image URL or storage key
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <Input
                value={newImageUrl}
                onChange={(e) => onNewImageUrlChange(e.target.value)}
                placeholder="https://… or uploads/…"
                disabled={locked || loading}
                className="h-9"
              />
              <label className="flex items-center gap-2 text-xs whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={newImageIsPrimary}
                  onChange={(e) => onNewImageIsPrimaryChange(e.target.checked)}
                  disabled={locked || loading}
                />
                Primary
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void onAddFromUrl(newImageUrl)}
                disabled={locked || loading || !newImageUrl.trim()}
              >
                Add URL
              </Button>
            </div>
          </details>

          {showInitialSkeleton ? (
            <div className="min-h-[8rem]" aria-busy="true" aria-label="Loading images" />
          ) : images.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              No images yet. Upload at least one photo for the catalog listing.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((img, index) => (
                <AdminProductImageTile
                  key={img.id}
                  img={img}
                  index={index}
                  locked={locked || loading}
                  busy={busyImageId === img.id}
                  onSetPrimary={() => void onSetPrimary(img.id)}
                  onDelete={() => void onDelete(img.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
