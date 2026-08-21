import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/guards/AuthContext";
import { customerApi } from "@/app/services/customerApi";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { isValidIndianMobile, normalizeIndianMobileDigits } from "@/app/helpers/indianMobilePhone";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";

type Props = {
  children: React.ReactNode;
};

/**
 * Blocks the customer portal when:
 * - phone is present but not OTP-verified, or
 * - email is present but not verified (email-only soft gate for edge sessions).
 * Guests and verified customers are unaffected. Admin impersonation is skipped.
 */
export function CustomerPhoneVerificationGate({ children }: Props) {
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [needsPhoneVerify, setNeedsPhoneVerify] = useState(false);
  const [needsEmailVerify, setNeedsEmailVerify] = useState(false);

  const isCustomer = user?.role === "customer";
  const isImpersonating = !!user?.impersonation;

  useEffect(() => {
    if (!isCustomer || isImpersonating) {
      setNeedsPhoneVerify(false);
      setNeedsEmailVerify(false);
      setPhone("");
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void customerApi
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        const raw = profile.phone?.trim() ?? "";
        const hasPhone = raw.length > 0;
        const phoneVerified = !!profile.isPhoneVerified;
        const hasEmail = !!(profile.email?.trim());
        const emailVerified = profile.isEmailVerified !== false;

        if (hasEmail && !emailVerified) {
          setNeedsEmailVerify(true);
          setNeedsPhoneVerify(false);
          setPhone("");
          return;
        }

        setNeedsEmailVerify(false);
        if (hasPhone && !phoneVerified && isValidIndianMobile(raw)) {
          setPhone(normalizeIndianMobileDigits(raw));
          setNeedsPhoneVerify(true);
        } else {
          setPhone("");
          setNeedsPhoneVerify(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNeedsPhoneVerify(false);
          setNeedsEmailVerify(false);
          setPhone("");
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCustomer, isImpersonating, user?.id]);

  if (!isCustomer || isImpersonating) {
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

  if (needsEmailVerify) {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle="Confirm your email address to continue using your customer account."
        portalType="customer"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Your account email is not verified yet. Open the verification link we sent, then sign in again.
        </p>
        <Button className="w-full h-11" variant="outline" asChild>
          <Link to="/verify-email-sent?portal=customer">Resend verification</Link>
        </Button>
        <Button
          className="mt-3 w-full h-11"
          variant="ghost"
          onClick={() => {
            logout();
            window.location.href = "/customer/login";
          }}
        >
          Sign out
        </Button>
      </AuthLayout>
    );
  }

  if (needsPhoneVerify && phone) {
    return (
      <AuthLayout
        title="Verify your phone"
        subtitle="Enter the SMS code to continue using your customer account."
        portalType="customer"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Your account has a mobile number that is not verified yet. Complete verification to continue.
        </p>
        <PhoneOtpDialog
          open
          onOpenChange={() => {
            /* required — ignore dismiss */
          }}
          phone={phone}
          role="customer"
          required
          onVerified={() => {
            setNeedsPhoneVerify(false);
          }}
        />
      </AuthLayout>
    );
  }

  return <>{children}</>;
}
