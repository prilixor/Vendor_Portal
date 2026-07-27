import type { RefObject } from "react";
import { FileUploadZone, type FileUploadZoneProps } from "@/app/components/shared/FileUploadZone";

interface DocumentFilePickerProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  accept?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}

export function DocumentFilePicker({
  selectedFile,
  onFileSelect,
  inputRef,
  accept,
  disabled,
  label = "Upload document",
  hint = "PDF, PNG, JPG, JPEG, or WEBP",
  className,
}: DocumentFilePickerProps) {
  return (
    <FileUploadZone
      selectedFile={selectedFile}
      onFileSelect={onFileSelect}
      inputRef={inputRef}
      accept={accept}
      disabled={disabled}
      label={label}
      hint={hint}
      className={className}
      showPreview
    />
  );
}

export type { FileUploadZoneProps };
