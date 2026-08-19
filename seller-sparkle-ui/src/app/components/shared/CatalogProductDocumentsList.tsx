import { useState } from "react";
import { Download, ExternalLink, Eye, FileText, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { apiClient } from "@/app/services/apiClient";
import { cn } from "@/app/helpers/utils";
import {
  catalogDocumentExtension,
  catalogDocumentFileName,
  catalogDocumentFormatLabel,
  catalogDocumentTypeHint,
  catalogDocumentTypeLabel,
  isPreviewableCatalogDocument,
  sortCatalogDocuments,
  type CatalogDocumentItem,
} from "@/app/helpers/catalogDocuments";

interface CatalogProductDocumentsListProps {
  documents: CatalogDocumentItem[];
  variant?: "customer" | "vendor";
  density?: "compact" | "comfortable";
  className?: string;
  emptyText?: string;
  showVendorNote?: boolean;
}

function useDocumentActions() {
  const [preview, setPreview] = useState<CatalogDocumentItem | null>(null);

  const download = async (doc: CatalogDocumentItem) => {
    try {
      const filename = catalogDocumentFileName(doc.fileUrl);
      await apiClient.downloadBlob(`/files/download?url=${encodeURIComponent(doc.fileUrl)}`, filename);
      toast.success("Download started");
    } catch {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
      toast.message("Opened in a new tab");
    }
  };

  const openPreview = (doc: CatalogDocumentItem) => {
    if (isPreviewableCatalogDocument(doc.fileUrl)) {
      setPreview(doc);
      return;
    }
    window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    toast.message("Document opened in a new tab");
  };

  return { preview, setPreview, download, openPreview };
}

function DocumentPreviewDialog({
  preview,
  onClose,
  onDownload,
}: {
  preview: CatalogDocumentItem | null;
  onClose: () => void;
  onDownload: (doc: CatalogDocumentItem) => void;
}) {
  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(95dvh,920px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="text-base sm:text-lg">
            {preview ? catalogDocumentTypeLabel(preview.documentType) : "Document"}
          </DialogTitle>
          {preview ? (
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {catalogDocumentTypeHint(preview.documentType)}
            </p>
          ) : null}
        </DialogHeader>
        {preview ? (
          <div className="relative flex min-h-[45dvh] flex-1 items-stretch overflow-hidden bg-muted/30 sm:min-h-[50dvh]">
            {(() => {
              const extension = catalogDocumentExtension(preview.fileUrl);
              if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
                return (
                  <img
                    src={preview.fileUrl}
                    alt={catalogDocumentTypeLabel(preview.documentType)}
                    className="mx-auto max-h-[min(65dvh,720px)] w-full object-contain p-3 sm:max-h-[min(72dvh,780px)]"
                  />
                );
              }
              if (extension === "pdf") {
                return (
                  <iframe
                    src={preview.fileUrl}
                    className="h-[min(65dvh,720px)] w-full border-0 sm:h-[min(72dvh,780px)]"
                    title={catalogDocumentTypeLabel(preview.documentType)}
                  />
                );
              }
              return (
                <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Preview is not available — use Download or open in a new tab.
                </p>
              );
            })()}
          </div>
        ) : null}
        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
          {preview ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.open(preview.fileUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                <span className="sm:hidden">Open</span>
                <span className="hidden sm:inline">Open in tab</span>
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={() => onDownload(preview)}>
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDocumentRow({
  doc,
  onPreview,
  onDownload,
}: {
  doc: CatalogDocumentItem;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const label = catalogDocumentTypeLabel(doc.documentType);
  const format = catalogDocumentFormatLabel(doc.fileUrl);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{label}</p>
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 font-mono text-[9px] uppercase">
            {format}
          </Badge>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{catalogDocumentTypeHint(doc.documentType)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onPreview}>
          View
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onDownload}>
          Save
        </Button>
      </div>
    </li>
  );
}

export function CatalogProductDocumentsList({
  documents,
  variant = "customer",
  density = "compact",
  className,
  emptyText = "No documents available yet.",
  showVendorNote = true,
}: CatalogProductDocumentsListProps) {
  const { preview, setPreview, download, openPreview } = useDocumentActions();
  const items = sortCatalogDocuments(documents.filter((d) => d.fileUrl?.trim()));
  const isVendor = variant === "vendor";

  if (items.length === 0) {
    if (variant === "customer") return null;
    return (
      <div className={cn("rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center", className)}>
        <FileText className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/70" />
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ul className={cn("space-y-2", !isVendor && density === "comfortable" && "space-y-2.5")}>
        {items.map((doc) =>
          !isVendor && density === "compact" ? (
            <CustomerDocumentRow
              key={doc.id}
              doc={doc}
              onPreview={() => openPreview(doc)}
              onDownload={() => void download(doc)}
            />
          ) : (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{catalogDocumentTypeLabel(doc.documentType)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{catalogDocumentFileName(doc.fileUrl)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => openPreview(doc)}
                  aria-label={`Preview ${catalogDocumentTypeLabel(doc.documentType)}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => void download(doc)}
                  aria-label={`Download ${catalogDocumentTypeLabel(doc.documentType)}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      {isVendor && showVendorNote ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Uploaded by Admin — vendors can view but not change these files.
        </p>
      ) : null}

      <DocumentPreviewDialog
        preview={preview}
        onClose={() => setPreview(null)}
        onDownload={(doc) => void download(doc)}
      />
    </div>
  );
}

/** One-line customer links — tap name to view, icon to download. No cards or sheets. */
export function CustomerProductDocumentsInline({
  documents,
  className,
}: {
  documents: CatalogDocumentItem[];
  className?: string;
}) {
  const { preview, setPreview, download, openPreview } = useDocumentActions();
  const items = sortCatalogDocuments(documents.filter((d) => d.fileUrl?.trim()));

  if (items.length === 0) return null;

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Documents
        </span>
        <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {items.map((doc, index) => {
            const label = catalogDocumentTypeLabel(doc.documentType);
            return (
              <li key={doc.id} className="inline-flex items-center">
                {index > 0 ? (
                  <span className="mr-1 text-muted-foreground/35" aria-hidden>
                    ·
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    className="text-[13px] font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => openPreview(doc)}
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Download ${label}`}
                    onClick={() => void download(doc)}
                  >
                    <Download className="h-3 w-3" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <DocumentPreviewDialog
        preview={preview}
        onClose={() => setPreview(null)}
        onDownload={(doc) => void download(doc)}
      />
    </>
  );
}

export function CatalogDocumentsSection({
  title = "Product documents",
  documents,
  variant = "customer",
  layout,
}: {
  title?: string;
  documents: CatalogDocumentItem[];
  variant?: "customer" | "vendor";
  layout?: "inline" | "expanded";
}) {
  const items = documents.filter((d) => d.fileUrl?.trim());
  if (variant === "customer" && items.length === 0) return null;

  if (variant === "customer" && layout !== "expanded") {
    return <CustomerProductDocumentsInline documents={items} />;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        {variant === "vendor" ? (
          <Badge variant="secondary" className="font-normal">
            <Shield className="mr-1 h-3 w-3" />
            Read-only
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal tabular-nums">
            {items.length} file{items.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
      <CatalogProductDocumentsList
        documents={items}
        variant={variant}
        density="compact"
        emptyText="Admin has not uploaded catalog documents for this product yet."
      />
    </section>
  );
}
