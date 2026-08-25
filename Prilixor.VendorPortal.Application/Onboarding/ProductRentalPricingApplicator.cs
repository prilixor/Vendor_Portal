using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Writes engine output onto <see cref="Product.RentalPricingPlans"/> without removing historical rows.
/// Disabled or removed duration masters are deactivated rather than deleted.
/// </summary>
public static class ProductRentalPricingApplicator
{
    public static void Apply(
        Product product,
        RentalPricingCalculation calculation)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(calculation);

        product.RentalPricingPlans ??= new List<ProductRentalPricingPlan>();
        DeduplicateByDurationMaster(product);

        var byMaster = product.RentalPricingPlans
            .Where(p => p.RentalDurationMasterId.HasValue)
            .GroupBy(p => p.RentalDurationMasterId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var keepMasterIds = new HashSet<Guid>();
        ProductRentalPricingPlan? recommended = null;

        foreach (var computed in calculation.Plans)
        {
            keepMasterIds.Add(computed.DurationMasterId);
            if (!byMaster.TryGetValue(computed.DurationMasterId, out var plan))
            {
                plan = new ProductRentalPricingPlan
                {
                    Id = computed.ExistingPlanId is Guid existingId && existingId != Guid.Empty
                        ? existingId
                        : Guid.CreateVersion7(),
                    ProductId = product.Id,
                    RentalDurationMasterId = computed.DurationMasterId,
                };
                product.RentalPricingPlans.Add(plan);
                byMaster[computed.DurationMasterId] = plan;
            }

            plan.DurationLabel = computed.DurationLabel;
            plan.DurationDays = computed.DurationDays;
            plan.BillingCycles = computed.BillingCycles;
            plan.NormalPrice = computed.BasePrice;
            plan.DiscountType = computed.PersistDiscountType;
            plan.DiscountValue = computed.DiscountValue;
            plan.FinalRentalPrice = computed.FinalPrice;
            plan.SortOrder = computed.SortOrder;
            plan.IsActive = computed.IsEligible;
            plan.RentalDurationMasterId = computed.DurationMasterId;
            plan.RentalDurationIconId = computed.RentalDurationIconId;
            plan.IconUrl = computed.IconUrl;
            plan.IconThumbnailUrl = computed.IconThumbnailUrl;
            plan.ValueTier = computed.ValueTier;
            plan.IconName = computed.IconName;

            plan.IsRecommended = false;
            if (computed.IsRecommended && computed.IsEligible)
            {
                recommended = plan;
            }
        }

        foreach (var plan in product.RentalPricingPlans)
        {
            if (!plan.RentalDurationMasterId.HasValue
                || !keepMasterIds.Contains(plan.RentalDurationMasterId.Value))
            {
                plan.IsActive = false;
                plan.IsRecommended = false;
            }
            else
            {
                plan.IsRecommended = recommended is not null && plan.Id == recommended.Id;
            }
        }
    }

    public static IReadOnlyList<RentalDurationPricingInput> ToDurationInputs(
        IEnumerable<RentalDurationMaster> masters) =>
        (masters ?? [])
            .Where(m => m.IsActive && !m.IsDeleted && m.DurationDays > 0)
            .Select(m => new RentalDurationPricingInput(
                m.Id,
                m.DurationLabel,
                m.DurationDays,
                m.BillingCycles,
                m.SortOrder))
            .ToList();

    public static IReadOnlyList<ExistingRentalPlanInput> ToExistingInputs(
        IEnumerable<ProductRentalPricingPlan>? plans) =>
        (plans ?? [])
            .Where(p => p.RentalDurationMasterId.HasValue)
            .Select(p => new ExistingRentalPlanInput(
                p.Id,
                p.RentalDurationMasterId!.Value,
                p.DiscountType,
                p.DiscountValue,
                p.IsRecommended,
                p.RentalDurationIconId,
                p.IconUrl,
                p.IconThumbnailUrl,
                p.ValueTier,
                p.IconName))
            .ToList();

    private static void DeduplicateByDurationMaster(Product product)
    {
        var seen = new HashSet<Guid>();
        foreach (var plan in product.RentalPricingPlans
                     .Where(p => p.RentalDurationMasterId.HasValue)
                     .OrderBy(p => p.CreatedOnUtc)
                     .ThenBy(p => p.Id)
                     .ToList())
        {
            var masterId = plan.RentalDurationMasterId!.Value;
            if (!seen.Add(masterId))
            {
                plan.IsActive = false;
                plan.RentalDurationMasterId = null;
            }
        }
    }
}
