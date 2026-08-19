import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/app/services/apiClient";
import { setImpersonationSession } from "@/app/helpers/authSession";
import { PageLoader } from "@/app/components/shared/PageLoader";
import { toast } from "sonner";

/** Consumes a one-time impersonation exchange code and starts a vendor or customer session. */
const ImpersonationConsume = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Starting impersonation…");

  useEffect(() => {
    const code = params.get("code");
    if (!code) {
      setError("Missing exchange code");
      return;
    }

    (async () => {
      try {
        const response = await apiClient.post<{
          token: string;
          user: { id: string; email: string; name: string; role: string };
        }>("/auth/exchange-impersonation", { code });

        const role = response.user.role === "customer" ? "customer" : "vendor";
        setStatus(role === "customer" ? "Starting customer impersonation…" : "Starting vendor impersonation…");

        // Tab-scoped only — never wipe adminUser / admin token in localStorage (other admin tabs stay signed in).
        setImpersonationSession({
          token: response.token,
          user: {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            role,
          },
        });

        toast.success(`Impersonating ${response.user.name}`);
        window.location.href = role === "customer" ? "/customer/shop" : "/vendor";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Exchange failed";
        setError(msg);
        toast.error(msg);
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      {error ? (
        <>
          <p className="text-destructive">{error}</p>
          <button className="text-primary underline" onClick={() => navigate("/admin/login")}>
            Back to admin login
          </button>
        </>
      ) : (
        <PageLoader label={status} className="min-h-0 py-0" />
      )}
    </div>
  );
};

export default ImpersonationConsume;
