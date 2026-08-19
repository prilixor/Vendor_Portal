import { useState } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Input } from "@/app/components/ui/input";
import { AdminProductImagesPanel } from "@/app/components/admin/AdminProductImagesPanel";
import { AdminProductDocumentsPanel } from "@/app/components/admin/AdminProductDocumentsPanel";
import { ProductImageDto } from "@/app/services/adminApi";

interface TaxAvailabilityFields {
  gstPercent: number;
  isActive: boolean;
  gstError?: string;
  onGstChange: (value: number) => void;
  onActiveChange: (value: boolean) => void;
}

interface AdminProductMediaStepProps {
  productId?: string | null;
  variant: "equipment" | "chemical";
  imagesTitle?: string;
  showTaxSection?: boolean;
  tax?: TaxAvailabilityFields;
  images: ProductImageDto[];
  imagesLoading: boolean;
  uploadingImage: boolean;
  newImageUrl: string;
  newImageIsPrimary: boolean;
  busyImageId?: string | null;
  onNewImageUrlChange: (value: string) => void;
  onNewImageIsPrimaryChange: (value: boolean) => void;
  onUploadImages: (files: File[]) => void | Promise<void>;
  onAddImageFromUrl: (url: string) => void | Promise<void>;
  onSetPrimaryImage: (imageId: string) => void | Promise<void>;
  onDeleteImage: (imageId: string) => void | Promise<void>;
}

export function AdminProductMediaStep({
  productId,
  variant,
  imagesTitle,
  showTaxSection = false,
  tax,
  images,
  imagesLoading,
  uploadingImage,
  busyImageId = null,
  newImageUrl,
  newImageIsPrimary,
  onNewImageUrlChange,
  onNewImageIsPrimaryChange,
  onUploadImages,
  onAddImageFromUrl,
  onSetPrimaryImage,
  onDeleteImage,
}: AdminProductMediaStepProps) {
  const [docCount, setDocCount] = useState(0);
  const mediaLocked = uploadingImage || imagesLoading || busyImageId != null;

  return (
    <div className="space-y-4">
      {showTaxSection && tax ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Tax & availability</h4>
            <p className="text-xs text-muted-foreground">GST applies to customer checkout. Inactive products stay out of the catalog.</p>
          </div>
          <FormGrid cols={2}>
            <div className="space-y-1.5">
              <Label required>GST %</Label>
              <Input
                type="number"
                min={0}
                value={tax.gstPercent}
                onChange={(e) => tax.onGstChange(Number(e.target.value) || 0)}
                className={tax.gstError ? "border-destructive" : ""}
              />
              <FieldError message={tax.gstError} />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tax.isActive}
                  onChange={(e) => tax.onActiveChange(e.target.checked)}
                />
                Active in catalog
              </label>
            </div>
          </FormGrid>
        </section>
      ) : null}

      <Tabs defaultValue="images" className="space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger value="images" className="py-2 text-xs sm:text-sm">
            Images
            {images.length > 0 ? (
              <Badge variant="secondary" className="ml-1.5 hidden px-1.5 py-0 text-[10px] sm:inline-flex">
                {images.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="py-2 text-xs sm:text-sm">
            Documents
            {docCount > 0 ? (
              <Badge variant="secondary" className="ml-1.5 hidden px-1.5 py-0 text-[10px] sm:inline-flex">
                {docCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <AdminProductImagesPanel
            title={imagesTitle}
            productId={productId}
            images={images}
            loading={imagesLoading}
            uploading={uploadingImage}
            busyImageId={busyImageId}
            newImageUrl={newImageUrl}
            newImageIsPrimary={newImageIsPrimary}
            onNewImageUrlChange={onNewImageUrlChange}
            onNewImageIsPrimaryChange={onNewImageIsPrimaryChange}
            onUploadFiles={onUploadImages}
            onAddFromUrl={onAddImageFromUrl}
            onSetPrimary={onSetPrimaryImage}
            onDelete={onDeleteImage}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <AdminProductDocumentsPanel
            productId={productId}
            variant={variant}
            disabled={mediaLocked}
            onCountChange={setDocCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
