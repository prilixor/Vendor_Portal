import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Stethoscope, Loader2, MapPin, ExternalLink } from "lucide-react";
import { apiClient } from "@/app/services/apiClient";

type PublicHospital = {
  id: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type PublicDoctor = {
  id: string;
  fullName: string;
  uniqueCode: string;
  specialization?: string | null;
  isActive: boolean;
  hospitals?: PublicHospital[] | null;
};

const formatAddress = (h: PublicHospital) =>
  [h.addressLine1, h.city, h.state, h.postalCode].filter(Boolean).join(", ");

const mapsUrl = (h: PublicHospital) => {
  if (typeof h.latitude === "number" && typeof h.longitude === "number") {
    return `https://www.google.com/maps?q=${h.latitude},${h.longitude}`;
  }
  const q = formatAddress(h) || h.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

/**
 * Public QR landing page for a doctor Unique ID.
 * Route: /dr/:code
 */
const DoctorPublicPage = () => {
  const { code } = useParams<{ code: string }>();
  const [doctor, setDoctor] = useState<PublicDoctor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code?.trim()) {
        setError("Missing doctor Unique ID");
        setLoading(false);
        return;
      }
      try {
        const data = await apiClient.get<PublicDoctor>(
          `/medical-directory/doctors/by-code/${encodeURIComponent(code.trim())}`,
        );
        if (!cancelled) setDoctor(data);
      } catch {
        if (!cancelled) setError("Doctor not found for this Unique ID.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prilixor Doctor</p>
            <h1 className="text-lg font-semibold">Doctor Reference</h1>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        )}

        {!loading && doctor && (
          <div className="space-y-4">
            <div>
              <p className="text-2xl font-semibold">{doctor.fullName}</p>
              {doctor.specialization && (
                <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs text-muted-foreground">Unique ID</p>
              <p className="font-mono text-lg font-semibold tracking-wide">{doctor.uniqueCode}</p>
            </div>

            {doctor.hospitals && doctor.hospitals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hospitals</p>
                {doctor.hospitals.map((h) => (
                  <div key={h.id} className="rounded-lg border px-3 py-2.5">
                    <p className="font-medium">{h.name}</p>
                    {formatAddress(h) && (
                      <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {formatAddress(h)}
                      </p>
                    )}
                    <a
                      href={mapsUrl(h)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Open in maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Share this Unique ID with patients so they can add you as a doctor reference when ordering on Prilixor.
            </p>
            <Link
              to="/customer/shop"
              className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Continue to Prilixor
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorPublicPage;
