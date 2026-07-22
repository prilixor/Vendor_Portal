import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Stethoscope, Loader2 } from "lucide-react";
import { apiClient } from "@/app/services/apiClient";

type PublicDoctor = {
  id: string;
  fullName: string;
  uniqueCode: string;
  specialization?: string | null;
  isActive: boolean;
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
