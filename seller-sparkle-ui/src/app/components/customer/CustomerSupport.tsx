import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PhoneCall,
  Mail,
  Clock,
  MessageSquare,
  Building2,
  PackageCheck,
  Check,
  Copy,
  LifeBuoy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { BackLink } from "@/app/components/shared/BackLink";
import { websiteContentApi } from "@/app/services/websiteContentApi";
import { toast } from "sonner";

const CustomerSupport = () => {
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get("order")?.trim();
  const [copied, setCopied] = useState(false);

  const { data: publicContent } = useQuery({
    queryKey: ["publicWebsiteContent"],
    queryFn: () => websiteContentApi.getPublicContent(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const contact = publicContent?.contact;
  const phone = contact?.phone || "+91 8511225390";
  const businessEmail = "info@blinksmed.com";
  const supportEmail = "support@blinksmed.in";
  const operatingHours = contact?.operatingHours || "Mon – Sat, 8:00 AM – 8:00 PM IST";
  const institutionalNote =
    contact?.institutionalNote ||
    "For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly.";

  const handleCallClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
    }
    setCopied(true);
    toast.success(`Calling ${phone} · Number copied to clipboard`);
    setTimeout(() => setCopied(false), 3500);
    window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
  };

  const handleCopyOnly = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
    }
    setCopied(true);
    toast.success(`Copied ${phone} to clipboard`);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleEmailClick = (targetEmail: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const subject = encodeURIComponent(
      orderRef ? `Support Request (Order: ${orderRef})` : "Customer Support Request"
    );
    window.location.href = `mailto:${targetEmail}?subject=${subject}`;
    setTimeout(() => {
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${targetEmail}&su=${subject}`,
        "_blank"
      );
    }, 300);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        {orderRef ? (
          <div className="mb-3">
            <BackLink to={`/customer/orders/${encodeURIComponent(orderRef)}`} label="Back to order" />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">CONTACT US</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              We are here to <span className="text-primary">help.</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Reach our team directly. We respond quickly to every enquiry.
            </p>
          </div>
        </div>

        {orderRef ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="h-5 w-5 text-primary shrink-0" />
              <div>
                <span className="font-semibold">Inquiring about Order: </span>
                <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30">
                  {orderRef}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Please mention this order number when calling or emailing us.
            </p>
          </div>
        ) : null}
      </div>

      {/* 3 Main Contact Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Call Us */}
        <Card className="flex flex-col justify-between border-border/80 shadow-xs transition-all hover:shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-semibold mt-3">Call Us</CardTitle>
            <CardDescription className="text-xs">Direct helpline for orders and queries</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div
              onClick={handleCallClick}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors"
              title="Click to call / copy number"
            >
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="text-base font-bold tabular-nums text-foreground hover:text-primary transition-colors"
              >
                {phone}
              </a>
              <button
                type="button"
                onClick={handleCopyOnly}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Copy phone number"
                aria-label="Copy phone number"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={handleCallClick}
                className="w-full font-semibold cursor-pointer"
                size="sm"
              >
                <PhoneCall className="mr-1.5 h-3.5 w-3.5" /> Call now
              </Button>
              <Button asChild variant="outline" className="w-full font-semibold" size="sm">
                <a
                  href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> WhatsApp
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Email Us */}
        <Card className="flex flex-col justify-between border-border/80 shadow-xs transition-all hover:shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Mail className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-semibold mt-3">Email Us</CardTitle>
            <CardDescription className="text-xs">Business & support helpdesk</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Business</span>
                <a
                  href={`mailto:${businessEmail}`}
                  onClick={(e) => handleEmailClick(businessEmail, e)}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  {businessEmail}
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground font-medium">Support</span>
                <a
                  href={`mailto:${supportEmail}`}
                  onClick={(e) => handleEmailClick(supportEmail, e)}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  {supportEmail}
                </a>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => handleEmailClick(supportEmail, e)}
              className="w-full font-semibold mt-2 cursor-pointer"
              size="sm"
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" /> Send Support Email
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Business Hours */}
        <Card className="flex flex-col justify-between border-border/80 shadow-xs transition-all hover:shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader className="p-5 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-semibold mt-3">Business Hours</CardTitle>
            <CardDescription className="text-xs">Support team operating window</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div>
              <p className="text-sm font-bold text-foreground">{operatingHours}</p>
              <p className="text-xs text-muted-foreground mt-1">
                We reply to calls, WhatsApp, and emails during these hours.
              </p>
            </div>
            <Button asChild variant="secondary" className="w-full font-semibold" size="sm">
              <Link to="/customer/orders">
                <PackageCheck className="mr-1.5 h-3.5 w-3.5" /> View My Orders
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Institutional & Bulk Inquiry Banner */}
      <Card className="border-border/80 bg-muted/20">
        <CardContent className="p-5 flex items-start gap-3.5">
          <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
            <p className="font-semibold text-foreground">Institutional Inquiries & Hospital Quotations</p>
            <p className="text-muted-foreground">{institutionalNote}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerSupport;
