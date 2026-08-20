import { fileExtension, fileNameFromUrl, isStoredBlobFileName, vendorDocumentFileLabel } from "@/app/helpers/vendorDocumentDisplay";

export type CatalogDocumentItem = {
  id: string;
  documentType: string;
  fileUrl: string;
};

const TYPE_LABELS: Record<string, string> = {
  spec_sheet: "Spec Sheet",
  sds: "Safety Data Sheet (SDS)",
  coa: "Certificate of Analysis (COA)",
  warranty: "Warranty",
  compliance: "Compliance",
};

/** Short customer-facing hint shown under each document title. */
const TYPE_HINTS: Record<string, string> = {
  spec_sheet: "Product specifications, dimensions, and technical details.",
  sds: "Safety, handling, storage, and emergency information.",
  coa: "Quality, purity, and batch analysis certificate.",
  warranty: "Manufacturer warranty coverage and terms.",
  compliance: "Regulatory approvals and certification documents.",
};

const PREFERRED_ORDER = ["spec_sheet", "sds", "coa", "warranty", "compliance"];

export function catalogDocumentTypeLabel(type: string): string {
  const key = type.trim().toLowerCase();
  if (TYPE_LABELS[key]) return TYPE_LABELS[key];
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function catalogDocumentTypeHint(type: string): string {
  const key = type.trim().toLowerCase();
  if (TYPE_HINTS[key]) return TYPE_HINTS[key];
  return "Official product document — view online or download a copy.";
}

export function catalogDocumentFormatLabel(url: string): string {
  const ext = catalogDocumentExtension(url);
  if (ext === "pdf") return "PDF";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Image";
  if (ext) return ext.toUpperCase();
  return "File";
}

export function sortCatalogDocuments<T extends { documentType: string }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a.documentType.trim().toLowerCase());
    const bi = PREFERRED_ORDER.indexOf(b.documentType.trim().toLowerCase());
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

/** Raw storage filename from the URL — used for extension / preview, never shown as-is when it is a blob key. */
export function catalogDocumentStoredFileName(url?: string): string {
  return fileNameFromUrl(url);
}

/**
 * Vendor/customer subtitle. Human names stay (`acetone_sds.pdf`); timestamp+GUID blob keys become "PDF document".
 */
export function catalogDocumentFileName(url?: string): string {
  return vendorDocumentFileLabel({
    documentType: "Document",
    fileUrl: url,
  });
}

/** Saved download name: original when readable, otherwise `spec_sheet.pdf`. */
export function catalogDocumentDownloadFileName(doc: { documentType?: string; fileUrl?: string }): string {
  const stored = catalogDocumentStoredFileName(doc.fileUrl);
  if (stored && !isStoredBlobFileName(stored)) return stored;
  const ext = catalogDocumentExtension(doc.fileUrl || "") || "pdf";
  const slug = (doc.documentType || "document").trim().toLowerCase().replace(/[^\w]+/g, "-") || "document";
  return `${slug}.${ext}`;
}

export function catalogDocumentExtension(url: string): string {
  return fileExtension(catalogDocumentStoredFileName(url) || url);
}

export function isPreviewableCatalogDocument(url: string): boolean {
  const ext = catalogDocumentExtension(url);
  return ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}
