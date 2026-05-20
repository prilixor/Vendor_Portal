import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { customerApi } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

const CustomerListingDetail = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const { addLine } = useCart();
  const [qty, setQty] = useState(1);
  const [days, setDays] = useState(7);
  const [imgIx, setImgIx] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-listing", listingId],
    queryFn: () => customerApi.getListingDetail(listingId!),
    enabled: !!listingId,
  });

  if (!listingId) {
    return <p className="text-sm text-muted-foreground">Invalid listing.</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Listing not found."}</p>
        <Button variant="outline" asChild>
          <Link to="/customer/browse">Back to browse</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative w-full min-w-0 overflow-hidden rounded-xl">
          <div className="block w-full pb-[75%]" aria-hidden />
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const images = data.imageUrls?.length ? data.imageUrls : [];

  const rentEstimate = data.dailyRent * qty * days;

  const handleAdd = () => {
    if (qty < 1 || days < 1) {
      toast.error("Quantity and rental days must be positive.");
      return;
    }
    addLine({
      listingId: data.id,
      title: data.title,
      vendorName: data.vendorName,
      dailyRent: data.dailyRent,
      monthlyRent: data.monthlyRent,
      securityDeposit: data.securityDeposit,
      primaryImageUrl: images[0],
      quantity: qty,
      rentalDays: days,
    });
    toast.success("Added to cart");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <div className="relative w-full overflow-hidden rounded-xl border bg-card">
          <div className="block w-full pb-[75%]" aria-hidden />
          {images.length > 0 ? (
            <img
              src={images[imgIx % images.length]}
              alt=""
              className="customer-catalog-media-img"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                maxWidth: "none",
                maxHeight: "none",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
              }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No photos
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((url, i) => (
              <button
                key={`listing-img-${i}`}
                type="button"
                onClick={() => setImgIx(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-card ${i === imgIx ? "border-primary" : "border-transparent"}`}
              >
                <img
                  src={url}
                  alt=""
                  className="customer-catalog-media-img"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                    maxHeight: "none",
                    objectFit: "contain",
                    objectPosition: "center",
                    display: "block",
                  }}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">{data.vendorName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.serviceAreaHint}</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Pricing</p>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Daily rent</span>
              <span className="font-semibold tabular-nums">₹{data.dailyRent.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly rent</span>
              <span className="font-semibold tabular-nums">₹{data.monthlyRent.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Security deposit</span>
              <span className="font-semibold tabular-nums">₹{data.securityDeposit.toFixed(0)}</span>
            </div>
            {data.prescriptionRequired && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Prescription may be required for this category.</p>
            )}
          </CardContent>
        </Card>

        {data.description ? (
          <div>
            <p className="text-sm font-medium">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.description}</p>
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm font-medium">Add to cart</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <QuantityStepper label="Qty" value={qty} min={1} max={999} onChange={setQty} />
              <QuantityStepper
                label="Days"
                value={days}
                min={1}
                max={366}
                onChange={setDays}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated rent for this line:{" "}
              <span className="font-semibold text-foreground tabular-nums">₹{rentEstimate.toFixed(0)}</span>{" "}
              (excludes deposit &amp; delivery).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-gradient-primary hover:opacity-95 shadow-glow" type="button" onClick={handleAdd}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to cart
              </Button>
              <Button variant="outline" asChild>
                <Link to="/customer/cart">View cart</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/customer/browse">More listings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerListingDetail;
