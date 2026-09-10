using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Resolves rental-plan icon display from the live admin catalog.
/// Inactive or deleted icons are hidden (no snapshot fallback) so Admin remove/off is immediate.
/// </summary>
public static class RentalDurationIconLiveResolve
{
    public readonly record struct ResolvedIconDisplay(
        string? IconUrl,
        string? IconThumbnailUrl,
        string? ValueTier,
        string? IconName);

    public static ResolvedIconDisplay Resolve(
        Guid? rentalDurationIconId,
        string? snapshotIconUrl,
        string? snapshotIconThumbnailUrl,
        string? snapshotValueTier,
        string? snapshotIconName,
        IReadOnlyDictionary<Guid, RentalDurationIcon>? liveIcons,
        IVendorFileUrlResolver? fileUrlResolver = null)
    {
        if (rentalDurationIconId is Guid iconId
            && liveIcons is not null
            && liveIcons.TryGetValue(iconId, out var icon)
            && !icon.IsDeleted
            && icon.IsActive)
        {
            return new ResolvedIconDisplay(
                ResolveOptionalUrl(icon.ImageUrl, fileUrlResolver),
                ResolveOptionalUrl(icon.ThumbnailUrl, fileUrlResolver),
                string.IsNullOrWhiteSpace(icon.ValueTier) ? snapshotValueTier : icon.ValueTier,
                string.IsNullOrWhiteSpace(icon.Name) ? snapshotIconName : icon.Name);
        }

        // liveIcons provided: hide missing/inactive/deleted icons instead of showing a stale snapshot.
        if (liveIcons is not null)
            return new ResolvedIconDisplay(null, null, null, null);

        return new ResolvedIconDisplay(
            ResolveOptionalUrl(snapshotIconUrl, fileUrlResolver),
            ResolveOptionalUrl(snapshotIconThumbnailUrl, fileUrlResolver),
            snapshotValueTier,
            snapshotIconName);
    }

    public static ResolvedIconDisplay Resolve(
        ProductRentalPricingPlan plan,
        IReadOnlyDictionary<Guid, RentalDurationIcon>? liveIcons,
        IVendorFileUrlResolver? fileUrlResolver = null)
        => Resolve(
            plan.RentalDurationIconId,
            plan.IconUrl,
            plan.IconThumbnailUrl,
            plan.ValueTier,
            plan.IconName,
            liveIcons,
            fileUrlResolver);

    public static IReadOnlyDictionary<Guid, RentalDurationIcon> ToLookup(
        IEnumerable<RentalDurationIcon>? icons)
        => icons?
            .Where(x => !x.IsDeleted)
            .GroupBy(x => x.Id)
            .ToDictionary(g => g.Key, g => g.First())
           ?? new Dictionary<Guid, RentalDurationIcon>();

    private static string? ResolveOptionalUrl(string? stored, IVendorFileUrlResolver? fileUrlResolver)
    {
        if (string.IsNullOrWhiteSpace(stored))
            return null;

        var value = stored.Trim();
        return fileUrlResolver is null ? value : fileUrlResolver.Resolve(value);
    }
}
