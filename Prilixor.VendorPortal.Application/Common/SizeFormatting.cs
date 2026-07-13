using System.Globalization;

namespace Prilixor.VendorPortal.Application.Common;

/// <summary>
/// Formats packaging-size values for display. The <c>SizeValue</c> column is stored with a
/// scale of 4, so a raw <c>decimal.ToString()</c> renders trailing zeros (e.g. "5.0000").
/// These helpers trim the trailing zeros without rounding, preserving fractional sizes
/// such as "0.5" or "2.5".
/// </summary>
public static class SizeFormatting
{
    /// <summary>Formats just the numeric size, trimming trailing zeros (e.g. 5.0000 → "5", 2.5000 → "2.5").</summary>
    public static string FormatValue(decimal sizeValue)
        => sizeValue.ToString("0.####", CultureInfo.InvariantCulture);

    /// <summary>Formats size + unit for display (e.g. "5 L", "2.5 L").</summary>
    public static string Format(decimal sizeValue, string? sizeUnit)
        => string.Concat(FormatValue(sizeValue), " ", sizeUnit ?? string.Empty).TrimEnd();
}
