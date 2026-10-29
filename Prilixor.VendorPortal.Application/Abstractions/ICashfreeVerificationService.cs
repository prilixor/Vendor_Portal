namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record GstinVerificationResult(
    bool IsValid,
    string Gstin,
    string? LegalName,
    string? TradeName,
    string? Status,
    string? Address,
    string? State,
    string? City,
    string? Pincode,
    string? Message);

public sealed record PanVerificationResult(
    bool IsValid,
    string Pan,
    string? RegisteredName,
    string? Type,
    string? NameMatchResult,
    double? NameMatchScore,
    string? Message);

public sealed record BankAccountVerificationResult(
    bool IsValid,
    string AccountNumber,
    string Ifsc,
    string? RegisteredName,
    string? BankName,
    string? NameMatchResult,
    double? NameMatchScore,
    string? Utr,
    string? Message);

public interface ICashfreeVerificationService
{
    Task<GstinVerificationResult> VerifyGstinAsync(string gstin, CancellationToken ct = default);
    Task<PanVerificationResult> VerifyPanAsync(string pan, string? nameToMatch = null, CancellationToken ct = default);
    Task<BankAccountVerificationResult> VerifyBankAccountAsync(string accountNumber, string ifsc, string? nameToMatch = null, string? phone = null, CancellationToken ct = default);
}
