using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace Prilixor.VendorPortal.Application.Onboarding;

internal static class ChequeVerificationHelper
{
    private static readonly Regex IfscRegex = new(@"\b[A-Z]{4}0[A-Z0-9]{6}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex AccountNumberRegex = new(@"\b[0-9]{9,18}\b", RegexOptions.Compiled);

    public static bool IsValidAccountNumber(string? acc)
    {
        if (string.IsNullOrWhiteSpace(acc)) return false;
        var trimmed = acc.Trim();
        if (trimmed.Length < 9 || trimmed.Length > 18) return false;
        if (!trimmed.All(char.IsDigit)) return false;
        if (trimmed.All(c => c == '0')) return false; // reject all zeros (000000000, 0000000000)
        if (trimmed.Distinct().Count() == 1) return false; // reject 111111111, etc.
        return true;
    }

    public static string ExtractTextFromBytes(byte[]? bytes)
    {
        if (bytes == null || bytes.Length == 0) return string.Empty;

        var sb = new StringBuilder();

        // If file starts with %PDF-, attempt to decompress streams
        bool isPdf = bytes.Length > 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46;
        if (isPdf)
        {
            TryExtractPdfStreams(bytes, sb);
        }

        // Also extract raw ASCII characters
        var rawAscii = ExtractRawAscii(bytes);
        sb.Append(' ').Append(rawAscii);

        return sb.ToString();
    }

    private static void TryExtractPdfStreams(byte[] bytes, StringBuilder sb)
    {
        ReadOnlySpan<byte> streamMarker = "stream"u8;
        ReadOnlySpan<byte> endMarker = "endstream"u8;

        int index = 0;
        while (index < bytes.Length)
        {
            int streamPos = bytes.AsSpan(index).IndexOf(streamMarker);
            if (streamPos < 0) break;
            int streamStart = index + streamPos + streamMarker.Length;

            while (streamStart < bytes.Length && (bytes[streamStart] == (byte)'\r' || bytes[streamStart] == (byte)'\n'))
            {
                streamStart++;
            }

            int endPos = bytes.AsSpan(streamStart).IndexOf(endMarker);
            if (endPos < 0) break;
            int streamEnd = streamStart + endPos;

            while (streamEnd > streamStart && (bytes[streamEnd - 1] == (byte)'\r' || bytes[streamEnd - 1] == (byte)'\n'))
            {
                streamEnd--;
            }

            if (streamEnd > streamStart)
            {
                var length = streamEnd - streamStart;
                try
                {
                    using var ms = new MemoryStream(bytes, streamStart, length);
                    using var zlib = new ZLibStream(ms, CompressionMode.Decompress);
                    using var outMs = new MemoryStream();
                    zlib.CopyTo(outMs);
                    var decompressedBytes = outMs.ToArray();
                    var text = ExtractRawAscii(decompressedBytes);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        sb.Append(' ').Append(text);
                    }
                }
                catch
                {
                    // If ZLib decompression fails, ignore and proceed
                }
            }

            index = streamEnd + endMarker.Length;
        }
    }

    private static string ExtractRawAscii(byte[] bytes)
    {
        var sb = new StringBuilder(bytes.Length);
        foreach (var b in bytes)
        {
            if (b is >= 32 and <= 126 or 10 or 13)
            {
                sb.Append((char)b);
            }
            else
            {
                sb.Append(' ');
            }
        }
        return sb.ToString();
    }

    public static (string? ExtractedIfsc, string? ExtractedAccount, string? MismatchReason) CheckChequeMatch(
        string fileText,
        string? enteredAcc,
        string? enteredIfsc)
    {
        var cleanEnteredAcc = enteredAcc?.Trim();
        var cleanEnteredIfsc = enteredIfsc?.Trim().ToUpperInvariant();

        string? matchedIfsc = null;
        string? matchedAccount = null;

        if (!string.IsNullOrWhiteSpace(fileText))
        {
            // 1. IFSC matching
            var ifscMatches = IfscRegex.Matches(fileText)
                .Select(m => m.Value.ToUpperInvariant())
                .Distinct()
                .ToList();

            if (ifscMatches.Count > 0)
            {
                if (!string.IsNullOrWhiteSpace(cleanEnteredIfsc) && ifscMatches.Contains(cleanEnteredIfsc))
                {
                    matchedIfsc = cleanEnteredIfsc;
                }
                else
                {
                    matchedIfsc = ifscMatches.First();
                }
            }

            // 2. Account number matching
            if (!string.IsNullOrWhiteSpace(cleanEnteredAcc) && fileText.Contains(cleanEnteredAcc))
            {
                matchedAccount = cleanEnteredAcc;
            }
            else
            {
                var accMatches = AccountNumberRegex.Matches(fileText)
                    .Select(m => m.Value)
                    .Where(IsValidAccountNumber)
                    .Distinct()
                    .ToList();

                if (accMatches.Count > 0)
                {
                    if (!string.IsNullOrWhiteSpace(cleanEnteredAcc) && accMatches.Contains(cleanEnteredAcc))
                    {
                        matchedAccount = cleanEnteredAcc;
                    }
                    else
                    {
                        // Look for a conflicting account number that is distinctly present
                        matchedAccount = accMatches.FirstOrDefault(a => a != cleanEnteredAcc);
                    }
                }
            }
        }

        // Detect genuine mismatch only if a REAL conflicting value was found on the document
        bool ifscMismatch = !string.IsNullOrWhiteSpace(matchedIfsc) &&
                            !string.IsNullOrWhiteSpace(cleanEnteredIfsc) &&
                            !string.Equals(matchedIfsc, cleanEnteredIfsc, StringComparison.OrdinalIgnoreCase);

        bool accMismatch = !string.IsNullOrWhiteSpace(matchedAccount) &&
                           !string.IsNullOrWhiteSpace(cleanEnteredAcc) &&
                           !string.Equals(matchedAccount, cleanEnteredAcc, StringComparison.OrdinalIgnoreCase);

        if (ifscMismatch && accMismatch)
        {
            return (matchedIfsc, matchedAccount,
                $"Bank Details Mismatch: Uploaded cheque has Account '{matchedAccount}' and IFSC '{matchedIfsc}', which do not match entered bank details (Account '{cleanEnteredAcc}', IFSC '{cleanEnteredIfsc}').");
        }

        if (ifscMismatch)
        {
            return (matchedIfsc, matchedAccount,
                $"Bank Details Mismatch: Uploaded cheque has IFSC '{matchedIfsc}', which does not match entered IFSC '{cleanEnteredIfsc}'.");
        }

        if (accMismatch)
        {
            return (matchedIfsc, matchedAccount,
                $"Bank Details Mismatch: Uploaded cheque has Account '{matchedAccount}', which does not match entered Account '{cleanEnteredAcc}'.");
        }

        return (matchedIfsc, matchedAccount, null);
    }
}
