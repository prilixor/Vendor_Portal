import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Loader2 } from "lucide-react";

type AccountRole = "customer" | "vendor";

function apiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return "/api";
}

async function readProblem(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
  return body?.detail || body?.message || "Something went wrong. Please try again.";
}

const DeleteAccountPage = () => {
  const [role, setRole] = useState<AccountRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter the email on the account.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      setError('Type DELETE to confirm.');
      return;
    }

    setLoading(true);
    try {
      const base = apiBaseUrl();
      const loginResponse = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
        }),
      });
      if (!loginResponse.ok) {
        setError(await readProblem(loginResponse));
        return;
      }
      const loginBody = await loginResponse.json() as { token?: string };
      if (!loginBody.token) {
        setError("Could not verify this account.");
        return;
      }

      const deleteResponse = await fetch(`${base}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginBody.token}`,
        },
        body: JSON.stringify({ password }),
      });
      if (!deleteResponse.ok) {
        setError(await readProblem(deleteResponse));
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach BlinksMed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout
        title="Account deleted"
        subtitle="You are signed out. This email can be used to register again later."
        portalType={role}
        backTo="/"
        backLabel="Home"
      >
        <p className="text-center text-sm text-muted-foreground">
          Login details and saved contact information were removed. Orders and records the business must keep are retained.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Delete your account"
      subtitle="Closes your BlinksMed customer or vendor login. Open rentals must be finished first."
      portalType={role}
      backTo="/"
      backLabel="Home"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Account type</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === "customer" ? "default" : "outline"}
              onClick={() => setRole("customer")}
            >
              Customer
            </Button>
            <Button
              type="button"
              variant={role === "vendor" ? "default" : "outline"}
              onClick={() => setRole("vendor")}
            >
              Vendor
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-email">Email</Label>
          <Input
            id="delete-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-password">Password</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="DELETE"
            autoCapitalize="characters"
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your name, email, phone, and saved address are removed, and you cannot sign in.
          Past orders and invoices stay on record. Verification documents already submitted may be kept where the law requires it.
          See the <Link to="/privacy-policy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default DeleteAccountPage;
