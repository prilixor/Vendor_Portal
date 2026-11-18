using System.Text.RegularExpressions;
using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AutoVerifyVendorBankAccountCommand(
    string VendorId,
    string BankAccountId) : ICommand<VendorBankAccountDto>;

public sealed class AutoVerifyVendorBankAccountCommandValidator : AbstractValidator<AutoVerifyVendorBankAccountCommand>
{
    public AutoVerifyVendorBankAccountCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.BankAccountId).NotEmpty();
    }
}

internal sealed class AutoVerifyVendorBankAccountCommandHandler(
    IVendorOnboardingRepository repository,
    ICashfreeVerificationService cashfreeService,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<AutoVerifyVendorBankAccountCommand, VendorBankAccountDto>
{
    private static readonly Regex IfscRegex = new(@"\b[A-Z]{4}0[A-Z0-9]{6}\b", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex AccountNumberRegex = new(@"\b[0-9]{9,18}\b", RegexOptions.Compiled);

    public async Task<Result<VendorBankAccountDto>> Handle(AutoVerifyVendorBankAccountCommand request, CancellationToken cancellationToken)
    {

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.BankAccountId, out var bankAccountId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.invalid_id", "Bank account id must be a valid UUID.", ErrorCategory.Validation));
        }

        var bankAccount = await repository.GetVendorBankAccountByIdAsync(vendorId, bankAccountId, cancellationToken);
        if (bankAccount is null)
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.not_found", "Vendor bank account not found.", ErrorCategory.NotFound));
        }

        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);
        var docs = await repository.GetVendorDocumentsAsync(vendorId, cancellationToken);
        var chequeDoc = docs.FirstOrDefault(d => string.Equals(d.DocumentType, "Cancelled Cheque", StringComparison.OrdinalIgnoreCase));

        string? extractedIfsc = null;
        string? extractedAccount = null;

        if (chequeDoc is not null)
        {
            byte[]? chequeBytes = null;
            try
            {
                chequeBytes = await uploadStorage.ReadStoredBytesAsync(chequeDoc.FileUrl, cancellationToken);
            }
            catch
            {
                // storage read error handled gracefully
            }

            var chequeText = chequeBytes is { Length: > 0 } ? ChequeVerificationHelper.ExtractTextFromBytes(chequeBytes) : string.Empty;
            var (matchedIfsc, matchedAccount, mismatchReason) = ChequeVerificationHelper.CheckChequeMatch(chequeText, bankAccount.AccountNumber, bankAccount.IfscCode);

            extractedIfsc = matchedIfsc;
            extractedAccount = matchedAccount;

            if (!string.IsNullOrWhiteSpace(mismatchReason))
            {
                bankAccount.VerificationStatus = "rejected";
                await repository.UpdateVendorBankAccountAsync(bankAccount, cancellationToken);

                chequeDoc.VerificationStatus = "rejected";
                chequeDoc.DocumentNumber = $"{extractedIfsc ?? bankAccount.IfscCode} · {extractedAccount ?? bankAccount.AccountNumber}";
                chequeDoc.RejectionReason = mismatchReason;
                await repository.UpdateVendorDocumentAsync(chequeDoc, cancellationToken);

                await repository.SaveChangesAsync(cancellationToken);

                return Result.Failure<VendorBankAccountDto>(new Error(
                    "vendors.bank_account.mismatch",
                    mismatchReason,
                    ErrorCategory.Validation));
            }
        }

        var accToVerify = bankAccount.AccountNumber?.Trim();
        var ifscToVerify = bankAccount.IfscCode?.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(accToVerify) || string.IsNullOrWhiteSpace(ifscToVerify))
        {
            bankAccount.VerificationStatus = "rejected";
            await repository.UpdateVendorBankAccountAsync(bankAccount, cancellationToken);
            await repository.SaveChangesAsync(cancellationToken);

            return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.invalid_data", "Bank Account Number and IFSC Code cannot be empty.", ErrorCategory.Validation));
        }

        // Cashfree Penny Drop IMPS verification
        var pennyDrop = await cashfreeService.VerifyBankAccountAsync(
            accToVerify,
            ifscToVerify,
            bankAccount.AccountHolderName ?? profile?.OwnerName,
            profile?.SupportPhone,
            cancellationToken);

        if (pennyDrop.IsValid)
        {
            bankAccount.VerificationStatus = "approved";
            bankAccount.VerifiedAt = DateTimeOffset.UtcNow;
            if (!string.IsNullOrWhiteSpace(pennyDrop.RegisteredName))
                bankAccount.AccountHolderName = pennyDrop.RegisteredName;
            if (!string.IsNullOrWhiteSpace(pennyDrop.BankName))
                bankAccount.BankName = pennyDrop.BankName;
            if (string.IsNullOrWhiteSpace(bankAccount.BranchName))
                bankAccount.BranchName = ifscToVerify.StartsWith("YESB", StringComparison.OrdinalIgnoreCase) ? "Main Branch" : "Branch";

            await repository.UpdateVendorBankAccountAsync(bankAccount, cancellationToken);

            // Also approve Cancelled Cheque document if uploaded
            if (chequeDoc is not null)
            {
                chequeDoc.VerificationStatus = "approved";
                chequeDoc.VerifiedAt = DateTimeOffset.UtcNow;
                chequeDoc.DocumentNumber = $"{ifscToVerify} · {accToVerify}";
                chequeDoc.RejectionReason = null;
                await repository.UpdateVendorDocumentAsync(chequeDoc, cancellationToken);
            }

            await repository.SaveChangesAsync(cancellationToken);
            return Result.Success(ToDto(bankAccount));
        }
        else
        {
            bankAccount.VerificationStatus = "rejected";
            await repository.UpdateVendorBankAccountAsync(bankAccount, cancellationToken);

            if (chequeDoc is not null)
            {
                chequeDoc.VerificationStatus = "rejected";
                chequeDoc.DocumentNumber = $"{ifscToVerify} · {accToVerify}";
                chequeDoc.RejectionReason = pennyDrop.Message ?? "Bank account penny drop verification failed via Cashfree.";
                await repository.UpdateVendorDocumentAsync(chequeDoc, cancellationToken);
            }

            await repository.SaveChangesAsync(cancellationToken);

            return Result.Failure<VendorBankAccountDto>(new Error(
                "vendors.bank_account.verification_failed",
                pennyDrop.Message ?? "Bank account penny drop verification failed via Cashfree.",
                ErrorCategory.Validation));
        }
    }

    private static VendorBankAccountDto ToDto(VendorBankAccount b) => new(
        b.Id.ToString(),
        b.VendorId.ToString(),
        b.AccountHolderName,
        b.BankName,
        b.AccountNumber,
        b.BranchName,
        b.IfscCode,
        b.VerificationStatus,
        b.VerifiedAt);
}
