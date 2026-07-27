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

interface DocumentTypeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DocumentUploadPanelProps {
  documentType: string;
  documentTypeOptions: DocumentTypeOption[];
  onDocumentTypeChange: (value: string) => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onUpload: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  busy?: boolean;
  uploadDisabled?: boolean;
  className?: string;
}

export function DocumentUploadPanel({
  documentType,
  documentTypeOptions,
  onDocumentTypeChange,
  selectedFile,
  onFileSelect,
  onUpload,
  inputRef,
  busy = false,
  uploadDisabled = false,
  className,
}: DocumentUploadPanelProps) {
  const selectedOption = documentTypeOptions.find((option) => option.value === documentType);
  const typeLocked = selectedOption?.disabled ?? false;

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/70 bg-background p-4 sm:p-5", className)}>
      <div>
        <h3 className="text-sm font-semibold">Add a document</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the document type, then browse or drag a file into the upload area below.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="document-type-select">Document type</Label>
        <Select value={documentType} onValueChange={onDocumentTypeChange} disabled={busy}>
          <SelectTrigger id="document-type-select" className="h-10 w-full">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
            {documentTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {typeLocked ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{documentType}</span> is already uploaded.
          Delete the existing file from the list below if you need to replace it.
        </div>
      ) : (
        <DocumentFilePicker
          inputRef={inputRef}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          disabled={busy}
          label={`Upload file for ${documentType}`}
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
          Upload document
        </Button>
      </div>
    </div>
  );
}

export { TypedFileUploadPanel } from "@/app/components/shared/TypedFileUploadPanel";
