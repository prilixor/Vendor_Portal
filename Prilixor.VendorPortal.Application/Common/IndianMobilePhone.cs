using System.Text.RegularExpressions;

namespace Prilixor.VendorPortal.Application.Common;

/// <summary>
/// Indian mobile numbers: 10 digits starting with 6–9.
/// Accepts optional +91 / 91 / 0 prefixes when normalizing.
/// </summary>
public static partial class IndianMobilePhone
{
    public const string Pattern = @"^[6-9]\d{9}$";
    public const string InvalidMessage =
        "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";

    public static string DigitsOnly(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Where(char.IsDigit).ToArray());

    /// <summary>
    /// Strips non-digits and common India prefixes (+91 / 91 / leading 0).
    /// </summary>
    public static string NormalizeDigits(string? value)
    {
        var digits = DigitsOnly(value);
        if (digits.Length == 12 && digits.StartsWith("91", StringComparison.Ordinal))
            digits = digits[2..];
        else if (digits.Length == 11 && digits.StartsWith('0'))
            digits = digits[1..];
        return digits;
    }

    public static bool IsValid(string? value)
    {
        var digits = NormalizeDigits(value);
        return IndianMobileRegex().IsMatch(digits);
    }

    public static bool TryNormalize(string? value, out string normalized)
    {
        normalized = NormalizeDigits(value);
        return IndianMobileRegex().IsMatch(normalized);
    }

    /// <summary>Returns E.164 for a valid Indian mobile (+91XXXXXXXXXX).</summary>
    public static bool TryToE164(string? value, out string e164)
    {
        if (!TryNormalize(value, out var digits))
        {
            e164 = string.Empty;
            return false;
        }

        e164 = "+91" + digits;
        return true;
    }

    [GeneratedRegex(Pattern)]
    private static partial Regex IndianMobileRegex();
}
