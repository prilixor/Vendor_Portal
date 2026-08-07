using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Resolves rental-plan icon display fields from the live admin catalog by
/// <see cref="ProductRentalPricingPlan.RentalDurationIconId"/>, falling back to
/// per-plan snapshot URLs when the master icon is missing/inactive/deleted.
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
