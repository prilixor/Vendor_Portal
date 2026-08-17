using System.Text.RegularExpressions;

namespace Prilixor.VendorPortal.Application.Common;

/// <summary>
/// Optional clinic contact: Indian mobile (10 digits, 6–9) or landline with STD
/// (0 + 10 digits, or a 10-digit metro STD such as 022 / 079 / 011).
/// </summary>
public static partial class IndianContactNumber
{
    public const string InvalidMessage =
        "Enter a valid Indian mobile (10 digits, starts with 6–9) or landline with STD, e.g. 079-2658-1234.";

    public static string DigitsOnly(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : new string(value.Where(char.IsDigit).ToArray());

    public static string NormalizeDigits(string? value)
    {
        var digits = StripCountryCode(DigitsOnly(value));
        if (digits.Length == 11 && digits.StartsWith('0'))
        {
            var rest = digits[1..];
            if (AhmedabadOrBengaluruStd().IsMatch(rest))
                return digits;
            if (MobileRegex().IsMatch(rest))
                return rest;
            return digits;
        }

        if (MetroStdLandlineRegex().IsMatch(digits) && !MobileRegex().IsMatch(digits))
            return "0" + digits;

        return digits;
    }

    public static bool IsValid(string? value)
    {
        var digits = StripCountryCode(DigitsOnly(value));
        if (MobileRegex().IsMatch(digits) || MetroStdLandlineRegex().IsMatch(digits))
            return true;
        if (digits.Length == 11 && digits.StartsWith('0'))
        {
            var rest = digits[1..];
            return MobileRegex().IsMatch(rest) || LandlineAfterZeroRegex().IsMatch(rest);
        }

        return false;
    }

    public static bool TryNormalizeOptional(string? value, out string? normalized)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            normalized = null;
            return true;
        }

        if (!IsValid(value))
        {
            normalized = null;
            return false;
        }

        normalized = NormalizeDigits(value);
        return true;
    }

    private static string StripCountryCode(string digits)
    {
        if (digits.StartsWith("91", StringComparison.Ordinal) && digits.Length is 12 or 13)
            return digits[2..];
        return digits;
    }

    [GeneratedRegex(@"^[6-9]\d{9}$")]
    private static partial Regex MobileRegex();

    [GeneratedRegex(@"^(11|20|22|33|40|44|79|80)\d{8}$")]
    private static partial Regex MetroStdLandlineRegex();

    [GeneratedRegex(@"^(79|80)\d{8}$")]
    private static partial Regex AhmedabadOrBengaluruStd();

    [GeneratedRegex(@"^[1-5]\d{9}$")]
    private static partial Regex LandlineAfterZeroRegex();
}
