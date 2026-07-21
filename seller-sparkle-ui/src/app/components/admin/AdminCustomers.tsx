import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { adminApi, AdminCustomerDetailDto, AdminCustomerListItemDto } from "@/app/services/adminApi";
import { Loader2, LogIn, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { ADMIN_PERMISSIONS } from "@/app/helpers/adminNav";
import { getCustomerPortalHref } from "@/app/helpers/portalHost";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

export const AdminCustomers = () => {
  const [rows, setRows] = useState<AdminCustomerListItemDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();

  const load = async (q?: string) => {
    setLoading(true);
    try {
      setRows(await adminApi.getAdminCustomers(q));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Directory of customer accounts. Place orders on behalf of a customer from their detail page." />
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, name, phone" />
        <Button onClick={() => load(search)} variant="secondary">
          <Search className="h-4 w-4 mr-2" /> Search
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{c.fullName}</p>
                <p className="text-sm text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                <p className="text-xs text-muted-foreground">{c.orderCount} orders</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/admin/customers/${c.id}`}>View</Link>
              </Button>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No customers found.</p>}
        </div>
      )}
      {!hasPermission(ADMIN_PERMISSIONS.customersView) && (
        <p className="text-sm text-destructive">You may not have customers.view permission.</p>
      )}
    </div>
  );
};

export const AdminCustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [detail, setDetail] = useState<AdminCustomerDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [listingId, setListingId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rentalDays, setRentalDays] = useState("7");
  const [orderType, setOrderType] = useState("rent");
  const [addressId, setAddressId] = useState("");
  const [deliveryOption, setDeliveryOption] = useState("standard");
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      setLoading(true);
      try {
        const d = await adminApi.getAdminCustomer(customerId);
        setDetail(d);
        const def = d.addresses.find((a) => a.isDefault) ?? d.addresses[0];
        if (def) setAddressId(def.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load customer");
        navigate("/admin/customers");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId, navigate]);

  const placeOrder = async () => {
    if (!customerId || !listingId.trim()) {
      toast.error("Listing ID is required");
      return;
    }
    setSaving(true);
    try {
      await adminApi.placeOrderForCustomer(customerId, {
        customerAddressId: addressId || undefined,
        deliveryOption,
        lines: [{
          listingId: listingId.trim(),
          quantity: Number(quantity) || 1,
          rentalDays: Number(rentalDays) || 0,
          orderType,
        }],
      });
      toast.success("Order placed");
      setOpen(false);
      const d = await adminApi.getAdminCustomer(customerId);
      setDetail(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Place order failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !detail) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.fullName}
        description={detail.email}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission(ADMIN_PERMISSIONS.customersImpersonate) && customerId && (
              <Button
                variant="secondary"
                disabled={impersonating}
                onClick={async () => {
                  setImpersonating(true);
                  try {
                    const result = await adminApi.impersonateCustomer(customerId);
                    const href = getCustomerPortalHref(
                      `/impersonation/consume?code=${encodeURIComponent(result.exchangeCode)}`,
                    );
                    window.open(href, "_blank", "noopener,noreferrer");
                    toast.success(`Opening ${result.targetName} in Customer Portal`);
                  } catch (e) {
                    toast.error(getUserFriendlyMessage(e));
                  } finally {
                    setImpersonating(false);
                  }
                }}
              >
                {impersonating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                Open as Customer
              </Button>
            )}
            {hasPermission(ADMIN_PERMISSIONS.customersPlaceOrder) && (
              <Button onClick={() => setOpen(true)}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Create order
              </Button>
            )}
          </div>
        }
      />
      <Card className="p-4 space-y-2">
        <p className="text-sm">Phone: {detail.phone || "—"}</p>
        <p className="text-sm">Verified: {detail.isEmailVerified ? "Yes" : "No"}</p>
      </Card>
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Addresses</h3>
        {detail.addresses.map((a) => (
          <p key={a.id} className="text-sm text-muted-foreground">
            {a.label ? `${a.label}: ` : ""}{a.line1}, {a.city}, {a.state} {a.postal}
            {a.isDefault ? " (default)" : ""}
          </p>
        ))}
        {detail.addresses.length === 0 && <p className="text-sm text-muted-foreground">No addresses</p>}
      </Card>
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Recent orders</h3>
        {detail.recentOrders.map((o) => (
          <div key={o.id} className="flex justify-between text-sm border-b py-2">
            <span>{o.orderNumber} · {o.status}</span>
            <span>₹{o.totalAmount}{o.placedByAdminId ? " · by admin" : ""}</span>
          </div>
        ))}
        {detail.recentOrders.length === 0 && <p className="text-sm text-muted-foreground">No orders</p>}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create order for {detail.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Listing ID</Label>
              <Input value={listingId} onChange={(e) => setListingId(e.target.value)} placeholder="Vendor listing GUID" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rental days</Label>
                <Input value={rentalDays} onChange={(e) => setRentalDays(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Order type</Label>
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery</Label>
              <Select value={deliveryOption} onValueChange={setDeliveryOption}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Select value={addressId} onValueChange={setAddressId}>
                <SelectTrigger><SelectValue placeholder="Select address" /></SelectTrigger>
                <SelectContent>
                  {detail.addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.line1}, {a.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={placeOrder} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Place order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;
