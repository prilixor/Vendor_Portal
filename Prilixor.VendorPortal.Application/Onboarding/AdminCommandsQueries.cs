using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RegisterAdminUserCommand(
    string Email,
    string Password,
    string FullName,
    string Role,
    bool IsActive) : ICommand<AdminUserDto>;

public sealed class RegisterAdminUserCommandValidator : AbstractValidator<RegisterAdminUserCommand>
{
    public RegisterAdminUserCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Role).NotEmpty().MaximumLength(40);
    }
}

internal sealed class RegisterAdminUserCommandHandler(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasherService)
    : ICommandHandler<RegisterAdminUserCommand, AdminUserDto>
{
    public async Task<Result<AdminUserDto>> Handle(RegisterAdminUserCommand request, CancellationToken cancellationToken)
    {
        var existing = await repository.GetAdminUserByEmailAsync(request.Email, cancellationToken);
        if (existing is not null)
        {
            return Result.Failure<AdminUserDto>(new Error("admin.email_exists", "Admin account already exists for this email.", ErrorCategory.Validation));
        }

        var entity = new AdminUser
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHasherService.HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role,
            IsActive = request.IsActive
        };

        await repository.AddAdminUserAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new AdminUserDto(
            entity.Id.ToString(),
            entity.Email,
            entity.FullName,
            entity.Role,
            entity.IsActive,
            entity.LastLoginAt));
    }
}

public sealed record GetAdminUsersQuery : IQuery<List<AdminUserDto>>;

internal sealed class GetAdminUsersQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminUsersQuery, List<AdminUserDto>>
{
    public async Task<Result<List<AdminUserDto>>> Handle(GetAdminUsersQuery request, CancellationToken cancellationToken)
    {
        var rows = await repository.GetAdminUsersAsync(cancellationToken);
        var result = rows.Select(x => new AdminUserDto(
            x.Id.ToString(),
            x.Email,
            x.FullName,
            x.Role,
            x.IsActive,
            x.LastLoginAt)).ToList();

        return Result.Success(result);
    }
}

public sealed record AddAdminAuditLogCommand(
    string AdminUserId,
    string ActionType,
    string EntityType,
    string? EntityId,
    string? OldValue,
    string? NewValue,
    string? Notes) : ICommand<AdminAuditLogDto>;

public sealed class AddAdminAuditLogCommandValidator : AbstractValidator<AddAdminAuditLogCommand>
{
    public AddAdminAuditLogCommandValidator()
    {
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.ActionType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.EntityType).NotEmpty().MaximumLength(100);
    }
}

internal sealed class AddAdminAuditLogCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddAdminAuditLogCommand, AdminAuditLogDto>
{
    public async Task<Result<AdminAuditLogDto>> Handle(AddAdminAuditLogCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminUserId, out var adminUserId))
        {
            return Result.Failure<AdminAuditLogDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null)
        {
            return Result.Failure<AdminAuditLogDto>(new Error("admin.not_found", "Admin user not found.", ErrorCategory.NotFound));
        }

        Guid? entityId = null;
        if (!string.IsNullOrWhiteSpace(request.EntityId))
        {
            if (!Guid.TryParse(request.EntityId, out var parsedEntityId))
            {
                return Result.Failure<AdminAuditLogDto>(new Error("admin.audit.invalid_entity_id", "Entity id must be a valid UUID.", ErrorCategory.Validation));
            }

            entityId = parsedEntityId;
        }

        var entity = new AdminAuditLog
        {
            AdminUserId = adminUserId,
            ActionType = request.ActionType,
            EntityType = request.EntityType,
            EntityId = entityId,
            OldValue = request.OldValue,
            NewValue = request.NewValue,
            Notes = request.Notes
        };

        await repository.AddAdminAuditLogAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new AdminAuditLogDto(
            entity.Id.ToString(),
            entity.AdminUserId.ToString(),
            entity.ActionType,
            entity.EntityType,
            entity.EntityId?.ToString(),
            entity.OldValue,
            entity.NewValue,
            entity.Notes));
    }
}

public sealed record GetAdminAuditLogsQuery(string? AdminUserId) : IQuery<List<AdminAuditLogDto>>;

internal sealed class GetAdminAuditLogsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminAuditLogsQuery, List<AdminAuditLogDto>>
{
    public async Task<Result<List<AdminAuditLogDto>>> Handle(GetAdminAuditLogsQuery request, CancellationToken cancellationToken)
    {
        Guid? adminUserId = null;
        if (!string.IsNullOrWhiteSpace(request.AdminUserId))
        {
            if (!Guid.TryParse(request.AdminUserId, out var parsedAdminUserId))
            {
                return Result.Failure<List<AdminAuditLogDto>>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
            }

            adminUserId = parsedAdminUserId;
        }

        var rows = await repository.GetAdminAuditLogsAsync(adminUserId, cancellationToken);
        var result = rows.Select(x => new AdminAuditLogDto(
            x.Id.ToString(),
            x.AdminUserId.ToString(),
            x.ActionType,
            x.EntityType,
            x.EntityId?.ToString(),
            x.OldValue,
            x.NewValue,
            x.Notes)).ToList();

        return Result.Success(result);
    }
}

public sealed record VerifyVendorBankAccountCommand(
    string AdminUserId,
    string VendorId,
    string BankAccountId,
    string VerificationStatus,
    string? Notes) : ICommand<VendorBankAccountDto>;

public sealed class VerifyVendorBankAccountCommandValidator : AbstractValidator<VerifyVendorBankAccountCommand>
{
    public VerifyVendorBankAccountCommandValidator()
    {
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.BankAccountId).NotEmpty();
        RuleFor(x => x.VerificationStatus)
            .NotEmpty()
            .Must(x => x is "approved" or "rejected")
            .WithMessage("Verification status must be either 'approved' or 'rejected'.");
    }
}

internal sealed class VerifyVendorBankAccountCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<VerifyVendorBankAccountCommand, VendorBankAccountDto>
{
    public async Task<Result<VendorBankAccountDto>> Handle(VerifyVendorBankAccountCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminUserId, out var adminUserId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.BankAccountId, out var bankAccountId))
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.invalid_id", "Bank account id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<VendorBankAccountDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var bankAccount = await repository.GetVendorBankAccountByIdAsync(vendorId, bankAccountId, cancellationToken);
        if (bankAccount is null)
        {
            return Result.Failure<VendorBankAccountDto>(new Error("vendors.bank_account.not_found", "Vendor bank account not found.", ErrorCategory.NotFound));
        }

        var oldStatus = bankAccount.VerificationStatus;
        bankAccount.VerificationStatus = request.VerificationStatus;
        bankAccount.VerifiedAt = request.VerificationStatus == "approved" ? DateTimeOffset.UtcNow : null;

        await repository.UpdateVendorBankAccountAsync(bankAccount, cancellationToken);

        var auditLog = new AdminAuditLog
        {
            AdminUserId = adminUserId,
            ActionType = "VENDOR_BANK_ACCOUNT_VERIFIED",
            EntityType = "VendorBankAccount",
            EntityId = bankAccount.Id,
            OldValue = oldStatus,
            NewValue = request.VerificationStatus,
            Notes = request.Notes
        };

        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorBankAccountDto(
            bankAccount.Id.ToString(),
            bankAccount.VendorId.ToString(),
            bankAccount.AccountHolderName,
            bankAccount.BankName,
            bankAccount.AccountNumber,
            bankAccount.IfscCode,
            bankAccount.VerificationStatus,
            bankAccount.VerifiedAt));
    }
}
