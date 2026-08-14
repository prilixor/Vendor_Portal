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
}: Props) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifiedRef = useRef(false);
  /** Prevents double auto-send (effect re-run / overlapping open) from stacking identical toasts. */
  const autoSendKeyRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      setCooldown(0);
      verifiedRef.current = false;
      autoSendKeyRef.current = null;
      return;
    }

    const key = `${role}:${phone.trim()}`;
    if (!phone.trim() || autoSendKeyRef.current === key) return;
    autoSendKeyRef.current = key;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once per open+phone+role
  }, [open, phone, role]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const handleOpenChange = (next: boolean) => {
    if (!next && required && !verifiedRef.current) {
      toast.error("Please verify your phone number to continue.");
      return;
    }
    onOpenChange(next);
  };

  const sendCode = async () => {
    if (!phone.trim()) {
      toast.error("Enter a valid phone number first.");
      return;
    }
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setSending(true);
    const toastId = `phone-otp-sent:${role}:${phone.trim()}`;
    try {
      const res = await authApi.sendPhoneOtp(phone, role);
      // Stable id collapses duplicate success toasts if send is triggered twice.
      toast.success(res.message || "Verification code sent.", { id: toastId });
      setCooldown(45);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send code.";
      toast.error(message, { id: `${toastId}:error` });
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length < 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const res = await authApi.verifyPhoneOtp(phone, code, role);
      const nextMessage =
        successMessage === undefined
          ? (res.message || "Phone verified.")
          : successMessage;
      if (nextMessage) toast.success(nextMessage);
      verifiedRef.current = true;
      onOpenChange(false);
      onVerified?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid code.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const resolvedDescription =
    description ??
    `Enter the 6-digit code sent to +91 ${phone}.${
      required ? " Verification is required to continue." : ""
    }`;

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
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            disabled={sending || cooldown > 0}
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
          <Button type="button" onClick={() => void verify()} disabled={verifying || code.length < 6}>
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
