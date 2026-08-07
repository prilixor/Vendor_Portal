import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, MapPin, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FieldError } from "@/app/components/shared/FieldError";
import { apiClient } from "@/app/services/apiClient";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type DoctorHospital = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  addressLine1?: string | null;
};

type DoctorLookup = {
  id: string;
  fullName: string;
  uniqueCode: string;
  specialization?: string | null;
  contactNumber?: string | null;
  isActive: boolean;
  publicPageUrl?: string | null;
  hospitals?: DoctorHospital[] | null;
};

type VendorDoctorLookupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when opened from an order that already has a Unique ID. */
  initialCode?: string | null;
};

/**
 * Lightweight Unique ID lookup for vendors — view-only, no doctor listing page.
 */
export function VendorDoctorLookupDialog({ open, onOpenChange, initialCode }: VendorDoctorLookupDialogProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctor, setDoctor] = useState<DoctorLookup | null>(null);

  useEffect(() => {
    if (!open) return;
    const pre = (initialCode || "").trim().toUpperCase();
    setCode(pre);
    setError(null);
    setDoctor(null);
    if (pre) void lookup(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCode]);

  const lookup = async (override?: string) => {
    const trimmed = (override ?? code).trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a doctor Unique ID");
      setDoctor(null);
      return;
    }
    setCode(trimmed);
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<DoctorLookup>(
        `/medical-directory/doctors/by-code/${encodeURIComponent(trimmed)}`,
      );
      if (!data.isActive) {
        setDoctor(null);
        setError("This doctor profile is inactive. Please use another Unique ID.");
        return;
      }
      setDoctor(data);
    } catch (e) {
      setDoctor(null);
      setError(
        getUserFriendlyMessage(
          e,
          "No doctor found for this Unique ID. Please check the ID and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-700" />
            Find doctor by Unique ID
          </DialogTitle>
          <DialogDescription>
            Enter the Unique ID from a customer order or QR share page to view doctor details. View only — no listing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-doctor-code">Unique ID</Label>
            <div className="flex gap-2">
              <Input
                id="vendor-doctor-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void lookup();
                  }
                }}
                placeholder="e.g. DRKP26001"
                className="font-mono tracking-wider uppercase"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="button" onClick={() => void lookup()} disabled={loading || !code.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </Button>
            </div>
            <FieldError message={error || undefined} />
          </div>

          {doctor && (
            <div className="overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-card dark:border-teal-500/30 dark:from-teal-500/15 dark:to-card">
              <div className="bg-gradient-to-br from-teal-700 to-emerald-800 px-4 py-3 text-white">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-100/85">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified doctor
                </div>
                <p className="mt-1 text-lg font-bold leading-tight">{doctor.fullName}</p>
                {doctor.specialization && (
                  <p className="mt-0.5 text-sm text-teal-50/85">{doctor.specialization}</p>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                    Unique ID
                  </p>
                  <p className="mt-0.5 font-mono text-xl font-bold tracking-wider text-teal-950 dark:text-teal-50">
                    {doctor.uniqueCode}
                  </p>
                </div>
                {doctor.contactNumber && (
                  <p className="text-sm text-muted-foreground">Contact: {doctor.contactNumber}</p>
                )}
                {doctor.hospitals && doctor.hospitals.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Hospitals
                    </p>
                    {doctor.hospitals.map((h) => (
                      <div key={h.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">{h.name}</p>
                        {[h.addressLine1, h.city, h.state].filter(Boolean).length > 0 && (
                          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            {[h.addressLine1, h.city, h.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {doctor.publicPageUrl && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={doctor.publicPageUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open share page
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
