import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { INDIAN_MOBILE_MESSAGE, isValidIndianMobile } from "@/app/helpers/indianMobilePhone";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  parseOtpSendCooldown,
} from "@/app/helpers/otpSendCooldown";

type Role = "vendor" | "customer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  role: Role;
  onVerified?: () => void;
  /** When true, user cannot dismiss without verifying (signup / mandatory flows). */
  required?: boolean;
  title?: string;
  description?: string;
  /** Override success toast after OTP verify. Pass empty string to skip toast. */
  successMessage?: string;
  /** Override default send. Used for login OTP. */
  sendOtp?: (phone: string) => Promise<{ message?: string }>;
  /** Override default verify. Used for login OTP (issues session). */
  verifyOtp?: (phone: string, code: string) => Promise<void>;
  /** When true, do not auto-send on open (caller already sent). */
  skipAutoSend?: boolean;
};

export function PhoneOtpDialog({
  open,
  onOpenChange,
  phone,
  role,
  onVerified,
  required = false,
  title = "Verify phone number",
  description,
  successMessage,
  sendOtp,
  verifyOtp,
  skipAutoSend = false,
}: Props) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInfo, setDialogInfo] = useState<string | null>(null);
  const verifiedRef = useRef(false);
  const autoSendKeyRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);

  const phoneValid = isValidIndianMobile(phone);

  useEffect(() => {
    if (!open) {
      setCode("");
      setCooldown(0);
      setDialogError(null);
      setDialogInfo(null);
      verifiedRef.current = false;
      autoSendKeyRef.current = null;
      return;
    }

    if (!phoneValid) {
      setDialogError(INDIAN_MOBILE_MESSAGE);
      setDialogInfo(null);
      return;
    }

    const key = `${role}:${phone.trim()}`;
    if (!phone.trim() || autoSendKeyRef.current === key) return;
    autoSendKeyRef.current = key;
    if (skipAutoSend) {
      setDialogInfo("Verification code sent.");
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      return;
    }
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once per open+phone+role
  }, [open, phone, role, phoneValid, skipAutoSend]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const handleOpenChange = (next: boolean) => {
    if (!next && required && !verifiedRef.current) {
      return;
    }
    onOpenChange(next);
  };

  const sendCode = async () => {
    if (!phoneValid) {
      setDialogError(INDIAN_MOBILE_MESSAGE);
      setDialogInfo(null);
      return;
    }
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setSending(true);
    setDialogError(null);
    try {
      const res = sendOtp
        ? await sendOtp(phone)
        : await authApi.sendPhoneOtp(phone, role);
      setDialogInfo(res.message || "Verification code sent.");
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      const wait = parseOtpSendCooldown(error);
      if (wait) {
        setCooldown(wait);
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to send code.";
      setDialogInfo(null);
      setDialogError(message);
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length < 6) {
      setDialogError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    setDialogError(null);
    try {
      if (verifyOtp) {
        await verifyOtp(phone, code);
        if (successMessage) toast.success(successMessage);
      } else {
        const res = await authApi.verifyPhoneOtp(phone, code, role);
        const nextMessage =
          successMessage === undefined
            ? (res.message || "Phone verified.")
            : successMessage;
        if (nextMessage) toast.success(nextMessage);
      }
      verifiedRef.current = true;
      onOpenChange(false);
      onVerified?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid code.";
      setDialogError(message);
    } finally {
      setVerifying(false);
    }
  };

  const resolvedDescription =
    description ??
    (phoneValid
      ? `Enter the 6-digit code sent to +91 ${phone}.${
          required ? " Verification is required to continue." : ""
        }`
      : "This phone number cannot receive a verification code until it is updated.");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!required}
        onInteractOutside={(e) => {
          if (required) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (required) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <InputOTP maxLength={6} value={code} onChange={setCode} disabled={!phoneValid}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {dialogError ? (
            <p className="text-center text-sm text-destructive">{dialogError}</p>
          ) : dialogInfo ? (
            <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">{dialogInfo}</p>
          ) : null}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={!phoneValid || sending || cooldown > 0}
            onClick={() => void sendCode()}
          >
            {sending ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              "Resend code"
            )}
          </Button>
        </div>
        <DialogFooter>
          {!required ? (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={verifying}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" onClick={() => void verify()} disabled={!phoneValid || verifying || code.length < 6}>
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
