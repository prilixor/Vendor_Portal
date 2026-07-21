import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { FieldError } from "@/app/components/shared/FieldError";
import { toast } from "sonner";
import { Trash2, Edit2 } from "lucide-react";

const CustomerAddresses = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => customerApi.getAddresses(),
  });

  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [latitude, setLatitude] = useState(23.0225);
  const [longitude, setLongitude] = useState(72.5714);
  const [setDefault, setSetDefault] = useState(false);
  const [selectedStateIso2, setSelectedStateIso2] = useState<string>("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateAddressForm = () => {
    const errors: Record<string, string> = {};
    if (!line1.trim()) errors.line1 = "Please enter the address line.";
    if (!city.trim()) errors.city = "Please select a city.";
    if (!state.trim()) errors.state = "Please select a state.";
    if (!postal.trim()) errors.postal = "Please enter the postal code.";
    return errors;
  };

  const {
    data: states = [],
    isLoading: statesLoading,
    error: statesError,
  } = useQuery({
    queryKey: ["lookup-indian-states"],
    queryFn: () => customerApi.getIndianStates(),
  });

  const {
    data: cityRows = [],
    isLoading: citiesLoading,
    error: citiesError,
  } = useQuery({
    queryKey: ["lookup-indian-cities", selectedStateIso2],
    queryFn: () => customerApi.getCitiesByState(selectedStateIso2),
    enabled: selectedStateIso2.trim().length > 0,
  });

  const cities = cityRows.map((x) => x.name);

  const addMut = useMutation({
    mutationFn: () =>
      customerApi.addAddress({
        label: label.trim() || undefined,
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        postal: postal.trim(),
        latitude,
        longitude,
        setAsDefault: setDefault,
      }),
    onSuccess: () => {
      toast.success("Address saved.");
      setLabel("");
      setLine1("");
      setCity("");
      setState("");
      setSelectedStateIso2("");
      setPostal("");
      setLatitude(23.0225);
      setLongitude(72.5714);
      setSetDefault(false);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMut = useMutation({
    mutationFn: () =>
      customerApi.updateAddress(editingAddressId!, {
        label: label.trim() || undefined,
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        postal: postal.trim(),
        latitude,
        longitude,
        setAsDefault: setDefault,
      }),
    onSuccess: () => {
      toast.success("Address updated.");
      setEditingAddressId(null);
      setLabel("");
      setLine1("");
      setCity("");
      setState("");
      setSelectedStateIso2("");
      setPostal("");
      setLatitude(23.0225);
      setLongitude(72.5714);
      setSetDefault(false);
      setFieldErrors({});
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => customerApi.deleteAddress(id),
    onSuccess: () => {
      toast.success("Address removed.");
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (error) {
    return <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load."}</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Addresses</h1>
        <p className="mt-1 text-sm text-muted-foreground">Used for rental delivery at checkout.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="font-medium">Saved</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No addresses yet.</p>
            )}
            {(data ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="text-sm">
                  {a.label && <p className="font-medium">{a.label}</p>}
                  <p>{a.line1}</p>
                  <p className="text-muted-foreground">
                    {a.city}, {a.state} {a.postal}
                  </p>
                  {typeof a.latitude === "number" && typeof a.longitude === "number" && (
                    <p className="text-xs text-muted-foreground">
                      Pinned: {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                    </p>
                  )}
                  {a.isDefault && <p className="mt-1 text-xs font-medium text-primary">Default</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => {
                    setEditingAddressId(a.id);
                    setLabel(a.label || "");
                    setLine1(a.line1);
                    setCity(a.city);
                    setState(a.state);
                    const stateObj = states.find((s) => s.name === a.state);
                    setSelectedStateIso2(stateObj?.iso2 || "");
                    setPostal(a.postal);
                    setLatitude(a.latitude ?? 23.0225);
                    setLongitude(a.longitude ?? 72.5714);
                    setSetDefault(a.isDefault);
                    setFieldErrors({});
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => delMut.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="font-medium">{editingAddressId ? "Edit address" : "Add address"}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground -mt-1 mb-1">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="addr-label">Label (optional)</Label>
              <Input id="addr-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-line1" required>Address line</Label>
              <Input
                id="addr-line1"
                value={line1}
                onChange={(e) => {
                  setLine1(e.target.value);
                  clearFieldError("line1");
                }}
                placeholder="Street, building"
                className={fieldErrors.line1 ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.line1} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addr-state" required>State</Label>
                <Select
                  value={selectedStateIso2 || "none"}
                  onValueChange={(value) => {
                    const iso2 = value === "none" ? "" : value;
                    setSelectedStateIso2(iso2);
                    const selected = states.find((s) => s.iso2 === iso2);
                    setState(selected?.name ?? "");
                    setCity("");
                    clearFieldError("state");
                  }}
                  disabled={statesLoading}
                >
                  <SelectTrigger id="addr-state" className={fieldErrors.state ? "border-destructive" : ""}>
                    <SelectValue placeholder={statesLoading ? "Loading states..." : "Select state"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s.iso2} value={s.iso2}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.state} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addr-city" required>City</Label>
                <Select
                  value={city || "none"}
                  onValueChange={(value) => {
                    setCity(value === "none" ? "" : value);
                    clearFieldError("city");
                  }}
                  disabled={!selectedStateIso2 || citiesLoading}
                >
                  <SelectTrigger id="addr-city" className={fieldErrors.city ? "border-destructive" : ""}>
                    <SelectValue
                      placeholder={
                        citiesLoading
                          ? "Loading cities..."
                          : selectedStateIso2
                            ? "Select city"
                            : "Select state first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.city} />
              </div>
            </div>
            {(statesError || citiesError) && (
              <p className="text-xs text-destructive">
                {statesError instanceof Error
                  ? statesError.message
                  : citiesError instanceof Error
                    ? citiesError.message
                    : "Failed to load states/cities."}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="addr-postal" required>Postal code</Label>
              <Input
                id="addr-postal"
                value={postal}
                onChange={(e) => {
                  setPostal(e.target.value);
                  clearFieldError("postal");
                }}
                className={fieldErrors.postal ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.postal} />
            </div>
            <div className="space-y-1.5">
              <Label>Pin delivery location</Label>
              <MapPicker
                latitude={latitude}
                longitude={longitude}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                height="h-56"
              />
              <p className="text-xs text-muted-foreground">
                Delivery distance fees use this pinned location.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch id="addr-def" checked={setDefault} onCheckedChange={setSetDefault} />
              <Label htmlFor="addr-def" className="text-sm font-normal">
                Set as default
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            {editingAddressId && (
              <Button
                variant="outline"
                className="w-full"
                disabled={editMut.isPending}
                onClick={() => {
                  setEditingAddressId(null);
                  setLabel("");
                  setLine1("");
                  setCity("");
                  setState("");
                  setSelectedStateIso2("");
                  setPostal("");
                  setLatitude(23.0225);
                  setLongitude(72.5714);
                  setSetDefault(false);
                  setFieldErrors({});
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              className="w-full bg-gradient-primary hover:opacity-95 shadow-glow"
              disabled={editingAddressId ? editMut.isPending : addMut.isPending}
              onClick={() => {
                const errors = validateAddressForm();
                if (Object.keys(errors).length > 0) {
                  setFieldErrors(errors);
                  toast.error("Please fill in the required fields.");
                  return;
                }
                setFieldErrors({});
                if (editingAddressId) editMut.mutate();
                else addMut.mutate();
              }}
            >
              {editingAddressId ? "Update address" : "Save address"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CustomerAddresses;
