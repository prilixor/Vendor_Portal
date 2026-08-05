using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Admin-only: set a vendor service area coverage radius. Vendors may place the pin but cannot change radius.
/// </summary>
public sealed record UpdateVendorServiceAreaRadiusCommand(
    string AdminId,
    string VendorId,
    string ServiceAreaId,
    decimal ServiceRadiusKm,
    string? Notes) : ICommand<VendorServiceAreaDto>;

public sealed class UpdateVendorServiceAreaRadiusCommandValidator : AbstractValidator<UpdateVendorServiceAreaRadiusCommand>
{
    public UpdateVendorServiceAreaRadiusCommandValidator()
    {
        RuleFor(x => x.AdminId).NotEmpty();
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ServiceAreaId).NotEmpty();
        RuleFor(x => x.ServiceRadiusKm)
            .GreaterThan(0)
            .LessThanOrEqualTo(500)
            .WithMessage("Service radius must be between 0 and 500 km.");
    }
}

internal sealed class UpdateVendorServiceAreaRadiusCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateVendorServiceAreaRadiusCommand, VendorServiceAreaDto>
{
    public async Task<Result<VendorServiceAreaDto>> Handle(UpdateVendorServiceAreaRadiusCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("admin.invalid_id", "Admin user id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.ServiceAreaId, out var serviceAreaId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendor_service_areas.invalid_id", "Service area id must be a valid UUID.", ErrorCategory.Validation));
        }

        var adminUser = await repository.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("admin.not_found", "Active admin user not found.", ErrorCategory.NotFound));
        }

        var entity = await repository.GetVendorServiceAreaByIdAsync(vendorId, serviceAreaId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendor_service_areas.not_found", "Service area not found.", ErrorCategory.NotFound));
        }

        var oldRadius = entity.ServiceRadiusKm;
        var wasSetByAdmin = entity.IsRadiusSetByAdmin;
        entity.ServiceRadiusKm = request.ServiceRadiusKm;
        entity.IsRadiusSetByAdmin = true;

        var auditLog = new AdminAuditLog
        {
            AdminId = adminUserId,
            ActionType = "VENDOR_SERVICE_AREA_RADIUS_UPDATED",
            EntityType = "VendorServiceArea",
            EntityId = entity.Id,
            OldValue = System.Text.Json.JsonSerializer.Serialize(new { radiusKm = oldRadius, isRadiusSetByAdmin = wasSetByAdmin }),
            NewValue = System.Text.Json.JsonSerializer.Serialize(new { radiusKm = request.ServiceRadiusKm, isRadiusSetByAdmin = true }),
            Notes = request.Notes,
            CreatedOnUtc = DateTime.UtcNow
        };
        await repository.AddAdminAuditLogAsync(auditLog, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorServiceAreaDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.AreaName,
            entity.City,
            entity.CenterLatitude,
            entity.CenterLongitude,
            entity.ServiceRadiusKm,
            entity.IsActive,
            entity.IsRadiusSetByAdmin));
    }
}
