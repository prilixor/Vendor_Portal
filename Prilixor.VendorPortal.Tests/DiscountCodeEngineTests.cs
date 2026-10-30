using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.Tests;

public class DiscountCodeEngineTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 30, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid ProductA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ProductB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid CategoryA = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid CategoryB = Guid.Parse("44444444-4444-4444-4444-444444444444");

    [Fact]
    public void Percent_discount_applies_only_to_eligible_item_prices_and_splits_the_amount()
    {
        var code = Code("percentage", 10m, appliesTo: "both");
        var lines = new[]
        {
            Line(1000m, "rent", ProductA, CategoryA),
            Line(500m, "buy", ProductB, CategoryB),
        };

        var result = DiscountCodeEngine.Evaluate(code, lines, 0, 0, Now);

        Assert.True(result.Applied);
        Assert.Equal(150m, result.TotalDiscount);
        Assert.Equal(100m, result.LineDiscounts[0]);
        Assert.Equal(50m, result.LineDiscounts[1]);
    }

    [Fact]
    public void Fixed_amount_is_split_across_eligible_lines_and_cannot_exceed_the_item_price()
    {
        var code = Code("fixed", 30m);
        var lines = new[]
        {
            Line(10m, "rent", ProductA, CategoryA),
            Line(10m, "rent", ProductA, CategoryA),
        };

        var result = DiscountCodeEngine.Evaluate(code, lines, 0, 0, Now);

        Assert.Equal(20m, result.TotalDiscount);
        Assert.Equal(10m, result.LineDiscounts[0]);
        Assert.Equal(10m, result.LineDiscounts[1]);
    }

    [Fact]
    public void Rent_only_code_leaves_a_buy_line_undiscounted()
    {
        var code = Code("fixed", 100m, appliesTo: "rent");
        var lines = new[]
        {
            Line(400m, "rent", ProductA, CategoryA),
            Line(400m, "buy", ProductA, CategoryA),
        };

        var result = DiscountCodeEngine.Evaluate(code, lines, 0, 0, Now);

        Assert.Equal(100m, result.TotalDiscount);
        Assert.Equal(100m, result.LineDiscounts[0]);
        Assert.Equal(0m, result.LineDiscounts[1]);
    }

    [Fact]
    public void Product_and_category_limits_use_either_match()
    {
        var code = Code("percentage", 10m, products: [ProductA], categories: [CategoryB]);
        var lines = new[]
        {
            Line(200m, "rent", ProductA, CategoryA),
            Line(300m, "buy", ProductB, CategoryB),
            Line(500m, "rent", ProductB, CategoryA),
        };

        var result = DiscountCodeEngine.Evaluate(code, lines, 0, 0, Now);

        Assert.Equal(50m, result.TotalDiscount);
        Assert.Equal(20m, result.LineDiscounts[0]);
        Assert.Equal(30m, result.LineDiscounts[1]);
        Assert.Equal(0m, result.LineDiscounts[2]);
    }

    [Fact]
    public void Percent_cap_minimum_and_use_limits_reject_or_reduce()
    {
        var capped = Code("percentage", 50m, maxDiscount: 40m);
        var cappedResult = DiscountCodeEngine.Evaluate(capped, [Line(200m, "rent", ProductA, CategoryA)], 0, 0, Now);
        Assert.Equal(40m, cappedResult.TotalDiscount);

        var minimum = Code("fixed", 10m, minimum: 500m);
        var minimumResult = DiscountCodeEngine.Evaluate(minimum, [Line(100m, "rent", ProductA, CategoryA)], 0, 0, Now);
        Assert.False(minimumResult.Applied);
        Assert.Equal(DiscountCodeEngine.MinimumMessage, minimumResult.Message);

        var limited = Code("fixed", 10m, maxTotalUses: 1);
        var limitedResult = DiscountCodeEngine.Evaluate(limited, [Line(100m, "rent", ProductA, CategoryA)], 1, 0, Now);
        Assert.Equal(DiscountCodeEngine.TotalLimitMessage, limitedResult.Message);
    }

    [Fact]
    public void Public_offer_picks_the_code_that_saves_the_most()
    {
        var smaller = Code("fixed", 20m, show: true);
        var larger = Code("percentage", 10m, show: true, code: "SAVE10");
        var hidden = Code("percentage", 50m, show: false, code: "SECRET");
        var lines = new[] { Line(1000m, "rent", ProductA, CategoryA) };

        var best = DiscountCodeEngine.PickBestPublic(
            [(smaller, 0, 0), (larger, 0, 0), (hidden, 0, 0)],
            lines,
            Now);

        Assert.Equal("SAVE10", best?.Code);
        Assert.Equal("Use SAVE10 for 10% off the item price.", DiscountCodeEngine.OfferLabel(larger));
    }

    private static DiscountLineInput Line(decimal item, string orderType, Guid productId, Guid categoryId) =>
        new(item, orderType, productId, categoryId);

    private static DiscountCodeDefinition Code(
        string type,
        decimal value,
        string appliesTo = "both",
        decimal? maxDiscount = null,
        decimal? minimum = null,
        int? maxTotalUses = null,
        bool show = false,
        string code = "WELCOME10",
        Guid[]? products = null,
        Guid[]? categories = null) =>
        new(
            Guid.NewGuid(),
            code,
            type,
            value,
            maxDiscount,
            minimum,
            null,
            null,
            true,
            maxTotalUses,
            null,
            appliesTo,
            show,
            products?.ToHashSet() ?? [],
            categories?.ToHashSet() ?? []);
}
