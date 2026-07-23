/** Nominatim reverse-geocode → structured address fields (Customer Mobile parity). */

export type ResolvedMapAddress = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  residential?: string;
  hamlet?: string;
  locality?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
};

type NominatimReverseResponse = {
  name?: string;
  address?: NominatimAddress;
};

const trim = (value?: string | null): string | null => {
  const t = value?.trim();
  return t ? t : null;
};

const buildLine1 = (address: NominatimAddress, placeName?: string): string | null => {
  const house = trim(address.house_number);
  const road = trim(address.road);
  if (road) return house ? `${house} ${road}` : road;
  return (
    trim(placeName) ||
    trim(address.neighbourhood) ||
    trim(address.suburb) ||
    trim(address.residential) ||
    trim(address.hamlet) ||
    trim(address.locality)
  );
};

export function hasResolvedAddressFields(address: ResolvedMapAddress | null | undefined): boolean {
  if (!address) return false;
  return Boolean(
    trim(address.line1) || trim(address.city) || trim(address.state) || trim(address.postal),
  );
}

export function missingAddressFieldLabels(input: {
  line1?: string;
  city?: string;
  state?: string;
  postal?: string;
  requireLine1?: boolean;
  requireCity?: boolean;
  requireState?: boolean;
  requirePostal?: boolean;
}): string[] {
  const missing: string[] = [];
  if (input.requireLine1 !== false && !trim(input.line1)) missing.push("address line");
  if (input.requireState !== false && !trim(input.state)) missing.push("state");
  if (input.requireCity !== false && !trim(input.city)) missing.push("city");
  if (input.requirePostal !== false && !trim(input.postal)) missing.push("postal code");
  return missing;
}

/** Reverse-geocode a pin. Returns null when the request fails or OSM has no address. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ResolvedMapAddress | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(String(latitude))}` +
      `&lon=${encodeURIComponent(String(longitude))}` +
      `&addressdetails=1`;
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimReverseResponse;
    if (!data.address) return null;

    const state = trim(data.address.state);
    const city = trim(
      data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.municipality ||
        data.address.county ||
        data.address.state_district,
    );
    const postal = trim(data.address.postcode);
    const line1 = buildLine1(data.address, data.name);

    const resolved: ResolvedMapAddress = { line1, city, state, postal };
    return hasResolvedAddressFields(resolved) ? resolved : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}
