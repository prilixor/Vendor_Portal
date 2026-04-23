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

public sealed record BanVendorCommand(string VendorId, string AdminUserId, string? Reason) : ICommand<VendorDto>;

public sealed class BanVendorCommandValidator : AbstractValidator<BanVendorCommand>
{
    public BanVendorCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
    }
}

internal sealed class BanVendorCommandHandler(
    IVendorOnboardingRepository repository,
    IEmailService emailService,
    IMediator mediator,
    ILogger<BanVendorCommandHandler> logger)
    : ICommandHandler<BanVendorCommand, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(BanVendorCommand request, CancellationToken cancellationToken)
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

        // Ban vendor
        vendor.AccountStatus = "banned";
        await repository.UpdateVendorAsync(vendor, cancellationToken);

        // Add audit log
        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "vendor_banned",
            EntityType = "vendor",
            EntityId = vendorId,
            OldValue = JsonSerializer.Serialize("active"),
            NewValue = JsonSerializer.Serialize("banned"),
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
            var emailBody = EmailTemplates.VendorBanned(vendor.Email, reason, vendorName);
            await emailService.SendEmailAsync(vendor.Email, "Your Vendor Account Has Been Banned", emailBody, cancellationToken);

            // Create notification record
            await mediator.Send(new CreateVendorNotificationCommand(
                vendorId.ToString(),
                "vendor_banned",
                "Vendor Account Banned",
                $"Your vendor account has been permanently banned. Reason: {reason}",
                "email",
                "sent"), cancellationToken);

            logger.LogInformation("Ban notification sent to vendor {VendorEmail}", vendor.Email);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send ban notification to vendor {VendorEmail}", vendor.Email);
            // Create notification record with failed status
            try
            {
                var reason = request.Reason ?? "No reason provided";
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorId.ToString(),
                    "vendor_banned",
                    "Vendor Account Banned",
                    $"Your vendor account has been permanently banned. Reason: {reason}",
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
