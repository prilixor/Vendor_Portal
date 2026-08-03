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
}
