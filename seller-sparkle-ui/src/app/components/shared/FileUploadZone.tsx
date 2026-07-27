import { useCallback, useRef, useState, type DragEvent, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { CloudUpload, FileSpreadsheet, FileText, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/helpers/utils";

const DEFAULT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickPreviewIcon(accept: string): LucideIcon {
  if (accept.includes("image")) return ImageIcon;
  if (accept.includes(".xls")) return FileSpreadsheet;
  return FileText;
}

export interface FileUploadZoneProps {
  selectedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  onFilesSelected?: (files: File[]) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  hideLabel?: boolean;
  hint?: string;
  className?: string;
  compact?: boolean;
  showPreview?: boolean;
  dropTitle?: string;
  dropDescription?: string;
  browseButtonLabel?: string;
  readyLabel?: string;
}

export function FileUploadZone({
  selectedFile = null,
  onFileSelect,
  onFilesSelected,
  inputRef,
  accept = DEFAULT_ACCEPT,
  multiple = false,
  disabled = false,
  loading = false,
  label = "Upload file",
  hideLabel = false,
  hint = "PDF, PNG, JPG, JPEG, or WEBP",
  className,
  compact = false,
  showPreview = true,
  dropTitle,
  dropDescription,
  browseButtonLabel = "Browse files",
  readyLabel = "Ready to upload",
}: FileUploadZoneProps) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? localInputRef;
  const [isDragging, setIsDragging] = useState(false);
  const isDisabled = disabled || loading;
  const PreviewIcon = pickPreviewIcon(accept);

  const openFileDialog = useCallback(() => {
    if (isDisabled) return;
    resolvedRef.current?.click();
  }, [isDisabled, resolvedRef]);

  const emitFiles = useCallback(
    (files: File[]) => {
      if (isDisabled || files.length === 0) return;

      if (onFilesSelected) {
        onFilesSelected(files);
        if (!showPreview && resolvedRef.current) {
          resolvedRef.current.value = "";
        }
        return;
      }

      onFileSelect?.(files[0] ?? null);
    },
    [isDisabled, onFilesSelected, onFileSelect, showPreview, resolvedRef],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    emitFiles(files);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDisabled) setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDisabled) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (isDisabled) return;

    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
    emitFiles(multiple ? files : files.slice(0, 1));
    if (resolvedRef.current) {
      resolvedRef.current.value = "";
    }
  };

  const clearFile = () => {
    onFileSelect?.(null);
    if (resolvedRef.current) {
      resolvedRef.current.value = "";
    }
  };

  const title = dropTitle ?? (isDragging ? "Drop your file here" : multiple ? "Drag & drop files here" : "Drag & drop your file here");
  const description =
    dropDescription ?? "or click anywhere in this box to browse files on your computer";

  return (
    <div className={cn("space-y-2", className)}>
      {!hideLabel && label ? <Label>{label}</Label> : null}

      <Input
        ref={resolvedRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={isDisabled}
        className="sr-only"
        onChange={handleInputChange}
      />

      {showPreview && selectedFile ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PreviewIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)} · {loading ? "Uploading..." : readyLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={clearFile}
            disabled={isDisabled}
            aria-label="Remove selected file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          onClick={openFileDialog}
          onKeyDown={(event) => {
            if (isDisabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFileDialog();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-disabled={isDisabled}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all",
            compact ? "min-h-[132px] py-4" : "min-h-[168px]",
            isDisabled && "cursor-not-allowed opacity-60",
            isDragging
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-primary/5",
          )}
        >
          <div
            className={cn(
              "mb-3 flex items-center justify-center rounded-full transition-colors",
              compact ? "h-10 w-10" : "h-12 w-12",
              isDragging ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground group-hover:text-primary",
            )}
          >
            {loading ? (
              <Loader2 className={cn("animate-spin", compact ? "h-5 w-5" : "h-6 w-6")} />
            ) : (
              <CloudUpload className={compact ? "h-5 w-5" : "h-6 w-6"} />
            )}
          </div>

          <p className="text-sm font-medium text-foreground">
            {loading ? "Uploading..." : title}
          </p>
          {!loading && (
            <>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
              {hint ? <p className="mt-3 text-[11px] text-muted-foreground/90">{hint}</p> : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 pointer-events-none"
                disabled={isDisabled}
                tabIndex={-1}
              >
                <Upload className="mr-2 h-4 w-4" />
                {browseButtonLabel}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
