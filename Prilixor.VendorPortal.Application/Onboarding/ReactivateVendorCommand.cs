using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using System.Text.Json;
using Prilixor.Shared.Extensions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record ReactivateVendorCommand(string VendorId, string AdminUserId, string? Reason) : ICommand<VendorDto>;

public sealed class ReactivateVendorCommandValidator : AbstractValidator<ReactivateVendorCommand>
{
    public ReactivateVendorCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
    }
}

internal sealed class ReactivateVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IEmailService emailService,
    IMediator mediator,
    VendorSmsNotifier vendorSms,
    ILogger<ReactivateVendorCommandHandler> logger)
    : ICommandHandler<ReactivateVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(ReactivateVendorCommand request, CancellationToken cancellationToken)
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

        // Store old status for audit log
        var oldStatus = vendor.AccountStatus;

        // Reactivate vendor (set back to active)
        vendor.AccountStatus = "active";
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        // Add audit log
        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            AdminUser = adminUser,
            ActionType = "vendor_reactivated",
            EntityType = "vendor",
            EntityId = vendorId,
            OldValue = JsonSerializer.Serialize(oldStatus),
            NewValue = JsonSerializer.Serialize("active"),
            Notes = request.Reason,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);

        await repository.SaveChangesAsync(cancellationToken);

        // Send notification
        try
        {
            var vendorName = vendor.Profile?.OwnerName ?? vendor.Email;
            var emailBody = EmailTemplates.VendorReactivated(vendor.Email, vendorName);
            await emailService.SendEmailAsync(vendor.Email, "Your Vendor Account Has Been Reactivated", emailBody, cancellationToken);

            // Create notification record
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "vendor_reactivated",
                "Vendor Account Reactivated",
                "Your vendor account has been reactivated. You can now resume your activities on the platform.",
                "email",
                "sent"), cancellationToken);

            logger.LogInformation("Reactivation notification sent to vendor {VendorEmail}", vendor.Email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send reactivation notification to vendor {VendorEmail}", vendor.Email);
            // Create notification record with failed status
            try
            {
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorId.ToString(),
                    "vendor_reactivated",
                    "Vendor Account Reactivated",
                    "Your vendor account has been reactivated. You can now resume your activities on the platform.",
                    "email",
                    "failed"), cancellationToken);
            }
            catch (Exception notificationEx)
            {
                logger.LogError(notificationEx, "Failed to create notification record for vendor {VendorId}", vendorId);
            }
        }

        await vendorSms.TrySendAsync(
            vendorId,
            SmsTemplates.VendorAccountReactivated(),
            VendorSmsKind.AccountReactivated,
            cancellationToken);

        return Result.Success(new VendorDto(
            vendor.Id.ToString(),
            vendor.Email,
            vendor.IsEmailVerified,
            vendor.VerificationTokenExpiryUtc.ToSafeDateTimeOffset(),
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt.ToSafeDateTimeOffset(),
            vendor.TermsAcceptedAt.ToSafeDateTimeOffset(),
            vendor.CreatedOnUtc.ToSafeDateTimeOffset()));
    }
}
