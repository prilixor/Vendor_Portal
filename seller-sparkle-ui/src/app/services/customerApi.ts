import { apiClient } from "@/app/services/apiClient";

export interface CustomerCatalogListingApi {
  id: string;
  title: string;
  vendorName: string;
  vendorRating: number;
  serviceAreaHint: string;
  categoryName: string;
  dailyRent: number;
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
}

export interface CustomerListingDetailApi {
  id: string;
  title: string;
  vendorName: string;
  vendorRating: number;
  serviceAreaHint: string;
  categoryName: string;
  dailyRent: number;
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
  variants?: ProductVariantDto[];
  variantInventory?: { productVariantId: string; availableQuantity: number }[];
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
  listingPrimaryImageUrl?: string | null;
  productVariantId?: string | null;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalCity?: string;
  doctorContactNumber?: string;
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
  isVerified: boolean;
}

export interface DoctorApi {
  id: string;
  fullName: string;
  specialization?: string | null;
  contactNumber?: string | null;
  isVerified: boolean;
}

export interface CartLinePayload {
  listingId: string;
  quantity: number;
  rentalDays: number;
  orderType?: "rent" | "buy";
  productVariantId?: string;
  doctorId?: string;
  hospitalId?: string;
  contactNumber?: string;
  referenceNumber?: string;
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

  searchHospitals(search?: string): Promise<HospitalDto[]> {
    const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    return apiClient.get<HospitalDto[]>(`/medical-directory/hospitals${qs}`);
  },

  createHospital(payload: {
    name: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }): Promise<HospitalDto> {
    return apiClient.post<HospitalDto>("/medical-directory/hospitals", payload);
  },

  searchDoctors(hospitalId?: string, search?: string): Promise<DoctorDto[]> {
    const qs = new URLSearchParams();
    if (hospitalId) qs.set("hospitalId", hospitalId);
    if (search?.trim()) qs.set("search", search.trim());
    const queryStr = qs.toString();
    return apiClient.get<DoctorDto[]>(`/medical-directory/doctors${queryStr ? "?" + queryStr : ""}`);
  },

  createDoctor(payload: {
    hospitalId: string;
    fullName: string;
    specialization?: string;
    contactNumber?: string;
  }): Promise<DoctorDto> {
    return apiClient.post<DoctorDto>("/medical-directory/doctors", payload);
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
        orderType: l.orderType ?? "rent",
        productVariantId: l.productVariantId,
        doctorId: l.doctorId,
        hospitalId: l.hospitalId,
        contactNumber: l.contactNumber,
        referenceNumber: l.referenceNumber,
      })),
    });
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
        orderType: l.orderType ?? "rent",
        productVariantId: l.productVariantId,
        doctorId: l.doctorId,
        hospitalId: l.hospitalId,
        contactNumber: l.contactNumber,
        referenceNumber: l.referenceNumber,
      })),
    });
  },

  cancelOrder(orderId: string): Promise<CustomerOrderApi> {
    return apiClient.patch<CustomerOrderApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/cancel`, {});
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

  getNotifications(): Promise<CustomerNotificationApi[]> {
    return apiClient.get<CustomerNotificationApi[]>("/customers/me/notifications");
  },

  getOrderExpirations(withinDays = 7): Promise<ExpiringOrderApi[]> {
    return apiClient.get<ExpiringOrderApi[]>(`/customers/me/orders/expirations?withinDays=${withinDays}`);
  },

  markNotificationRead(notificationId: string): Promise<CustomerNotificationApi> {
    return apiClient.patch<CustomerNotificationApi>(
      `/customers/me/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
    );
  },

  markAllNotificationsRead(): Promise<CustomerNotificationsMarkAllReadApi> {
    return apiClient.patch<CustomerNotificationsMarkAllReadApi>("/customers/me/notifications/read-all");
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

export interface HospitalDto {
  id: string;
  name: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  isVerified: boolean;
}

export interface DoctorDto {
  id: string;
  fullName: string;
  specialization?: string;
  contactNumber?: string;
  isVerified: boolean;
}

