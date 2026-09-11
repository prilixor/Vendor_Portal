import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { LegalAgreeCheckbox } from "@/app/components/legal/LegalAgreeCheckbox";
import { legalAcceptanceApi } from "@/app/services/legalAcceptanceApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { toast } from "sonner";

export function LegalReconsentGate({
  role,
  userId,
}: {
  role: "customer" | "vendor";
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const queryKey = ["legal-reconsent", role, userId];
  const surface = role === "vendor" ? "vendor_web" : "customer_web";

  const { data: pending = [] } = useQuery({
    queryKey,
    queryFn: () =>
      role === "vendor"
        ? legalAcceptanceApi.listVendorPending(userId)
        : legalAcceptanceApi.listCustomerPending(),
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const acceptMut = useMutation({
    mutationFn: () =>
      role === "vendor"
        ? legalAcceptanceApi.acceptVendor(userId, { screen: "reconsent", acceptedLegal: true, sourceSurface: "vendor_web" })
        : legalAcceptanceApi.acceptCustomer({ screen: "reconsent", acceptedLegal: true, sourceSurface: "customer_web" }),
    onSuccess: async () => {
      setAgreed(false);
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Updated terms accepted.");
    },
    onError: (error) => {
      toast.error(getUserFriendlyMessage(error));
    },
  });

  if (pending.length === 0) return null;

  return (
    <Dialog open>
      <DialogContent
        className="max-w-lg"
        hideCloseButton
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Updated policies require your acceptance
          </DialogTitle>
          <DialogDescription>
            A material update was published. Please review and accept the current version before continuing.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {pending.map((doc) => (
            <li key={doc.slug}>
              {doc.title}
              <span className="text-muted-foreground"> · v{doc.versionNumber}</span>
            </li>
          ))}
        </ul>
        <LegalAgreeCheckbox
          surface={surface}
          screen="reconsent"
          agreed={agreed}
          onAgreedChange={setAgreed}
          prefix="I have read and re-accept"
          id="legal-reconsent"
        />
        <Button
          className="w-full bg-gradient-primary"
          disabled={!agreed || acceptMut.isPending}
          onClick={() => acceptMut.mutate()}
        >
          {acceptMut.isPending ? "Saving…" : "Accept and continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
