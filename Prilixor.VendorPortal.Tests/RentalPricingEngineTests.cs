using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Tests;

public class RentalPricingEngineTests
{
    private static readonly RentalPricingOptions Options = new();

    [Fact]
    public void Durations_are_taken_from_input_not_hardcoded()
    {
        var durations = Durations((10, 10), (30, 30), (45, 45), (60, 60), (180, 180));

        var result = RentalPricingEngine.Calculate(100m, 10_000m, durations, options: Options);

        Assert.Equal([10, 30, 45, 60, 180], result.Plans.Select(p => p.DurationDays).ToArray());
        Assert.Equal(60, result.EconomicMaximumDays);
        Assert.True(result.Plans.Single(p => p.DurationDays == 60).IsEligible);
        Assert.False(result.Plans.Single(p => p.DurationDays == 180).IsEligible);
    }

    [Fact]
    public void Prompt_example_selects_112_day_max_plan_and_integer_curve()
    {
        var durations = Durations(
            (7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (56, 56),
            (70, 70), (84, 84), (98, 98), (112, 112), (126, 126), (140, 140));

        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);
        var byDays = result.Plans.ToDictionary(p => p.DurationDays);

        Assert.Equal(112, result.EconomicMaximumDays);
        Assert.Equal(10, result.EligibleCount);
        Assert.Equal(
            [7, 14, 21, 28, 42, 56, 70, 84, 98, 112],
            result.Plans.Where(p => p.IsEligible).Select(p => p.DurationDays).ToArray());
        Assert.Equal([126, 140], result.Plans.Where(p => !p.IsEligible).Select(p => p.DurationDays).ToArray());

        Assert.Equal(0m, byDays[7].DiscountValue);
        Assert.Equal(1m, byDays[14].DiscountValue);
        Assert.Equal(1m, byDays[21].DiscountValue);
        Assert.Equal(2m, byDays[28].DiscountValue);
        Assert.Equal(4m, byDays[42].DiscountValue);
        Assert.Equal(6m, byDays[56].DiscountValue);
        Assert.Equal(9m, byDays[70].DiscountValue);
        Assert.Equal(13m, byDays[84].DiscountValue);
        Assert.Equal(16m, byDays[98].DiscountValue);
        Assert.Equal(20m, byDays[112].DiscountValue);
        Assert.Equal(0m, byDays[126].DiscountValue);
        Assert.False(byDays[126].IsEligible);

        Assert.Equal(1470m, byDays[7].BasePrice);
        Assert.Equal(1470m, byDays[7].FinalPrice);
        Assert.Equal(23520m, byDays[112].BasePrice);
        Assert.True(byDays[112].FinalPrice < byDays[112].BasePrice);
        Assert.Equal(RentalPricingPlanMath.None, byDays[112].PersistDiscountType);
    }

    [Fact]
    public void New_duration_becomes_eligible_when_base_amount_does_not_exceed_buy_price()
    {
        var without50 = Durations((7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (56, 56));
        var with50 = Durations((7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (50, 50), (56, 56));

        var before = RentalPricingEngine.Calculate(166.25m, 10_000m, without50, options: Options);
        var after = RentalPricingEngine.Calculate(166.25m, 10_000m, with50, options: Options);

        Assert.Equal(56, before.Plans.Where(p => p.IsEligible).Max(p => p.DurationDays));
        Assert.True(after.Plans.Single(p => p.DurationDays == 50).IsEligible);
        Assert.True(after.Plans.Single(p => p.DurationDays == 56).IsEligible);
    }

    [Fact]
    public void Disabled_or_zero_day_durations_are_excluded()
    {
        var durations = new List<RentalDurationPricingInput>
        {
            new(Guid.NewGuid(), "10 Days", 10, 0.35m, 1),
            new(Guid.NewGuid(), "Invalid", 0, 0m, 2),
            new(Guid.Empty, "No id", 20, 0.7m, 3),
            new(Guid.NewGuid(), "30 Days", 30, 1m, 4),
        };

        var result = RentalPricingEngine.Calculate(100m, null, durations, options: Options);

        Assert.Equal([10, 30], result.Plans.Select(p => p.DurationDays).ToArray());
        Assert.All(result.Plans, p => Assert.True(p.IsEligible));
        Assert.All(result.Plans, p => Assert.Equal(0m, p.DiscountValue));
    }

    [Fact]
    public void Unsorted_and_duplicate_master_ids_are_normalized()
    {
        var seven = Guid.NewGuid();
        var fourteen = Guid.NewGuid();
        var durations = new List<RentalDurationPricingInput>
        {
            new(fourteen, "14 Days", 14, 0.5m, 2),
            new(seven, "7 Days", 7, 0.25m, 1),
            new(seven, "7 Days dup", 7, 0.25m, 9),
            new(Guid.NewGuid(), "112 Days", 112, 4m, 3),
        };

        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);

        Assert.Equal([7, 14, 112], result.Plans.Select(p => p.DurationDays).ToArray());
        Assert.Equal(0m, result.Plans.Single(p => p.DurationDays == 7).DiscountValue);
        Assert.Equal(20m, result.Plans.Single(p => p.DurationDays == 112).DiscountValue);
    }

    [Fact]
    public void Seven_day_plan_is_always_zero_and_max_plan_is_twenty()
    {
        var durations = Durations((7, 7), (14, 14), (21, 21), (28, 28), (42, 42));
        var result = RentalPricingEngine.Calculate(166.25m, 10_000m, durations, options: Options);
        var eligible = result.Plans.Where(p => p.IsEligible).OrderBy(p => p.DurationDays).ToList();

        Assert.Equal(0m, eligible[0].DiscountValue);
        Assert.Equal(7, eligible[0].DurationDays);
        Assert.Equal(20m, eligible[^1].DiscountValue);
        Assert.True(eligible[^1].IsAutomatic);
    }

    [Fact]
    public void Automatic_discounts_round_to_nearest_integer_not_five_percent_steps()
    {
        Assert.Equal(2m, RentalPricingEngine.RoundAutomaticDiscountPercent(1.79m, Options));
        Assert.Equal(4m, RentalPricingEngine.RoundAutomaticDiscountPercent(3.85m, Options));
        Assert.Equal(6m, RentalPricingEngine.RoundAutomaticDiscountPercent(6.38m, Options));
        Assert.Equal(9m, RentalPricingEngine.RoundAutomaticDiscountPercent(9.30m, Options));
        Assert.Equal(13m, RentalPricingEngine.RoundAutomaticDiscountPercent(12.56m, Options));
        Assert.Equal(16m, RentalPricingEngine.RoundAutomaticDiscountPercent(16.14m, Options));
        Assert.Equal(20m, RentalPricingEngine.RoundAutomaticDiscountPercent(20m, Options));
        Assert.Equal(20m, RentalPricingEngine.RoundAutomaticDiscountPercent(25m, Options));
        Assert.Equal(0m, RentalPricingEngine.RoundAutomaticDiscountPercent(0.4m, Options));
        Assert.Equal(1m, RentalPricingEngine.RoundAutomaticDiscountPercent(0.5m, Options));
    }

    [Fact]
    public void Legacy_five_percent_and_ninety_percent_config_cannot_change_automatic_math()
    {
        var stale = new RentalPricingOptions
        {
            TargetRecoveryPercentage = 90m,
            DiscountStepPercent = 5m,
            MaximumDiscountPercent = 20m,
            DiscountCurveExponent = 1.5,
            MinimumPlanDays = 7,
        };
        var durations = Durations(
            (7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (56, 56),
            (70, 70), (84, 84), (98, 98), (112, 112), (126, 126));

        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: stale);
        var byDays = result.Plans.ToDictionary(p => p.DurationDays);

        Assert.Equal(112, result.EconomicMaximumDays);
        Assert.True(byDays[112].IsEligible);
        Assert.Equal(1m, byDays[14].DiscountValue);
        Assert.Equal(20m, byDays[112].DiscountValue);
    }

    [Fact]
    public void Plan_greater_than_seven_days_gets_at_least_one_percent()
    {
        var durations = Durations((7, 7), (14, 14), (112, 112));
        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);
        var fourteen = result.Plans.Single(p => p.DurationDays == 14);

        Assert.True(fourteen.IsEligible);
        Assert.True(fourteen.DiscountValue >= 1m);
        Assert.Equal(1m, fourteen.DiscountValue);
    }

    [Fact]
    public void Discounts_never_decrease_as_duration_increases()
    {
        var durations = Durations(
            (7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (56, 56),
            (70, 70), (84, 84), (98, 98), (112, 112));
        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);
        var eligible = result.Plans.Where(p => p.IsEligible).OrderBy(p => p.DurationDays).ToList();

        for (var i = 1; i < eligible.Count; i++)
        {
            Assert.True(
                eligible[i].DiscountValue >= eligible[i - 1].DiscountValue,
                $"{eligible[i].DurationDays}d discount {eligible[i].DiscountValue} fell below {eligible[i - 1].DurationDays}d {eligible[i - 1].DiscountValue}");
        }
    }

    [Fact]
    public void Only_seven_day_plan_gets_zero_automatic_discount()
    {
        var durations = Durations((7, 7), (90, 90));
        var result = RentalPricingEngine.Calculate(166.25m, 10_000m, durations, options: Options);

        var eligible = result.Plans.Where(p => p.IsEligible).ToList();
        Assert.Single(eligible);
        Assert.Equal(7, eligible[0].DurationDays);
        Assert.Equal(0m, eligible[0].DiscountValue);
        Assert.Equal(eligible[0].BasePrice, eligible[0].FinalPrice);
        Assert.False(result.Plans.Single(p => p.DurationDays == 90).IsEligible);
    }

    [Fact]
    public void Single_eligible_plan_longer_than_seven_days_gets_max_discount()
    {
        var durations = Durations((14, 14), (180, 180));
        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);
        var fourteen = result.Plans.Single(p => p.DurationDays == 14);

        Assert.True(fourteen.IsEligible);
        Assert.Equal(20m, fourteen.DiscountValue);
        Assert.False(result.Plans.Single(p => p.DurationDays == 180).IsEligible);
    }

    [Fact]
    public void Plan_shorter_than_seven_days_stays_at_zero_percent()
    {
        var durations = Durations((5, 5), (7, 7), (14, 14), (112, 112));
        var result = RentalPricingEngine.Calculate(210m, 25_000m, durations, options: Options);

        Assert.Equal(0m, result.Plans.Single(p => p.DurationDays == 5).DiscountValue);
        Assert.Equal(0m, result.Plans.Single(p => p.DurationDays == 7).DiscountValue);
        Assert.True(result.Plans.Single(p => p.DurationDays == 14).DiscountValue >= 1m);
    }

    [Fact]
    public void Missing_buy_price_offers_all_active_plans_with_zero_automatic_discount()
    {
        var durations = Durations((7, 7), (14, 14), (30, 30), (45, 45));
        var result = RentalPricingEngine.Calculate(100m, null, durations, options: Options);

        Assert.Null(result.EconomicMaximumDays);
        Assert.Equal(4, result.EligibleCount);
        Assert.All(result.Plans, p =>
        {
            Assert.True(p.IsEligible);
            Assert.Equal(0m, p.DiscountValue);
            Assert.Equal(p.DurationDays * 100m, p.BasePrice);
            Assert.Equal(p.BasePrice, p.FinalPrice);
        });
    }

    [Fact]
    public void Buy_price_below_first_plan_marks_all_plans_unavailable()
    {
        var durations = Durations((7, 7), (14, 14));
        var result = RentalPricingEngine.Calculate(210m, 100m, durations, options: Options);

        Assert.Equal(0, result.EligibleCount);
        Assert.All(result.Plans, p =>
        {
            Assert.False(p.IsEligible);
            Assert.Equal(0m, p.DiscountValue);
        });
    }

    [Fact]
    public void Missing_daily_rate_produces_no_plans()
    {
        var durations = Durations((7, 7), (14, 14));
        var result = RentalPricingEngine.Calculate(0m, 10_000m, durations, options: Options);

        Assert.Empty(result.Plans);
        Assert.False(RentalPricingEngine.IsDailyRateValidForRent(isRentEnabled: true, dailyRate: 0m));
        Assert.True(RentalPricingEngine.IsDailyRateValidForRent(isRentEnabled: false, dailyRate: 0m));
    }

    [Fact]
    public void Manual_percentage_and_flat_discounts_are_preserved_when_base_price_changes()
    {
        var master7 = Guid.NewGuid();
        var master14 = Guid.NewGuid();
        var durations = new List<RentalDurationPricingInput>
        {
            new(master7, "7 Days", 7, 0.25m, 1),
            new(master14, "14 Days", 14, 0.5m, 2),
        };
        var existing = new List<ExistingRentalPlanInput>
        {
            new(Guid.NewGuid(), master7, RentalPricingPlanMath.Percentage, 10m, false),
            new(Guid.NewGuid(), master14, RentalPricingPlanMath.Fixed, 500m, false),
        };

        var result = RentalPricingEngine.Calculate(100m, null, durations, existing, Options);

        var seven = result.Plans.Single(p => p.DurationMasterId == master7);
        var fourteen = result.Plans.Single(p => p.DurationMasterId == master14);
        Assert.False(seven.IsAutomatic);
        Assert.Equal(RentalPricingPlanMath.Percentage, seven.PersistDiscountType);
        Assert.Equal(10m, seven.DiscountValue);
        Assert.Equal(630m, seven.FinalPrice);
        Assert.False(fourteen.IsAutomatic);
        Assert.Equal(RentalPricingPlanMath.Fixed, fourteen.PersistDiscountType);
        Assert.Equal(500m, fourteen.DiscountValue);
        Assert.Equal(900m, fourteen.FinalPrice);
    }

    [Fact]
    public void Reset_to_automatic_recalculates_previously_manual_plans()
    {
        var master = Guid.NewGuid();
        var durations = new List<RentalDurationPricingInput>
        {
            new(master, "7 Days", 7, 0.25m, 1),
            new(Guid.NewGuid(), "14 Days", 14, 0.5m, 2),
        };
        var existing = new List<ExistingRentalPlanInput>
        {
            new(Guid.NewGuid(), master, RentalPricingPlanMath.Percentage, 10m, false),
        };

        var reset = RentalPricingEngine.Calculate(100m, null, durations, existing, Options, resetManualOverrides: true);
        var plan = reset.Plans.Single(p => p.DurationMasterId == master);

        Assert.True(plan.IsAutomatic);
        Assert.Equal(RentalPricingPlanMath.None, plan.PersistDiscountType);
        Assert.Equal(0m, plan.DiscountValue);
        Assert.Equal(700m, plan.FinalPrice);
    }

    [Fact]
    public void Duration_day_change_recalculates_base_price_and_eligibility()
    {
        var master = Guid.NewGuid();
        var original = new List<RentalDurationPricingInput> { new(master, "28 Days", 28, 1m, 1) };
        var updated = new List<RentalDurationPricingInput> { new(master, "30 Days", 30, 1m, 1) };

        var before = RentalPricingEngine.Calculate(100m, null, original, options: Options);
        var after = RentalPricingEngine.Calculate(100m, null, updated, options: Options);

        Assert.Equal(2800m, before.Plans.Single().BasePrice);
        Assert.Equal(3000m, after.Plans.Single().BasePrice);
        Assert.Equal(30, after.Plans.Single().DurationDays);
    }

    [Fact]
    public void Flat_discount_cannot_make_final_price_zero_or_negative()
    {
        var final = RentalPricingPlanMath.ComputeSafeFinalPrice(500m, RentalPricingPlanMath.Fixed, 500m);
        Assert.Equal(0.01m, final);
        Assert.Equal(0.01m, RentalPricingPlanMath.ComputeSafeFinalPrice(100m, RentalPricingPlanMath.Percentage, 100m));
        Assert.True(RentalPricingPlanMath.ComputeSafeFinalPrice(1163.75m, RentalPricingPlanMath.Percentage, 20m) > 0m);
    }

    [Fact]
    public void Most_popular_is_the_middle_eligible_plan_and_only_one_is_flagged()
    {
        var durations = Durations((7, 7), (14, 14), (21, 21), (28, 28), (42, 42), (56, 56));
        var result = RentalPricingEngine.Calculate(166.25m, 10_000m, durations, options: Options);

        var popular = result.Plans.Where(p => p.IsRecommended).ToList();
        Assert.Single(popular);
        Assert.True(popular[0].IsEligible);
        Assert.Equal(21, popular[0].DurationDays);
        Assert.Equal(2, RentalPricingEngine.MiddleIndex(5));
        Assert.Equal(2, RentalPricingEngine.MiddleIndex(6));
    }

    [Fact]
    public void Manual_recommended_plan_is_preserved_when_still_eligible()
    {
        var master28 = Guid.NewGuid();
        var durations = Durations((7, 7), (14, 14), (21, 21), (28, 28), (42, 42));
        durations = durations
            .Select(d => d.DurationDays == 28 ? d with { Id = master28 } : d)
            .ToList();
        var existing = new List<ExistingRentalPlanInput>
        {
            new(Guid.NewGuid(), master28, RentalPricingPlanMath.Percentage, 10m, true),
        };

        var result = RentalPricingEngine.Calculate(166.25m, 10_000m, durations, existing, Options);
        var popular = result.Plans.Single(p => p.IsRecommended);
        Assert.Equal(28, popular.DurationDays);
        Assert.False(popular.IsAutomatic);
    }

    [Fact]
    public void Economic_maximum_uses_floor_of_buy_price_divided_by_daily_rate()
    {
        Assert.Equal(119, RentalPricingEngine.CalculateEconomicMaximumDays(210m, 25_000m, Options));
        Assert.Equal(60, RentalPricingEngine.CalculateEconomicMaximumDays(166.25m, 10_000m, Options));
        Assert.Null(RentalPricingEngine.CalculateEconomicMaximumDays(166.25m, null, Options));
        Assert.Null(RentalPricingEngine.CalculateEconomicMaximumDays(0m, 10_000m, Options));
        Assert.True(RentalPricingEngine.IsWithinBuyPrice(112, 210m, 25_000m));
        Assert.False(RentalPricingEngine.IsWithinBuyPrice(126, 210m, 25_000m));
    }

    private static List<RentalDurationPricingInput> Durations(params (int Sort, int Days)[] items) =>
        items.Select(item => new RentalDurationPricingInput(
            Guid.NewGuid(),
            $"{item.Days} Days",
            item.Days,
            decimal.Round(item.Days / 28m, 2, MidpointRounding.AwayFromZero),
            item.Sort)).ToList();
}

public class RentalPricingApplicatorTests
{
    [Fact]
    public void Does_not_create_duplicate_plans_for_the_same_product_and_duration()
    {
        var masterId = Guid.NewGuid();
        var product = new Product
        {
            Id = Guid.NewGuid(),
            DailyRent = 100m,
            IsRentEnabled = true,
            RentalPricingPlans =
            [
                new ProductRentalPricingPlan
                {
                    Id = Guid.NewGuid(),
                    RentalDurationMasterId = masterId,
                    DurationDays = 7,
                    DiscountType = RentalPricingPlanMath.None,
                },
                new ProductRentalPricingPlan
                {
                    Id = Guid.NewGuid(),
                    RentalDurationMasterId = masterId,
                    DurationDays = 7,
                    DiscountType = RentalPricingPlanMath.None,
                },
            ],
        };

        var calculation = RentalPricingEngine.Calculate(
            100m,
            null,
            [new RentalDurationPricingInput(masterId, "7 Days", 7, 0.25m, 1)]);
        ProductRentalPricingApplicator.Apply(product, calculation);

        var withMaster = product.RentalPricingPlans.Where(p => p.RentalDurationMasterId == masterId).ToList();
        Assert.Single(withMaster);
        Assert.Equal(700m, withMaster[0].NormalPrice);
        Assert.True(withMaster[0].IsActive);
    }

    [Fact]
    public void Disabled_duration_deactivates_existing_plan_instead_of_deleting_it()
    {
        var kept = Guid.NewGuid();
        var removed = Guid.NewGuid();
        var product = new Product
        {
            Id = Guid.NewGuid(),
            DailyRent = 100m,
            IsRentEnabled = true,
            RentalPricingPlans =
            [
                new ProductRentalPricingPlan
                {
                    Id = Guid.NewGuid(),
                    RentalDurationMasterId = kept,
                    DurationDays = 7,
                    DiscountType = RentalPricingPlanMath.None,
                    IsActive = true,
                },
                new ProductRentalPricingPlan
                {
                    Id = Guid.NewGuid(),
                    RentalDurationMasterId = removed,
                    DurationDays = 14,
                    DiscountType = RentalPricingPlanMath.None,
                    IsActive = true,
                },
            ],
        };

        var calculation = RentalPricingEngine.Calculate(
            100m,
            null,
            [new RentalDurationPricingInput(kept, "7 Days", 7, 0.25m, 1)]);
        ProductRentalPricingApplicator.Apply(product, calculation);

        Assert.Equal(2, product.RentalPricingPlans.Count);
        Assert.True(product.RentalPricingPlans.Single(p => p.RentalDurationMasterId == kept).IsActive);
        Assert.False(product.RentalPricingPlans.Single(p => p.RentalDurationMasterId == removed).IsActive);
    }
}
