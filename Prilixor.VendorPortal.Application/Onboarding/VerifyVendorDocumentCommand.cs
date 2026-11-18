using System.Text;
using System.Text.RegularExpressions;
using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AutoVerifyVendorDocumentCommand(
    string VendorId,
    string DocumentId,
    string? DocumentNumber = null) : ICommand<VendorDocumentDto>;

public sealed class AutoVerifyVendorDocumentCommandValidator : AbstractValidator<AutoVerifyVendorDocumentCommand>
{
    public AutoVerifyVendorDocumentCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.DocumentId).NotEmpty();
    }
}

internal sealed class AutoVerifyVendorDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    ICashfreeVerificationService cashfreeService,
    IVendorFileUrlResolver fileUrlResolver,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<AutoVerifyVendorDocumentCommand, VendorDocumentDto>
{
    private static readonly Regex GstinRegex = new(@"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex PanRegex = new(@"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex IfscRegex = new(@"\b[A-Z]{4}0[A-Z0-9]{6}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex AccountNumberRegex = new(@"\b[0-9]{9,18}\b", RegexOptions.Compiled);
    private static readonly Regex TradeLicenseRegex = new(@"\b(BBMP|BMC|MCD|GHMC|[A-Z]{2,6})[-/][A-Z0-9]{2,8}[-/][0-9]{4,12}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex ConsumerNumberRegex = new(@"\b(BESCOM|MSEDCL|TPDDL|[A-Z]{3,8})[-/][A-Z0-9]{2,8}[-/][0-9]{4,12}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex PincodeRegex = new(@"\b[1-9][0-9]{5}\b", RegexOptions.Compiled);

    public async Task<Result<VendorDocumentDto>> Handle(AutoVerifyVendorDocumentCommand request, CancellationToken cancellationToken)
    {

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.DocumentId, out var documentId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.documents.invalid_id", "Document id must be a valid UUID.", ErrorCategory.Validation));
        }

        var doc = await repository.GetVendorDocumentByIdAsync(vendorId, documentId, cancellationToken);
        if (doc is null)
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.documents.not_found", "Document not found.", ErrorCategory.NotFound));
        }

        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);

        // Read the actual uploaded document bytes directly from storage to extract document content
        byte[]? fileBytes = null;
        try
        {
            fileBytes = await uploadStorage.ReadStoredBytesAsync(doc.FileUrl, cancellationToken);
        }
        catch
        {
            // If storage read fails, fall back to request parameter
        }

        var fileText = fileBytes is { Length: > 0 } ? ExtractPrintableText(fileBytes) : string.Empty;

        if (string.Equals(doc.DocumentType, "GST Certificate", StringComparison.OrdinalIgnoreCase))
        {
            // 1. Extract GSTIN directly from the uploaded document file
            string? extractedGstin = null;
            if (!string.IsNullOrWhiteSpace(fileText))
            {
                var match = GstinRegex.Match(fileText);
                if (match.Success)
                {
                    extractedGstin = match.Value.Trim().ToUpperInvariant();
                }
            }

            var profileGstin = profile?.GstNumber?.Trim().ToUpperInvariant();
            var providedGstin = request.DocumentNumber?.Trim().ToUpperInvariant();

            // 2. Anti-fraud cross-validation: Detect mismatches between uploaded document and profile entered in Step 2
            if (!string.IsNullOrWhiteSpace(extractedGstin) && !string.IsNullOrWhiteSpace(profileGstin))
            {
                if (!string.Equals(extractedGstin, profileGstin, StringComparison.OrdinalIgnoreCase))
                {
                    doc.VerificationStatus = "rejected";
                    doc.DocumentNumber = extractedGstin;
                    doc.RejectionReason = $"Document Mismatch: The uploaded GST Certificate contains GSTIN '{extractedGstin}', which does not match your registered profile GSTIN '{profileGstin}'. Please upload the certificate for your registered business.";
                    await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                    await repository.SaveChangesAsync(cancellationToken);

                    return Result.Success(ToDto(doc));
                }
            }

            // Determine GSTIN to verify (prioritizing the one extracted from the document)
            var gstinToVerify = extractedGstin ?? providedGstin ?? profileGstin ?? doc.DocumentNumber;
            if (string.IsNullOrWhiteSpace(gstinToVerify))
            {
                doc.VerificationStatus = "rejected";
                doc.RejectionReason = "Could not extract a valid 15-character GSTIN from the uploaded document. Please upload a clear official GST Certificate.";
                await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                await repository.SaveChangesAsync(cancellationToken);
                return Result.Success(ToDto(doc));
            }

            // 3. Verify the document's GSTIN with the Government registry via Cashfree
            var result = await cashfreeService.VerifyGstinAsync(gstinToVerify, cancellationToken);
            if (result.IsValid)
            {
                // 4. Cross-check: Verify Business Name match against GST registry and certificate text
                if (!string.IsNullOrWhiteSpace(profile?.BusinessName) &&
                    !IsBusinessNameMatch(profile.BusinessName, result.LegalName, result.TradeName, fileText))
                {
                    var registeredName = !string.IsNullOrWhiteSpace(result.TradeName)
                        ? result.TradeName
                        : (!string.IsNullOrWhiteSpace(result.LegalName) ? result.LegalName : "registered GST entity");

                    doc.VerificationStatus = "rejected";
                    doc.DocumentNumber = result.Gstin ?? gstinToVerify;
                    doc.RejectionReason = $"Business Name Mismatch: Entered business name '{profile.BusinessName}' does not match registered GST business name '{registeredName}'.";
                    await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                    await repository.SaveChangesAsync(cancellationToken);
                    return Result.Success(ToDto(doc));
                }

                doc.VerificationStatus = "approved";
                doc.VerifiedAt = DateTimeOffset.UtcNow;
                doc.DocumentNumber = result.Gstin ?? gstinToVerify;
                doc.RejectionReason = null;
            }
            else
            {
                doc.VerificationStatus = "rejected";
                doc.DocumentNumber = gstinToVerify;
                doc.RejectionReason = result.Message ?? "GSTIN verification failed against the GST registry.";
            }
        }
        else if (string.Equals(doc.DocumentType, "PAN Card", StringComparison.OrdinalIgnoreCase))
        {
            // 1. Extract PAN directly from the uploaded document file
            string? extractedPan = null;
            if (!string.IsNullOrWhiteSpace(fileText))
            {
                var match = PanRegex.Match(fileText);
                if (match.Success)
                {
                    extractedPan = match.Value.Trim().ToUpperInvariant();
                }
            }

            var providedPan = request.DocumentNumber?.Trim().ToUpperInvariant();
            var panToVerify = extractedPan ?? providedPan ?? doc.DocumentNumber;

            if (string.IsNullOrWhiteSpace(panToVerify))
            {
                doc.VerificationStatus = "rejected";
                doc.RejectionReason = "Could not extract a valid 10-character PAN from the uploaded document. Please enter or upload a clear PAN Card.";
                await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                await repository.SaveChangesAsync(cancellationToken);
                return Result.Success(ToDto(doc));
            }

            // Cross-check: If client entered a PAN and document extracted a different PAN, reject mismatch
            if (!string.IsNullOrWhiteSpace(extractedPan) && !string.IsNullOrWhiteSpace(providedPan) &&
                !string.Equals(extractedPan, providedPan, StringComparison.OrdinalIgnoreCase))
            {
                doc.VerificationStatus = "rejected";
                doc.DocumentNumber = extractedPan;
                doc.RejectionReason = $"Document Mismatch: Uploaded PAN card has '{extractedPan}', but entered PAN was '{providedPan}'.";
                await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                await repository.SaveChangesAsync(cancellationToken);
                return Result.Success(ToDto(doc));
            }

            var result = await cashfreeService.VerifyPanAsync(panToVerify, profile?.OwnerName, cancellationToken);
            if (result.IsValid)
            {
                doc.VerificationStatus = "approved";
                doc.VerifiedAt = DateTimeOffset.UtcNow;
                doc.DocumentNumber = result.Pan ?? panToVerify;
                doc.RejectionReason = null;
            }
            else
            {
                doc.VerificationStatus = "rejected";
                doc.DocumentNumber = panToVerify;
                doc.RejectionReason = result.Message ?? "PAN verification failed against the NSDL registry.";
            }
        }
        else if (string.Equals(doc.DocumentType, "Cancelled Cheque", StringComparison.OrdinalIgnoreCase))
        {
            var banks = await repository.GetVendorBankAccountsAsync(vendorId, cancellationToken);
            var bank = banks.FirstOrDefault();

            var (extractedIfsc, extractedAccount, mismatchReason) = ChequeVerificationHelper.CheckChequeMatch(
                fileText,
                bank?.AccountNumber,
                bank?.IfscCode);

            if (!string.IsNullOrWhiteSpace(mismatchReason))
            {
                doc.VerificationStatus = "rejected";
                doc.DocumentNumber = $"{extractedIfsc ?? bank?.IfscCode} · {extractedAccount ?? bank?.AccountNumber}";
                doc.RejectionReason = mismatchReason;

                if (bank is not null)
                {
                    bank.VerificationStatus = "rejected";
                    await repository.UpdateVendorBankAccountAsync(bank, cancellationToken);
                }

                await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                await repository.SaveChangesAsync(cancellationToken);
                return Result.Success(ToDto(doc));
            }

            var ifscToVerify = extractedIfsc ?? bank?.IfscCode?.Trim().ToUpperInvariant();
            var accToVerify = extractedAccount ?? bank?.AccountNumber?.Trim();

            if (string.IsNullOrWhiteSpace(ifscToVerify) || string.IsNullOrWhiteSpace(accToVerify))
            {
                doc.VerificationStatus = "rejected";
                doc.RejectionReason = "Could not identify bank account number and IFSC code. Please verify bank details in the Bank tab or upload a clear cancelled cheque.";
                await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
                await repository.SaveChangesAsync(cancellationToken);
                return Result.Success(ToDto(doc));
            }

            // 2. Perform Cashfree Penny Drop verification (IMPS bank account check)
            var result = await cashfreeService.VerifyBankAccountAsync(accToVerify, ifscToVerify, bank?.AccountHolderName ?? profile?.OwnerName, profile?.SupportPhone, cancellationToken);
            if (result.IsValid)
            {
                doc.VerificationStatus = "approved";
                doc.VerifiedAt = DateTimeOffset.UtcNow;
                doc.DocumentNumber = $"{ifscToVerify} · {accToVerify}";
                doc.RejectionReason = null;

                if (bank is not null)
                {
                    bank.AccountNumber = accToVerify;
                    bank.IfscCode = ifscToVerify;
                    if (!string.IsNullOrWhiteSpace(result.RegisteredName)) bank.AccountHolderName = result.RegisteredName;
                    if (!string.IsNullOrWhiteSpace(result.BankName)) bank.BankName = result.BankName;
                    if (string.IsNullOrWhiteSpace(bank.BranchName)) bank.BranchName = ifscToVerify.StartsWith("YESB", StringComparison.OrdinalIgnoreCase) ? "Main Branch" : "Branch";
                    bank.VerificationStatus = "approved";
                    bank.VerifiedAt = DateTimeOffset.UtcNow;
                    await repository.UpdateVendorBankAccountAsync(bank, cancellationToken);
                }
                else
                {
                    var newBank = new VendorBankAccount
                    {
                        VendorId = vendorId,
                        AccountNumber = accToVerify,
                        IfscCode = ifscToVerify,
                        AccountHolderName = !string.IsNullOrWhiteSpace(result.RegisteredName)
                            ? result.RegisteredName
                            : (!string.IsNullOrWhiteSpace(profile?.OwnerName) ? profile.OwnerName : (!string.IsNullOrWhiteSpace(profile?.BusinessName) ? profile.BusinessName : "Account Holder")),
                        BankName = !string.IsNullOrWhiteSpace(result.BankName)
                            ? result.BankName
                            : (ifscToVerify.StartsWith("YESB", StringComparison.OrdinalIgnoreCase) ? "YES Bank" : "Bank"),
                        BranchName = ifscToVerify.StartsWith("YESB", StringComparison.OrdinalIgnoreCase) ? "Main Branch" : "Branch",
                        VerificationStatus = "approved",
                        VerifiedAt = DateTimeOffset.UtcNow
                    };
                    await repository.AddVendorBankAccountAsync(newBank, cancellationToken);
                }
            }
            else
            {
                doc.VerificationStatus = "rejected";
                doc.DocumentNumber = $"{ifscToVerify} · {accToVerify}";
                doc.RejectionReason = result.Message ?? "Bank account penny drop verification failed via Cashfree.";

                if (bank is not null)
                {
                    bank.VerificationStatus = "rejected";
                    await repository.UpdateVendorBankAccountAsync(bank, cancellationToken);
                }
            }
        }
        else
        {
            // For Trade License, Address Proof, and other documents: kept for manual Admin compliance review
            doc.VerificationStatus = "under_review";
            doc.RejectionReason = null;
        }

        await repository.UpdateVendorDocumentAsync(doc, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(ToDto(doc));
    }

    private VendorDocumentDto ToDto(VendorDocument doc) => new(
        doc.Id.ToString(),
        doc.VendorId.ToString(),
        doc.DocumentType,
        fileUrlResolver.Resolve(doc.FileUrl),
        doc.DocumentNumber,
        doc.VerificationStatus,
        doc.RejectionReason,
        doc.VerifiedAt,
        doc.OriginalFileName);

    internal static string ExtractPrintableText(byte[] bytes)
    {
        return ChequeVerificationHelper.ExtractTextFromBytes(bytes);
    }

    private static readonly string[] BusinessStopWords =
    [
        "pvt", "ltd", "private", "limited", "enterprises", "enterprise",
        "company", "co", "corp", "corporation", "llp", "the", "and",
        "industries", "traders", "solutions", "services", "store", "shop", "india"
    ];

    internal static bool IsBusinessNameMatch(string enteredName, string? legalName, string? tradeName, string fileText)
    {
        if (string.IsNullOrWhiteSpace(enteredName)) return true;

        var cleanEntered = NormalizeBusinessString(enteredName);
        if (string.IsNullOrWhiteSpace(cleanEntered)) return true;

        if (!string.IsNullOrWhiteSpace(tradeName))
        {
            var cleanTrade = NormalizeBusinessString(tradeName);
            if (cleanTrade == cleanEntered || cleanTrade.Contains(cleanEntered) || cleanEntered.Contains(cleanTrade))
                return true;
            if (HasTokenOverlap(cleanEntered, cleanTrade))
                return true;
        }

        if (!string.IsNullOrWhiteSpace(legalName))
        {
            var cleanLegal = NormalizeBusinessString(legalName);
            if (cleanLegal == cleanEntered || cleanLegal.Contains(cleanEntered) || cleanEntered.Contains(cleanLegal))
                return true;
            if (HasTokenOverlap(cleanEntered, cleanLegal))
                return true;
        }

        if (!string.IsNullOrWhiteSpace(fileText))
        {
            var cleanFile = NormalizeBusinessString(fileText);
            if (cleanFile.Contains(cleanEntered))
                return true;

            var tokens = GetSignificantTokens(cleanEntered);
            if (tokens.Count > 0 && tokens.All(t => cleanFile.Contains(t)))
                return true;
        }

        return false;
    }

    private static string NormalizeBusinessString(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var chars = input.Select(c => char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ').ToArray();
        return Regex.Replace(new string(chars), @"\s+", " ").Trim();
    }

    private static List<string> GetSignificantTokens(string normalized)
    {
        return normalized
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3 && !BusinessStopWords.Contains(w, StringComparer.OrdinalIgnoreCase))
            .ToList();
    }

    private static bool HasTokenOverlap(string name1, string name2)
    {
        var tokens1 = GetSignificantTokens(name1);
        var tokens2 = GetSignificantTokens(name2);

        if (tokens1.Count == 0 || tokens2.Count == 0)
        {
            tokens1 = name1.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            tokens2 = name2.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        }

        return tokens1.Any(t1 => tokens2.Any(t2 => t1 == t2 || t1.Contains(t2) || t2.Contains(t1)));
    }
}

