import { VendorDocument } from "@/app/models";
import { mockDocuments } from "@/app/services/mockData";

const STORAGE_KEY = "vendor_documents_v1";

type DocumentMap = Record<string, VendorDocument[]>;

const defaultDocuments: DocumentMap = {
  v1: mockDocuments.map((doc) => ({ ...doc, vendorId: "v1" })),
};

const readDocumentMap = (): DocumentMap => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultDocuments;
  }

  try {
    const parsed = JSON.parse(raw) as DocumentMap;
    return { ...defaultDocuments, ...parsed };
  } catch {
    return defaultDocuments;
  }
};

const saveDocumentMap = (data: DocumentMap) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getVendorDocuments = (vendorId: string): VendorDocument[] => {
  const data = readDocumentMap();
  return data[vendorId] ?? [];
};

export const saveVendorDocuments = (vendorId: string, documents: VendorDocument[]) => {
  const data = readDocumentMap();
  data[vendorId] = documents;
  saveDocumentMap(data);
};


