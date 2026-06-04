using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface ICustomerRepository
{
    Task<Customer?> GetCustomerByIdAsync(Guid customerId, CancellationToken cancellationToken);
    Task<Customer?> GetCustomerByEmailAsync(string email, CancellationToken cancellationToken);
    Task AddCustomerAsync(Customer customer, CancellationToken cancellationToken);
    Task UpdateCustomerAsync(Customer customer, CancellationToken cancellationToken);

    Task<List<CustomerAddress>> GetCustomerAddressesAsync(Guid customerId, CancellationToken cancellationToken);
    Task<CustomerAddress?> GetCustomerAddressByIdAsync(Guid customerId, Guid addressId, CancellationToken cancellationToken);
    Task AddCustomerAddressAsync(CustomerAddress address, CancellationToken cancellationToken);
    Task UpdateCustomerAddressAsync(CustomerAddress address, CancellationToken cancellationToken);

    Task<List<CustomerCatalogListingDto>> GetPublicCatalogListingsAsync(string? categoryFilter, string? search, Guid? customerId, CancellationToken cancellationToken);
    Task<VendorProductListingAggregate?> GetListingForCustomerAsync(Guid listingId, CancellationToken cancellationToken);
    Task<List<VendorProductListingAggregate>> GetCandidateListingsByProductIdAsync(Guid productId, CancellationToken cancellationToken);

    Task AddCustomerRentalOrderAsync(CustomerRentalOrder order, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderWithListing>> GetCustomerOrdersAsync(Guid customerId, CancellationToken cancellationToken);
    Task<CustomerRentalOrderWithListing?> GetCustomerOrderAsync(Guid customerId, Guid orderId, CancellationToken cancellationToken);
    Task<CustomerRentalOrderWithListing?> GetCustomerOrderByNumberAsync(Guid customerId, string orderNumber, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderWithListing>> GetVendorOrdersAsync(Guid vendorId, string? status, CancellationToken cancellationToken);
    Task<CustomerRentalOrderWithListing?> GetVendorOrderAsync(Guid vendorId, Guid orderId, CancellationToken cancellationToken);
    Task<CustomerRentalOrderWithListing?> GetCustomerOrderByIdAsync(Guid orderId, CancellationToken cancellationToken);
    Task<CustomerRentalOrder?> GetCustomerOrderEntityByIdAsync(Guid orderId, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderWithListing>> GetAllCustomerOrdersForAdminAsync(CancellationToken cancellationToken);
    Task<bool> OrderNumberExistsAsync(string orderNumber, CancellationToken cancellationToken);
    Task UpdateCustomerRentalOrderAsync(CustomerRentalOrder order, CancellationToken cancellationToken);
    Task AddCustomerOrderVendorOfferAsync(CustomerOrderVendorOffer offer, CancellationToken cancellationToken);
    Task<List<CustomerOrderVendorOffer>> GetCustomerOrderVendorOffersAsync(Guid customerOrderId, CancellationToken cancellationToken);
    Task<CustomerOrderVendorOffer?> GetCustomerOrderVendorOfferAsync(Guid customerOrderId, Guid vendorId, CancellationToken cancellationToken);
    Task<List<CustomerOrderVendorOffer>> GetPendingVendorOffersAsync(Guid vendorId, CancellationToken cancellationToken);
    Task UpdateCustomerOrderVendorOfferAsync(CustomerOrderVendorOffer offer, CancellationToken cancellationToken);
    Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForCustomerAsync(Guid customerId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken);
    Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForVendorAsync(Guid vendorId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken);
    Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForAdminAsync(DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken);

    Task<List<CustomerNotification>> GetCustomerNotificationsAsync(Guid customerId, CancellationToken cancellationToken);
    Task<CustomerNotification?> GetCustomerNotificationByIdAsync(Guid customerId, Guid notificationId, CancellationToken cancellationToken);
    Task AddCustomerNotificationAsync(CustomerNotification notification, CancellationToken cancellationToken);
    Task<int> MarkAllCustomerNotificationsReadAsync(Guid customerId, CancellationToken cancellationToken);

    Task<CustomerNotificationPreference?> GetCustomerNotificationPreferenceAsync(Guid customerId, CancellationToken cancellationToken);
    Task AddCustomerNotificationPreferenceAsync(CustomerNotificationPreference preference, CancellationToken cancellationToken);
    Task UpdateCustomerNotificationPreferenceAsync(CustomerNotificationPreference preference, CancellationToken cancellationToken);

    Task<List<ChatSession>> GetCustomerChatSessionsAsync(Guid customerId, CancellationToken cancellationToken);
    Task<List<ChatSession>> GetVendorChatSessionsAsync(Guid vendorId, CancellationToken cancellationToken);
    Task<ChatSession?> GetChatSessionAsync(Guid customerId, Guid vendorId, Guid? orderId, CancellationToken cancellationToken);
    Task<ChatSession?> GetChatSessionByIdAsync(Guid sessionId, CancellationToken cancellationToken);
    Task AddChatSessionAsync(ChatSession session, CancellationToken cancellationToken);
    Task UpdateChatSessionAsync(ChatSession session, CancellationToken cancellationToken);
    Task<List<ChatMessage>> GetChatMessagesAsync(Guid sessionId, CancellationToken cancellationToken);
    Task AddChatMessageAsync(ChatMessage message, CancellationToken cancellationToken);
    Task<string?> GetVendorBusinessNameAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<bool> HasActiveOrdersForListingAsync(Guid listingId, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Rental order row plus listing loaded from the vendor database (may be null if listing was removed).</summary>
public sealed record CustomerRentalOrderWithListing(
    CustomerRentalOrder Order,
    VendorProductListing? Listing,
    string? ListingPrimaryImageUrl);

/// <summary>Listing row for customer browse (mapped from vendor listings).</summary>
public sealed record CustomerCatalogListingDto(
    Guid Id,
    string Title,
    string VendorName,
    decimal VendorRating,
    string ServiceAreaHint,
    string CategoryName,
    decimal DailyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    bool PrescriptionRequired,
    bool DepositRequired,
    string ListingStatus,
    int AvailableQuantity,
    int ProductTotalAvailableQuantity,
    string AvailabilityStatus,
    string? PrimaryImageUrl);

/// <summary>Listing + vendor + product loaded for checkout validation.</summary>
public sealed class VendorProductListingAggregate
{
    public Guid ListingId { get; init; }
    public Guid ProductId { get; init; }
    public Guid VendorId { get; init; }
    public string VendorAccountStatus { get; init; } = string.Empty;
    public string? VendorBusinessName { get; init; }
    public decimal? VendorLatitude { get; init; }
    public decimal? VendorLongitude { get; init; }
    public string ListingTitle { get; init; } = string.Empty;
    public string ListingStatus { get; init; } = string.Empty;
    public decimal DailyRent { get; init; }
    public decimal MonthlyRent { get; init; }
    public decimal SecurityDeposit { get; init; }
    public decimal? BuyPrice { get; init; }
    public decimal GstPercent { get; init; }
    public bool IsRentEnabled { get; init; }
    public bool IsBuyEnabled { get; init; }
    public int ListingAvailableQuantity { get; init; }
    public bool CategoryPrescriptionRequired { get; init; }
    public bool CategoryDepositRequired { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public List<string> ImageUrls { get; init; } = [];
    public Guid? InventoryId { get; init; }
    public int InventoryAvailable { get; init; }
    public int InventoryReserved { get; init; }
    public int InventoryTotal { get; init; }
    public int InventoryRented { get; init; }
    public int InventoryBlocked { get; init; }
}

public sealed record ExpiringOrderAggregate(
    Guid OrderId,
    string OrderNumber,
    Guid CustomerId,
    string CustomerName,
    Guid VendorId,
    string VendorName,
    Guid ListingId,
    string ListingTitle,
    string Status,
    string OrderType,
    DateOnly EndDate);
