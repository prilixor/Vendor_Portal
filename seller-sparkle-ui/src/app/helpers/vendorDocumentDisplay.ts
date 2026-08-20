/** Storage blob names look like `20260812125016743_a6c94387....pdf` — never show those to vendors. */
const STORED_BLOB_NAME = /^\d{14,}_[a-f0-9-]{20,}/i;

export function fileNameFromUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://local.invalid");
    return decodeURIComponent(parsed.pathname.split("/").pop() || "");
  } catch {
    const raw = (url.split("/").pop() || "").split("?")[0];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}

export function fileExtension(nameOrUrl?: string | null): string {
  const name = (nameOrUrl ?? "").split(/[?#]/)[0];
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function isStoredBlobFileName(name: string): boolean {
  return STORED_BLOB_NAME.test(name.trim());
}

/**
 * KYC-style subtitle: original upload name when we have it, otherwise a format label.
 * Storage keys (timestamp + GUID) stay internal.
 */
export function vendorDocumentFileLabel(opts: {
  documentType: string;
  fileUrl?: string | null;
  originalFileName?: string | null;
}): string {
  const original = opts.originalFileName?.trim();
  if (original && !isStoredBlobFileName(original)) {
    const base = original.split(/[\\/]/).pop() || original;
    return base.length > 48 ? `${base.slice(0, 45)}…` : base;
  }

  const fromUrl = fileNameFromUrl(opts.fileUrl ?? undefined);
  if (fromUrl && !isStoredBlobFileName(fromUrl)) {
    return fromUrl.length > 48 ? `${fromUrl.slice(0, 45)}…` : fromUrl;
  }

  const ext = fileExtension(original) || fileExtension(fromUrl) || fileExtension(opts.fileUrl);
  if (ext === "pdf") return "PDF document";
  if (["jpg", "jpeg"].includes(ext)) return "JPEG image";
  if (ext === "png") return "PNG image";
  if (ext === "webp") return "WEBP image";
  if (ext) return `${ext.toUpperCase()} file`;
  return "Uploaded file";
}
