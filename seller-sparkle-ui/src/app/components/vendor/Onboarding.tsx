import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Stepper } from "@/app/components/shared/Stepper";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { mockBankDetails, mockBusinessProfile } from "@/app/services/mockData";
import { ArrowLeft, ArrowRight, Upload, FileText, Trash2, ShieldCheck, CheckCircle2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { VendorDocument, VerificationStatus } from "@/app/models";
import { getVendorDocuments, saveVendorDocuments } from "@/app/services/vendorDocuments";

const steps = [
  { label: "Basic Info", description: "Account" },
  { label: "Business", description: "Profile" },
  { label: "Documents", description: "KYC" },
  { label: "Bank", description: "Payouts" },
  { label: "Review", description: "Submit" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(mockBusinessProfile);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [bank, setBank] = useState(mockBankDetails);
  const [submission, setSubmission] = useState<VerificationStatus>("under_review");
  const [documentType, setDocumentType] = useState("GST Certificate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const updateProfile = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const updateBank = <K extends keyof typeof bank>(k: K, v: (typeof bank)[K]) => setBank((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!user) return;
    const loadedDocuments = getVendorDocuments(user.id);
    setDocuments(loadedDocuments);
  }, [user]);

  const handleFileUpload = async () => {
    if (!user) return;
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }
    const fileUrl = await fileToDataUrl(selectedFile);

    const newDoc: VendorDocument = {
      id: `d${Date.now()}`,
      vendorId: user.id,
      type: documentType,
      fileName: selectedFile.name,
      fileUrl,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      status: "pending",
      uploadedAt: new Date().toISOString().slice(0, 10),
    };

    setDocuments((prev) => {
      const updated = [...prev, newDoc];
      saveVendorDocuments(user.id, updated);
      return updated;
    });

    setSelectedFile(null);
    toast.success("Document uploaded. Awaiting verification.");
  };

  const removeDoc = (id: string) => {
    if (!user) return;
    setDocuments((prev) => {
      const updated = prev.filter((x) => x.id !== id);
      saveVendorDocuments(user.id, updated);
      return updated;
    });
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

  const submit = () => {
    setSubmission("under_review");
    toast.success("Application submitted! Our team will review within 24 hours.");
    setStep(4);
  };

  return (
    <div>
      <PageHeader
        title="Vendor onboarding"
        description="Complete all steps to get verified and start listing products."
      />

      <Card className="p-6 sm:p-8 shadow-elegant border-border/60">
        <div className="mb-8">
          <Stepper steps={steps} current={step} onStepClick={setStep} />
        </div>

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
                <Input value={user?.name ?? ""} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <Input value="Vendor" readOnly className="bg-muted/50" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <h2 className="text-lg font-semibold">Business profile</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Business name" value={profile.businessName} onChange={(v) => updateProfile("businessName", v)} />
              <Field label="Owner name" value={profile.ownerName} onChange={(v) => updateProfile("ownerName", v)} />
              <Field label="Phone" value={profile.phone} onChange={(v) => updateProfile("phone", v)} />
              <Field label="GST number" value={profile.gstNumber} onChange={(v) => updateProfile("gstNumber", v)} />
              <Field className="md:col-span-2" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateProfile("addressLine1", v)} />
              <Field className="md:col-span-2" label="Address line 2 (optional)" value={profile.addressLine2 ?? ""} onChange={(v) => updateProfile("addressLine2", v)} />
              <Field label="City" value={profile.city} onChange={(v) => updateProfile("city", v)} />
              <Field label="State" value={profile.state} onChange={(v) => updateProfile("state", v)} />
              <Field label="Postal code" value={profile.postalCode} onChange={(v) => updateProfile("postalCode", v)} />
            </div>
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
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 md:grid-cols-3">
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
                  <Button onClick={handleFileUpload} variant="outline" className="w-full">
                    <Upload className="mr-2 h-4 w-4" /> Upload document
                  </Button>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
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
                          <Button variant="ghost" size="icon" onClick={() => previewDoc(doc)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeDoc(doc.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Account holder name" value={bank.accountHolderName} onChange={(v) => updateBank("accountHolderName", v)} />
              <Field label="Bank name" value={bank.bankName} onChange={(v) => updateBank("bankName", v)} />
              <Field label="Account number" value={bank.accountNumber} onChange={(v) => updateBank("accountNumber", v)} />
              <Field label="IFSC code" value={bank.ifscCode} onChange={(v) => updateBank("ifscCode", v)} />
            </div>
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

        {/* Footer actions */}
        {step < 4 && (
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button variant="ghost" onClick={prev} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <p className="text-xs text-muted-foreground">Step {step + 1} of {steps.length}</p>
            {step === 3 ? (
              <Button onClick={submit} className="bg-gradient-primary shadow-glow">
                Submit for verification
              </Button>
            ) : (
              <Button onClick={next}>
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

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

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


