namespace Prilixor.VendorPortal.Application.Onboarding;

public static class RentalPricingPlanMath
{
    public const string None = "none";
    public const string Fixed = "fixed";
    public const string Percentage = "percentage";

    public static string NormalizeDiscountType(string? discountType)
    {
        var t = (discountType ?? None).Trim().ToLowerInvariant();
        return t switch
        {
            Fixed => Fixed,
            Percentage => Percentage,
            _ => None
        };
    }

    public static bool IsValidDiscountType(string? discountType) =>
        NormalizeDiscountType(discountType) is None or Fixed or Percentage;

    /// <summary>
    /// Configure Prices stores percentage or fixed. Automatic engine keeps type <see cref="None"/>.
    /// </summary>
    public static bool IsManualOverride(string? discountType) =>
        NormalizeDiscountType(discountType) is Fixed or Percentage;

    public static decimal ComputeFinalPrice(decimal normalPrice, string? discountType, decimal discountValue)
    {
        var normal = Math.Max(0m, normalPrice);
        var value = Math.Max(0m, discountValue);
        return NormalizeDiscountType(discountType) switch
        {
            Fixed => Math.Max(0m, decimal.Round(normal - value, 2, MidpointRounding.AwayFromZero)),
            Percentage => Math.Max(0m, decimal.Round(normal * (1m - Math.Min(100m, value) / 100m), 2, MidpointRounding.AwayFromZero)),
            _ => decimal.Round(normal, 2, MidpointRounding.AwayFromZero)
        };
    }

    /// <summary>
    /// Final rental price is always &gt; 0 when base price is &gt; 0. Flat/percentage discounts cannot zero the price.
    /// </summary>
    public static decimal ComputeSafeFinalPrice(decimal normalPrice, string? discountType, decimal discountValue)
    {
        var normal = Math.Max(0m, decimal.Round(normalPrice, 2, MidpointRounding.AwayFromZero));
        if (normal <= 0m)
        {
            return 0m;
        }

        var type = NormalizeDiscountType(discountType);
        var value = Math.Max(0m, discountValue);
        decimal final;
        switch (type)
        {
            case Fixed:
                if (value >= normal)
                {
                    return 0.01m;
                }

                final = decimal.Round(normal - value, 2, MidpointRounding.AwayFromZero);
                break;
            case Percentage:
                var percent = Math.Min(100m, value);
                if (percent >= 100m)
                {
                    return 0.01m;
                }

                final = decimal.Round(normal * (1m - percent / 100m), 2, MidpointRounding.AwayFromZero);
                break;
            default:
                final = normal;
                break;
        }

        return final <= 0m ? 0.01m : final;
    }
}
