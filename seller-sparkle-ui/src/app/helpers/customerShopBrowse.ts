export type ShopBrowseMode = "equipment" | "chemicals";

export const SHOP_PATH = "/customer/shop";
export const SHOP_TAB_PARAM = "tab";

const STORAGE_KEY = "customerShopBrowseMode";

export function parseShopBrowseMode(value: string | null | undefined): ShopBrowseMode | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "chemicals" || normalized === "chemical" || normalized === "buy") {
    return "chemicals";
  }
  if (normalized === "equipment" || normalized === "rent") {
    return "equipment";
  }
  return null;
}

export function readStoredShopBrowseMode(): ShopBrowseMode {
  try {
    return parseShopBrowseMode(sessionStorage.getItem(STORAGE_KEY)) ?? "equipment";
  } catch {
    return "equipment";
  }
}

export function persistShopBrowseMode(mode: ShopBrowseMode): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode / blocked storage — URL still carries the tab.
  }
}

/** URL tab wins; otherwise last tab in this session; otherwise equipment. */
export function resolveShopBrowseMode(tabParam: string | null | undefined): ShopBrowseMode {
  return parseShopBrowseMode(tabParam) ?? readStoredShopBrowseMode();
}

export function shopHrefForBrowseMode(mode: ShopBrowseMode): string {
  return mode === "chemicals" ? `${SHOP_PATH}?${SHOP_TAB_PARAM}=chemicals` : SHOP_PATH;
}

export function shopHrefForListing(isChemical: boolean): string {
  return shopHrefForBrowseMode(isChemical ? "chemicals" : "equipment");
}

export function lastShopHref(): string {
  return shopHrefForBrowseMode(readStoredShopBrowseMode());
}

export function applyShopBrowseModeToSearchParams(
  params: URLSearchParams,
  mode: ShopBrowseMode,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (mode === "chemicals") {
    next.set(SHOP_TAB_PARAM, "chemicals");
  } else {
    next.delete(SHOP_TAB_PARAM);
  }
  return next;
}
