import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Skeleton } from "@/app/components/ui/skeleton";
import { type TypedUploadOption } from "@/app/components/shared/TypedFileUploadPanel";
import { adminApi, ProductDocumentDto } from "@/app/services/adminApi";
import { apiClient } from "@/app/services/apiClient";
import {
  catalogDocumentExtension,
  catalogDocumentFileName,
  catalogDocumentTypeLabel,
} from "@/app/helpers/catalogDocuments";

const EQUIPMENT_DOC_TYPES: TypedUploadOption[] = [
  { value: "spec_sheet", label: "Spec Sheet" },
  { value: "warranty", label: "Warranty" },
  { value: "compliance", label: "Compliance" },
];

const CHEMICAL_DOC_TYPES: TypedUploadOption[] = [
  { value: "spec_sheet", label: "Spec Sheet" },
  { value: "sds", label: "SDS" },
  { value: "coa", label: "COA" },
  { value: "compliance", label: "Compliance" },
];

interface AdminProductDocumentsPanelProps {
  productId?: string | null;
  variant: "equipment" | "chemical";
  disabled?: boolean;
  onCountChange?: (count: number) => void;
}

export function AdminProductDocumentsPanel({
  productId,
  variant,
  disabled = false,
  onCountChange,
}: AdminProductDocumentsPanelProps) {
  const typeOptions = variant === "chemical" ? CHEMICAL_DOC_TYPES : EQUIPMENT_DOC_TYPES;
  const [documents, setDocuments] = useState<ProductDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductDocumentDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingTypeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setDocuments([]);
      onCountChange?.(0);
      return;
    }
    void loadDocuments(productId);
  }, [productId]);

  const loadDocuments = async (id: string) => {
    try {
      setLoading(true);
      const rows = await adminApi.getProductDocuments(id);
      setDocuments(rows);
      onCountChange?.(rows.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load product documents.";
      toast.error(message);
      setDocuments([]);
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  };

  const docsOfType = (type: string) =>
    documents.filter((d) => d.documentType.trim().toLowerCase() === type.trim().toLowerCase());

  const pickFile = (type: string) => {
    pendingTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const uploadForType = async (type: string, file: File) => {
    if (!productId) return;
    try {
      setBusyType(type);
      const upload = await adminApi.uploadProductDocumentFile(file);
      const fileRef = (upload.storageKey?.trim() || upload.fileUrl || "").trim();
      if (!fileRef) {
        toast.error("Upload failed — no file URL returned.");
        return;
      }
      await adminApi.addProductDocument(productId, {
        documentType: type,
        fileUrl: fileRef,
      });
      await loadDocuments(productId);
      toast.success(`${catalogDocumentTypeLabel(type)} saved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload document.";
      toast.error(message);
    } finally {
      setBusyType(null);
    }
  };

  const deleteDocument = async (documentId: string, type: string) => {
    if (!productId) return;
    try {
      setBusyType(type);
      await adminApi.deleteProductDocument(productId, documentId);
      if (preview?.id === documentId) setPreview(null);
      await loadDocuments(productId);
      toast.success("Document removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete document.";
      toast.error(message);
    } finally {
      setBusyType(null);
    }
  };

  const downloadUrl = async (url?: string) => {
    if (!url) return;
    try {
      const parsed = new URL(url, window.location.origin);
      const filename = decodeURIComponent(parsed.pathname.split("/").pop() || "file");
      await apiClient.downloadBlob(`/files/download?url=${encodeURIComponent(url)}`, filename);
    } catch {
      toast.error("Download failed.");
    }
  };

  const locked = disabled || loading;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const type = pendingTypeRef.current;
          pendingTypeRef.current = null;
          if (file && type) void uploadForType(type, file);
        }}
      />

      {!productId ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          Create the product first, then reopen this step to attach documents.
        </p>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            One file per type. Uploading again replaces the current file. Customers and vendors see these as read-only.
          </p>
          {typeOptions.map((type) => {
            const rows = docsOfType(type.value);
            const current = rows[0];
            const extras = rows.slice(1);
            const busy = busyType === type.value;
            return (
              <div key={type.value} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{type.label}</p>
                      <Badge variant={current ? "secondary" : "outline"} className="font-normal">
                        {current ? "Uploaded" : "Missing"}
                      </Badge>
                    </div>
                    {current ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {catalogDocumentFileName(current.fileUrl)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">PDF or image · shown on the product page</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {current ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={locked || busy}
                          onClick={() => setPreview(current)}
                          aria-label={`Preview ${type.label}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          disabled={locked || busy}
                          onClick={() => pickFile(type.value)}
                        >
                          <Upload className="mr-1 h-3.5 w-3.5" />
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={locked || busy}
                          onClick={() => void deleteDocument(current.id, type.value)}
                          aria-label={`Remove ${type.label}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        disabled={locked || busy}
                        onClick={() => pickFile(type.value)}
                      >
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
                {extras.length > 0 ? (
                  <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Extra copies of this type — remove them so only one file remains.
                    </p>
                    {extras.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                        <p className="min-w-0 truncate text-xs">{catalogDocumentFileName(doc.fileUrl)}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPreview(doc)}>
                            Preview
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={locked || busy}
                            onClick={() => void deleteDocument(doc.id, type.value)}
                            aria-label="Remove extra document"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1.25rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle className="text-base sm:text-lg">
              {preview ? catalogDocumentTypeLabel(preview.documentType) : "Document"}
            </DialogTitle>
            {preview ? (
              <p className="truncate text-xs text-muted-foreground">{catalogDocumentFileName(preview.fileUrl)}</p>
            ) : null}
          </DialogHeader>
          {preview ? (
            <div className="relative flex min-h-[50dvh] flex-1 items-center justify-center overflow-hidden bg-muted/30">
              {(() => {
                const extension = catalogDocumentExtension(preview.fileUrl);
                if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
                  return (
                    <img
                      src={preview.fileUrl}
                      alt=""
                      className="max-h-[70dvh] max-w-full object-contain p-3"
                    />
                  );
                }
                if (extension === "pdf") {
                  return <iframe src={preview.fileUrl} className="h-[70dvh] w-full border-0" title="PDF preview" />;
                }
                return <p className="px-6 text-center text-sm text-muted-foreground">Preview is not available for this file type.</p>;
              })()}
            </div>
          ) : null}
          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-5">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setPreview(null)}>
              Close
            </Button>
            {preview ? (
              <Button type="button" className="w-full sm:w-auto" onClick={() => void downloadUrl(preview.fileUrl)}>
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
