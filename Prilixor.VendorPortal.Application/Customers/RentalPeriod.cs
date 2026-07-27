namespace Prilixor.VendorPortal.Application.Customers;

/// <summary>
/// Rental billing period unit. Daily remains fully supported in code/API;
/// UI visibility is controlled separately on the frontend.
/// </summary>
public static class RentalPeriod
{
    public const string Day = "day";
    public const string Week = "week";
    public const string Month = "month";

    public static readonly HashSet<string> AllUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        Day, Week, Month
    };

    public static string Normalize(string? unit)
        => string.IsNullOrWhiteSpace(unit) ? Day : unit.Trim().ToLowerInvariant();

    public static bool IsValid(string? unit)
        => AllUnits.Contains(Normalize(unit));

    /// <summary>
    /// <paramref name="periodCount"/> is the number of days, weeks, or months depending on unit.
    /// </summary>
    public static DateOnly AddPeriods(DateOnly start, string unit, int periodCount)
    {
        var count = Math.Max(0, periodCount);
        return Normalize(unit) switch
        {
            Week => start.AddDays(count * 7),
            Month => start.AddMonths(count),
            _ => start.AddDays(count)
        };
    }

    public static int ToCalendarDays(string unit, int periodCount, DateOnly? start = null)
    {
        var count = Math.Max(0, periodCount);
        return Normalize(unit) switch
        {
            Week => count * 7,
            Month when start.HasValue =>
                AddPeriods(start.Value, Month, count).DayNumber - start.Value.DayNumber,
            Month => count * 30,
            _ => count
        };
    }

    public static decimal SelectCustomerRate(string unit, decimal daily, decimal weekly, decimal monthly)
        => Normalize(unit) switch
        {
            Week => weekly,
            Month => monthly,
            _ => daily
        };

    public static decimal SelectVendorRate(string unit, decimal daily, decimal weekly, decimal monthly)
        => Normalize(unit) switch
        {
            Week => weekly,
            Month => monthly,
            _ => daily
        };
}
