namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// Listing statuses that may appear on the customer-facing catalog.
/// Vendors/admins often use <c>approved</c> after verification; the UI may also use <c>active</c> for live rentals.
/// </summary>
public static class CustomerCatalogListingStatus
{
    public static bool IsVisibleOnPublicCatalog(string? listingStatus)
    {
        if (string.IsNullOrWhiteSpace(listingStatus))
            return false;

        var s = listingStatus.Trim();
        return s.Equals("active", StringComparison.OrdinalIgnoreCase)
            || s.Equals("approved", StringComparison.OrdinalIgnoreCase);
    }
}
