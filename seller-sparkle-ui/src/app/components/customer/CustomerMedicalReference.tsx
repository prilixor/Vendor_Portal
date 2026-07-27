import { useState } from "react";
import { Building2, CheckCircle2, Loader2, MapPin, Stethoscope, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FieldError } from "@/app/components/shared/FieldError";
import { customerApi, type HospitalApi } from "@/app/services/customerApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

export type DoctorHospitalRef = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  addressLine1?: string | null;
};

export type DoctorRefSelection = {
  doctorId: string;
  uniqueCode: string;
  doctorName: string;
  specialization?: string | null;
  hospitals?: DoctorHospitalRef[];
};

interface CustomerMedicalReferenceProps {
  title?: string;
  value: DoctorRefSelection | null;
  onChange: (value: DoctorRefSelection | null) => void;
}

const formatHospitalPlace = (h: DoctorHospitalRef) => {
  const parts = [h.city, h.state].map((p) => p?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
};

const formatHospitalAddress = (h: DoctorHospitalRef) => {
  const line = h.addressLine1?.trim();
  const place = formatHospitalPlace(h);
  if (line && place) return `${line} · ${place}`;
  return line || place;
};

const mapHospitals = (list?: HospitalApi[] | null): DoctorHospitalRef[] =>
  (list ?? [])
    .filter((h) => h?.id && h?.name)
    .map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      state: h.state,
      addressLine1: h.addressLine1,
    }));

/**
 * Checkout doctor reference: lookup Admin-curated doctor by Unique ID (QR / share page).
 * Shows affiliated hospitals for context — optional; no hospital form / selection required.
 */
export function CustomerMedicalReference({ title, value, onChange }: CustomerMedicalReferenceProps) {
  const [code, setCode] = useState(value?.uniqueCode || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the doctor's Unique ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const doctor = await customerApi.getDoctorByCode(trimmed);
      if (!doctor.isActive) {
        setError("This doctor profile is inactive. Please use another Unique ID.");
        onChange(null);
        return;
      }
      setCode(doctor.uniqueCode);
      onChange({
        doctorId: doctor.id,
        uniqueCode: doctor.uniqueCode,
        doctorName: doctor.fullName,
        specialization: doctor.specialization,
        hospitals: mapHospitals(doctor.hospitals),
      });
    } catch (e) {
      onChange(null);
      setError(getUserFriendlyMessage(e) || "Doctor not found for this Unique ID.");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setCode("");
    setError(null);
    onChange(null);
  };

  const hospitals = value?.hospitals ?? [];

  return (
    <div className="space-y-4">
      {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
      <p className="text-sm text-muted-foreground leading-relaxed">
        Enter the Unique ID from your doctor (or from their QR / share page). This is optional and helps vendors
        know who referred the equipment.
      </p>

      {value?.doctorId ? (
        <div className="overflow-hidden rounded-xl border border-teal-200 bg-teal-50/80">
          {/* Doctor */}
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Doctor linked
                </div>
                <p className="mt-1 truncate text-base font-semibold text-teal-950">{value.doctorName}</p>
                {value.specialization && (
                  <p className="mt-0.5 text-xs text-teal-800/80">{value.specialization}</p>
                )}
                <p className="mt-2 inline-flex rounded-md bg-white/70 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-teal-900 ring-1 ring-teal-200/80">
                  {value.uniqueCode}
                </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={clear} aria-label="Remove doctor">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Hospitals */}
          <div className="border-t border-teal-200/70 bg-white/55 px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-800/70">
                <Building2 className="h-3.5 w-3.5" />
                Hospitals
              </p>
              {hospitals.length > 0 && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-teal-800">
                  {hospitals.length}
                </span>
              )}
            </div>

            {hospitals.length > 0 ? (
              <ul className="space-y-2">
                {hospitals.map((h) => {
                  const detail = formatHospitalAddress(h);
                  return (
                    <li
                      key={h.id}
                      className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm shadow-teal-900/5"
                    >
                      <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                      {detail && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-slate-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                          <span>{detail}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-teal-200/80 bg-teal-50/40 px-3 py-2.5 text-xs text-teal-800/70">
                No affiliated hospitals on file for this doctor.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="doctor-unique-id">Doctor Unique ID</Label>
          <div className="flex gap-2">
            <Input
              id="doctor-unique-id"
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
              placeholder="e.g. DRDS26001"
              className="font-mono tracking-wider uppercase"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="button" onClick={() => void lookup()} disabled={loading || !code.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
            </Button>
          </div>
          <FieldError message={error || undefined} />
          <p className="text-xs text-muted-foreground">
            Ask your doctor for their BlinksMed Unique ID, or scan their QR code to open the share page and copy it.
          </p>
        </div>
      )}
    </div>
  );
}
