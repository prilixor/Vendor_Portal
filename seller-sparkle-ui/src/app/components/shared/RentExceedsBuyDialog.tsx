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

type RentExceedsBuyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle?: string;
  rentalTotal: number;
  buyTotal: number;
  durationLabel: string;
  /** When false, user must shorten the rental — Buy is not available. */
  buyAvailable?: boolean;
  /** Hide "Choose shorter period" — user must acknowledge Buy switch. */
  compulsory?: boolean;
  onConfirmBuy: () => void;
};

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Shown when Buy is enabled and rental cost ≥ buy price.
 * Forces Buy (Buy disabled products never reach this dialog).
 */
export function RentExceedsBuyDialog({
  open,
  onOpenChange,
  itemTitle,
  rentalTotal,
  buyTotal,
  durationLabel,
  buyAvailable = true,
  compulsory = false,
  onConfirmBuy,
}: RentExceedsBuyDialogProps) {
  const name = itemTitle?.trim() || "this item";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {buyAvailable ? "Switching to Buy" : "Rental exceeds item value"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                For <span className="font-medium text-foreground">{name}</span>, estimated rent of{" "}
                <span className="font-semibold tabular-nums text-foreground">{inr(rentalTotal)}</span>{" "}
                for {durationLabel} meets or exceeds the buy price of{" "}
                <span className="font-semibold tabular-nums text-foreground">{inr(buyTotal)}</span>.
              </p>
              {buyAvailable ? (
                <p>
                  Owning the item is better at this duration. We will set the order type to{" "}
                  <span className="font-medium text-foreground">Buy</span> (no rental deposit).
                </p>
              ) : (
                <p>
                  Buy is not enabled for this product. Please choose a shorter rental period so rent stays below the item value.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {buyAvailable ? (
            <>
              {!compulsory && <AlertDialogCancel>Choose shorter period</AlertDialogCancel>}
              <AlertDialogAction
                onClick={() => {
                  onConfirmBuy();
                  onOpenChange(false);
                }}
              >
                Switch to Buy
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={() => onOpenChange(false)}>OK</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
