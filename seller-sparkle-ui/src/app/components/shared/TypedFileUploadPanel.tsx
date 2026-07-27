import type { RefObject } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { DocumentFilePicker } from "@/app/components/shared/DocumentFilePicker";
import { cn } from "@/app/helpers/utils";

export interface TypedUploadOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface TypedFileUploadPanelProps {
  typeLabel?: string;
  typeValue: string;
  typeOptions: TypedUploadOption[];
  onTypeChange: (value: string) => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onUpload: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  busy?: boolean;
  uploadDisabled?: boolean;
  className?: string;
  title?: string;
  description?: string;
  fileLabel?: string;
  accept?: string;
  hint?: string;
  uploadButtonLabel?: string;
  typeLockedMessage?: string;
}

export function TypedFileUploadPanel({
  typeLabel = "Document type",
  typeValue,
  typeOptions,
  onTypeChange,
  selectedFile,
  onFileSelect,
  onUpload,
  inputRef,
  busy = false,
  uploadDisabled = false,
  className,
  title = "Add a file",
  description = "Choose the type, then browse or drag a file into the upload area below.",
  fileLabel,
  accept,
  hint,
  uploadButtonLabel = "Upload",
  typeLockedMessage,
}: TypedFileUploadPanelProps) {
  const selectedOption = typeOptions.find((option) => option.value === typeValue);
  const typeLocked = selectedOption?.disabled ?? false;
  const selectedTypeLabel = selectedOption?.label ?? typeValue;

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/70 bg-background p-4 sm:p-5", className)}>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="typed-upload-select">{typeLabel}</Label>
        <Select value={typeValue} onValueChange={onTypeChange} disabled={busy}>
          <SelectTrigger id="typed-upload-select" className="h-10 w-full">
            <SelectValue placeholder={`Select ${typeLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typeLocked ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {typeLockedMessage ?? (
            <>
              <span className="font-medium text-foreground">{selectedTypeLabel}</span> is already uploaded.
              Remove the existing file below if you need to replace it.
            </>
          )}
        </div>
      ) : (
        <DocumentFilePicker
          inputRef={inputRef}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          disabled={busy}
          accept={accept}
          hint={hint}
          label={fileLabel ?? `Upload file for ${selectedTypeLabel}`}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedFile
            ? "Review the selected file, then click upload."
            : "Select a file to enable upload."}
        </p>
        <Button
          type="button"
          onClick={onUpload}
          disabled={busy || uploadDisabled || !selectedFile || typeLocked}
          className="w-full sm:w-auto bg-gradient-primary shadow-glow"
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploadButtonLabel}
        </Button>
      </div>
    </div>
  );
}
