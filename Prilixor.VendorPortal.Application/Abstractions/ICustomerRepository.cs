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
    
    Task AddCustomerRentalOrderExtensionAsync(CustomerRentalOrderExtension extension, CancellationToken cancellationToken);
    Task<CustomerRentalOrderExtension?> GetCustomerRentalOrderExtensionByIdAsync(Guid extensionId, CancellationToken cancellationToken);
    Task UpdateCustomerRentalOrderExtensionAsync(CustomerRentalOrderExtension extension, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderExtension>> GetPendingCustomerRentalOrderExtensionsAsync(Guid orderId, CancellationToken cancellationToken);

    Task AddCustomerRentalOrderBuyoutAsync(CustomerRentalOrderBuyout buyout, CancellationToken cancellationToken);
    Task<CustomerRentalOrderBuyout?> GetCustomerRentalOrderBuyoutByIdAsync(Guid buyoutId, CancellationToken cancellationToken);
    Task UpdateCustomerRentalOrderBuyoutAsync(CustomerRentalOrderBuyout buyout, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderBuyout>> GetPendingCustomerRentalOrderBuyoutsAsync(Guid orderId, CancellationToken cancellationToken);
    
    Task<List<PendingContinuationAggregate>> GetAllPendingContinuationsForAdminAsync(CancellationToken cancellationToken);
    
    Task AddCustomerRentalOrderAssetAsync(CustomerRentalOrderAsset asset, CancellationToken cancellationToken);
    Task<List<CustomerRentalOrderAsset>> GetCustomerRentalOrderAssetsAsync(Guid customerOrderId, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, List<string>>> GetCustomerOrderAssetTagsByOrderIdsAsync(IEnumerable<Guid> orderIds, CancellationToken cancellationToken);
    Task RemoveCustomerRentalOrderAssetAsync(CustomerRentalOrderAsset asset, CancellationToken cancellationToken);
    Task<CustomerRentalOrderWithListing?> GetActiveCustomerOrderForAssetAsync(Guid assetId, CancellationToken cancellationToken);

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

    Task<List<CustomerFavorite>> GetCustomerFavoritesAsync(Guid customerId, CancellationToken cancellationToken);
    Task<CustomerFavorite?> GetCustomerFavoriteAsync(Guid customerId, Guid vendorProductListingId, CancellationToken cancellationToken);
    Task AddCustomerFavoriteAsync(CustomerFavorite favorite, CancellationToken cancellationToken);
    Task RemoveCustomerFavoriteAsync(CustomerFavorite favorite, CancellationToken cancellationToken);
    Task<List<Guid>> GetCustomersByFavoriteListingAsync(Guid vendorProductListingId, CancellationToken cancellationToken);
    Task<Dictionary<Guid, int>> GetFavoriteCountsByListingsAsync(List<Guid> listingIds, CancellationToken cancellationToken);
    Task<Dictionary<Guid, int>> GetFavoriteCountsByProductsAsync(CancellationToken cancellationToken);

    // --- Medical Directory ---
    Task<Prilixor.VendorPortal.Domain.Common.Hospital?> GetHospitalByIdAsync(Guid hospitalId, CancellationToken cancellationToken);
    Task<List<Prilixor.VendorPortal.Domain.Common.Hospital>> SearchHospitalsAsync(string searchTerm, CancellationToken cancellationToken);
    Task AddHospitalAsync(Prilixor.VendorPortal.Domain.Common.Hospital hospital, CancellationToken cancellationToken);
    Task<Prilixor.VendorPortal.Domain.Common.Doctor?> GetDoctorByIdAsync(Guid doctorId, CancellationToken cancellationToken);
    Task<List<Prilixor.VendorPortal.Domain.Common.Doctor>> SearchDoctorsAsync(Guid? hospitalId, string searchTerm, CancellationToken cancellationToken);
    Task AddDoctorAsync(Prilixor.VendorPortal.Domain.Common.Doctor doctor, CancellationToken cancellationToken);
    Task LinkDoctorToHospitalAsync(Guid hospitalId, Guid doctorId, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Rental order row plus listing loaded from the vendor database (may be null if listing was removed).</summary>
public sealed record CustomerRentalOrderWithListing(
    CustomerRentalOrder Order,
    VendorProductListing? Listing,
    string? ListingPrimaryImageUrl,
    Prilixor.VendorPortal.Domain.Common.Doctor? Doctor = null,
    Prilixor.VendorPortal.Domain.Common.Hospital? Hospital = null,
    string? VariantDescription = null);

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
    string? PrimaryImageUrl,
    decimal? BuyPrice = null,
    bool IsRentEnabled = true,
    bool IsBuyEnabled = false,
    string? CasNumber = null,
    string? ChemicalFormula = null,
    decimal? PurityPercentage = null,
    decimal? MolecularWeight = null,
    string? BaseUnit = null,
    bool IsChemical = false,
    /// <summary>Highest active variant buy price (chemicals). Null when equal to BuyPrice or not applicable.</summary>
    decimal? MaxBuyPrice = null);

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
    public decimal VendorDailyRent { get; init; }
    public decimal VendorMonthlyRent { get; init; }
    public decimal VendorSecurityDeposit { get; init; }
    public decimal? VendorBuyPrice { get; init; }
    public decimal GstPercent { get; init; }
    public bool IsRentEnabled { get; init; }
    public bool IsBuyEnabled { get; init; }
    /// <summary>True when the product's category is a chemical (drives buy-only + chemical spec display).</summary>
    public bool IsChemical { get; init; }
    public int ListingAvailableQuantity { get; init; }
    public bool CategoryPrescriptionRequired { get; init; }
    public bool CategoryDepositRequired { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public List<string> ImageUrls { get; init; } = [];
    public List<Prilixor.VendorPortal.Application.Onboarding.ProductVariantDto> Variants { get; init; } = [];
    public Guid? InventoryId { get; init; }
    public int InventoryAvailable { get; init; }
    public int InventoryReserved { get; init; }
    public int InventoryTotal { get; init; }
    public int InventoryRented { get; init; }
    public string? CasNumber { get; init; }
    public string? ChemicalFormula { get; init; }
    public decimal? PurityPercentage { get; init; }
    public decimal? MolecularWeight { get; init; }
    public string? BaseUnit { get; init; }
    public string? SdsDocumentUrl { get; init; }
    public string? CoaDocumentUrl { get; init; }
    public int InventoryBlocked { get; init; }
    /// <summary>Per-variant (SKU-level) available stock for chemical listings.</summary>
    public List<VariantInventoryItem> VariantInventory { get; init; } = [];
}

/// <summary>Lightweight stock summary for one packaging size (SKU).</summary>
public sealed record VariantInventoryItem(
    Guid ProductVariantId,
    int AvailableQuantity);

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
    DateOnly EndDate,
    int DaysLeft,
    string? ListingPrimaryImageUrl = null
);

public sealed record PendingContinuationAggregate(
    Guid Id,
    Guid CustomerRentalOrderId,
    string OrderNumber,
    string CustomerName,
    string VendorName,
    string ListingTitle,
    decimal TotalAmount,
    DateTimeOffset CreatedOnUtc,
    string Type
);
