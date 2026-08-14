import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { normalizeIndianMobileDigits } from "@/app/helpers/indianMobilePhone";
import { AuthLayout } from "@/app/components/layout/AuthLayout";

type Props = {
  children: React.ReactNode;
};

/**
 * Blocks the vendor portal when SupportPhone is present but not OTP-verified.
 * Admin impersonation is skipped.
 */
export function VendorPhoneVerificationGate({ children }: Props) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);

  const isVendor = user?.role === "vendor";
  const isImpersonating = !!user?.impersonation;

  useEffect(() => {
    if (!isVendor || isImpersonating || !user?.id) {
      setNeedsVerify(false);
      setPhone("");
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void vendorOnboardingApi
      .getVendorProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
        const raw = profile.supportPhone?.trim() ?? "";
        const hasPhone = raw.length > 0;
        const verified = !!profile.isPhoneVerified;
        if (hasPhone && !verified) {
          setPhone(normalizeIndianMobileDigits(raw));
          setNeedsVerify(true);
        } else {
          setPhone("");
          setNeedsVerify(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsVerify(false);
          setPhone("");
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isVendor, isImpersonating, user?.id]);

  if (!isVendor || isImpersonating) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking account…
      </div>
    );
  }

  if (needsVerify && phone) {
    return (
      <AuthLayout
        title="Verify your phone"
        subtitle="Enter the SMS code to continue using your vendor account."
        portalType="vendor"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Your support phone is not verified yet. Complete SMS verification to continue.
        </p>
        <PhoneOtpDialog
          open
          onOpenChange={() => {
            /* required — ignore dismiss */
          }}
          phone={phone}
          role="vendor"
          required
          onVerified={() => {
            setNeedsVerify(false);
          }}
        />
      </AuthLayout>
    );
  }

  return <>{children}</>;
}
