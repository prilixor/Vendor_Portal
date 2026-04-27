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
        RuleFor(x => x.Role).NotEmpty().MaximumLength(40)
            .Must(role => role is "super_admin" or "verifier" or "operations_admin")
            .WithMessage("Role must be 'super_admin', 'verifier', or 'operations_admin'.");
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
    string AdminId,
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
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.ActionType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.EntityType).NotEmpty().MaximumLength(100);
    }
}

internal sealed class AddAdminAuditLogCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddAdminAuditLogCommand, AdminAuditLogDto>
{
    public async Task<Result<AdminAuditLogDto>> Handle(AddAdminAuditLogCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
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
            AdminId = adminUserId,
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
            entity.AdminId.ToString(),
            adminUser?.FullName,
            adminUser?.Email,
            entity.ActionType,
            entity.EntityType,
            entity.EntityId?.ToString(),
            entity.OldValue,
            entity.NewValue,
            entity.Notes));
    }
}

public sealed record GetAdminAuditLogsQuery(string? AdminId) : IQuery<List<AdminAuditLogDto>>;

internal sealed class GetAdminAuditLogsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminAuditLogsQuery, List<AdminAuditLogDto>>
{
    public async Task<Result<List<AdminAuditLogDto>>> Handle(GetAdminAuditLogsQuery request, CancellationToken cancellationToken)
    {
        Guid? adminUserId = null;
        if (!string.IsNullOrWhiteSpace(request.AdminId))
        {
            if (!Guid.TryParse(request.AdminId, out var parsedAdminId))
            {
                return Result.Failure<List<AdminAuditLogDto>>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
            }

            adminUserId = parsedAdminId;
        }

        var rows = await repository.GetAdminAuditLogsAsync(adminUserId, cancellationToken);
        var result = rows.Select(x => new AdminAuditLogDto(
            x.Id.ToString(),
            x.AdminId.ToString(),
            x.AdminUser?.FullName,
            x.AdminUser?.Email,
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
    string AdminId,
    string VendorId,
    string BankAccountId,
    string VerificationStatus,
    string? Notes) : ICommand<VendorBankAccountDto>;

public sealed class VerifyVendorBankAccountCommandValidator : AbstractValidator<VerifyVendorBankAccountCommand>
{
    public VerifyVendorBankAccountCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
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
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
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

        if (!string.Equals(oldStatus, "rejected", StringComparison.OrdinalIgnoreCase)
            && string.Equals(request.VerificationStatus, "rejected", StringComparison.OrdinalIgnoreCase))
        {
            var notification = new VendorNotification
            {
                VendorId = vendorId,
                NotificationType = "bank_rejected",
                Title = "Bank account verification rejected",
                Message = AdminNotificationMessageBuilder.WithReason(
                    $"Your bank account ending with {GetLast4(bankAccount.AccountNumber)} was rejected. Please review and resubmit.",
                    request.Notes),
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow
            };
            await repository.AddVendorNotificationAsync(notification, cancellationToken);
        }

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
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
            bankAccount.BranchName,
            bankAccount.IfscCode,
            bankAccount.VerificationStatus,
            bankAccount.VerifiedAt));
    }

    private static string GetLast4(string accountNumber)
    {
        if (string.IsNullOrWhiteSpace(accountNumber))
        {
            return "N/A";
        }

        var cleaned = accountNumber.Trim();
        return cleaned.Length <= 4 ? cleaned : cleaned[^4..];
    }
}

public sealed record VerifyVendorDocumentCommand(
    string AdminId,
    string VendorId,
    string DocumentId,
    string VerificationStatus,
    string? Notes) : ICommand<VendorDocumentDto>;

public sealed class VerifyVendorDocumentCommandValidator : AbstractValidator<VerifyVendorDocumentCommand>
{
    public VerifyVendorDocumentCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.DocumentId).NotEmpty();
        RuleFor(x => x.VerificationStatus)
            .NotEmpty()
            .Must(x => x is "approved" or "rejected")
            .WithMessage("Verification status must be either 'approved' or 'rejected'.");
    }
}

internal sealed class VerifyVendorDocumentCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<VerifyVendorDocumentCommand, VendorDocumentDto>
{
    public async Task<Result<VendorDocumentDto>> Handle(VerifyVendorDocumentCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.DocumentId, out var documentId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.documents.invalid_id", "Document id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<VendorDocumentDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var document = await repository.GetVendorDocumentByIdAsync(vendorId, documentId, cancellationToken);
        if (document is null)
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.documents.not_found", "Vendor document not found.", ErrorCategory.NotFound));
        }

        var oldStatus = document.VerificationStatus;
        document.VerificationStatus = request.VerificationStatus;
        document.VerifiedAt = request.VerificationStatus == "approved" ? DateTimeOffset.UtcNow : null;
        document.RejectionReason = request.VerificationStatus == "rejected" ? request.Notes : null;

        await repository.UpdateVendorDocumentAsync(document, cancellationToken);

        if (!string.Equals(oldStatus, "rejected", StringComparison.OrdinalIgnoreCase)
            && string.Equals(request.VerificationStatus, "rejected", StringComparison.OrdinalIgnoreCase))
        {
            var notification = new VendorNotification
            {
                VendorId = vendorId,
                NotificationType = "document_rejected",
                Title = "Document verification rejected",
                Message = AdminNotificationMessageBuilder.WithReason(
                    $"Your {document.DocumentType} document was rejected. Please update and resubmit.",
                    request.Notes),
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow
            };
            await repository.AddVendorNotificationAsync(notification, cancellationToken);
        }

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_DOCUMENT_VERIFIED",
            EntityType = "VendorDocument",
            EntityId = document.Id,
            OldValue = oldStatus,
            NewValue = request.VerificationStatus,
            Notes = request.Notes
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorDocumentDto(
            document.Id.ToString(),
            document.VendorId.ToString(),
            document.DocumentType,
            document.FileUrl,
            document.DocumentNumber,
            document.VerificationStatus,
            document.RejectionReason,
            document.VerifiedAt));
    }
}

public sealed record VerifyVendorListingCommand(
    string AdminId,
    string VendorId,
    string ListingId,
    string ListingStatus,
    string? Notes) : ICommand<VendorProductListingDto>;

public sealed class VerifyVendorListingCommandValidator : AbstractValidator<VerifyVendorListingCommand>
{
    public VerifyVendorListingCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.ListingStatus)
            .NotEmpty()
            .Must(x => x is "approved" or "rejected")
            .WithMessage("Listing status must be either 'approved' or 'rejected'.");
    }
}

internal sealed class VerifyVendorListingCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<VerifyVendorListingCommand, VendorProductListingDto>
{
    public async Task<Result<VendorProductListingDto>> Handle(VerifyVendorListingCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<VendorProductListingDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.listing.invalid_id", "Listing id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<VendorProductListingDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null)
        {
            return Result.Failure<VendorProductListingDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));
        }

        var oldStatus = listing.ListingStatus;
        listing.ListingStatus = request.ListingStatus;
        await repository.UpdateVendorProductListingAsync(listing, cancellationToken);

        if (!string.Equals(oldStatus, "rejected", StringComparison.OrdinalIgnoreCase)
            && string.Equals(request.ListingStatus, "rejected", StringComparison.OrdinalIgnoreCase))
        {
            var notification = new VendorNotification
            {
                VendorId = vendorId,
                NotificationType = "listing_rejected",
                Title = "Listing review rejected",
                Message = AdminNotificationMessageBuilder.WithReason(
                    $"Your listing '{listing.ListingTitle}' was rejected. Please update and resubmit.",
                    request.Notes),
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow
            };
            await repository.AddVendorNotificationAsync(notification, cancellationToken);
        }

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_LISTING_VERIFIED",
            EntityType = "VendorProductListing",
            EntityId = listing.Id,
            OldValue = oldStatus,
            NewValue = request.ListingStatus,
            Notes = request.Notes
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorProductListingDto(
            listing.Id.ToString(),
            listing.VendorId.ToString(),
            listing.ProductId.ToString(),
            listing.ListingTitle,
            listing.DailyRent,
            listing.MonthlyRent,
            listing.SecurityDeposit,
            listing.AvailableQuantity,
            listing.ListingStatus));
    }
}

public sealed record ForceResetVendorPasswordCommand(
    string AdminId,
    string VendorId,
    string NewPassword,
    string? Notes) : ICommand<AdminPasswordResetDto>;

public sealed class ForceResetVendorPasswordCommandValidator : AbstractValidator<ForceResetVendorPasswordCommand>
{
    public ForceResetVendorPasswordCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

internal sealed class ForceResetVendorPasswordCommandHandler(
    IVendorOnboardingRepository repository,
    IPasswordHasherService passwordHasherService)
    : ICommandHandler<ForceResetVendorPasswordCommand, AdminPasswordResetDto>
{
    public async Task<Result<AdminPasswordResetDto>> Handle(ForceResetVendorPasswordCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<AdminPasswordResetDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<AdminPasswordResetDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<AdminPasswordResetDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null || vendor.IsDeleted)
        {
            return Result.Failure<AdminPasswordResetDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        vendor.PasswordHash = passwordHasherService.HashPassword(request.NewPassword);
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_PASSWORD_FORCE_RESET",
            EntityType = "Vendor",
            EntityId = vendorId,
            OldValue = null,
            NewValue = "password_reset",
            Notes = request.Notes
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new AdminPasswordResetDto(
            vendorId.ToString(),
            "Vendor password reset successfully.",
            DateTimeOffset.UtcNow));
    }
}

internal static class AdminNotificationMessageBuilder
{
    public static string WithReason(string baseMessage, string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
        {
            return baseMessage;
        }

        return $"{baseMessage} Reason: {notes.Trim()}";
    }
}
