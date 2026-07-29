import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Stethoscope, Loader2, MapPin, ExternalLink, Copy, Check, ShoppingBag } from "lucide-react";
import { apiClient } from "@/app/services/apiClient";
import { toast } from "sonner";

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
  const [copied, setCopied] = useState(false);

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
      } catch (e) {
        if (!cancelled) {
          setError(
            "No doctor found for this Unique ID. Please check the ID and try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const copyId = async () => {
    if (!doctor?.uniqueCode) return;
    try {
      await navigator.clipboard.writeText(doctor.uniqueCode);
      setCopied(true);
      toast.success("Unique ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1f1c] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -right-16 top-40 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-700 shadow-lg shadow-teal-900/40">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200/80">BlinksMed</p>
            <p className="text-sm text-teal-50/70">Doctor reference</p>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-teal-100/70">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading doctor profile…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
              <p className="text-lg font-semibold text-white">Doctor not found</p>
              <p className="mt-2 text-sm text-teal-100/70">{error}</p>
              <p className="mt-3 text-xs text-teal-100/50">
                Ask your doctor for their BlinksMed Unique ID, or scan their QR code again.
              </p>
              <Link
                to="/customer/shop"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-400"
              >
                Go to BlinksMed shop
              </Link>
            </div>
          )}

          {!loading && doctor && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-2xl shadow-black/30">
              <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-800 px-6 pb-8 pt-7 text-white">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-100/80">Verified doctor</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{doctor.fullName}</h1>
                {doctor.specialization && (
                  <p className="mt-2 text-sm text-teal-50/85">{doctor.specialization}</p>
                )}
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700">Unique ID</p>
                      <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-teal-950">
                        {doctor.uniqueCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyId()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-teal-800/80">
                    Use this ID at checkout to attach this doctor as your medical reference on a BlinksMed order.
                  </p>
                </div>

                {doctor.hospitals && doctor.hospitals.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Affiliated hospitals
                    </p>
                    {doctor.hospitals.map((h) => (
                      <div key={h.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <p className="font-semibold text-slate-900">{h.name}</p>
                        {formatAddress(h) && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                            {formatAddress(h)}
                          </p>
                        )}
                        <a
                          href={mapsUrl(h)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                        >
                          Open in maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-800">For patients</p>
                  <p className="mt-1">
                    Continue to BlinksMed, add items to your cart, and enter this Unique ID when placing your order
                    (optional). No hospital form is required.
                  </p>
                </div>

                <Link
                  to="/customer/shop"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-600"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Continue to BlinksMed shop
                </Link>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-8 pb-2 text-center text-[11px] text-teal-100/50">
          © {new Date().getFullYear()} BlinksMed · Medical equipment rentals
        </footer>
      </div>
    </div>
  );
};

export default DoctorPublicPage;
