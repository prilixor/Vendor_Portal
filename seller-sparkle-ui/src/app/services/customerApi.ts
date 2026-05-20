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
  isDefault: boolean;
}

export interface CustomerOrderApi {
  id: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  vendorName: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  totalAmount: number;
  depositAmount: number;
  quantity: number;
  rentalDays: number;
  listingPrimaryImageUrl?: string | null;
}

export interface CartLinePayload {
  listingId: string;
  quantity: number;
  rentalDays: number;
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
    setAsDefault: boolean;
  }): Promise<CustomerAddressApi> {
    return apiClient.post<CustomerAddressApi>("/customers/me/addresses", payload);
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
  }): Promise<CustomerOrderApi[]> {
    return apiClient.post<CustomerOrderApi[]>("/customers/me/orders", {
      customerAddressId: payload.customerAddressId ?? undefined,
      deliveryOption: payload.deliveryOption,
      lines: payload.lines.map((l) => ({
        listingId: l.listingId,
        quantity: l.quantity,
        rentalDays: l.rentalDays,
      })),
    });
  },

  cancelOrder(orderId: string): Promise<CustomerOrderApi> {
    return apiClient.patch<CustomerOrderApi>(`/customers/me/orders/${encodeURIComponent(orderId)}/cancel`, {});
  },

  getNotifications(): Promise<CustomerNotificationApi[]> {
    return apiClient.get<CustomerNotificationApi[]>("/customers/me/notifications");
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
};
