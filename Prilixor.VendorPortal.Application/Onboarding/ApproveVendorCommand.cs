using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using System.Text.Json;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record ApproveVendorCommand(string VendorId, string AdminUserId) : ICommand<VendorDto>;

public sealed class ApproveVendorCommandValidator : AbstractValidator<ApproveVendorCommand>
{
    public ApproveVendorCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
    }
}

internal sealed class ApproveVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IEmailService emailService,
    IMediator mediator,
    ILogger<ApproveVendorCommandHandler> logger)
    : ICommandHandler<ApproveVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(ApproveVendorCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.AdminUserId, out var adminUserId))
        {
            return Result.Failure<VendorDto>(new Error("admins.invalid_id", "Admin id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        // Validate vendor has uploaded exactly 5 documents
        var documents = await repository.GetVendorDocumentsAsync(vendorId, cancellationToken);
        if (documents.Count != 5)
        {
            return Result.Failure<VendorDto>(new Error("vendors.insufficient_documents", $"Vendor must upload exactly 5 documents. Currently uploaded: {documents.Count}/5.", ErrorCategory.Validation));
        }

        // Validate all documents are approved
        var pendingOrRejectedDocuments = documents.Where(d => d.VerificationStatus != "approved").ToList();
        if (pendingOrRejectedDocuments.Any())
        {
            var notApprovedDocTypes = string.Join(", ", pendingOrRejectedDocuments.Select(d => d.DocumentType));
            return Result.Failure<VendorDto>(new Error("vendors.documents_not_approved", $"The following documents are not approved: {notApprovedDocTypes}. All 5 documents must be approved before vendor can be approved.", ErrorCategory.Validation));
        }

        // Validate vendor has uploaded bank account
        var bankAccounts = await repository.GetVendorBankAccountsAsync(vendorId, cancellationToken);
        if (!bankAccounts.Any())
        {
            return Result.Failure<VendorDto>(new Error("vendors.no_bank_account", "Vendor must upload at least one bank account before approval.", ErrorCategory.Validation));
        }

        // Validate at least one bank account is approved
        var approvedBankAccount = bankAccounts.FirstOrDefault(b => b.VerificationStatus == "approved");
        if (approvedBankAccount == null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.bank_account_not_approved", "At least one bank account must be approved before vendor can be approved.", ErrorCategory.Validation));
        }

        // Approve vendor
        vendor.AccountStatus = "active";
        vendor.RegistrationStage = "approved";
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        // Add audit log
        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            AdminUser = adminUser,
            ActionType = "vendor_approved",
            EntityType = "vendor",
            EntityId = vendorId,
            OldValue = JsonSerializer.Serialize("pending"),
            NewValue = JsonSerializer.Serialize("active"),
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await repository.SaveChangesAsync(cancellationToken);

        // Send notification
        try
        {
            var vendorName = vendor.Profile?.OwnerName ?? vendor.Email;
            var emailBody = EmailTemplates.VendorApproved(vendor.Email, vendorName);
            await emailService.SendEmailAsync(vendor.Email, "Your Vendor Account Has Been Approved", emailBody, cancellationToken);

            // Create notification record
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "vendor_approved",
                "Vendor Account Approved",
                "Congratulations! Your vendor account has been approved. You can now start listing your products.",
                "email",
                "sent"), cancellationToken);

            logger.LogInformation("Approval notification sent to vendor {VendorEmail}", vendor.Email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send approval notification to vendor {VendorEmail}", vendor.Email);
            // Create notification record with failed status
            try
            {
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorId.ToString(),
                    "vendor_approved",
                    "Vendor Account Approved",
                    "Congratulations! Your vendor account has been approved. You can now start listing your products.",
                    "email",
                    "failed"), cancellationToken);
            }
            catch (Exception notificationEx)
            {
                logger.LogError(notificationEx, "Failed to create notification record for vendor {VendorId}", vendorId);
            }
        }

        return Result.Success(new VendorDto(
            vendor.Id.ToString(),
            vendor.Email,
            vendor.IsEmailVerified,
            vendor.VerificationTokenExpiryUtc,
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt));
    }
}
