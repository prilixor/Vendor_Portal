import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { LegalPolicyLinks } from "@/app/components/legal/LegalPolicyLinks";

export function CancelOrderConfirm({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Cancellation and refunds follow the policy linked below. This cannot be undone once confirmed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <LegalPolicyLinks
          surface="customer_web"
          screen="order_cancel"
          className="text-xs text-muted-foreground"
          linkClassName="text-xs"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep request</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {pending ? "Cancelling…" : "Cancel request"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
