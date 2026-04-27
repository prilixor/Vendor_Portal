using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorBankAccountCommand(
    string VendorId,
    string? BankAccountId,
    string AccountHolderName,
    string BankName,
    string AccountNumber,
    string BranchName,
    string IfscCode) : ICommand<VendorBankAccountDto>;

public sealed class UpsertVendorBankAccountCommandValidator : AbstractValidator<UpsertVendorBankAccountCommand>
{
    public UpsertVendorBankAccountCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AccountHolderName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.BankName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.AccountNumber).NotEmpty().MaximumLength(100);
        RuleFor(x => x.BranchName).MaximumLength(255);
        RuleFor(x => x.IfscCode).NotEmpty().MaximumLength(20);
    }
}

internal sealed class UpsertVendorBankAccountCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorBankAccountCommand, VendorBankAccountDto>
{
    public async Task<Result<VendorBankAccountDto>> Handle(UpsertVendorBankAccountCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        VendorBankAccount entity;
        if (!string.IsNullOrWhiteSpace(request.BankAccountId))
        {
            if (!Guid.TryParse(request.BankAccountId, out var bankAccountId))
            {
                return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.invalid_id", "Bank account id must be a valid UUID.", ErrorCategory.Validation));
            }

            entity = await repository.GetVendorBankAccountByIdAsync(vendorId, bankAccountId, cancellationToken)
                ?? new VendorBankAccount { VendorId = vendorId };
        }
        else
        {
            entity = new VendorBankAccount { VendorId = vendorId };
        }

        entity.AccountHolderName = request.AccountHolderName;
        entity.BankName = request.BankName;
        entity.AccountNumber = request.AccountNumber;
        entity.BranchName = request.BranchName;
        entity.IfscCode = request.IfscCode;
        entity.VerificationStatus = "pending";
        entity.VerifiedAt = null;

        if (entity.Id == Guid.Empty)
        {
            await repository.AddVendorBankAccountAsync(entity, cancellationToken);
        }
        else
        {
            await repository.UpdateVendorBankAccountAsync(entity, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorBankAccountDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.AccountHolderName,
            entity.BankName,
            entity.AccountNumber,
            entity.BranchName,
            entity.IfscCode,
            entity.VerificationStatus,
            entity.VerifiedAt));
    }
}

public sealed record GetVendorBankAccountsQuery(string VendorId) : IQuery<List<VendorBankAccountDto>>;

internal sealed class GetVendorBankAccountsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorBankAccountsQuery, List<VendorBankAccountDto>>
{
    public async Task<Result<List<VendorBankAccountDto>>> Handle(GetVendorBankAccountsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorBankAccountDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorBankAccountsAsync(vendorId, cancellationToken);
        var result = rows.Select(x => new VendorBankAccountDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.AccountHolderName,
            x.BankName,
            x.AccountNumber,
            x.BranchName,
            x.IfscCode,
            x.VerificationStatus,
            x.VerifiedAt)).ToList();

        return Result.Success(result);
    }
}
