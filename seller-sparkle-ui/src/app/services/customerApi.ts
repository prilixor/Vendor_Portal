import { apiClient, type ApiClientOptions } from "@/app/services/apiClient";

export interface CustomerCatalogListingApi {
  id: string;
  title: string;
  vendorName: string;
  vendorRating: number;
  serviceAreaHint: string;
  categoryName: string;
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  listingStatus: string;
  availableQuantity: number;
  productTotalAvailableQuantity: number;
  availabilityStatus: "available" | "low_stock" | "out_of_stock" | string;
  primaryImageUrl?: string | null;
  buyPrice?: number;
  /** Highest chemical packaging buy price when sizes differ; omit when same as buyPrice. */
  maxBuyPrice?: number;
  isRentEnabled?: boolean;
  isBuyEnabled?: boolean;
  /** True when the listing's category is a chemical (buy-only + chemical spec display). */
  isChemical?: boolean;
  casNumber?: string;
  chemicalFormula?: string;
  purityPercentage?: number;
  molecularWeight?: number;
  baseUnit?: string;
  variants?: ProductVariantDto[];
  variantInventory?: { productVariantId: string; availableQuantity: number }[];
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  vendorPrice?: number;
  buyPrice: number;
  isActive: boolean;
  /** Live per-size stock (only populated on the customer listing-detail response). */
  availableQuantity?: number;
}

export interface CustomerCatalogCategoryApi {
  id: string;
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isActive: boolean;
  /** True for chemical categories (used to filter pills by Equipment vs Chemicals tab). */
  isChemical?: boolean;
}

export type RentalDiscountType = "none" | "fixed" | "percentage";

export interface RentalPricingPlanDto {
  id: string;
  productId: string;
  durationLabel: string;
  durationDays: number;
  normalPrice: number;
  discountType: RentalDiscountType;
  discountValue: number;
  finalRentalPrice: number;
  isRecommended: boolean;
  isActive: boolean;
  sortOrder: number;
  billingCycles?: number;
  rentalDurationIconId?: string | null;
  iconUrl?: string | null;
  iconThumbnailUrl?: string | null;
  valueTier?: string | null;
  iconName?: string | null;
}

export interface RentalDurationIconDto {
  id: string;
  name: string;
  valueTier: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  imageStorageKey?: string | null;
  thumbnailStorageKey?: string | null;
}

export interface CustomerListingDetailApi {
  id: string;
  title: string;
  vendorName: string;
  vendorRating: number;
  serviceAreaHint: string;
  categoryName: string;
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  listingStatus: string;
  availableQuantity: number;
  availabilityStatus: "available" | "low_stock" | "out_of_stock" | string;
  description: string;
  imageUrls: string[];
  buyPrice?: number;
  isRentEnabled?: boolean;
  isBuyEnabled?: boolean;
  /** True when the listing's category is a chemical (buy-only + chemical spec display). */
  isChemical?: boolean;
  casNumber?: string;
  chemicalFormula?: string;
  purityPercentage?: number;
  molecularWeight?: number;
  baseUnit?: string;
  sdsDocumentUrl?: string;
  coaDocumentUrl?: string;
  documents?: Array<{
    id: string;
    documentType: string;
    fileUrl: string;
  }>;
  variants?: ProductVariantDto[];
  variantInventory?: { productVariantId: string; availableQuantity: number }[];
  /** Active admin-configured duration plans (prefer over week/month steppers when present). */
  rentalPricingPlans?: RentalPricingPlanDto[];
}

export interface CustomerProfileApi {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
}

export interface CustomerAddressApi {
  id: string;
  label?: string | null;
  line1: string;
  city: string;
  state: string;
  postal: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
}

export interface CustomerOrderQuoteApi {
  subtotalAmount: number;
  depositAmount: number;
  serviceFeeAmount: number;
  distanceFeeAmount: number;
  expressFeeAmount: number;
  gstAmount: number;
  totalAmount: number;
  buySuggestions: Array<{
    listingId: string;
    listingTitle: string;
    rentAmount: number;
    buyAmount: number;
    savingsAmount: number;
  }>;
}

export interface CustomerOrderApi {
  id: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  vendorName: string;
  vendorId: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  totalAmount: number;
  depositAmount: number;
  serviceFeeAmount: number;
  distanceFeeAmount: number;
  expressFeeAmount: number;
  gstAmount: number;
  orderType: string;
  quantity: number;
  rentalDays: number;
  rentalPeriodUnit?: "day" | "week" | "month";
  listingPrimaryImageUrl?: string | null;
  /** Alias some responses may use; prefer listingPrimaryImageUrl. */
  primaryImageUrl?: string | null;
  productVariantId?: string | null;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorUniqueCode?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalCity?: string;
  doctorContactNumber?: string;
  /** Snapshot when order used a duration pricing plan. */
  rentalPricingPlanId?: string | null;
  rentalDurationLabel?: string | null;
  rentalDurationDays?: number | null;
  rentalNormalPrice?: number | null;
  rentalDiscountType?: RentalDiscountType | string | null;
  rentalDiscountValue?: number | null;
  rentalFinalPrice?: number | null;
}

export interface CustomerOrderImageApi {
  id: string;
  orderId: string;
  requestId?: string | null;
  fileUrl: string;
  originalFileName?: string | null;
  contentType?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CustomerOrderImageRequestApi {
  id: string;
  orderId: string;
  vendorId: string;
  status: string;
  message: string;
  requestedAt: string;
  images: CustomerOrderImageApi[];
}

export interface ExtensionQuoteApi {
  additionalDays: number;
  newEndDate: string;
  extensionAmount: number;
  serviceFeeAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface BuyoutQuoteApi {
  baseBuyoutAmount: number;
  rentDeductionAmount: number;
  serviceFeeAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface HospitalApi {
  id: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactNumber?: string | null;
  isActive?: boolean;
}

export interface DoctorApi {
  id: string;
  fullName: string;
  uniqueCode: string;
  email?: string | null;
  specialization?: string | null;
  contactNumber?: string | null;
  isActive: boolean;
  publicPageUrl?: string | null;
  hospitals?: HospitalApi[] | null;
}

export interface CartLinePayload {
  listingId: string;
  quantity: number;
  rentalDays: number;
  rentalPeriodUnit?: "day" | "week" | "month";
  orderType?: "rent" | "buy";
  productVariantId?: string;
  /** Optional Admin-curated doctor reference (Unique ID lookup). */
  doctorId?: string;
  rentalPricingPlanId?: string;
  /** ISO date YYYY-MM-DD when using a duration pricing plan. */
  rentalStartDate?: string;
}

export interface VariantStockSuggestionApi {
  productVariantId: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  buyPrice: number;
  availableQuantity: number;
}

export interface PlaceCustomerOrdersResultApi {
  placedOrders: CustomerOrderApi[];
  failedLines: Array<{
    listingId: string;
    quantity: number;
    rentalDays: number;
    orderType: string;
    reasonCode: string;
    message: string;
    variantSuggestions?: VariantStockSuggestionApi[] | null;
  }>;
}

export interface CustomerCheckoutApi {
  checkoutSessionId: string;
  razorpayKeyId: string;
  razorpayOrderId?: string | null;
  amount: number;
  currency: string;
  paymentLinkUrl?: string | null;
  orders: CustomerOrderApi[];
  failedLines: PlaceCustomerOrdersResultApi["failedLines"];
}

export interface CustomerNotificationApi {
  id: string;
  title: string;
  body: string;
  notificationType: string;
  relatedOrderId?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export interface CustomerNotificationsMarkAllReadApi {
  updatedCount: number;
}

export interface ExpiringOrderApi {
  orderId: string;
  orderNumber: string;
  customerName: string;
  vendorName: string;
  listingTitle: string;
  status: string;
  orderType: string;
  endDate: string;
  daysLeft: number;
}

export interface IndianStateLookupApi {
  name: string;
  iso2: string;
}

export interface IndianCityLookupApi {
  name: string;
}

function catalogQuery(category?: string, search?: string): string {
  const qs = new URLSearchParams();
  if (category?.trim()) qs.set("category", category.trim());
  if (search?.trim()) qs.set("search", search.trim());
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export const customerApi = {
  getCatalogCategories(): Promise<CustomerCatalogCategoryApi[]> {
    return apiClient.get<CustomerCatalogCategoryApi[]>("/customers/catalog/categories");
  },

  getCatalogListings(category?: string, search?: string): Promise<CustomerCatalogListingApi[]> {
    return apiClient.get<CustomerCatalogListingApi[]>(`/customers/catalog/listings${catalogQuery(category, search)}`);
  },

  getListingDetail(listingId: string): Promise<CustomerListingDetailApi> {
    return apiClient.get<CustomerListingDetailApi>(`/customers/catalog/listings/${encodeURIComponent(listingId)}`);
  },

  getRentalDurationIcons(): Promise<RentalDurationIconDto[]> {
    return apiClient.get<RentalDurationIconDto[]>("/customers/catalog/rental-duration-icons");
  },

  getProfile(): Promise<CustomerProfileApi> {
    return apiClient.get<CustomerProfileApi>("/customers/me/profile");
  },

  updateProfile(fullName: string, phone?: string): Promise<CustomerProfileApi> {
    return apiClient.put<CustomerProfileApi>("/customers/me/profile", { fullName, phone: phone?.trim() || undefined });
  },

  getAddresses(): Promise<CustomerAddressApi[]> {
    return apiClient.get<CustomerAddressApi[]>("/customers/me/addresses");
  },

  addAddress(payload: {
    label?: string;
    line1: string;
    city: string;
    state: string;
    postal: string;
    latitude?: number;
    longitude?: number;
    setAsDefault: boolean;
  }): Promise<CustomerAddressApi> {
    return apiClient.post<CustomerAddressApi>("/customers/me/addresses", payload);
  },

  updateAddress(addressId: string, payload: {
    label?: string;
    line1: string;
    city: string;
    state: string;
    postal: string;
    latitude?: number;
    longitude?: number;
    setAsDefault: boolean;
  }): Promise<CustomerAddressApi> {
    return apiClient.put<CustomerAddressApi>(`/customers/me/addresses/${encodeURIComponent(addressId)}`, payload);
  },

  deleteAddress(addressId: string): Promise<void> {
    return apiClient.delete(`/customers/me/addresses/${encodeURIComponent(addressId)}`);
  },

  getDoctorByCode(uniqueCode: string): Promise<DoctorApi> {
    return apiClient.get<DoctorApi>(
      `/medical-directory/doctors/by-code/${encodeURIComponent(uniqueCode.trim())}`,
    );
  },

  searchDoctors(search?: string): Promise<DoctorApi[]> {
    const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    return apiClient.get<DoctorApi[]>(`/medical-directory/doctors${qs}`);
  },

  getOrders(): Promise<CustomerOrderApi[]> {
    return apiClient.get<CustomerOrderApi[]>("/customers/me/orders");
  },

  getOrder(orderId: string): Promise<CustomerOrderApi> {
    return apiClient.get<CustomerOrderApi>(`/customers/me/orders/${encodeURIComponent(orderId)}`);
  },

  placeOrders(payload: {
    customerAddressId?: string | null;
    deliveryOption: string;
    lines: CartLinePayload[];
  }): Promise<PlaceCustomerOrdersResultApi> {
    return apiClient.post<PlaceCustomerOrdersResultApi>("/customers/me/orders", {
      customerAddressId: payload.customerAddressId ?? undefined,
      deliveryOption: payload.deliveryOption,
      lines: payload.lines.map((l) => ({
        listingId: l.listingId,
        quantity: l.quantity,
        rentalDays: l.rentalDays,
        rentalPeriodUnit: l.rentalPeriodUnit ?? "day",
        orderType: l.orderType ?? "rent",
        productVariantId: l.productVariantId,
        doctorId: l.doctorId || undefined,
        rentalPricingPlanId: l.rentalPricingPlanId || undefined,
        rentalStartDate: l.rentalStartDate || undefined,
      })),
    });
  },

  createCheckout(payload: {
    customerAddressId?: string | null;
    deliveryOption: string;
    lines: CartLinePayload[];
  }): Promise<CustomerCheckoutApi> {
    return apiClient.post<CustomerCheckoutApi>("/customers/me/payments/checkout", {
      customerAddressId: payload.customerAddressId ?? undefined,
      deliveryOption: payload.deliveryOption,
      lines: payload.lines.map((l) => ({
        listingId: l.listingId,
        quantity: l.quantity,
        rentalDays: l.rentalDays,
        rentalPeriodUnit: l.rentalPeriodUnit ?? "day",
        orderType: l.orderType ?? "rent",
        productVariantId: l.productVariantId,
        doctorId: l.doctorId || undefined,
        rentalPricingPlanId: l.rentalPricingPlanId || undefined,
        rentalStartDate: l.rentalStartDate || undefined,
      })),
    });
  },

  verifyCheckout(payload: {
    checkoutSessionId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<CustomerCheckoutApi> {
    return apiClient.post<CustomerCheckoutApi>("/customers/me/payments/verify", payload);
  },

  quoteOrders(payload: {
    customerAddressId?: string | null;
    deliveryOption: string;
    lines: CartLinePayload[];
  }): Promise<CustomerOrderQuoteApi> {
    return apiClient.post<CustomerOrderQuoteApi>("/customers/me/orders/quote", {
      customerAddressId: payload.customerAddressId ?? undefined,
      deliveryOption: payload.deliveryOption,
      lines: payload.lines.map((l) => ({
        listingId: l.listingId,
        quantity: l.quantity,
        rentalDays: l.rentalDays,
        rentalPeriodUnit: l.rentalPeriodUnit ?? "day",
        orderType: l.orderType ?? "rent",
        productVariantId: l.productVariantId,
        doctorId: l.doctorId || undefined,
        rentalPricingPlanId: l.rentalPricingPlanId || undefined,
        rentalStartDate: l.rentalStartDate || undefined,
      })),
    });
  },

  cancelOrder(orderId: string): Promise<CustomerOrderApi> {
    return apiClient.patch<CustomerOrderApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/cancel`, {});
  },

  async getOrderImageRequest(orderId: string): Promise<CustomerOrderImageRequestApi | null> {
    const row = await apiClient.get<CustomerOrderImageRequestApi | null | undefined>(
      `/customers/me/orders/${encodeURIComponent(orderId)}/image-request`,
    );
    return row ?? null;
  },

  createOrderImageRequest(orderId: string): Promise<CustomerOrderImageRequestApi> {
    return apiClient.post<CustomerOrderImageRequestApi>(
      `/customers/me/orders/${encodeURIComponent(orderId)}/image-request`,
      {},
    );
  },

  quoteExtension(orderId: string, additionalDays: number): Promise<ExtensionQuoteApi> {
    return apiClient.post<ExtensionQuoteApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/extensions/quote`, {
      additionalDays
    });
  },

  processExtension(orderId: string, additionalDays: number): Promise<void> {
    return apiClient.post<void>(`/customers/me/orders/${encodeURIComponent(orderId)}/extensions`, {
      additionalDays
    });
  },

  quoteBuyout(orderId: string): Promise<BuyoutQuoteApi> {
    return apiClient.post<BuyoutQuoteApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/buyouts/quote`, {});
  },

  processBuyout(orderId: string): Promise<void> {
    return apiClient.post<void>(`/customers/me/orders/${encodeURIComponent(orderId)}/buyouts`, {});
  },

  getNotifications(options?: ApiClientOptions): Promise<CustomerNotificationApi[]> {
    return apiClient.get<CustomerNotificationApi[]>("/customers/me/notifications", options);
  },

  getOrderExpirations(withinDays = 7): Promise<ExpiringOrderApi[]> {
    return apiClient.get<ExpiringOrderApi[]>(`/customers/me/orders/expirations?withinDays=${withinDays}`);
  },

  markNotificationRead(notificationId: string): Promise<CustomerNotificationApi> {
    return apiClient.patch<CustomerNotificationApi>(
      `/customers/me/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
      { quiet: true },
    );
  },

  markAllNotificationsRead(): Promise<CustomerNotificationsMarkAllReadApi> {
    return apiClient.patch<CustomerNotificationsMarkAllReadApi>(
      "/customers/me/notifications/read-all",
      {},
      { quiet: true },
    );
  },

  getIndianStates(): Promise<IndianStateLookupApi[]> {
    return apiClient.get<IndianStateLookupApi[]>("/vendors/locations/states");
  },

  getCitiesByState(stateIso2: string): Promise<IndianCityLookupApi[]> {
    return apiClient.get<IndianCityLookupApi[]>(
      `/vendors/locations/states/${encodeURIComponent(stateIso2)}/cities`,
    );
  },

  getNotificationPreferences(): Promise<CustomerNotificationPreferenceApi> {
    return apiClient.get<CustomerNotificationPreferenceApi>("/customers/me/notification-preferences");
  },

  updateNotificationPreferences(prefs: Omit<CustomerNotificationPreferenceApi, "customerId">): Promise<CustomerNotificationPreferenceApi> {
    return apiClient.put<CustomerNotificationPreferenceApi>("/customers/me/notification-preferences", prefs);
  },

  getFavorites(): Promise<CustomerFavoriteApi[]> {
    return apiClient.get<CustomerFavoriteApi[]>("/customers/me/favorites");
  },

  addFavorite(listingId: string): Promise<CustomerFavoriteApi> {
    return apiClient.post<CustomerFavoriteApi>("/customers/me/favorites", { vendorProductListingId: listingId });
  },

  removeFavorite(listingId: string): Promise<void> {
    return apiClient.delete(`/customers/me/favorites/${encodeURIComponent(listingId)}`);
  },
};

export interface CustomerFavoriteApi {
  id: string;
  customerId: string;
  vendorProductListingId: string;
  addedAtUtc: string;
}

export interface CustomerNotificationPreferenceApi {
  customerId: string;
  orderStatusUpdatesEnabled: boolean;
  expirationRemindersEnabled: boolean;
  depositRefundsEnabled: boolean;
  directMessagesEnabled: boolean;
  marketingEmailsEnabled: boolean;
}

/** @deprecated Use HospitalApi / DoctorApi */
export type HospitalDto = HospitalApi;
export type DoctorDto = DoctorApi;

