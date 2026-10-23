import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type AdminVendorListingInventoryDto, type VendorListingPricingDto } from "@/app/services/adminApi";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { BackLink } from "@/app/components/shared/BackLink";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import { useAuth } from "@/app/guards/AuthContext";
import { ADMIN_PERMISSIONS } from "@/app/helpers/adminNav";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

const money = (value?: number | null) =>
  value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;

type PriceForm = {
  isCustomPricing: boolean;
  dailyRent: string;
  securityDeposit: string;
  buyPrice: string;
  vendorDailyRent: string;
  vendorBuyPrice: string;
  variants: { variantId: string; buyPrice: string; vendorPrice: string }[];
};

const toForm = (row: VendorListingPricingDto): PriceForm => ({
  isCustomPricing: row.isCustomPricing,
  dailyRent: String(row.dailyRent ?? 0),
  securityDeposit: String(row.securityDeposit ?? 0),
  buyPrice: row.buyPrice == null ? "" : String(row.buyPrice),
  vendorDailyRent: String(row.vendorDailyRent ?? 0),
  vendorBuyPrice: row.vendorBuyPrice == null ? "" : String(row.vendorBuyPrice),
  variants: (row.variants ?? []).map((v) => ({
    variantId: v.variantId,
    buyPrice: String(v.buyPrice ?? 0),
    vendorPrice: String(v.vendorPrice ?? 0),
  })),
});

const readMoney = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
};

const VendorListingPricing = () => {
  const { vendorId = "", listingId = "" } = useParams();
  const { hasPermission } = useAuth();
  const canSetPrice = hasPermission(ADMIN_PERMISSIONS.vendorsProductPrice);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PriceForm | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vendor-listing-pricing", vendorId, listingId],
    queryFn: () => adminApi.getVendorListingPricing(vendorId, listingId),
    enabled: Boolean(vendorId && listingId),
  });

  const { data: stockRows } = useQuery({
    queryKey: ["vendor-inventory-summaries", vendorId],
    queryFn: () => adminApi.getVendorInventorySummaries(vendorId),
    enabled: Boolean(vendorId),
  });
  const stock = stockRows?.find((row) => row.listingId.toLowerCase() === listingId.toLowerCase());

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const backTab = data?.isChemical ? "chemicals" : "products";

  const save = async () => {
    if (!data || !form || !canSetPrice) return;
    setSaving(true);
    try {
      const saved = await adminApi.setVendorListingPricing(vendorId, listingId, {
        isCustomPricing: form.isCustomPricing,
        dailyRent: data.catalogDailyRent,
        securityDeposit: data.catalogSecurityDeposit,
        buyPrice: data.catalogBuyPrice,
        vendorDailyRent: readMoney(form.vendorDailyRent),
        vendorBuyPrice: readMoney(form.vendorBuyPrice),
        variants: form.variants.map((v) => {
          const catalog = data.variants.find((row) => row.variantId === v.variantId);
          return {
            variantId: v.variantId,
            buyPrice: catalog?.catalogBuyPrice ?? 0,
            vendorPrice: readMoney(v.vendorPrice) ?? 0,
          };
        }),
      });
      queryClient.setQueryData(["vendor-listing-pricing", vendorId, listingId], saved);
      toast.success(saved.isCustomPricing ? "Vendor price saved." : "This vendor now uses the catalog price.");
    } catch (err) {
      toast.error(getUserFriendlyMessage(err, "Could not save vendor pricing."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink to={`/admin/vendors/${vendorId}?tab=${backTab}`} label="Back to vendor" />
      <PageHeader
        title={data?.productName ?? "Vendor product"}
        description={
          data
            ? `${data.vendorName} · ${data.categoryName}${data.brandName ? ` · ${data.brandName}` : ""}`
            : "Review this vendor's listing and set a price only if it should differ from the catalog."
        }
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Vendors", href: "/admin/vendors" },
          { label: data?.vendorName ?? "Vendor", href: `/admin/vendors/${vendorId}?tab=${backTab}` },
          { label: data?.productName ?? "Product" },
        ]}
      />

      {isError && (
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-destructive">{getUserFriendlyMessage(error, "Could not load this vendor product.")}</p>
            <Button variant="outline" onClick={() => void refetch()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      <PageContentGate loading={isLoading && !data}>
        {data && form && (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Card className="border-border/60">
              <CardContent className="space-y-3 p-4">
                {data.imageUrl ? (
                  <img src={data.imageUrl} alt="" className="h-44 w-full rounded-lg bg-muted/40 object-contain p-2" />
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{data.productName}</p>
                  {data.modelName && <p className="text-muted-foreground">{data.modelName}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline">{data.isChemical ? "Chemical" : "Equipment"}</Badge>
                    <Badge variant="outline">{statusLabel(data.listingStatus)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="space-y-5 p-4 sm:p-5">
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">Vendor payout</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {form.isCustomPricing
                        ? "Custom price is on. These amounts apply only to this vendor."
                        : "Custom price is off. This vendor earns the catalog payout."}
                    </p>
                  </div>
                  <label className="flex w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm">
                    <Switch
                      checked={form.isCustomPricing}
                      disabled={!canSetPrice}
                      onCheckedChange={(checked) => setForm({ ...form, isCustomPricing: checked })}
                    />
                    Custom price
                  </label>
                </div>

                {!canSetPrice && (
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Your role can view this product. Setting a vendor price needs the Set Vendor Product Price permission.
                  </p>
                )}

                {!data.isChemical && (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Customer pays</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <CatalogAmount label="Daily rate" value={money(data.catalogDailyRent)} />
                        <CatalogAmount label="Security deposit" value={money(data.catalogSecurityDeposit)} />
                        <CatalogAmount label="Buy price" value={money(data.catalogBuyPrice)} />
                      </div>
                    </div>
                    <QuantitySummary
                      available={stock?.availableQuantity ?? data.availableQuantity}
                      total={stock?.totalQuantity ?? data.availableQuantity}
                    />
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">This vendor earns</p>
                      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        <PayoutRow label="Daily payout" hint="Per rental day">
                          <PayoutInput
                            label="Vendor daily payout"
                            value={form.vendorDailyRent}
                            disabled={!canSetPrice || !form.isCustomPricing}
                            onChange={(vendorDailyRent) => setForm({ ...form, vendorDailyRent })}
                          />
                        </PayoutRow>
                        <PayoutRow label="Buy payout" hint="If the customer buys this product">
                          <PayoutInput
                            label="Vendor buy payout"
                            value={form.vendorBuyPrice}
                            disabled={!canSetPrice || !form.isCustomPricing}
                            onChange={(vendorBuyPrice) => setForm({ ...form, vendorBuyPrice })}
                          />
                        </PayoutRow>
                      </div>
                    </div>
                  </div>
                )}

                {data.isChemical && (
                  <div className="space-y-4">
                  <QuantitySummary
                    available={stock?.availableQuantity ?? data.availableQuantity}
                    total={stock?.totalQuantity ?? data.availableQuantity}
                  />
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_8rem_10rem] items-center gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                      <span>Size</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Customer price</span>
                      <span className="text-right">Vendor payout</span>
                    </div>
                    {data.variants.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">This chemical has no sizes yet.</p>
                    ) : (
                      data.variants.map((variant, index) => {
                        const row = form.variants.find((v) => v.variantId === variant.variantId);
                        return (
                          <div
                            key={variant.variantId}
                            className={`grid grid-cols-1 items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_8rem_10rem] sm:gap-3 sm:py-2.5 ${index === 0 ? "sm:border-t" : "border-t"} border-border`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{variant.sizeValue} {variant.sizeUnit}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground" title={variant.sku}>{variant.sku}</p>
                            </div>
                            <SizeQty variant={variant} stock={stock} />
                            <p className="text-sm font-medium tabular-nums sm:text-right">
                              <span className="mr-2 text-xs font-normal text-muted-foreground sm:hidden">Customer price</span>
                              {money(variant.catalogBuyPrice)}
                            </p>
                            <div className="sm:justify-self-end">
                              <p className="mb-1 text-xs text-muted-foreground sm:hidden">Vendor payout</p>
                              <PayoutInput
                                label={`Vendor payout for ${variant.sizeValue} ${variant.sizeUnit}`}
                                value={row?.vendorPrice ?? ""}
                                disabled={!canSetPrice || !form.isCustomPricing}
                                onChange={(vendorPrice) =>
                                  setForm({
                                    ...form,
                                    variants: form.variants.map((v) =>
                                      v.variantId === variant.variantId ? { ...v, vendorPrice } : v
                                    ),
                                  })
                                }
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  </div>
                )}

                {canSetPrice && (
                  <div className="flex justify-end border-t border-border pt-4">
                    <Button onClick={() => void save()} disabled={saving}>
                      {saving ? "Saving…" : "Save vendor price"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </PageContentGate>
    </div>
  );
};

const statusLabel = (status: string) => {
  const normalized = status.replace(/_/g, " ").trim();
  if (normalized === "approved" || normalized === "active") return "Active";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
};

const QuantitySummary = ({ available, total }: { available: number; total: number }) => (
  <div>
    <p className="mb-2 text-xs font-medium text-muted-foreground">Quantity</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <CatalogAmount label="Available" value={String(available)} />
      <CatalogAmount label="Total" value={String(total)} />
    </div>
  </div>
);

const SizeQty = ({
  variant,
  stock,
}: {
  variant: VendorListingPricingDto["variants"][number];
  stock?: AdminVendorListingInventoryDto;
}) => {
  const sku = variant.sku.trim().toLowerCase();
  const label = `${variant.sizeValue} ${variant.sizeUnit}`.trim().toLowerCase();
  const row = stock?.sizes?.find((size) => size.sku.trim().toLowerCase() === sku)
    ?? stock?.sizes?.find((size) => size.label.trim().toLowerCase() === label);
  const available = row?.available;
  const total = row?.total;
  return (
    <div className="sm:text-right">
      <p className="text-sm font-semibold tabular-nums">
        <span className="mr-2 text-xs font-normal text-muted-foreground sm:hidden">Qty</span>
        {available ?? "—"}
      </p>
      {available != null && total != null && total !== available && (
        <p className="text-[11px] text-muted-foreground tabular-nums">{total} total</p>
      )}
    </div>
  );
};

const CatalogAmount = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
  </div>
);

const PayoutRow = ({ label, hint, children }: { label: string; hint: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
    {children}
  </div>
);

const PayoutInput = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="relative w-full sm:w-36">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
    <Input
      type="number"
      min={0}
      inputMode="decimal"
      aria-label={label}
      className="h-9 pl-7 text-right tabular-nums"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default VendorListingPricing;
