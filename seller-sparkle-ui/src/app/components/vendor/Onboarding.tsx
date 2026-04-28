import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Stepper } from "@/app/components/shared/Stepper";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { ArrowLeft, ArrowRight, Upload, FileText, Trash2, ShieldCheck, CheckCircle2, Eye, Building2, ChevronLeft, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { BankDetails, BusinessProfile, VendorDocument, VerificationStatus } from "@/app/models";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

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
  const [activeTab, setActiveTab] = useState("profile");
  const [documentType, setDocumentType] = useState("GST Certificate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: string } | null>(null);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);

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

  const updateProfile = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const updateBank = <K extends keyof typeof bank>(k: K, v: (typeof bank)[K]) => {
    // Only allow numeric characters for account number
    if (k === "accountNumber" || k === "confirmAccountNumber") {
      v = v.replace(/[^0-9]/g, "") as (typeof bank)[K];
    }
    setBank((p) => ({ ...p, [k]: v }));
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

  const mapDocuments = (docsDto: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorDocuments>>) =>
    docsDto.map((doc) => ({
      id: doc.id,
      vendorId: doc.vendorId,
      type: doc.documentType,
      fileName: doc.fileUrl.split("/").pop() || doc.documentType,
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
            phone: profileDto.supportPhone,
            gstNumber: profileDto.gstNumber ?? "",
            addressLine1: profileDto.addressLine1,
            addressLine2: profileDto.addressLine2 ?? "",
            city: profileDto.city,
            state: profileDto.state,
            postalCode: profileDto.postalCode,
            latitude: profileDto.latitude ?? prev.latitude,
            longitude: profileDto.longitude ?? prev.longitude,
          }));
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
        fileUrl: uploaded.fileUrl,
      });

      const latestDocs = await vendorOnboardingApi.getVendorDocuments(user.id);
      setDocuments(mapDocuments(latestDocs));
      setSelectedFile(null);
      toast.success("Document uploaded. Awaiting verification.");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: string) => {
    if (!user) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorDocument(user.id, id);
      const latestDocs = await vendorOnboardingApi.getVendorDocuments(user.id);
      setDocuments(mapDocuments(latestDocs));
      toast.success("Document deleted.");
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
    const previewUrl = getPreviewUrl(doc.fileUrl);
    setPreviewDocument({ url: previewUrl, type: doc.type });
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
    if (step === 1) {
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

    if (step === 3) {
      // Validate required bank details fields
      if (!bank.accountHolderName.trim()) {
        toast.error("Please fill in account holder name");
        return;
      }
      if (!bank.accountNumber.trim()) {
        toast.error("Please fill in account number");
        return;
      }
      if (!bank.confirmAccountNumber.trim()) {
        toast.error("Please fill in confirm account number");
        return;
      }
      if (bank.accountNumber !== bank.confirmAccountNumber) {
        toast.error("Account numbers do not match");
        return;
      }
      if (!bank.ifscCode.trim()) {
        toast.error("Please fill in IFSC code");
        return;
      }
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

    try {
      setBusy(true);
      await saveProfile();
      await saveBank();
      const verification = await vendorOnboardingApi.createVerificationRequest(user.id);
      setSubmission(mapStatus(verification.reviewStatus));
      setHasSubmittedBefore(true);
      setViewMode("profile");
      toast.success("Application submitted! Our team will review within 24 hours.");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleEditSection = (sectionIndex: number) => {
    setEditingSection(sectionIndex);
    setStep(sectionIndex);
  };

  const handleSaveSection = async () => {
    if (editingSection === 1) {
      await saveProfile();
    } else if (editingSection === 3) {
      // Validate required bank details fields
      if (!bank.accountHolderName.trim()) {
        toast.error("Please fill in account holder name");
        return;
      }
      if (!bank.accountNumber.trim()) {
        toast.error("Please fill in account number");
        return;
      }
      if (!bank.confirmAccountNumber.trim()) {
        toast.error("Please fill in confirm account number");
        return;
      }
      if (bank.accountNumber !== bank.confirmAccountNumber) {
        toast.error("Account numbers do not match");
        return;
      }
      if (!bank.ifscCode.trim()) {
        toast.error("Please fill in IFSC code");
        return;
      }
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
    setEditingSection(null);
  };

  return (
    <div>
      {viewMode === "profile" ? (
        // PROFILE VIEW MODE - Admin-style design
        <>
          <PageHeader
            title={profile.businessName || user?.name || "Vendor"}
            description={`${profile.ownerName || ""} · ${profile.city || ""}`}
            breadcrumbs={[
              { label: "Vendor", href: "/vendor/dashboard" },
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
                  <p className="text-lg font-semibold">{profile.businessName || user?.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.ownerName || ""} · {user?.email}</p>
                </div>
              </div>
              <StatusBadge status={accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
            </div>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg p-1">
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
                    <FormGrid cols={3}>
                      <Field label="Business name" value={profile.businessName} onChange={(v) => updateProfile("businessName", v)} />
                      <Field label="Owner name" value={profile.ownerName} onChange={(v) => updateProfile("ownerName", v)} />
                      <Field label="Phone" value={profile.phone} onChange={(v) => updateProfile("phone", v)} />
                      <Field label="GST number" value={profile.gstNumber} onChange={(v) => updateProfile("gstNumber", v)} />
                      <Field label="City" value={profile.city} onChange={(v) => updateProfile("city", v)} />
                      <Field label="State" value={profile.state} onChange={(v) => updateProfile("state", v)} />
                      <Field className="sm:col-span-2" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateProfile("addressLine1", v)} />
                      <Field className="sm:col-span-2" label="Address line 2 (optional)" value={profile.addressLine2 ?? ""} onChange={(v) => updateProfile("addressLine2", v)} />
                      <Field label="Postal code" value={profile.postalCode} onChange={(v) => updateProfile("postalCode", v)} />
                    </FormGrid>
                    <div className="space-y-2 pt-2">
                      <Label>Pin your business location</Label>
                      <MapPicker
                        latitude={profile.latitude}
                        longitude={profile.longitude}
                        onChange={(lat, lng) => {
                          updateProfile("latitude", lat);
                          updateProfile("longitude", lng);
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
                    <Detail label="Business" value={profile.businessName || "Not set"} />
                    <Detail label="Owner" value={profile.ownerName || "Not set"} />
                    <Detail label="Phone" value={profile.phone || "Not set"} />
                    <Detail label="GSTIN" value={profile.gstNumber || "Not set"} />
                    <Detail label="City" value={profile.city || "Not set"} />
                    <Detail label="State" value={profile.state || "Not set"} />
                    <Detail className="sm:col-span-2" label="Address" value={`${profile.addressLine1 || ""} ${profile.addressLine2 || ""}`.trim() || "Not set"} />
                    <Detail label="Pincode" value={profile.postalCode || "Not set"} />
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="docs">
              <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
                <h2 className="text-lg font-semibold mb-4">Documents</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
                    <div className="space-y-1.5 min-w-0">
                      <Label>Document type</Label>
                      <Select value={documentType} onValueChange={setDocumentType}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
                          {["GST Certificate", "PAN Card", "Trade License", "Address Proof", "Cancelled Cheque"].map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>File</Label>
                      <Input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleFileUpload} variant="outline" className="w-full" disabled={busy}>
                        <Upload className="mr-2 h-4 w-4" /> Upload document
                      </Button>
                    </div>
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
                            {doc.status === "rejected" && doc.rejectionReason && (
                              <p className="text-xs text-destructive mt-2">{doc.rejectionReason}</p>
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
                                {doc.status === "rejected" && doc.rejectionReason && (
                                  <p className="text-xs text-destructive">{doc.rejectionReason}</p>
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
                    <FormGrid cols={2}>
                      <Field label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} />
                      <Field label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} />
                      <Field label="Confirm account number" value={bank.confirmAccountNumber} onChange={(v) => updateBank("confirmAccountNumber", v)} />
                      <div className="space-y-1.5">
                        <Label>IFSC code</Label>
                        <div className="relative">
                          <Input
                            value={bank.ifscCode}
                            onChange={(e) => updateBank("ifscCode", e.target.value)}
                            onBlur={handleIFSCBlur}
                            disabled={ifscLoading}
                          />
                          {ifscLoading && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                          )}
                        </div>
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

            {!hasLoaded && busy && (
              <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                Loading onboarding data...
              </div>
            )}
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Username Name</Label>
                      <Input value={profile.ownerName || user?.name || "Not set"} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>User type</Label>
                      <Input value={user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : "Vendor"} readOnly className="bg-muted/50" />
                    </div>
                  </div>
                </div>
              )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <h2 className="text-lg font-semibold">Business profile</h2>
            <FormGrid cols={2}>
              <Field label="Business name" value={profile.businessName} onChange={(v) => updateProfile("businessName", v)} />
              <Field label="Owner name" value={profile.ownerName} onChange={(v) => updateProfile("ownerName", v)} />
              <Field label="Phone" value={profile.phone} onChange={(v) => updateProfile("phone", v)} />
              <Field label="GST number" value={profile.gstNumber} onChange={(v) => updateProfile("gstNumber", v)} />
              <Field className="sm:col-span-2" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateProfile("addressLine1", v)} />
              <Field className="sm:col-span-2" label="Address line 2 (optional)" value={profile.addressLine2 ?? ""} onChange={(v) => updateProfile("addressLine2", v)} />
              <Field label="City" value={profile.city} onChange={(v) => updateProfile("city", v)} />
              <Field label="State" value={profile.state} onChange={(v) => updateProfile("state", v)} />
              <Field label="Postal code" value={profile.postalCode} onChange={(v) => updateProfile("postalCode", v)} />
            </FormGrid>
            <div className="space-y-2 pt-2">
              <Label>Pin your business location</Label>
              <MapPicker
                latitude={profile.latitude}
                longitude={profile.longitude}
                onChange={(lat, lng) => {
                  updateProfile("latitude", lat);
                  updateProfile("longitude", lng);
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Document verification</h2>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
                <div className="space-y-1.5 min-w-0">
                  <Label>Document type</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
                      {["GST Certificate", "PAN Card", "Trade License", "Address Proof", "Cancelled Cheque"].map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleFileUpload} variant="outline" className="w-full" disabled={busy}>
                    <Upload className="mr-2 h-4 w-4" /> Upload document
                  </Button>
                </div>
              </div>
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
                      {doc.status === "rejected" && doc.rejectionReason && (
                        <p className="text-xs text-destructive mt-2">{doc.rejectionReason}</p>
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
                          {doc.status === "rejected" && doc.rejectionReason && (
                            <p className="text-xs text-destructive">{doc.rejectionReason}</p>
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
            <FormGrid cols={2}>
              <Field label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} />
              <Field label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} />
              <Field label="Confirm account number" value={bank.confirmAccountNumber} onChange={(v) => updateBank("confirmAccountNumber", v)} />
              <div className="space-y-1.5">
                <Label>IFSC code</Label>
                <div className="relative">
                  <Input
                    value={bank.ifscCode}
                    onChange={(e) => updateBank("ifscCode", e.target.value)}
                    onBlur={handleIFSCBlur}
                    disabled={ifscLoading}
                  />
                  {ifscLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
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
      <Dialog open={previewDocument !== null} onOpenChange={(open) => !open && setPreviewDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Preview - {previewDocument?.type}</DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div className="w-full h-[70vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
              {previewDocument.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={previewDocument.url}
                  alt="Document preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : previewDocument.url.match(/\.pdf$/i) ? (
                <iframe
                  src={previewDocument.url}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type. 
                    <a
                      href={previewDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-2"
                    >
                      Download file
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  readonly?: boolean;
  onBlur?: () => void;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label>{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readonly}
      onBlur={onBlur}
    />
  </div>
);

const Detail = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className={className}>
    <p className="mb-1 text-xs text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

const getPreviewUrl = (fileUrl: string): string => {
  if (!fileUrl.startsWith("data:")) return fileUrl;
  try {
    const [meta, data] = fileUrl.split(",");
    if (!meta || !data) return fileUrl;
    const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return fileUrl;
  }
};

export default Onboarding;


