import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Stepper } from "@/app/components/shared/Stepper";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { ArrowLeft, ArrowRight, Upload, FileText, Trash2, ShieldCheck, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { BankDetails, BusinessProfile, VendorDocument, VerificationStatus } from "@/app/models";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

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
  ifscCode: "",
  status: "pending",
};

const Onboarding = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<BusinessProfile>(defaultProfile);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [bank, setBank] = useState<BankDetails>(defaultBank);
  const [submission, setSubmission] = useState<VerificationStatus>("pending");
  const [documentType, setDocumentType] = useState("GST Certificate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const updateProfile = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const updateBank = <K extends keyof typeof bank>(k: K, v: (typeof bank)[K]) => setBank((p) => ({ ...p, [k]: v }));

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
        const [profileRes, docsRes, bankRes, verificationRes] = await Promise.allSettled([
          vendorOnboardingApi.getVendorProfile(user.id),
          vendorOnboardingApi.getVendorDocuments(user.id),
          vendorOnboardingApi.getVendorBankAccounts(user.id),
          vendorOnboardingApi.getVerificationRequests(user.id),
        ]);

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
        }

        if (docsRes.status === "fulfilled") {
          setDocuments(mapDocuments(docsRes.value));
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
            ifscCode: latestBank.ifscCode,
            status: mapStatus(latestBank.verificationStatus),
          });
          setBankAccountId(latestBank.id);
        }

        if (verificationRes.status === "fulfilled" && verificationRes.value.length > 0) {
          setSubmission(mapStatus(verificationRes.value[0].reviewStatus));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load onboarding data.";
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
      const message = error instanceof Error ? error.message : "Failed to upload document.";
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
      const message = error instanceof Error ? error.message : "Failed to delete document.";
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
    const popup = window.open(previewUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }
    if (previewUrl !== doc.fileUrl) {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    }
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
        const message = error instanceof Error ? error.message : "Failed to save profile.";
        toast.error(message);
        return;
      } finally {
        setBusy(false);
      }
    }

    next();
  };

  const submit = async () => {
    if (!user) return;

    try {
      setBusy(true);
      await saveProfile();
      await saveBank();
      const verification = await vendorOnboardingApi.createVerificationRequest(user.id);
      setSubmission(mapStatus(verification.reviewStatus));
      toast.success("Application submitted! Our team will review within 24 hours.");
      setStep(4);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit application.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Vendor onboarding"
        description="Complete all steps to get verified and start listing products."
      />

      <Card className="p-4 sm:p-6 lg:p-8 shadow-elegant border-border/60">
        <div className="mb-6">
          <Stepper steps={steps} current={step} onStepClick={setStep} />
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
                <Label>Account name</Label>
                <Input value={profile.ownerName || user?.name || "Not set"} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Account type</Label>
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
                <div className="space-y-1.5">
                  <Label>Document type</Label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {["GST Certificate", "PAN Card", "Trade License", "Address Proof", "Cancelled Cheque"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
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
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[600px] text-sm">
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bank details</h2>
              <StatusBadge status={bank.status} />
            </div>
            <FormGrid cols={2}>
              <Field label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} />
              <Field label="Bank name" value={bank.bankName} onChange={(v) => updateBank("bankName", v)} />
              <Field label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} />
              <Field label="IFSC code" value={bank.ifscCode} onChange={(v) => updateBank("ifscCode", v)} />
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold">Application submitted</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our team will review your business details and documents. You'll receive an update via email and in-app notification.
            </p>
            <div className="mt-6 inline-flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Current status:</span>
              <StatusBadge status={submission} />
            </div>
            <div className="mt-8 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Review my info</Button>
              <Button onClick={submit}>Resubmit</Button>
            </div>
          </div>
        )}
        </div>

        {/* Footer actions */}
        {step < 4 && (
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
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
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


