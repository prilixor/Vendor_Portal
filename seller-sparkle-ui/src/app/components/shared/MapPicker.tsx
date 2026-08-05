import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import { cn } from "@/app/helpers/utils";
import {
  reverseGeocode,
  type ResolvedMapAddress,
} from "@/app/helpers/reverseGeocode";

interface MapPickerProps {
  latitude: number;
  longitude: number;
  onChange?: (lat: number, lng: number) => void;
  onAddressResolved?: (address: ResolvedMapAddress | null) => void;
  radiusKm?: number;
  onRadiusChange?: (km: number) => void;
  /** Max value for the radius slider (default 30). Admin can pass 100+. */
  maxRadiusKm?: number;
  /** Optional quick-select presets shown next to the slider (e.g. [15, 30, 100]). */
  radiusPresetsKm?: number[];
  /** When true with showRadius and no onRadiusChange, shows a read-only radius label. */
  radiusReadOnlyLabel?: string;
  height?: string;
  showRadius?: boolean;
  className?: string;
}

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const MapPicker = ({
  latitude,
  longitude,
  onChange,
  onAddressResolved,
  radiusKm,
  onRadiusChange,
  maxRadiusKm = 30,
  radiusPresetsKm,
  radiusReadOnlyLabel,
  height = "h-72",
  showRadius = false,
  className,
}: MapPickerProps) => {
  const center: LatLngExpression = [latitude, longitude];
  const isInteractive = Boolean(onChange);
  const heightClass = parseTailwindHeightClass(height);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  const onChangeRef = useRef(onChange);
  const onAddressResolvedRef = useRef(onAddressResolved);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const reverseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved;
  }, [onAddressResolved]);

  useEffect(() => {
    return () => {
      if (reverseTimerRef.current != null) {
        window.clearTimeout(reverseTimerRef.current);
      }
      reverseAbortRef.current?.abort();
    };
  }, []);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (!onAddressResolvedRef.current) return;

    if (reverseTimerRef.current != null) {
      window.clearTimeout(reverseTimerRef.current);
    }
    reverseAbortRef.current?.abort();

    reverseTimerRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      reverseAbortRef.current = controller;
      setIsResolvingAddress(true);
      void reverseGeocode(lat, lng, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          onAddressResolvedRef.current?.(result);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!controller.signal.aborted) {
            onAddressResolvedRef.current?.(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsResolvingAddress(false);
          }
        });
    }, 400);
  }, []);

  const emitChange = useCallback(
    (lat: number, lng: number, resolveAddress = true) => {
      onChangeRef.current?.(lat, lng);
      if (resolveAddress) {
        scheduleReverseGeocode(lat, lng);
      }
    },
    [scheduleReverseGeocode],
  );

  const searchPlaces = async (searchQuery: string, signal?: AbortSignal) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const photonUrl =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}` +
        `&lat=${latitude}&lon=${longitude}&limit=12&lang=en`;
      const photonResponse = await fetch(photonUrl, { signal });
      if (!photonResponse.ok) {
        throw new Error("Autocomplete request failed.");
      }
      const photonPayload = (await photonResponse.json()) as PhotonResponse;
      const photonResults = photonPayload.features
        .filter((item) => item.geometry?.coordinates?.length === 2)
        .map((item) => {
          const [lng, lat] = item.geometry.coordinates;
          return {
            place_id: item.properties.osm_id ?? item.properties.name,
            lat: String(lat),
            lon: String(lng),
            display_name: formatPhotonLabel(item.properties),
          };
        });

      if (photonResults.length > 0) {
        const limitedPhotonResults = photonResults.slice(0, 10);
        setResults(limitedPhotonResults);
        if (onChange) {
          const first = limitedPhotonResults[0];
          const lat = Number(first.lat);
          const lng = Number(first.lon);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            emitChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
          }
        }
        return;
      }

      const nearbyDelta = 0.8;
      const left = longitude - nearbyDelta;
      const right = longitude + nearbyDelta;
      const top = latitude + nearbyDelta;
      const bottom = latitude - nearbyDelta;

      const nearbyUrl =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&bounded=1` +
        `&viewbox=${left},${top},${right},${bottom}&q=${encodeURIComponent(searchQuery)}`;
      const globalUrl =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10` +
        `&q=${encodeURIComponent(searchQuery)}`;

      const nearbyResponse = await fetch(nearbyUrl, { signal });
      if (!nearbyResponse.ok) {
        throw new Error("Nearby search request failed.");
      }
      const nearbyData = (await nearbyResponse.json()) as SearchResult[];

      let merged = nearbyData;
      if (nearbyData.length < 6) {
        const globalResponse = await fetch(globalUrl, { signal });
        if (!globalResponse.ok) {
          throw new Error("Global search request failed.");
        }
        const globalData = (await globalResponse.json()) as SearchResult[];
        const deduped = [...nearbyData];
        globalData.forEach((item) => {
          if (!deduped.some((existing) => existing.place_id === item.place_id)) {
            deduped.push(item);
          }
        });
        merged = deduped;
      }

      const limited = merged.slice(0, 10);
      setResults(limited);
      if (onChange && limited.length > 0) {
        const first = limited[0];
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          emitChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
        }
      }
      if (limited.length === 0) {
        setSearchError("No matching areas found.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setSearchError("Unable to search area right now.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!isInteractive) return;
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void searchPlaces(trimmedQuery, controller.signal);
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, isInteractive]);

  const handleSelectResult = (result: SearchResult) => {
    if (!onChange) return;
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    emitChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
    setQuery(result.display_name);
    setResults([]);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {isInteractive && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search area, landmark, shop or address"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          {isSearching && <p className="text-xs text-muted-foreground">Searching places...</p>}
          {(results.length > 0 || searchError) && (
            <div className="max-h-44 overflow-auto rounded-md border border-border bg-background">
              {results.map((result) => (
                <button
                  key={`${result.place_id}-${result.lat}-${result.lon}`}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="block w-full border-b border-border px-3 py-2 text-left text-xs hover:bg-muted last:border-b-0"
                >
                  {result.display_name}
                </button>
              ))}
              {searchError && <p className="px-3 py-2 text-xs text-muted-foreground">{searchError}</p>}
            </div>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-border",
          isInteractive ? "cursor-crosshair" : "cursor-default",
          heightClass
        )}
      >
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={isInteractive}
          dragging={isInteractive}
          doubleClickZoom={isInteractive}
          zoomControl={isInteractive}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapResizeHandler />
          <MapCenterUpdater latitude={latitude} longitude={longitude} />
          <LocationSelector onChange={onChange ? emitChange : undefined} />
          <DraggableMarker
            latitude={latitude}
            longitude={longitude}
            onChange={
              onChange
                ? (lat, lng) => emitChange(lat, lng, false)
                : undefined
            }
            onDragEnd={
              onChange
                ? (lat, lng) => emitChange(lat, lng, true)
                : undefined
            }
          />
          {showRadius && radiusKm && (
            <Circle
              center={center}
              radius={radiusKm * 1000}
              pathOptions={{ color: "hsl(var(--primary))", fillOpacity: 0.15 }}
            />
          )}
        </MapContainer>

        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
          {isResolvingAddress && onAddressResolved && (
            <span className="ml-1.5 font-normal text-muted-foreground">Looking up address…</span>
          )}
        </div>
        {onChange && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
            Search, click map, or drag pin
          </div>
        )}
      </div>

      {showRadius && onRadiusChange && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Radius:</span>
            <input
              type="range"
              min={1}
              max={maxRadiusKm}
              value={Math.min(radiusKm ?? 5, maxRadiusKm)}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-16 text-right text-sm font-semibold text-primary">{radiusKm} km</span>
          </div>
          {radiusPresetsKm && radiusPresetsKm.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {radiusPresetsKm.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => onRadiusChange(km)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    radiusKm === km
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {km} km
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {showRadius && !onRadiusChange && radiusKm != null && (
        <p className="text-sm text-muted-foreground">
          {radiusReadOnlyLabel ?? `Coverage radius: ${radiusKm} km (set by Admin)`}
        </p>
      )}
    </div>
  );
};

const LocationSelector = ({
  onChange,
}: {
  onChange?: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click(event) {
      if (!onChange) return;
      onChange(
        parseFloat(event.latlng.lat.toFixed(6)),
        parseFloat(event.latlng.lng.toFixed(6))
      );
    },
  });
  return null;
};

const DraggableMarker = ({
  latitude,
  longitude,
  onChange,
  onDragEnd,
}: {
  latitude: number;
  longitude: number;
  onChange?: (lat: number, lng: number) => void;
  onDragEnd?: (lat: number, lng: number) => void;
}) => {
  const markerRef = useRef<L.Marker | null>(null);
  const eventHandlers = useMemo(
    () => ({
      drag() {
        if (!onChange) return;
        const marker = markerRef.current;
        if (!marker) return;
        const { lat, lng } = marker.getLatLng();
        onChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
      },
      dragend() {
        const handler = onDragEnd ?? onChange;
        if (!handler) return;
        const marker = markerRef.current;
        if (!marker) return;
        const { lat, lng } = marker.getLatLng();
        handler(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
      },
    }),
    [onChange, onDragEnd]
  );

  return (
    <Marker
      draggable={Boolean(onChange || onDragEnd)}
      eventHandlers={eventHandlers}
      position={[latitude, longitude]}
      icon={markerIcon}
      ref={markerRef}
    />
  );
};

const MapCenterUpdater = ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) => {
  const map = useMap();
  useEffect(() => {
    // Leaflet maps inside animated dialogs can render with wrong tile layout.
    // A short invalidate loop keeps tiles aligned as the modal settles.
    const timeouts: number[] = [];
    [0, 80, 180, 320].forEach((delay) => {
      const timer = window.setTimeout(() => {
        map.invalidateSize();
        map.setView([latitude, longitude], map.getZoom(), { animate: false });
      }, delay);
      timeouts.push(timer);
    });

    return () => {
      timeouts.forEach((timer) => window.clearTimeout(timer));
    };
  }, [latitude, longitude, map]);
  return null;
};

const MapResizeHandler = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  return null;
};

const parseTailwindHeightClass = (height: string): string => {
  if (height.startsWith("h-")) return height;
  return "h-72";
};

interface SearchResult {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
}

interface PhotonResponse {
  features: Array<{
    geometry: {
      coordinates: [number, number];
    };
    properties: {
      osm_id?: number;
      name?: string;
      city?: string;
      state?: string;
      country?: string;
      postcode?: string;
      street?: string;
      district?: string;
    };
  }>;
}

const formatPhotonLabel = (properties: PhotonResponse["features"][number]["properties"]): string => {
  const parts = [
    properties.name,
    properties.street,
    properties.district,
    properties.city,
    properties.state,
    properties.postcode,
    properties.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unnamed place";
};
