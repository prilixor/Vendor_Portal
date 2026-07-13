using FluentValidation;
using MediatR;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.Shared.Extensions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Domain.Customers;

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
            entity.LastLoginAt.ToSafeDateTimeOffset()));
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
            x.LastLoginAt.ToSafeDateTimeOffset())).ToList();

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
            AdminUser = adminUser,
            ActionType = request.ActionType,
            EntityType = request.EntityType,
            EntityId = entityId,
            OldValue = request.OldValue,
            NewValue = request.NewValue,
            Notes = request.Notes,
            CreatedOnUtc = DateTime.UtcNow
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
            entity.Notes,
            entity.CreatedOnUtc.ToSafeDateTimeOffset()));
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
            x.Notes,
            x.CreatedOnUtc.ToSafeDateTimeOffset())).ToList();

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

internal sealed class VerifyVendorBankAccountCommandHandler(IVendorOnboardingRepository repository, IMediator mediator)
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
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "bank_rejected",
                "Bank account verification rejected",
                AdminNotificationMessageBuilder.WithReason(
                    $"Your bank account ending with {GetLast4(bankAccount.AccountNumber)} was rejected. Please review and resubmit.",
                    request.Notes),
                "in_app",
                "sent"), cancellationToken);
        }

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_BANK_ACCOUNT_VERIFIED",
            EntityType = "VendorBankAccount",
            EntityId = bankAccount.Id,
            OldValue = System.Text.Json.JsonSerializer.Serialize(oldStatus),
            NewValue = System.Text.Json.JsonSerializer.Serialize(request.VerificationStatus),
            Notes = request.Notes,
            CreatedOnUtc = DateTime.UtcNow
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

internal sealed class VerifyVendorDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver,
    IMediator mediator)
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

        // For active vendors, check if all documents are approved and restore registration stage
        if (string.Equals(request.VerificationStatus, "approved", StringComparison.OrdinalIgnoreCase))
        {
            var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
            if (vendor != null && vendor.AccountStatus == "active" && vendor.RegistrationStage != "approved")
            {
                var allDocuments = await repository.GetVendorDocumentsAsync(vendorId, cancellationToken);
                var allApproved = allDocuments.All(d => d.VerificationStatus == "approved" && !d.IsDeleted);
                
                if (allApproved && allDocuments.Any())
                {
                    vendor.RegistrationStage = "approved";
                }
            }
        }

        if (!string.Equals(oldStatus, "rejected", StringComparison.OrdinalIgnoreCase)
            && string.Equals(request.VerificationStatus, "rejected", StringComparison.OrdinalIgnoreCase))
        {
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "document_rejected",
                "Document verification rejected",
                AdminNotificationMessageBuilder.WithReason(
                    $"Your {document.DocumentType} document was rejected. Please update and resubmit.",
                    request.Notes),
                "in_app",
                "sent"), cancellationToken);
        }

        if (!string.Equals(oldStatus, "approved", StringComparison.OrdinalIgnoreCase)
            && string.Equals(request.VerificationStatus, "approved", StringComparison.OrdinalIgnoreCase))
        {
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "document_verified",
                "Document verified successfully",
                $"Your {document.DocumentType} document has been verified and approved.",
                "in_app",
                "sent"), cancellationToken);
        }

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_DOCUMENT_VERIFIED",
            EntityType = "VendorDocument",
            EntityId = document.Id,
            OldValue = System.Text.Json.JsonSerializer.Serialize(oldStatus),
            NewValue = System.Text.Json.JsonSerializer.Serialize(request.VerificationStatus),
            Notes = request.Notes,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorDocumentDto(
            document.Id.ToString(),
            document.VendorId.ToString(),
            document.DocumentType,
            fileUrlResolver.Resolve(document.FileUrl),
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
            OldValue = System.Text.Json.JsonSerializer.Serialize(oldStatus),
            NewValue = System.Text.Json.JsonSerializer.Serialize(request.ListingStatus),
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
            listing.ListingStatus,
            0));
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
            NewValue = System.Text.Json.JsonSerializer.Serialize("password_reset"),
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

public sealed record UpdateAdminOrderStatusCommand(string AdminId, Guid OrderId, string Status, List<string>? AssetTags = null) : ICommand<AdminOrderDto>;

public sealed class UpdateAdminOrderStatusCommandValidator : AbstractValidator<UpdateAdminOrderStatusCommand>
{
    public UpdateAdminOrderStatusCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Status).NotEmpty();
    }
}

internal sealed class UpdateAdminOrderStatusCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<UpdateAdminOrderStatusCommand, AdminOrderDto>
{
    public async Task<Result<AdminOrderDto>> Handle(UpdateAdminOrderStatusCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await vendors.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<AdminOrderDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.IsDeleted)
            return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var current = order.Status.Trim().ToLowerInvariant();
        var target = request.Status.Trim().ToLowerInvariant();
        
        if (current == target)
            return await BuildOrderDto(customers, order.Id, cancellationToken);

        var listing = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listing is null)
            return Result.Failure<AdminOrderDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));

        var inventory = await vendors.GetVendorInventoryByListingIdAsync(listing.ListingId, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (target == "in_transit" || target == "active")
        {
            var assignedAssets = await customers.GetCustomerRentalOrderAssetsAsync(order.Id, cancellationToken);
            if (request.AssetTags is { Count: > 0 } && !assignedAssets.Any())
            {
                if (request.AssetTags.Count != order.Quantity)
                {
                    return Result.Failure<AdminOrderDto>(new Error("admin.order.asset_count_mismatch", $"Expected {order.Quantity} asset tags, got {request.AssetTags.Count}.", ErrorCategory.Validation));
                }

                if (request.AssetTags.Distinct().Count() != request.AssetTags.Count)
                {
                    return Result.Failure<AdminOrderDto>(new Error("admin.order.asset_duplicate", "Duplicate asset tags provided in the request.", ErrorCategory.Validation));
                }

                foreach (var tag in request.AssetTags)
                {
                    var asset = await vendors.GetVendorProductAssetByTagGlobalAsync(listing.VendorId, tag, cancellationToken);
                    if (asset is not null && asset.VendorProductListingId != listing.ListingId)
                    {
                        return Result.Failure<AdminOrderDto>(new Error("admin.order.asset_duplicate_global", $"Asset tag {tag} already belongs to another product ({asset.VendorProductListing?.ListingTitle ?? "Unknown"}).", ErrorCategory.Validation));
                    }

                    if (asset is null)
                    {
                        asset = new VendorProductAsset
                        {
                            VendorProductListingId = listing.ListingId,
                            AssetTag = tag,
                            Status = "available",
                            Condition = "Good",
                            CreatedBy = listing.VendorId
                        };
                        await vendors.AddVendorProductAssetAsync(asset, cancellationToken);
                        await vendors.SaveChangesAsync(cancellationToken);
                    }

                    if (asset.Status == "rented" || asset.Status == "sold")
                    {
                        return Result.Failure<AdminOrderDto>(new Error("admin.order.asset_unavailable", $"Asset {tag} is currently {asset.Status}.", ErrorCategory.Validation));
                    }

                    asset.Status = order.OrderType == "buy" ? "sold" : "rented";
                    await vendors.UpdateVendorProductAssetAsync(asset, cancellationToken);

                    var orderAsset = new CustomerRentalOrderAsset
                    {
                        CustomerRentalOrderId = order.Id,
                        VendorProductAssetId = asset.Id
                    };
                    await customers.AddCustomerRentalOrderAssetAsync(orderAsset, cancellationToken);
                }
            }
        }

        if (target == "active")
        {
            if (order.OrderType == "rent")
            {
                order.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
                order.EndDate = order.StartDate.Value.AddDays(order.RentalDays);
            }
            else if (order.OrderType == "buy")
            {
                order.StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
                order.EndDate = order.StartDate;
            }

            if (inventory is not null)
            {
                if (order.OrderType == "buy")
                {
                    inventory.TotalQuantity = Math.Max(0, inventory.TotalQuantity - order.Quantity);
                    int quantityToReduce = order.Quantity;
                    
                    int fromReserved = Math.Min(inventory.ReservedQuantity, quantityToReduce);
                    inventory.ReservedQuantity -= fromReserved;
                    quantityToReduce -= fromReserved;
                    
                    if (quantityToReduce > 0)
                    {
                        int fromAvailable = Math.Min(inventory.AvailableQuantity, quantityToReduce);
                        inventory.AvailableQuantity -= fromAvailable;
                        quantityToReduce -= fromAvailable;
                    }
                    if (quantityToReduce > 0)
                    {
                        int fromRented = Math.Min(inventory.RentedQuantity, quantityToReduce);
                        inventory.RentedQuantity -= fromRented;
                        quantityToReduce -= fromRented;
                    }
                    if (quantityToReduce > 0)
                    {
                        int fromBlocked = Math.Min(inventory.BlockedQuantity, quantityToReduce);
                        inventory.BlockedQuantity -= fromBlocked;
                        quantityToReduce -= fromBlocked;
                    }
                }
                else
                {
                    inventory.ReservedQuantity = Math.Max(0, inventory.ReservedQuantity - order.Quantity);
                    inventory.RentedQuantity += order.Quantity;
                }

                await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
                await vendors.AddVendorInventoryMovementAsync(
                    new VendorInventoryMovement
                    {
                        VendorInventoryId = inventory.Id,
                        MovementType = order.OrderType == "buy" ? "stock_removed" : "rented",
                        Quantity = order.Quantity,
                        ReferenceType = "customer_rental_order",
                        ReferenceId = order.Id,
                        Notes = $"Order {order.OrderNumber} moved to active by Admin",
                        EventAt = now,
                    },
                    cancellationToken);
            }

        }
        else if (target == "returned")
        {
            if (inventory is not null)
            {
                inventory.RentedQuantity = Math.Max(0, inventory.RentedQuantity - order.Quantity);
                inventory.AvailableQuantity += order.Quantity;
                await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
                await vendors.AddVendorInventoryMovementAsync(
                    new VendorInventoryMovement
                    {
                        VendorInventoryId = inventory.Id,
                        MovementType = "returned",
                        Quantity = order.Quantity,
                        ReferenceType = "customer_rental_order",
                        ReferenceId = order.Id,
                        Notes = $"Order {order.OrderNumber} marked returned by Admin",
                        EventAt = now,
                    },
                    cancellationToken);
            }
            else
            {
                var productListing = await vendors.GetVendorProductListingByIdAsync(listing.VendorId, listing.ListingId, cancellationToken);
                if (productListing is not null)
                {
                    productListing.AvailableQuantity += order.Quantity;
                    await vendors.UpdateVendorProductListingAsync(productListing, cancellationToken);
                }
            }

            var assignedAssets = await customers.GetCustomerRentalOrderAssetsAsync(order.Id, cancellationToken);
            foreach (var orderAsset in assignedAssets)
            {
                var asset = await vendors.GetVendorProductAssetByIdAsync(orderAsset.VendorProductAssetId, cancellationToken);
                if (asset is not null)
                {
                    asset.Status = "available";
                    await vendors.UpdateVendorProductAssetAsync(asset, cancellationToken);
                }
            }
        }

        order.Status = target;
        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                RelatedOrderId = order.Id,
                NotificationType = "order_status_updated",
                Title = $"Order {order.OrderNumber} updated",
                Body = target switch
                {
                    "in_transit" => "Your order is now out for delivery.",
                    "active" => order.OrderType == "buy" ? "Your purchase is delivered." : "Your rental order has been delivered and is now active.",
                    "returned" => "Return completed for your rental order.",
                    _ => "Order status has been updated."
                },
            },
            cancellationToken);

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "ADMIN_UPDATE_ORDER_STATUS",
            EntityType = "CustomerRentalOrder",
            EntityId = order.Id,
            OldValue = System.Text.Json.JsonSerializer.Serialize(current),
            NewValue = System.Text.Json.JsonSerializer.Serialize(target),
            Notes = "Admin forcibly updated order status"
        };
        await vendors.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await BuildOrderDto(customers, order.Id, cancellationToken);
    }

    private static async Task<Result<AdminOrderDto>> BuildOrderDto(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        var listing = row.Listing;
        
        return Result.Success(new AdminOrderDto(
            o.Id,
            o.OrderNumber,
            o.CustomerId,
            o.Customer?.FullName ?? "Customer",
            o.Customer?.Email ?? "customer@example.com",
            (o.Status == "dispatch_failed" || o.Status == "awaiting_vendor_acceptance") ? "Unassigned" : (listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor"),
            !string.IsNullOrEmpty(row.VariantDescription) 
                ? $"{listing?.ListingTitle ?? "Deleted Product"} ({row.VariantDescription})" 
                : (listing?.ListingTitle ?? "Deleted Product"),
            o.Status,
            o.OrderType,
            o.Quantity,
            o.RentalDays,
            o.TotalAmount,
            o.DepositAmount,
            o.VendorSubtotalAmount,
            o.CreatedOnUtc,
            o.StartDate,
            o.EndDate,
            row.ListingPrimaryImageUrl,
            o.IsExtended,
            DoctorId: row.Doctor?.Id,
            DoctorName: row.Doctor?.FullName,
            DoctorSpecialization: row.Doctor?.Specialization,
            HospitalId: row.Hospital?.Id,
            HospitalName: row.Hospital?.Name,
            HospitalCity: row.Hospital?.City,
            DoctorContactNumber: row.Doctor?.ContactNumber
        ));
    }
}

public sealed record AdminReassignVendorOrderCommand(string AdminId, Guid OrderId) : ICommand<AdminOrderDto>;

internal sealed class AdminReassignVendorOrderCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    Microsoft.Extensions.Options.IOptions<Prilixor.VendorPortal.Domain.Options.CustomerPricingOptions> pricingOptions)
    : ICommandHandler<AdminReassignVendorOrderCommand, AdminOrderDto>
{
    public async Task<Result<AdminOrderDto>> Handle(AdminReassignVendorOrderCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));

        var orderRow = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (orderRow is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = orderRow.Order;
        
        if (order.Status != "dispatch_failed" && order.Status != "confirmed")
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_order_status", "Only dispatch_failed or confirmed orders can be reassigned.", ErrorCategory.Validation));

        var oldVendorId = orderRow.Listing?.VendorId;
        order.Status = "awaiting_vendor_acceptance";
        
        var agg = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (agg is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.listing_not_found", "Original listing not found.", ErrorCategory.NotFound));

        var options = pricingOptions.Value;
        var vendorAreasByVendorId = new Dictionary<Guid, List<VendorServiceArea>>();
        CustomerAddress? address = null;
        if (order.CustomerAddressId.HasValue)
            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, order.CustomerAddressId.Value, cancellationToken);

        var candidateListings = await customers.GetCandidateListingsByProductIdAsync(agg.ProductId, cancellationToken);
        var eligibleCandidates = new List<(VendorProductListingAggregate Candidate, decimal DistanceKm)>();
        foreach (var candidate in candidateListings.Where(c => c.VendorId != Guid.Empty && c.VendorId != oldVendorId))
        {
            var candidateListing = await vendors.GetVendorProductListingByIdAsync(candidate.VendorId, candidate.ListingId, cancellationToken);
            if (candidateListing is null) continue;

            var candidateInventory = await vendors.GetVendorInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
            var candidateAvailable = candidateInventory?.AvailableQuantity ?? candidateListing.AvailableQuantity;
            if (candidateAvailable < order.Quantity) continue;

            decimal distanceKm = 0m;
            if (address is not null && address.Latitude.HasValue && address.Longitude.HasValue)
            {
                var vendorAreas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                var candidateDistance = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address.Latitude.Value, address.Longitude.Value, candidate, vendorAreas, options);
                if (!candidateDistance.IsSuccess) continue;
                distanceKm = candidateDistance.DistanceKm;
            }
            eligibleCandidates.Add((candidate, distanceKm));
        }

        var ranked = eligibleCandidates
            .OrderBy(x => x.DistanceKm)
            .ThenByDescending(x => x.Candidate.InventoryAvailable)
            .Take(Math.Max(1, options.MaxDispatchVendorsPerLine))
            .ToList();

        var now = DateTimeOffset.UtcNow;
        
        for (var i = 0; i < ranked.Count; i++)
        {
            var candidate = ranked[i].Candidate;
            var offer = new CustomerOrderVendorOffer
            {
                CustomerRentalOrderId = order.Id,
                VendorId = candidate.VendorId,
                VendorProductListingId = candidate.ListingId,
                OfferRank = i + 1,
                Status = "pending",
                ExpiresAt = now.AddMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes)),
            };
            await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        if (ranked.Count == 0)
        {
            order.Status = "dispatch_failed";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Failure<AdminOrderDto>(new Error("admin.reassign.no_vendor", "No other eligible vendors available right now.", ErrorCategory.Validation));
        }

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "ADMIN_REASSIGN_VENDOR",
            EntityType = "CustomerRentalOrder",
            EntityId = order.Id,
            Notes = "Admin reassigned order to new vendors."
        };
        await vendors.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await BuildOrderDto(customers, order.Id, cancellationToken);
    }
    
    private static async Task<Result<AdminOrderDto>> BuildOrderDto(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null) return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));
        var o = row.Order;
        var listing = row.Listing;
        return Result.Success(new AdminOrderDto(
            o.Id, o.OrderNumber, o.CustomerId, o.Customer?.FullName ?? "Customer", o.Customer?.Email ?? "customer@example.com",
            (o.Status == "dispatch_failed" || o.Status == "awaiting_vendor_acceptance") ? "Unassigned" : (listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor"),
            !string.IsNullOrEmpty(row.VariantDescription) 
                ? $"{listing?.ListingTitle ?? "Deleted Product"} ({row.VariantDescription})" 
                : (listing?.ListingTitle ?? "Deleted Product"),
            o.Status, o.OrderType, o.Quantity, o.RentalDays, o.TotalAmount, o.DepositAmount, o.VendorSubtotalAmount, o.CreatedOnUtc, o.StartDate, o.EndDate, row.ListingPrimaryImageUrl, o.IsExtended,
            DoctorId: row.Doctor?.Id, DoctorName: row.Doctor?.FullName, DoctorSpecialization: row.Doctor?.Specialization, HospitalId: row.Hospital?.Id, HospitalName: row.Hospital?.Name, HospitalCity: row.Hospital?.City, DoctorContactNumber: row.Doctor?.ContactNumber
        ));
    }
}

public sealed record AdminForceCancelRefundOrderCommand(string AdminId, Guid OrderId) : ICommand<AdminOrderDto>;

internal sealed class AdminForceCancelRefundOrderCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<AdminForceCancelRefundOrderCommand, AdminOrderDto>
{
    public async Task<Result<AdminOrderDto>> Handle(AdminForceCancelRefundOrderCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));

        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        if (o.Status == "cancelled" || o.Status == "returned")
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_order_status", "Order is already cancelled or returned.", ErrorCategory.Validation));

        o.Status = "cancelled";
        await customers.UpdateCustomerRentalOrderAsync(o, cancellationToken);

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "ADMIN_FORCE_CANCEL_REFUND",
            EntityType = "CustomerRentalOrder",
            EntityId = o.Id,
            Notes = "Admin force cancelled the order and initiated refund."
        };
        await vendors.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await BuildOrderDto(customers, o.Id, cancellationToken);
    }
    
    private static async Task<Result<AdminOrderDto>> BuildOrderDto(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null) return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));
        var o = row.Order;
        var listing = row.Listing;
        return Result.Success(new AdminOrderDto(
            o.Id, o.OrderNumber, o.CustomerId, o.Customer?.FullName ?? "Customer", o.Customer?.Email ?? "customer@example.com",
            (o.Status == "dispatch_failed" || o.Status == "awaiting_vendor_acceptance") ? "Unassigned" : (listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor"),
            !string.IsNullOrEmpty(row.VariantDescription) 
                ? $"{listing?.ListingTitle ?? "Deleted Product"} ({row.VariantDescription})" 
                : (listing?.ListingTitle ?? "Deleted Product"),
            o.Status, o.OrderType, o.Quantity, o.RentalDays, o.TotalAmount, o.DepositAmount, o.VendorSubtotalAmount, o.CreatedOnUtc, o.StartDate, o.EndDate, row.ListingPrimaryImageUrl, o.IsExtended,
            DoctorId: row.Doctor?.Id, DoctorName: row.Doctor?.FullName, DoctorSpecialization: row.Doctor?.Specialization, HospitalId: row.Hospital?.Id, HospitalName: row.Hospital?.Name, HospitalCity: row.Hospital?.City, DoctorContactNumber: row.Doctor?.ContactNumber
        ));
    }
}

public sealed record AdminRestartOrderDispatchCommand(string AdminId, Guid OrderId) : ICommand<AdminOrderDto>;

internal sealed class AdminRestartOrderDispatchCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    Microsoft.Extensions.Options.IOptions<Prilixor.VendorPortal.Domain.Options.CustomerPricingOptions> pricingOptions)
    : ICommandHandler<AdminRestartOrderDispatchCommand, AdminOrderDto>
{
    public async Task<Result<AdminOrderDto>> Handle(AdminRestartOrderDispatchCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));

        var orderRow = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (orderRow is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = orderRow.Order;
        
        if (order.Status != "dispatch_failed")
            return Result.Failure<AdminOrderDto>(new Error("admin.invalid_order_status", "Only dispatch_failed orders can be restarted.", ErrorCategory.Validation));

        order.Status = "awaiting_vendor_acceptance";
        
        var agg = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (agg is null)
            return Result.Failure<AdminOrderDto>(new Error("customers.listing_not_found", "Original listing not found.", ErrorCategory.NotFound));

        var options = pricingOptions.Value;
        var vendorAreasByVendorId = new Dictionary<Guid, List<VendorServiceArea>>();
        CustomerAddress? address = null;
        if (order.CustomerAddressId.HasValue)
            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, order.CustomerAddressId.Value, cancellationToken);

        var candidateListings = await customers.GetCandidateListingsByProductIdAsync(agg.ProductId, cancellationToken);
        var eligibleCandidates = new List<(VendorProductListingAggregate Candidate, decimal DistanceKm)>();
        foreach (var candidate in candidateListings.Where(c => c.VendorId != Guid.Empty))
        {
            var candidateListing = await vendors.GetVendorProductListingByIdAsync(candidate.VendorId, candidate.ListingId, cancellationToken);
            if (candidateListing is null) continue;

            var candidateInventory = await vendors.GetVendorInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
            var candidateAvailable = candidateInventory?.AvailableQuantity ?? candidateListing.AvailableQuantity;
            if (candidateAvailable < order.Quantity) continue;

            decimal distanceKm = 0m;
            if (address is not null && address.Latitude.HasValue && address.Longitude.HasValue)
            {
                var vendorAreas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                var candidateDistance = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address.Latitude.Value, address.Longitude.Value, candidate, vendorAreas, options);
                if (!candidateDistance.IsSuccess) continue;
                distanceKm = candidateDistance.DistanceKm;
            }
            eligibleCandidates.Add((candidate, distanceKm));
        }

        var ranked = eligibleCandidates
            .OrderBy(x => x.DistanceKm)
            .ThenByDescending(x => x.Candidate.InventoryAvailable)
            .Take(Math.Max(1, options.MaxDispatchVendorsPerLine))
            .ToList();

        var now = DateTimeOffset.UtcNow;
        
        for (var i = 0; i < ranked.Count; i++)
        {
            var candidate = ranked[i].Candidate;
            var offer = new CustomerOrderVendorOffer
            {
                CustomerRentalOrderId = order.Id,
                VendorId = candidate.VendorId,
                VendorProductListingId = candidate.ListingId,
                OfferRank = i + 1,
                Status = "pending",
                ExpiresAt = now.AddMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes)),
            };
            await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        if (ranked.Count == 0)
        {
            order.Status = "dispatch_failed";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Failure<AdminOrderDto>(new Error("admin.restart.no_vendor", "Cannot restart dispatch: No eligible vendors found with sufficient stock or within delivery range.", ErrorCategory.Validation));
        }

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);

        var listingTitle = agg.ListingTitle ?? "Listing";
        if (order.ProductVariantId.HasValue)
        {
            var reprocessVariant = agg.Variants.FirstOrDefault(v => v.Id == order.ProductVariantId.Value.ToString());
            if (reprocessVariant != null)
            {
                listingTitle += $" ({Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(reprocessVariant.SizeValue, reprocessVariant.SizeUnit)})";
            }
        }
        
        await customers.AddCustomerNotificationAsync(
            new Prilixor.VendorPortal.Domain.Customers.CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                Title = $"Order {order.OrderNumber} is being re-processed",
                Body = $"We are re-processing your {order.OrderType} request for \"{listingTitle}\" with our vendors.",
                NotificationType = "order_pending",
                RelatedOrderId = order.Id,
            },
            cancellationToken);

        foreach (var r in ranked)
        {
            var candidate = r.Candidate;
            await vendors.AddVendorNotificationAsync(new Prilixor.VendorPortal.Domain.Vendors.VendorNotification
            {
                VendorId = candidate.VendorId,
                NotificationType = "dispatch_offer",
                Title = $"New order request {order.OrderNumber}",
                Message = $"You have a new {order.OrderType} request for \"{listingTitle}\".",
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow
            }, cancellationToken);
        }
        
        var auditLog = new Prilixor.VendorPortal.Domain.Vendors.AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "ADMIN_RESTART_DISPATCH",
            EntityType = "CustomerRentalOrder",
            EntityId = order.Id,
            Notes = "Admin restarted the dispatch process and sent new offers."
        };
        await vendors.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await BuildOrderDto(customers, order.Id, cancellationToken);
    }
    
    private static async Task<Result<AdminOrderDto>> BuildOrderDto(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null) return Result.Failure<AdminOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));
        var o = row.Order;
        var listing = row.Listing;
        return Result.Success(new AdminOrderDto(
            o.Id, o.OrderNumber, o.CustomerId, o.Customer?.FullName ?? "Customer", o.Customer?.Email ?? "customer@example.com",
            (o.Status == "dispatch_failed" || o.Status == "awaiting_vendor_acceptance") ? "Unassigned" : (listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor"),
            !string.IsNullOrEmpty(row.VariantDescription) 
                ? $"{listing?.ListingTitle ?? "Deleted Product"} ({row.VariantDescription})" 
                : (listing?.ListingTitle ?? "Deleted Product"),
            o.Status, o.OrderType, o.Quantity, o.RentalDays, o.TotalAmount, o.DepositAmount, o.VendorSubtotalAmount, o.CreatedOnUtc, o.StartDate, o.EndDate, row.ListingPrimaryImageUrl, o.IsExtended,
            DoctorId: row.Doctor?.Id, DoctorName: row.Doctor?.FullName, DoctorSpecialization: row.Doctor?.Specialization, HospitalId: row.Hospital?.Id, HospitalName: row.Hospital?.Name, HospitalCity: row.Hospital?.City, DoctorContactNumber: row.Doctor?.ContactNumber
        ));
    }
}

public sealed record AdminPendingContinuationDto(
    Guid ExtensionId,
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    string VendorName,
    string ListingTitle,
    decimal TotalAmount,
    DateTime CreatedOnUtc,
    string Type
);

public sealed record GetAdminAllPendingContinuationsQuery() : IQuery<List<AdminPendingContinuationDto>>;

internal sealed class GetAdminAllPendingContinuationsQueryHandler(
    ICustomerRepository customers)
    : IQueryHandler<GetAdminAllPendingContinuationsQuery, List<AdminPendingContinuationDto>>
{
    public async Task<Result<List<AdminPendingContinuationDto>>> Handle(GetAdminAllPendingContinuationsQuery request, CancellationToken cancellationToken)
    {
        var continuations = await customers.GetAllPendingContinuationsForAdminAsync(cancellationToken);

        var list = continuations.Select(c => new AdminPendingContinuationDto(
            c.Id,
            c.CustomerRentalOrderId,
            c.OrderNumber,
            c.CustomerName,
            c.VendorName,
            c.ListingTitle,
            c.TotalAmount,
            c.CreatedOnUtc.UtcDateTime,
            c.Type
        )).ToList();

        return Result.Success(list);
    }
}
