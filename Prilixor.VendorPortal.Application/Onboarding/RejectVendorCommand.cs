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

public sealed record RejectVendorCommand(string VendorId, string AdminUserId, string? Reason) : ICommand<VendorDto>;

public sealed class RejectVendorCommandValidator : AbstractValidator<RejectVendorCommand>
{
    public RejectVendorCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
    }
}

internal sealed class RejectVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IEmailService emailService,
    IMediator mediator,
    ILogger<RejectVendorCommandHandler> logger)
    : ICommandHandler<RejectVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(RejectVendorCommand request, CancellationToken cancellationToken)
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

        // Validate vendor status
        if (vendor.AccountStatus != "pending")
        {
            return Result.Failure<VendorDto>(new Error("vendors.invalid_status", "Vendor must be in pending status to be rejected.", ErrorCategory.Validation));
        }

        // Reject vendor
        vendor.AccountStatus = "rejected";
        vendor.RegistrationStage = "rejected";
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        // Add audit log
        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            AdminUser = adminUser,
            ActionType = "vendor_rejected",
            EntityType = "vendor",
            EntityId = vendorId,
            OldValue = JsonSerializer.Serialize("pending"),
            NewValue = JsonSerializer.Serialize("rejected"),
            Notes = request.Reason,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await repository.SaveChangesAsync(cancellationToken);

        // Send notification
        try
        {
            var vendorName = vendor.Profile?.OwnerName ?? vendor.Email;
            var reason = request.Reason ?? "No reason provided";
            var emailBody = EmailTemplates.VendorRejected(vendor.Email, reason, vendorName);
            await emailService.SendEmailAsync(vendor.Email, "Your Vendor Account Application Has Been Rejected", emailBody, cancellationToken);

            // Create notification record
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "vendor_rejected",
                "Vendor Account Rejected",
                $"Your vendor account application has been rejected. Reason: {reason}",
                "email",
                "sent"), cancellationToken);

            logger.LogInformation("Rejection notification sent to vendor {VendorEmail}", vendor.Email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send rejection notification to vendor {VendorEmail}", vendor.Email);
            // Create notification record with failed status
            try
            {
                var reason = request.Reason ?? "No reason provided";
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorId.ToString(),
                    "vendor_rejected",
                    "Vendor Account Rejected",
                    $"Your vendor account application has been rejected. Reason: {reason}",
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
            vendor.EmailVerified,
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt));
    }
}
