import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Truck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { LegalPolicyLinks } from "@/app/components/legal/LegalPolicyLinks";
import { useAuth } from "@/app/guards/AuthContext";
import { customerApi, type CartLinePayload } from "@/app/services/customerApi";
import type { PublicLegalDocumentListItem } from "@/app/services/publicLegalApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

const PRODUCT_DETAIL_FALLBACK: PublicLegalDocumentListItem[] = [
  {
    slug: "rental-and-purchase-policy",
    documentType: "rental-and-purchase-policy",
    title: "Rental & Purchase Policy",
    publicPath: "/rental-and-purchase-policy",
    sortOrder: 3,
    versionNumber: 1,
    effectiveFrom: "",
    lastUpdated: "",
    isRequiredToProceed: false,
  },
  {
    slug: "shipping-delivery-policy",
    documentType: "shipping-delivery-policy",
    title: "Shipping & Delivery Policy",
    publicPath: "/shipping-delivery-policy",
    sortOrder: 5,
    versionNumber: 1,
    effectiveFrom: "",
    lastUpdated: "",
    isRequiredToProceed: false,
  },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function ListingDeliveryCheck({ line }: { line: CartLinePayload }) {
  const { user } = useAuth();
  const [pincode, setPincode] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: addresses } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => customerApi.getAddresses(),
    enabled: user?.role === "customer",
  });

  const check = async () => {
    const pin = digitsOnly(pincode);
    if (pin.length !== 6) {
      setResult({ ok: false, message: "Enter a 6-digit pincode." });
      return;
    }
    if (user?.role !== "customer") {
      setResult({ ok: false, message: "Sign in and save this pincode on a delivery address to confirm service." });
      return;
    }
    const match = (addresses ?? []).find((a) => digitsOnly(a.postal) === pin);
    if (!match) {
      setResult({
        ok: false,
        message: "No saved address uses this pincode. Add it in Addresses, then check again.",
      });
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      await customerApi.quoteOrders({
        customerAddressId: match.id,
        deliveryOption: "standard",
        lines: [line],
      });
      setResult({ ok: true, message: `We can deliver to ${pin}.` });
    } catch (error) {
      setResult({
        ok: false,
        message: getUserFriendlyMessage(error) || "This pincode is outside the vendor service area.",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Truck className="h-3.5 w-3.5 text-primary" />
        Check delivery by pincode
      </div>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit pincode"
          value={pincode}
          onChange={(event) => {
            setPincode(digitsOnly(event.target.value));
            setResult(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void check();
            }
          }}
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={() => void check()} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
        </Button>
      </div>
      {result ? (
        <p className={`text-[11px] leading-relaxed ${result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
          {result.ok ? <Check className="mr-1 inline h-3 w-3" /> : null}
          {result.message}{" "}
          {user?.role !== "customer" ? (
            <Link to="/customer/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          ) : !result.ok && digitsOnly(pincode).length === 6 && !(addresses ?? []).some((a) => digitsOnly(a.postal) === digitsOnly(pincode)) ? (
            <Link to="/customer/addresses" className="font-medium text-primary hover:underline">
              Add address
            </Link>
          ) : null}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Delivery is confirmed from your address pincode. Final charges appear at checkout.
        </p>
      )}
      <LegalPolicyLinks
        surface="customer_web"
        screen="product_detail"
        className="text-[11px] text-muted-foreground"
        linkClassName="text-[11px]"
        fallback={PRODUCT_DETAIL_FALLBACK}
      />
    </div>
  );
}
