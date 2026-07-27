import { Link, useSearchParams } from "react-router-dom";
import { LifeBuoy, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { BackLink } from "@/app/components/shared/BackLink";

const CustomerSupport = () => {
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get("order")?.trim();

  return (
    <div className="space-y-6">
      <div>
        {orderRef ? <BackLink to="/customer/orders" label="Back to orders" /> : null}
        <h1 className={orderRef ? "mt-1 text-2xl font-bold tracking-tight" : "text-2xl font-bold tracking-tight"}>Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get help with rentals, orders, or your account.</p>
        {orderRef ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            You opened this page from order{" "}
            <span className="font-semibold tabular-nums">{orderRef}</span>. Mention this ID when you contact us.
          </p>
        ) : null}
      </div>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LifeBuoy className="h-4 w-4" />
          Contact us
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visit our contact page for phone, email, and general inquiries.
        </p>
        <Button asChild variant="default">
          <Link to="/contact-us">
            Open contact page
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 shrink-0" />
        <span>Vendor-specific issues are handled by each listing&apos;s shop — check your order confirmation for details.</span>
      </CardContent>
    </Card>
    </div>
  );
};

export default CustomerSupport;
