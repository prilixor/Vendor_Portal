import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Stepper } from "@/app/components/shared/Stepper";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/app/components/ui/command";
import { ArrowLeft, ArrowRight, Upload, FileText, Trash2, ShieldCheck, CheckCircle2, Eye, Building2, ChevronLeft, MoreVertical, ChevronDown, Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { missingAddressFieldLabels } from "@/app/helpers/reverseGeocode";
import { useAuth } from "@/app/guards/AuthContext";
import { BankDetails, BusinessProfile, VendorDocument, VerificationStatus } from "@/app/models";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { AdminCommentHint } from "@/app/components/shared/AdminCommentHint";
import { OnboardingRejectedHelpBanner } from "@/app/components/shared/OnboardingRejectedHelpBanner";
import { RequiredDocumentsChecklist } from "@/app/components/shared/RequiredDocumentsChecklist";
import { DocumentUploadPanel } from "@/app/components/shared/DocumentUploadPanel";
import {
  buildDocumentChecklist,
  getMissingDocumentTypes,
  REQUIRED_DOCUMENT_TYPES,
} from "@/app/helpers/vendorVerification";
import { sanitizeAdminComment, buildVerificationSupportMessage } from "@/app/helpers/adminComment";
import { useSupportChat } from "@/app/contexts/SupportChatContext";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";
import { cn, toCamelCase } from "@/app/helpers/utils";
import {
  INDIAN_MOBILE_MESSAGE,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/app/helpers/indianMobilePhone";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";

const steps = [
  { label: "Basic Info", description: "Account" },
  { label: "Business", description: "Profile" },
  { label: "Documents", description: "KYC" },
  { label: "Bank", description: "Payouts" },
  { label: "Review", description: "Submit" },
];

const defaultProfile: BusinessProfile = {
  businessName: "",
  ownerName: "",
  phone: "",
  gstNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  latitude: 19.07,
  longitude: 72.87,
};

const defaultBank: BankDetails = {
  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  branchName: "",
  ifscCode: "",
  status: "pending",
};

const Onboarding = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { refresh: refreshVerification } = useVendorVerification();
  const { openSupportChat } = useSupportChat();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [profile, setProfile] = useState<BusinessProfile>(defaultProfile);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [bank, setBank] = useState<BankDetails>(defaultBank);
  const [submission, setSubmission] = useState<VerificationStatus>("pending");
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);
  const [viewMode, setViewMode] = useState<"onboarding" | "profile">("onboarding");
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [originalProfile, setOriginalProfile] = useState<BusinessProfile | null>(null);
  const [originalBank, setOriginalBank] = useState<BankDetails | null>(null);
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(urlTab || "profile");

  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [documentType, setDocumentType] = useState("GST Certificate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationTokenExpiryUtc, setVerificationTokenExpiryUtc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRefMobile = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: string } | null>(null);
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // State and City API state
  const [states, setStates] = useState<{ name: string; iso2: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [selectedStateIso2, setSelectedStateIso2] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateProfileFields = (): boolean => {
    const errors: Record<string, string> = {};
    if (!profile.businessName.trim()) errors.businessName = "Please enter your business name.";
    if (!profile.ownerName.trim()) errors.ownerName = "Please enter the owner's name.";
    if (!profile.addressLine1.trim()) errors.addressLine1 = "Please enter address line 1.";
    if (!profile.city.trim()) errors.city = "Please select a city.";
    if (!profile.state.trim()) errors.state = "Please select a state.";
    if (!profile.postalCode.trim()) errors.postalCode = "Please enter a postal code.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const validateBankFields = (): boolean => {
    const errors: Record<string, string> = {};
    if (!bank.accountHolderName.trim()) errors.accountHolderName = "Please enter the account holder name.";
    if (!bank.accountNumber.trim()) errors.accountNumber = "Please enter the account number.";
    if (!bank.confirmAccountNumber.trim()) {
      errors.confirmAccountNumber = "Please confirm the account number.";
    } else if (bank.accountNumber !== bank.confirmAccountNumber) {
      errors.confirmAccountNumber = "Account numbers do not match.";
    }
    if (!bank.ifscCode.trim()) errors.ifscCode = "Please enter the IFSC code.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleStepClick = (idx: number) => {
    // Allow clicking on completed steps or the current step
    if (completedSteps.has(idx) || idx === step) {
      setStep(idx);
      return;
    }

    // Allow clicking on the next step if current step is complete
    if (idx === step + 1) {
      handleContinue();
    }
  };

  const updateProfile = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) => {
    setProfile((p) => ({ ...p, [k]: v }));
    clearFieldError(k as string);
  };

  const updateBank = <K extends keyof typeof bank>(k: K, v: (typeof bank)[K]) => {
    // Only allow numeric characters for account number
    if (k === "accountNumber" || k === "confirmAccountNumber") {
      v = v.replace(/[^0-9]/g, "") as (typeof bank)[K];
    }
    setBank((p) => ({ ...p, [k]: v }));
    clearFieldError(k as string);
  };

  const validateIFSC = (ifsc: string): boolean => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc.toUpperCase());
  };

  const fetchBankDetails = async (ifsc: string) => {
    if (!validateIFSC(ifsc)) {
      setIfscError("Invalid IFSC format. Must be 11 characters: 4 letters + 0 + 6 alphanumeric");
      return;
    }

    setIfscLoading(true);
    setIfscError(null);

    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (!response.ok) {
        throw new Error("IFSC not found");
      }
      const data = await response.json();
      if (!data || !data.BANK || !data.BRANCH) {
        throw new Error("Invalid IFSC code");
      }

      setBank((prev) => ({
        ...prev,
        bankName: data.BANK,
        branchName: data.BRANCH,
      }));
      setIfscError(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      setIfscError(message);
      setBank((prev) => ({
        ...prev,
        bankName: "",
        branchName: "",
      }));
    } finally {
      setIfscLoading(false);
    }
  };

  const handleIFSCBlur = () => {
    if (bank.ifscCode && bank.ifscCode.length === 11) {
      fetchBankDetails(bank.ifscCode);
    } else if (!bank.ifscCode) {
      // Clear bank name and branch name when IFSC is empty
      setBank((prev) => ({
        ...prev,
        bankName: "",
        branchName: "",
      }));
      setIfscError(null);
    }
  };

  const mapStatus = (status?: string): VerificationStatus => {
    if (!status) return "pending";
    if (status === "under_review" || status === "submitted") return "under_review";
    if (status === "approved" || status === "rejected" || status === "pending") return status;
    return "pending";
  };

  // Fetch states from API
  useEffect(() => {
    const fetchStates = async () => {
      setStatesLoading(true);
      setStatesError(null);
      try {
        const response = await vendorOnboardingApi.getIndianStates();
        setStates(response);
      } catch (error) {
        console.error("Failed to fetch states:", error);
        const message = getUserFriendlyMessage(error);
        setStatesError(message || "Failed to load states.");
      } finally {
        setStatesLoading(false);
      }
    };

    fetchStates();
  }, []);

  // Set selectedStateIso2 when states are loaded and profile has a state
  useEffect(() => {
    if (states.length > 0 && profile.state) {
      const selectedState = states.find(s => s.name === profile.state);
      if (selectedState) {
        setSelectedStateIso2(selectedState.iso2);
      }
    }
  }, [states, profile.state]);

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!selectedStateIso2) {
        setCities([]);
        return;
      }

      setCitiesLoading(true);
      setCitiesError(null);
      try {
        const response = await vendorOnboardingApi.getCitiesByState(selectedStateIso2);
        setCities(response.map((city) => city.name));
      } catch (error) {
        console.error("Failed to fetch cities:", error);
        const message = getUserFriendlyMessage(error);
        setCitiesError(message || "Failed to load cities.");
      } finally {
        setCitiesLoading(false);
      }
    };

    fetchCities();
  }, [selectedStateIso2]);

  const getFileNameFromUrl = (url?: string) => {
    if (!url) return "";
    try {
      // Use URL to parse path, fallback to simple split
      const parsed = new URL(url, window.location.origin);
      const name = parsed.pathname.split("/").pop() || "";
      return decodeURIComponent(name);
    } catch {
      const raw = (url.split("/").pop() || "").split("?")[0];
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  };

  const mapDocuments = (docsDto: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorDocuments>>) =>
    docsDto.map((doc) => ({
      id: doc.id,
      vendorId: doc.vendorId,
      type: doc.documentType,
      fileName: getFileNameFromUrl(doc.fileUrl) || doc.documentType,
      fileUrl: doc.fileUrl,
      status: mapStatus(doc.verificationStatus),
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.verifiedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    }));

  useEffect(() => {
    if (!user) return;

    const loadOnboardingData = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        const [profileRes, docsRes, bankRes, verificationRes, statusRes] = await Promise.allSettled([
          vendorOnboardingApi.getVendorProfile(user.id),
          vendorOnboardingApi.getVendorDocuments(user.id),
          vendorOnboardingApi.getVendorBankAccounts(user.id),
          vendorOnboardingApi.getVerificationRequests(user.id),
          vendorOnboardingApi.getVendorStatus(user.id),
        ]);

        const completed = new Set<number>();

        if (profileRes.status === "fulfilled") {
          const profileDto = profileRes.value;
          setProfile((prev) => ({
            ...prev,
            businessName: profileDto.businessName,
            ownerName: profileDto.ownerName,
            phone: normalizeIndianMobileDigits(profileDto.supportPhone || ""),
            gstNumber: profileDto.gstNumber ?? "",
            addressLine1: profileDto.addressLine1,
            addressLine2: profileDto.addressLine2 ?? "",
            city: profileDto.city,
            state: profileDto.state,
            postalCode: profileDto.postalCode,
            latitude: profileDto.latitude ?? prev.latitude,
            longitude: profileDto.longitude ?? prev.longitude,
          }));
          // Set selectedStateIso2 when profile loads with existing state
          if (profileDto.state) {
            setSelectedStateIso2(null); // Will be set after states are loaded
          }
          // Step 0 (Basic Info) is always complete
          completed.add(0);
          // Step 1 (Business Profile) is complete if profile exists
          if (profileDto.businessName && profileDto.ownerName && profileDto.supportPhone) {
            completed.add(1);
          }
        }

        if (docsRes.status === "fulfilled") {
          setDocuments(mapDocuments(docsRes.value));
          // Step 2 (Documents) is complete if documents exist
          if (docsRes.value.length > 0) {
            completed.add(2);
          }
        } else {
          const reason = docsRes.reason instanceof Error ? docsRes.reason.message : "Failed to load documents.";
          toast.error(reason);
        }

        if (bankRes.status === "fulfilled" && bankRes.value.length > 0) {
          const latestBank = bankRes.value[0];
          setBank({
            accountHolderName: latestBank.accountHolderName,
            bankName: latestBank.bankName,
            accountNumber: latestBank.accountNumber,
            confirmAccountNumber: latestBank.accountNumber,
            branchName: latestBank.branchName || "",
            ifscCode: latestBank.ifscCode,
            status: mapStatus(latestBank.verificationStatus),
          });
          setBankAccountId(latestBank.id);
          // Step 3 (Bank) is complete if bank account exists
          completed.add(3);
        }

        if (verificationRes.status === "fulfilled" && verificationRes.value.length > 0) {
          setSubmission(mapStatus(verificationRes.value[0].reviewStatus));
          setHasSubmittedBefore(true);
          // Step 4 (Review) is complete if submitted
          completed.add(4);
        }

        if (statusRes.status === "fulfilled") {
          setAccountStatus(statusRes.value.accountStatus);
          setIsEmailVerified(statusRes.value.isEmailVerified);
          setVerificationTokenExpiryUtc(statusRes.value.verificationTokenExpiryUtc ?? null);
        }

        // Switch to profile view if vendor has submitted before
        if (hasSubmittedBefore || (verificationRes.status === "fulfilled" && verificationRes.value.length > 0)) {
          setViewMode("profile");
        }

        setCompletedSteps(completed);
      } catch (error) {
        const message = getUserFriendlyMessage(error);
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void loadOnboardingData();
  }, [user]);

  const syncVerificationState = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendor-verification"] }),
      refreshVerification(),
    ]);
  }, [queryClient, refreshVerification]);

  useEffect(() => {
    const nextMissing = getMissingDocumentTypes(documents)[0];
    if (nextMissing) {
      setDocumentType(nextMissing);
    }
  }, [documents]);

  const validateDocumentsForProgress = useCallback(() => {
    const missing = getMissingDocumentTypes(documents);
    const rejected = documents.filter((doc) => doc.status === "rejected");
    if (missing.length > 0) {
      toast.error(`Upload all required documents before continuing: ${missing.join(", ")}`);
      return false;
    }
    if (rejected.length > 0) {
      toast.error(`Re-upload rejected documents before continuing: ${rejected.map((doc) => doc.type).join(", ")}`);
      return false;
    }
    return true;
  }, [documents]);

  const handleFileUpload = async () => {
    if (!user) return;
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    // Check if document type already exists
    const existingDoc = documents.find((doc) => doc.type === documentType);
    if (existingDoc) {
      toast.error("This document is already uploaded. Please delete the existing file before uploading a new one.");
      return;
    }

    try {
      setBusy(true);
      const uploaded = await vendorOnboardingApi.uploadVendorFile(user.id, selectedFile);
      await vendorOnboardingApi.addVendorDocument(user.id, {
        vendorId: user.id,
        documentType,
        fileUrl: uploaded.storageKey ?? uploaded.fileUrl,
      });

      const latestDocs = await vendorOnboardingApi.getVendorDocuments(user.id);
      setDocuments(mapDocuments(latestDocs));
      setSelectedFile(null);
      // Reset file input value
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (fileInputRefMobile.current) fileInputRefMobile.current.value = "";
      await syncVerificationState();
      toast.success("Document uploaded. Awaiting verification.");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = (id: string) => {
    setDeleteDocConfirmId(id);
  };

  const confirmRemoveDoc = async () => {
    if (!user || !deleteDocConfirmId) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorDocument(user.id, deleteDocConfirmId);
      const latestDocs = await vendorOnboardingApi.getVendorDocuments(user.id);
      setDocuments(mapDocuments(latestDocs));
      await syncVerificationState();
      toast.success("Document deleted.");
      setDeleteDocConfirmId(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const previewDoc = (doc: VendorDocument) => {
    if (!doc.fileUrl) {
      toast.info("Preview is available for newly uploaded files.");
      return;
    }
    const openPreview = (doc: VendorDocument) => {
      const previewUrl = getPreviewUrl(doc.fileUrl);
      setPdfLoading(true);
      setPreviewDocument({ url: previewUrl, type: doc.type });
    };
    openPreview(doc);
  };

  const saveProfile = async () => {
    if (!user) return;

    await vendorOnboardingApi.upsertVendorProfile(user.id, {
      vendorId: user.id,
      businessName: profile.businessName,
      ownerName: profile.ownerName,
      supportPhone: profile.phone,
      gstNumber: profile.gstNumber,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      latitude: profile.latitude,
      longitude: profile.longitude,
    });
  };

  const saveBank = async () => {
    if (!user) return;

    if (bankAccountId) {
      const updated = await vendorOnboardingApi.updateVendorBankAccount(user.id, bankAccountId, {
        vendorId: user.id,
        bankAccountId,
        accountHolderName: bank.accountHolderName,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        branchName: bank.branchName,
        ifscCode: bank.ifscCode,
      });
      setBankAccountId(updated.id);
      return;
    }

    const created = await vendorOnboardingApi.createVendorBankAccount(user.id, {
      vendorId: user.id,
      accountHolderName: bank.accountHolderName,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      branchName: bank.branchName,
      ifscCode: bank.ifscCode,
    });
    setBankAccountId(created.id);
  };

  const handleContinue = async () => {
    if (step === 0) {
      // Validate phone number in basic info (Indian mobile)
      if (!profile.phone.trim()) {
        toast.error("Phone number is required");
        return;
      }
      if (!isValidIndianMobile(profile.phone)) {
        toast.error(INDIAN_MOBILE_MESSAGE);
        return;
      }
    }

    if (step === 1) {
      // Validate required profile fields before saving
      if (!validateProfileFields()) return;
      try {
        setBusy(true);
        await saveProfile();
        toast.success("Business profile saved.");
      } catch (error) {
        const message = getUserFriendlyMessage(error);
        toast.error(message);
        return;
      } finally {
        setBusy(false);
      }
    }

    if (step === 2) {
      if (!validateDocumentsForProgress()) return;
    }

    if (step === 3) {
      // Validate required bank details fields
      if (!validateBankFields()) return;
      if (!bank.bankName.trim()) {
        toast.error("Please enter a valid IFSC code to auto-fill bank name");
        return;
      }
      if (!bank.branchName.trim()) {
        toast.error("Please enter a valid IFSC code to auto-fill branch name");
        return;
      }
      try {
        setBusy(true);
        await saveBank();
        toast.success("Bank details saved.");
      } catch (error) {
        const message = getUserFriendlyMessage(error);
        toast.error(message);
        return;
      } finally {
        setBusy(false);
      }
    }

    // Mark current step as complete before moving
    setCompletedSteps((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const submit = async () => {
    if (!user) return;

    if (!validateDocumentsForProgress()) return;

    // Validate bank details before final submission
    if (!validateBankFields()) return;
    if (!bank.bankName.trim()) { toast.error("Please enter a valid IFSC code to auto-fill bank name"); return; }
    if (!bank.branchName.trim()) { toast.error("Please enter a valid IFSC code to auto-fill branch name"); return; }

    try {
      setBusy(true);
      await saveProfile();
      await saveBank();
      const verification = await vendorOnboardingApi.createVerificationRequest(user.id);
      setSubmission(mapStatus(verification.reviewStatus));
      setHasSubmittedBefore(true);
      setViewMode("profile");
      await syncVerificationState();
      toast.success("Application submitted! Our team will review within 24 hours.");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleEditSection = (sectionIndex: number) => {
    // Store original values before editing so we can restore on cancel
    if (sectionIndex === 1) {
      setOriginalProfile({ ...profile });
    } else if (sectionIndex === 3) {
      setOriginalBank({ ...bank });
    }
    setFieldErrors({});
    setEditingSection(sectionIndex);
    setStep(sectionIndex);
  };

  const handleSaveSection = async () => {
    if (editingSection === 1) {
      // Validate required profile fields
      if (!validateProfileFields()) return;
      if (!profile.gstNumber.trim()) {
        toast.error("Please fill in GSTIN");
        return;
      }
      // GSTIN validation: 15 characters (2 state code + 10 PAN + 1 entity number + 1 check character + 1 Z)
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(profile.gstNumber.trim().toUpperCase())) {
        toast.error("Please enter a valid 15-digit GSTIN");
        return;
      }
      await saveProfile();
    } else if (editingSection === 3) {
      // Validate required bank details fields
      if (!validateBankFields()) return;
      if (!bank.bankName.trim()) {
        toast.error("Please enter a valid IFSC code to auto-fill bank name");
        return;
      }
      if (!bank.branchName.trim()) {
        toast.error("Please enter a valid IFSC code to auto-fill branch name");
        return;
      }
      await saveBank();
    }
    setEditingSection(null);
    toast.success("Section updated successfully.");
  };

  const handleCancelEdit = () => {
    // Restore original values when canceling edit
    if (editingSection === 1 && originalProfile) {
      setProfile(originalProfile);
      setOriginalProfile(null);
    } else if (editingSection === 3 && originalBank) {
      setBank(originalBank);
      setOriginalBank(null);
    }
    setFieldErrors({});
    setEditingSection(null);
  };

  const rejectedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "rejected"),
    [documents],
  );
  const documentChecklist = useMemo(() => buildDocumentChecklist(documents), [documents]);
  const missingDocuments = useMemo(() => getMissingDocumentTypes(documents), [documents]);
  const uploadedDocumentTypes = useMemo(() => new Set(documents.map((doc) => doc.type)), [documents]);
  const documentTypeOptions = useMemo(
    () =>
      REQUIRED_DOCUMENT_TYPES.map((type) => ({
        value: type,
        label: uploadedDocumentTypes.has(type) ? `${type} (uploaded)` : `${type} (required)`,
        disabled: uploadedDocumentTypes.has(type),
      })),
    [uploadedDocumentTypes],
  );
  const hasRejectedVerificationItems = useMemo(
    () => rejectedDocuments.length > 0 || bank.status === "rejected",
    [rejectedDocuments, bank.status],
  );

  const openVerificationSupportHelp = useCallback(() => {
    const { message, category } = buildVerificationSupportMessage(
      rejectedDocuments,
      bank.status === "rejected",
    );
    openSupportChat({ message, category });
  }, [rejectedDocuments, bank.status, openSupportChat]);

  // Show loading state until data is fully loaded to prevent UI flicker
  if (!hasLoaded) {
    return (
      <div className="min-h-[60vh] p-6">
        {/* Header Skeleton */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Stepper Skeleton */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="hidden flex-1 space-y-1 sm:block">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-2/3" />
                </div>
                {i < 5 && <Skeleton className="hidden h-0.5 flex-1 sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content Cards Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-6">
              <Skeleton className="mb-4 h-5 w-24" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {viewMode === "profile" ? (
        // PROFILE VIEW MODE - Admin-style design
        <>
          <PageHeader
            title={toCamelCase(editingSection === 1 ? (originalProfile?.businessName || profile.businessName || user?.name || "Vendor") : (profile.businessName || user?.name || "Vendor"))}
            description={`${toCamelCase(editingSection === 1 ? (originalProfile?.ownerName || profile.ownerName || "") : (profile.ownerName || ""))} · ${editingSection === 1 ? (originalProfile?.city || profile.city || "") : (profile.city || "")}`}
            breadcrumbs={[
              { label: "Vendor", href: "/vendor" },
              { label: "Profile" },
            ]}
            actions={
              <Button onClick={submit} className="bg-gradient-primary shadow-glow" disabled={busy}>
                Submit for Verification
              </Button>
            }
          />

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-soft text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">{toCamelCase(editingSection === 1 ? (originalProfile?.businessName || profile.businessName || user?.name) : (profile.businessName || user?.name))}</p>
                  <p className="text-sm text-muted-foreground">{toCamelCase(editingSection === 1 ? (originalProfile?.ownerName || profile.ownerName || "") : (profile.ownerName || ""))} · {user?.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <StatusBadge status={accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
                <div className="text-xs text-muted-foreground">
                  Email {isEmailVerified ? "verified" : "unverified"}
                  {!isEmailVerified && verificationTokenExpiryUtc ? ` · Link expires ${new Date(verificationTokenExpiryUtc).toLocaleDateString()}` : ""}
                </div>
              </div>
            </div>
          </Card>

          {hasRejectedVerificationItems && (
            <OnboardingRejectedHelpBanner
              rejectedDocuments={rejectedDocuments}
              rejectedBank={bank.status === "rejected"}
              onGetHelp={openVerificationSupportHelp}
            />
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto rounded-lg p-1">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="docs">Docs</TabsTrigger>
              <TabsTrigger value="bank">Bank</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Business Profile</h2>
                  <Button variant="outline" size="sm" onClick={() => handleEditSection(1)} disabled={editingSection !== null}>
                    Edit
                  </Button>
                </div>
                {editingSection === 1 ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground -mt-2">
                      Fields marked <span className="text-destructive">*</span> are required.
                    </p>
                    <FormGrid cols={3}>
                      <Field required label="Business name" value={profile.businessName} onChange={(v) => updateProfile("businessName", v)} error={fieldErrors.businessName} />
                      <Field required label="Owner name" value={profile.ownerName} onChange={(v) => updateProfile("ownerName", v)} error={fieldErrors.ownerName} />
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <IndianMobileInput
                          value={profile.phone}
                          onChange={() => {}}
                          readOnly
                          className="bg-muted/50"
                        />
                      </div>
                      <Field label="GST number" value={profile.gstNumber} onChange={(v) => updateProfile("gstNumber", v)} />
                      <StateCityCombobox
                        required
                        label="State"
                        value={profile.state}
                        options={states.map(s => s.name)}
                        onChange={(v) => {
                          updateProfile("state", v);
                          updateProfile("city", "");
                          const selectedState = states.find(s => s.name === v);
                          setSelectedStateIso2(selectedState?.iso2 || null);
                        }}
                        placeholder={statesLoading ? "Loading states..." : "Select state"}
                        disabled={statesLoading}
                        error={fieldErrors.state}
                      />
                      <StateCityCombobox
                        required
                        label="City"
                        value={profile.city}
                        options={cities}
                        onChange={(v) => updateProfile("city", v)}
                        placeholder={citiesLoading ? "Loading cities..." : profile.state ? "Select city" : "Select state first"}
                        disabled={!profile.state || citiesLoading}
                        error={fieldErrors.city}
                      />
                      <Field required className="sm:col-span-2" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateProfile("addressLine1", v)} error={fieldErrors.addressLine1} />
                      <Field className="sm:col-span-2" label="Address line 2 (optional)" value={profile.addressLine2 ?? ""} onChange={(v) => updateProfile("addressLine2", v)} />
                      <Field required label="Postal code" value={profile.postalCode} onChange={(v) => updateProfile("postalCode", v)} error={fieldErrors.postalCode} />
                    </FormGrid>
                    {(statesError || citiesError) && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {citiesError ?? statesError}
                      </p>
                    )}
                    <div className="space-y-2 pt-2">
                      <Label>Pin your business location</Label>
                      <MapPicker
                        latitude={profile.latitude}
                        longitude={profile.longitude}
                        onChange={(lat, lng) => {
                          updateProfile("latitude", lat);
                          updateProfile("longitude", lng);
                        }}
                        onAddressResolved={(address) => {
                          const nextLine1 = address?.line1 || profile.addressLine1;
                          const nextCity = address?.city || profile.city;
                          let nextState = profile.state;
                          const nextPostal = address?.postal || profile.postalCode;

                          if (address?.line1) updateProfile("addressLine1", address.line1);
                          if (address?.city) updateProfile("city", address.city);
                          if (address?.postal) updateProfile("postalCode", address.postal);
                          if (address?.state) {
                            const matched = states.find(
                              (s) => s.name.toLowerCase() === address.state!.toLowerCase(),
                            );
                            if (matched) {
                              nextState = matched.name;
                              updateProfile("state", matched.name);
                              setSelectedStateIso2(matched.iso2);
                            } else {
                              nextState = address.state;
                              updateProfile("state", address.state);
                            }
                          }

                          const missing = missingAddressFieldLabels({
                            line1: nextLine1,
                            city: nextCity,
                            state: nextState,
                            postal: nextPostal,
                          });
                          if (missing.length === 0) {
                            toast.success("Location applied from map.");
                          } else {
                            toast.message(`Map pin saved. Please fill required ${missing.join(", ")}.`);
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveSection} disabled={busy}>Save</Button>
                      <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Business" value={toCamelCase(editingSection === 1 ? (originalProfile?.businessName || profile.businessName || "Not set") : (profile.businessName || "Not set"))} />
                    <Detail label="Owner" value={toCamelCase(editingSection === 1 ? (originalProfile?.ownerName || profile.ownerName || "Not set") : (profile.ownerName || "Not set"))} />
                    <Detail label="Phone" value={editingSection === 1 ? (originalProfile?.phone || profile.phone || "Not set") : (profile.phone || "Not set")} />
                    <Detail label="GSTIN" value={editingSection === 1 ? (originalProfile?.gstNumber || profile.gstNumber || "Not set") : (profile.gstNumber || "Not set")} />
                    <Detail label="City" value={editingSection === 1 ? (originalProfile?.city || profile.city || "Not set") : (profile.city || "Not set")} />
                    <Detail label="State" value={editingSection === 1 ? (originalProfile?.state || profile.state || "Not set") : (profile.state || "Not set")} />
                    <Detail className="sm:col-span-2" label="Address" value={`${editingSection === 1 ? (originalProfile?.addressLine1 || profile.addressLine1 || "") : (profile.addressLine1 || "")} ${editingSection === 1 ? (originalProfile?.addressLine2 || profile.addressLine2 || "") : (profile.addressLine2 || "")}`.trim() || "Not set"} />
                    <Detail label="Pincode" value={editingSection === 1 ? (originalProfile?.postalCode || profile.postalCode || "Not set") : (profile.postalCode || "Not set")} />
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="docs">
              <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
                <h2 className="text-lg font-semibold mb-4">Documents</h2>
                <RequiredDocumentsChecklist items={documentChecklist} className="mb-4" />
                <DocumentUploadPanel
                  documentType={documentType}
                  documentTypeOptions={documentTypeOptions}
                  onDocumentTypeChange={setDocumentType}
                  selectedFile={selectedFile}
                  onFileSelect={setSelectedFile}
                  onUpload={() => void handleFileUpload()}
                  inputRef={fileInputRef}
                  busy={busy}
                />
                <div className="space-y-3 mt-4">
                  {/* Mobile card view */}
                  <div className="block sm:hidden space-y-3">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="p-3 border-border/60">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.type}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">{doc.uploadedAt}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <StatusBadge status={doc.status} />
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewDoc(doc)} disabled={busy}>
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeDoc(doc.id)} disabled={busy}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {doc.status === "rejected" && (
                              <AdminCommentHint
                                className="mt-2"
                                itemLabel={doc.type}
                                comment={sanitizeAdminComment(doc.rejectionReason)}
                              />
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {documents.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground border rounded-xl">
                        No documents uploaded yet.
                      </div>
                    )}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Document</th>
                          <th className="px-4 py-3 font-semibold">Uploaded</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium">{doc.type}</p>
                                  <p className="text-xs text-muted-foreground truncate" title={doc.fileName}>{doc.fileName}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{doc.uploadedAt}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <StatusBadge status={doc.status} />
                                {doc.status === "rejected" && (
                                  <AdminCommentHint
                                    itemLabel={doc.type}
                                    comment={sanitizeAdminComment(doc.rejectionReason)}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => previewDoc(doc)} disabled={busy}>
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeDoc(doc.id)} disabled={busy}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {documents.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                              No documents uploaded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="bank">
              <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Bank Details</h2>
                  <Button variant="outline" size="sm" onClick={() => handleEditSection(3)} disabled={editingSection !== null}>
                    Edit
                  </Button>
                </div>
                {editingSection === 3 ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground -mt-2">
                      Fields marked <span className="text-destructive">*</span> are required.
                    </p>
                    <FormGrid cols={2}>
                      <Field required label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} error={fieldErrors.accountHolderName} />
                      <Field required label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} error={fieldErrors.accountNumber} />
                      <Field required label="Confirm account number" value={bank.confirmAccountNumber} onChange={(v) => updateBank("confirmAccountNumber", v)} error={fieldErrors.confirmAccountNumber} />
                      <div className="space-y-1.5">
                        <Label required>IFSC code</Label>
                        <div className="relative">
                          <Input
                            value={bank.ifscCode}
                            onChange={(e) => updateBank("ifscCode", e.target.value)}
                            onBlur={handleIFSCBlur}
                            disabled={ifscLoading}
                            className={fieldErrors.ifscCode ? "border-destructive" : ""}
                          />
                          {ifscLoading && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                          )}
                        </div>
                        <FieldError message={fieldErrors.ifscCode} />
                        {ifscError && <p className="text-xs text-destructive">{ifscError}</p>}
                      </div>
                      <Field label="Bank name" value={bank.bankName} onChange={(v) => updateBank("bankName", v)} readonly />
                      <Field label="Branch name" value={bank.branchName} onChange={(v) => updateBank("branchName", v)} readonly />
                    </FormGrid>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveSection} disabled={busy || ifscLoading}>Save</Button>
                      <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Account holder name" value={bank.accountHolderName || "Not set"} />
                    <Detail label="Bank name" value={bank.bankName || "Not set"} />
                    <Detail label="Account number" value={bank.accountNumber || "Not set"} />
                    <Detail label="Branch name" value={bank.branchName || "Not set"} />
                    <Detail label="IFSC code" value={bank.ifscCode || "Not set"} />
                  </div>
                )}
                <div className="rounded-lg border border-info/20 bg-info-soft p-3 text-xs text-info mt-4">
                  <ShieldCheck className="mr-1.5 inline h-4 w-4" />
                  Bank details are encrypted and used only for payouts.
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        // ONBOARDING VIEW MODE
        <>
          <PageHeader
            title="Vendor onboarding"
            description="Complete all steps to get verified and start listing products."
          />

          <Card className="p-4 sm:p-6 lg:p-8 shadow-elegant border-border/60">
            <div className="mb-6">
              <Stepper steps={steps} current={step} onStepClick={handleStepClick} completedSteps={completedSteps} />
            </div>

            {loadError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-2 text-sm text-destructive">
                {loadError}
              </div>
            )}

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto px-1">
              {/* STEP 1 */}
              {step === 0 && (
                <div className="space-y-5 max-w-xl animate-fade-in">
                  <h2 className="text-lg font-semibold">Basic information</h2>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={user?.email ?? ""} readOnly className="bg-muted/50" />
                    <p className="text-xs text-muted-foreground">This is the email tied to your account and cannot be changed here.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" required>Phone Number</Label>
                    <IndianMobileInput
                      id="phone"
                      value={profile.phone}
                      onChange={() => {}}
                      readOnly
                      placeholder="Phone from your account"
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Phone is synced from your account and cannot be edited here.</p>
                    {!profile.phone && <p className="text-xs text-destructive">Phone number is required</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>User type</Label>
                    <Input value={user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : "Vendor"} readOnly className="bg-muted/50" />
                  </div>
                </div>
              )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <h2 className="text-lg font-semibold">Business profile</h2>
            <p className="text-xs text-muted-foreground -mt-3">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
            <FormGrid cols={2}>
              <Field required label="Business name" value={profile.businessName} onChange={(v) => updateProfile("businessName", v)} error={fieldErrors.businessName} />
              <Field required label="Owner name" value={profile.ownerName} onChange={(v) => updateProfile("ownerName", v)} error={fieldErrors.ownerName} />
              <Field label="GST number" value={profile.gstNumber} onChange={(v) => updateProfile("gstNumber", v)} />
              <Field required className="sm:col-span-2" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateProfile("addressLine1", v)} error={fieldErrors.addressLine1} />
              <Field className="sm:col-span-2" label="Address line 2 (optional)" value={profile.addressLine2 ?? ""} onChange={(v) => updateProfile("addressLine2", v)} />
              <StateCityCombobox
                required
                label="State"
                value={profile.state}
                options={states.map(s => s.name)}
                onChange={(v) => {
                  updateProfile("state", v);
                  updateProfile("city", "");
                  const selectedState = states.find(s => s.name === v);
                  setSelectedStateIso2(selectedState?.iso2 || null);
                }}
                placeholder={statesLoading ? "Loading states..." : "Select state"}
                disabled={statesLoading}
                error={fieldErrors.state}
              />
              <StateCityCombobox
                required
                label="City"
                value={profile.city}
                options={cities}
                onChange={(v) => updateProfile("city", v)}
                placeholder={citiesLoading ? "Loading cities..." : profile.state ? "Select city" : "Select state first"}
                disabled={!profile.state || citiesLoading}
                error={fieldErrors.city}
              />
              <Field required label="Postal code" value={profile.postalCode} onChange={(v) => updateProfile("postalCode", v)} error={fieldErrors.postalCode} />
            </FormGrid>
            {(statesError || citiesError) && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {citiesError ?? statesError}
              </p>
            )}
            <div className="space-y-2 pt-2">
              <Label>Pin your business location</Label>
              <MapPicker
                latitude={profile.latitude}
                longitude={profile.longitude}
                onChange={(lat, lng) => {
                  updateProfile("latitude", lat);
                  updateProfile("longitude", lng);
                }}
                onAddressResolved={(address) => {
                  const nextLine1 = address?.line1 || profile.addressLine1;
                  const nextCity = address?.city || profile.city;
                  let nextState = profile.state;
                  const nextPostal = address?.postal || profile.postalCode;

                  if (address?.line1) updateProfile("addressLine1", address.line1);
                  if (address?.city) updateProfile("city", address.city);
                  if (address?.postal) updateProfile("postalCode", address.postal);
                  if (address?.state) {
                    const matched = states.find(
                      (s) => s.name.toLowerCase() === address.state!.toLowerCase(),
                    );
                    if (matched) {
                      nextState = matched.name;
                      updateProfile("state", matched.name);
                      setSelectedStateIso2(matched.iso2);
                    } else {
                      nextState = address.state;
                      updateProfile("state", address.state);
                    }
                  }

                  const missing = missingAddressFieldLabels({
                    line1: nextLine1,
                    city: nextCity,
                    state: nextState,
                    postal: nextPostal,
                  });
                  if (missing.length === 0) {
                    toast.success("Location applied from map.");
                  } else {
                    toast.message(`Map pin saved. Please fill required ${missing.join(", ")}.`);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            {hasRejectedVerificationItems && (
              <OnboardingRejectedHelpBanner
                rejectedDocuments={rejectedDocuments}
                rejectedBank={bank.status === "rejected"}
                onGetHelp={openVerificationSupportHelp}
              />
            )}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Document verification</h2>
              <p className="text-sm text-muted-foreground">
                Upload all five required documents. Each document is reviewed individually — you can see what is missing, pending, or rejected below.
              </p>
              <RequiredDocumentsChecklist items={documentChecklist} />
              <DocumentUploadPanel
                documentType={documentType}
                documentTypeOptions={documentTypeOptions}
                onDocumentTypeChange={setDocumentType}
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                onUpload={() => void handleFileUpload()}
                inputRef={fileInputRefMobile}
                busy={busy}
              />
            </div>
            {/* Mobile card view */}
            <div className="block sm:hidden space-y-3">
              {documents.map((doc) => (
                <Card key={doc.id} className="p-3 border-border/60">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.type}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{doc.uploadedAt}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <StatusBadge status={doc.status} />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => previewDoc(doc)} disabled={busy}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDoc(doc.id)} disabled={busy}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                      {doc.status === "rejected" && (
                        <AdminCommentHint
                          className="mt-2"
                          itemLabel={doc.type}
                          comment={sanitizeAdminComment(doc.rejectionReason)}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {documents.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-xl">
                  No documents uploaded yet.
                </div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Uploaded</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.type}</p>
                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.uploadedAt}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <StatusBadge status={doc.status} />
                          {doc.status === "rejected" && (
                            <AdminCommentHint
                              itemLabel={doc.type}
                              comment={sanitizeAdminComment(doc.rejectionReason)}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => previewDoc(doc)} disabled={busy}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(doc.id)} disabled={busy}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No documents uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {step === 3 && (
          <div className="space-y-5 max-w-2xl animate-fade-in">
            <h2 className="text-lg font-semibold">Bank details</h2>
            <p className="text-xs text-muted-foreground -mt-3">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
            <FormGrid cols={2}>
              <Field required label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} error={fieldErrors.accountHolderName} />
              <Field required label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} error={fieldErrors.accountNumber} />
              <Field required label="Confirm account number" value={bank.confirmAccountNumber} onChange={(v) => updateBank("confirmAccountNumber", v)} error={fieldErrors.confirmAccountNumber} />
              <div className="space-y-1.5">
                <Label required>IFSC code</Label>
                <div className="relative">
                  <Input
                    value={bank.ifscCode}
                    onChange={(e) => updateBank("ifscCode", e.target.value)}
                    onBlur={handleIFSCBlur}
                    disabled={ifscLoading}
                    className={fieldErrors.ifscCode ? "border-destructive" : ""}
                  />
                  {ifscLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
                <FieldError message={fieldErrors.ifscCode} />
                {ifscError && <p className="text-xs text-destructive">{ifscError}</p>}
              </div>
              <Field label="Bank name" value={bank.bankName} onChange={(v) => updateBank("bankName", v)} readonly />
              <Field label="Branch name" value={bank.branchName} onChange={(v) => updateBank("branchName", v)} readonly />
            </FormGrid>
            <div className="rounded-lg border border-info/20 bg-info-soft p-3 text-xs text-info">
              <ShieldCheck className="mr-1.5 inline h-4 w-4" />
              Bank details are encrypted and used only for payouts.
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {step === 4 && (
          <div className="max-w-xl animate-fade-in text-center">
            {(() => {
              const statusConfig: Record<string, { icon: any; color: string; title: string; description: string }> = {
                approved: {
                  icon: CheckCircle2,
                  color: "bg-success-soft text-success",
                  title: "Application Approved",
                  description: "Congratulations! Your vendor application has been approved. You can now start listing your products and accepting orders.",
                },
                rejected: {
                  icon: CheckCircle2,
                  color: "bg-destructive-soft text-destructive",
                  title: "Application Rejected",
                  description: "Your application was not approved. Please review the feedback and resubmit with updated information.",
                },
                suspended: {
                  icon: CheckCircle2,
                  color: "bg-warning-soft text-warning",
                  title: "Application Suspended",
                  description: "Your vendor account has been suspended. Please contact support for more information.",
                },
                banned: {
                  icon: CheckCircle2,
                  color: "bg-destructive-soft text-destructive",
                  title: "Application Banned",
                  description: "Your vendor account has been banned. This action is permanent.",
                },
                under_review: {
                  icon: CheckCircle2,
                  color: "bg-info-soft text-info",
                  title: "Application Under Review",
                  description: "Our team is reviewing your business details and documents. You'll receive an update via email and in-app notification.",
                },
                active: {
                  icon: CheckCircle2,
                  color: "bg-success-soft text-success",
                  title: "Application Approved",
                  description: "Congratulations! Your vendor application has been approved. You can now start listing your products and accepting orders.",
                },
              };

              const config = statusConfig[accountStatus] || statusConfig.active;
              const Icon = config.icon;

              return (
                <>
                  <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.color}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h2 className="text-xl font-semibold">{config.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {config.description}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Account status:</span>
                    <StatusBadge status={accountStatus as VerificationStatus} />
                  </div>
                </>
              );
            })()}
            <div className="mt-8 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Review my info</Button>
              {(accountStatus === "rejected" || accountStatus === "suspended") && (
                <Button onClick={submit}>Resubmit</Button>
              )}
            </div>
          </div>
        )}
            </div>

            {/* Footer actions - only show in onboarding mode */}
            {viewMode === "onboarding" && step < 4 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={prev} disabled={step === 0} className="w-full sm:w-auto">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <p className="text-xs text-muted-foreground text-center sm:text-right">Step {step + 1} of {steps.length}</p>
                {step === 3 ? (
                  <Button onClick={submit} className="bg-gradient-primary shadow-glow w-full sm:w-auto" disabled={busy}>
                    Submit for verification
                  </Button>
                ) : (
                  <Button onClick={handleContinue} className="w-full sm:w-auto" disabled={busy}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Document Preview Modal */}
      <Dialog open={previewDocument !== null} onOpenChange={(open) => { if (!open) { setPreviewDocument(null); setPdfLoading(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Preview - {previewDocument?.type}</DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div className="w-full h-[60vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden relative">
              {(() => {
                const extension = getFileExtensionFromUrl(previewDocument.url);
                const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);
                const isPdf = extension === "pdf";

                if (isImage) {
                  return (
                <img
                  src={previewDocument.url}
                  alt="Document preview"
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => setPdfLoading(false)}
                />
                  );
                }

                if (isPdf) {
                  return (
                <>
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading PDF...</p>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={previewDocument.url}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                    onLoad={() => setPdfLoading(false)}
                    onError={() => {
                      setPdfLoading(false);
                      toast.error("Failed to load PDF. Please try downloading the file instead.");
                    }}
                  />
                </>
                  );
                }

                return (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type.
                    <button
                      type="button"
                      onClick={() => void downloadUrl(previewDocument.url)}
                      className="text-primary hover:underline ml-2"
                    >
                      Download file
                    </button>
                  </p>
                </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewDocument(null);
                setPdfLoading(false);
              }}
            >
              Close
            </Button>
            {previewDocument && (
              <Button onClick={() => void downloadUrl(previewDocument.url)}>
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={!!deleteDocConfirmId} onOpenChange={(open) => !open && setDeleteDocConfirmId(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDocConfirmId(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemoveDoc()}
              className="w-full sm:w-auto"
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  className,
  readonly,
  onBlur,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  readonly?: boolean;
  onBlur?: () => void;
  required?: boolean;
  error?: string;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label required={required}>{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readonly}
      onBlur={onBlur}
      className={error ? "border-destructive" : ""}
    />
    <FieldError message={error} />
  </div>
);

const Detail = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={className}>
    <p className="mb-1 text-xs text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

const getApiOrigin = (): string | null => {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
};

const normalizeHostedFileUrl = (fileUrl: string): string => {
  if (!fileUrl || fileUrl.startsWith("data:")) return fileUrl;

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return fileUrl;

  try {
    const isAbsolute = /^https?:\/\//i.test(fileUrl);
    if (isAbsolute) {
      const absolute = new URL(fileUrl);
      if (absolute.origin !== apiOrigin) {
        return fileUrl;
      }
    }

    const parsed = new URL(fileUrl, apiOrigin);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return fileUrl;
  }
};

const getFileExtensionFromUrl = (url: string): string => {
  const fromName = (name: string): string => {
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match?.[1] ?? "";
  };

  try {
    const parsed = new URL(url, window.location.origin);
    const directName = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
    const nestedUrl = parsed.searchParams.get("url");
    if (nestedUrl) {
      const nested = new URL(nestedUrl, window.location.origin);
      const nestedName = decodeURIComponent(nested.pathname.split("/").pop() ?? "");
      return fromName(nestedName) || fromName(directName);
    }
    return fromName(directName);
  } catch {
    const cleaned = url.split("?")[0]?.split("#")[0] ?? "";
    const name = cleaned.split("/").pop() ?? "";
    return fromName(name);
  }
};

const getPreviewUrl = (fileUrl: string): string => {
  const normalized = normalizeHostedFileUrl(fileUrl);
  if (!normalized.startsWith("data:")) return normalized;
  try {
    const [meta, data] = normalized.split(",");
    if (!meta || !data) return normalized;
    const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return normalized;
  }
};

const downloadUrl = async (url: string) => {
  try {
    const token = localStorage.getItem('vendor_portal_token');
    const headers: HeadersInit = {};
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
    if (token && (url.startsWith(apiBase) || url.startsWith(window.location.origin))) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error('Download failed');
    const blob = await resp.blob();
    const parsed = new URL(url, window.location.origin);
    const filename = decodeURIComponent((parsed.pathname.split('/').pop() || 'file'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error(err);
    toast.error('Download failed.');
  }
};

// Searchable Combobox for State/City selection
interface StateCityComboboxProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

const StateCityCombobox = ({ label, value, options, onChange, placeholder, disabled, required, error }: StateCityComboboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", error ? "border-destructive" : "")}
            disabled={disabled}
          >
            {value || placeholder}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" sideOffset={4} avoidCollisions={false}>
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option === value ? "" : option);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
};

export default Onboarding;


