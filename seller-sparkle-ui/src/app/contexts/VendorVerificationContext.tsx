import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import type { VendorDocument, VerificationStatus } from "@/app/models";
import {
  computeVendorVerificationSnapshot,
  normalizeVerificationStatus,
  type VendorVerificationSnapshot,
} from "@/app/helpers/vendorVerification";

interface VendorVerificationContextValue extends VendorVerificationSnapshot {
  isLoading: boolean;
  isReady: boolean;
  refresh: () => Promise<void>;
}

const VendorVerificationContext = createContext<VendorVerificationContextValue | null>(null);

function mapDocuments(
  docsDto: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorDocuments>>,
): VendorDocument[] {
  return docsDto.map((doc) => ({
    id: doc.id,
    vendorId: doc.vendorId,
    type: doc.documentType,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    status: normalizeVerificationStatus(doc.verificationStatus),
    rejectionReason: doc.rejectionReason,
    uploadedAt: doc.uploadedAtUtc
      ? new Date(doc.uploadedAtUtc).toLocaleDateString()
      : "—",
  }));
}

function mapBankStatus(
  accounts: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorBankAccounts>>,
): VerificationStatus {
  const primary = accounts[0];
  return normalizeVerificationStatus(primary?.verificationStatus);
}

export function VendorVerificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const vendorId = user?.role === "vendor" ? user.id : undefined;

  const query = useQuery({
    queryKey: ["vendor-verification", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const [status, documents, bankAccounts] = await Promise.all([
        vendorOnboardingApi.getVendorStatus(vendorId!),
        vendorOnboardingApi.getVendorDocuments(vendorId!),
        vendorOnboardingApi.getVendorBankAccounts(vendorId!),
      ]);

      return computeVendorVerificationSnapshot({
        accountStatus: status.accountStatus,
        registrationStage: status.registrationStage,
        documents: mapDocuments(documents),
        bankStatus: mapBankStatus(bankAccounts),
      });
    },
    refetchInterval: (current) =>
      current.state.data?.operationsBlocked ? 30_000 : false,
    refetchOnWindowFocus: (current) => !!current.state.data?.operationsBlocked,
  });

  const value = useMemo<VendorVerificationContextValue>(() => {
    const snapshot =
      query.data ??
      computeVendorVerificationSnapshot({
        accountStatus: null,
        registrationStage: null,
        documents: [],
        bankStatus: "pending",
      });

    return {
      ...snapshot,
      isLoading: query.isLoading,
      isReady: !vendorId || query.isSuccess || query.isError,
      refresh: async () => {
        await query.refetch();
      },
    };
  }, [query.data, query.isLoading, query.isSuccess, query.isError, query.refetch, vendorId]);

  return (
    <VendorVerificationContext.Provider value={value}>
      {children}
    </VendorVerificationContext.Provider>
  );
}

export function useVendorVerification() {
  const context = useContext(VendorVerificationContext);
  if (!context) {
    throw new Error("useVendorVerification must be used within VendorVerificationProvider");
  }
  return context;
}

export function useOptionalVendorVerification() {
  return useContext(VendorVerificationContext);
}
