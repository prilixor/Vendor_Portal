namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>Canonical value-tier keys for rental duration icons.</summary>
public static class RentalDurationValueTiers
{
    public const string Good = "good";
    public const string Better = "better";
    public const string BestValue = "best_value";
    public const string MaximumSavings = "maximum_savings";

    public static readonly string[] All =
    [
        Good,
        Better,
        BestValue,
        MaximumSavings,
    ];

    public static string Normalize(string? value)
    {
        var key = (value ?? string.Empty).Trim().ToLowerInvariant().Replace('-', '_').Replace(' ', '_');
        return key switch
        {
            "good" => Good,
            "better" => Better,
            "best" or "bestvalue" or "best_value" => BestValue,
            "maximum" or "maximumsavings" or "maximum_savings" or "max_savings" => MaximumSavings,
            _ => Good,
        };
    }

    public static string DisplayLabel(string? value) => Normalize(value) switch
    {
        Better => "Better",
        BestValue => "Best Value",
        MaximumSavings => "Maximum Savings",
        _ => "Good",
    };
}
