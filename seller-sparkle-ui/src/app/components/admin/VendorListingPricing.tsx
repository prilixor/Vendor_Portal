import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type VendorListingPricingDto } from "@/app/services/adminApi";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { BackLink } from "@/app/components/shared/BackLink";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
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
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="border-border/60">
              <CardContent className="space-y-3 p-4">
                {data.imageUrl ? (
                  <img src={data.imageUrl} alt="" className="h-40 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{data.productName}</p>
                  {data.modelName && <p className="text-muted-foreground">{data.modelName}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline">{data.isChemical ? "Chemical" : "Equipment"}</Badge>
                    <Badge variant="outline">{data.listingStatus.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="pt-2 text-muted-foreground">Qty {data.availableQuantity}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="space-y-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Vendor payout for this product</h2>
                    <p className="text-xs text-muted-foreground">
                      Customers keep paying the catalog price. Turn this on only when this vendor should earn a different payout for this product.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
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
                    <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-3">
                      <CatalogAmount label="Customer daily rate" value={money(data.catalogDailyRent)} />
                      <CatalogAmount label="Security deposit" value={money(data.catalogSecurityDeposit)} />
                      <CatalogAmount label="Customer buy price" value={money(data.catalogBuyPrice)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MoneyField
                        label="Vendor daily payout"
                        catalog={money(data.catalogVendorDailyRent)}
                        value={form.vendorDailyRent}
                        disabled={!canSetPrice || !form.isCustomPricing}
                        onChange={(vendorDailyRent) => setForm({ ...form, vendorDailyRent })}
                      />
                      <MoneyField
                        label="Vendor buy payout"
                        catalog={money(data.catalogVendorBuyPrice)}
                        value={form.vendorBuyPrice}
                        disabled={!canSetPrice || !form.isCustomPricing}
                        onChange={(vendorBuyPrice) => setForm({ ...form, vendorBuyPrice })}
                      />
                    </div>
                  </div>
                )}

                {data.isChemical && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Size</th>
                          <th className="px-3 py-2 font-medium">Customer price</th>
                          <th className="px-3 py-2 font-medium">Catalog payout</th>
                          <th className="px-3 py-2 font-medium">Vendor payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.variants.map((variant) => {
                          const row = form.variants.find((v) => v.variantId === variant.variantId);
                          return (
                            <tr key={variant.variantId} className="border-t border-border/70">
                              <td className="px-3 py-2">
                                <p className="font-medium">{variant.sizeValue} {variant.sizeUnit}</p>
                                <p className="font-mono text-[11px] text-muted-foreground">{variant.sku}</p>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{money(variant.catalogBuyPrice)}</td>
                              <td className="px-3 py-2 tabular-nums">{money(variant.catalogVendorPrice)}</td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-9"
                                  value={row?.vendorPrice ?? ""}
                                  disabled={!canSetPrice || !form.isCustomPricing}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      variants: form.variants.map((v) =>
                                        v.variantId === variant.variantId ? { ...v, vendorPrice: e.target.value } : v
                                      ),
                                    })
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Customer rent, buy, and deposit stay on the catalog. This page changes only what this vendor earns.
                </p>

                {canSetPrice && (
                  <div className="flex justify-end">
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

const CatalogAmount = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
  </div>
);

const MoneyField = ({
  label,
  catalog,
  value,
  disabled,
  onChange,
}: {
  label: string;
  catalog: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input type="number" min={0} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    <p className="text-[11px] text-muted-foreground">Catalog: {catalog}</p>
  </div>
);

export default VendorListingPricing;
