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
}

export interface CartLinePayload {
  listingId: string;
  quantity: number;
  rentalDays: number;
  orderType?: "rent" | "buy";
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
      })),
    });
  },

  cancelOrder(orderId: string): Promise<CustomerOrderApi> {
    return apiClient.patch<CustomerOrderApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/cancel`, {});
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
