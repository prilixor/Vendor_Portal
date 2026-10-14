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

public sealed record SuspendVendorCommand(string VendorId, string AdminUserId, string? Reason) : ICommand<VendorDto>;

public sealed class SuspendVendorCommandValidator : AbstractValidator<SuspendVendorCommand>
{
    public SuspendVendorCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
    }
}

internal sealed class SuspendVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IEmailService emailService,
    IMediator mediator,
    VendorSmsNotifier vendorSms,
    ILogger<SuspendVendorCommandHandler> logger)
    : ICommandHandler<SuspendVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(SuspendVendorCommand request, CancellationToken cancellationToken)
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

        // Suspend vendor
        vendor.AccountStatus = "suspended";
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        // Add audit log
        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            AdminUser = adminUser,
            ActionType = "vendor_suspended",
            EntityType = "vendor",
            EntityId = vendorId,
            OldValue = JsonSerializer.Serialize("active"),
            NewValue = JsonSerializer.Serialize("suspended"),
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
            var emailBody = EmailTemplates.VendorSuspended(vendor.Email, reason, vendorName);
            await emailService.SendEmailAsync(vendor.Email, "Your Vendor Account Has Been Suspended", emailBody, cancellationToken);

            // Create notification record
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "vendor_suspended",
                "Vendor Account Suspended",
                $"Your vendor account has been suspended. Reason: {reason}",
                "email",
                "sent"), cancellationToken);

            logger.LogInformation("Suspension notification sent to vendor {VendorEmail}", vendor.Email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send suspension notification to vendor {VendorEmail}", vendor.Email);
            // Create notification record with failed status
            try
            {
                var reason = request.Reason ?? "No reason provided";
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorId.ToString(),
                    "vendor_suspended",
                    "Vendor Account Suspended",
                    $"Your vendor account has been suspended. Reason: {reason}",
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
            SmsTemplates.VendorAccountSuspended(request.Reason),
            VendorSmsKind.AccountSuspended,
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
