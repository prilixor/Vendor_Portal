using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record RankedDispatchCandidate(
    Guid VendorId,
    Guid ListingId,
    decimal DistanceKm,
    int InventoryAvailable);

public static class SequentialDispatchRules
{
    public const string Pending = "pending";
    public const string Queued = "queued";
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
    public const string Expired = "expired";

    public const int AbsoluteMaxVendors = 5;

    public static int MaxVendors(CustomerPricingOptions options) =>
        Math.Clamp(options.MaxDispatchVendorsPerLine, 1, AbsoluteMaxVendors);

    public static TimeSpan OfferTtl(CustomerPricingOptions options) =>
        TimeSpan.FromMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes));

    public static bool IsOpenOffer(string status) =>
        string.Equals(status, Pending, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, Queued, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Vendors who actually received a turn. Queued vendors expired because someone else
    /// accepted must still be eligible when that vendor later cancels.
    /// </summary>
    public static bool HasBeenAttempted(string status) =>
        string.Equals(status, Pending, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, Accepted, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, Rejected, StringComparison.OrdinalIgnoreCase);

    /// <summary>Orders from one checkout are numbered like BM123-01, BM123-02.</summary>
    public static string? CheckoutGroupPrefix(string? orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber))
            return null;
        var i = orderNumber.LastIndexOf('-');
        return i > 0 ? orderNumber[..i] : null;
    }

    /// <summary>
    /// One shop = one attempt. Keep the listing with the most stock.
    /// Preferred vendors (confirmed sibling lines) win only on equal distance — pickup.
    /// </summary>
    public static List<RankedDispatchCandidate> SelectUniqueVendors(
        IEnumerable<RankedDispatchCandidate> ranked,
        IReadOnlySet<Guid> excludeVendorIds,
        IReadOnlySet<Guid> preferredVendorIds,
        int take,
        Guid? pinFirstVendorId = null)
    {
        take = Math.Clamp(take, 1, AbsoluteMaxVendors);
        var unique = ranked
            .Where(x => x.VendorId != Guid.Empty && !excludeVendorIds.Contains(x.VendorId))
            .GroupBy(x => x.VendorId)
            .Select(g => g
                .OrderByDescending(x => x.InventoryAvailable)
                .ThenBy(x => x.ListingId)
                .First())
            .ToList();

        var ordered = unique
            .OrderBy(x => x.DistanceKm)
            .ThenBy(x => preferredVendorIds.Contains(x.VendorId) ? 0 : 1)
            .ThenByDescending(x => x.InventoryAvailable)
            .ThenBy(x => x.ListingId)
            .ToList();

        if (pinFirstVendorId is Guid pinId && pinId != Guid.Empty)
        {
            var pinned = ordered.FirstOrDefault(x => x.VendorId == pinId);
            if (pinned is not null)
            {
                ordered.Remove(pinned);
                ordered.Insert(0, pinned);
            }
        }

        return ordered.Take(take).ToList();
    }
}
