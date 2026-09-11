import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import type { CustomerPrescriptionFileApi } from "@/app/services/customerApi";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.pdf,.jpg,.jpeg,.png,.webp";

function isImage(contentType?: string | null, fileName?: string | null) {
  const type = (contentType || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(fileName || "");
}

type Props = {
  files: CustomerPrescriptionFileApi[];
  canEdit?: boolean;
  uploading?: boolean;
  onUpload?: (file: File) => void;
  onDelete?: (fileId: string) => void;
};

export function OrderPrescriptionFilesCard({ files, canEdit, uploading, onUpload, onDelete }: Props) {
  if (!canEdit && files.length === 0) return null;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
        <p className="text-[13px] font-semibold sm:text-base">Prescription</p>
        <p className="text-xs text-muted-foreground">
          Image or PDF. Doctor Unique ID is optional and separate.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
        {files.length > 0 ? (
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
              >
                {isImage(file.contentType, file.originalFileName) ? (
                  <a href={file.fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={file.fileUrl}
                      alt={file.originalFileName || "Prescription"}
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  </a>
                ) : (
                  <FileText className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
                )}
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-medium text-teal-800 underline-offset-2 hover:underline dark:text-teal-200"
                >
                  {file.originalFileName || "Prescription file"}
                </a>
                {canEdit && onDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onDelete(file.id)}
                    aria-label="Remove prescription"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No prescription uploaded yet.</p>
        )}

        {canEdit && onUpload && files.length < 3 ? (
          <label className="inline-flex">
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(file);
              }}
            />
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Upload image or PDF
              </span>
            </Button>
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
