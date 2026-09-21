import { LegalAgreeCheckbox } from "@/app/components/legal/LegalAgreeCheckbox";
import type { LegalWebSurface } from "@/app/helpers/legalSurface";

export function RegisterLegalAgree({
  surface,
  agreed,
  onAgreedChange,
}: {
  surface: LegalWebSurface;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
}) {
  return (
    <LegalAgreeCheckbox
      surface={surface}
      screen="register"
      agreed={agreed}
      onAgreedChange={onAgreedChange}
      prefix="By creating an account, you agree to our"
    />
  );
}
