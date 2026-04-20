using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorNotificationPreferenceCommand(
    string VendorId,
    bool EmailNotificationsEnabled,
    bool PushNotificationsEnabled,
    bool NewOrderNotifications) : ICommand<VendorNotificationPreferenceDto>;

public sealed class UpsertVendorNotificationPreferenceCommandValidator : AbstractValidator<UpsertVendorNotificationPreferenceCommand>
{
    public UpsertVendorNotificationPreferenceCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
    }
}

internal sealed class UpsertVendorNotificationPreferenceCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorNotificationPreferenceCommand, VendorNotificationPreferenceDto>
{
    public async Task<Result<VendorNotificationPreferenceDto>> Handle(UpsertVendorNotificationPreferenceCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorNotificationPreferenceDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorNotificationPreferenceDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var entity = await repository.GetVendorNotificationPreferenceAsync(vendorId, cancellationToken)
            ?? new VendorNotificationPreference { VendorId = vendorId };

        entity.EmailNotificationsEnabled = request.EmailNotificationsEnabled;
        entity.PushNotificationsEnabled = request.PushNotificationsEnabled;
        entity.NewOrderNotifications = request.NewOrderNotifications;

        await repository.UpsertVendorNotificationPreferenceAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorNotificationPreferenceDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.EmailNotificationsEnabled,
            entity.PushNotificationsEnabled,
            entity.NewOrderNotifications));
    }
}

public sealed record GetVendorNotificationPreferenceQuery(string VendorId) : IQuery<VendorNotificationPreferenceDto>;

internal sealed class GetVendorNotificationPreferenceQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorNotificationPreferenceQuery, VendorNotificationPreferenceDto>
{
    public async Task<Result<VendorNotificationPreferenceDto>> Handle(GetVendorNotificationPreferenceQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorNotificationPreferenceDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetVendorNotificationPreferenceAsync(vendorId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorNotificationPreferenceDto>(new Error("vendors.notifications.preference_not_found", "Notification preference not found.", ErrorCategory.NotFound));
        }

        return Result.Success(new VendorNotificationPreferenceDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.EmailNotificationsEnabled,
            entity.PushNotificationsEnabled,
            entity.NewOrderNotifications));
    }
}

public sealed record CreateVendorNotificationCommand(
    string VendorId,
    string NotificationType,
    string Title,
    string Message,
    string Channel,
    string Status) : ICommand<VendorNotificationDto>;

public sealed class CreateVendorNotificationCommandValidator : AbstractValidator<CreateVendorNotificationCommand>
{
    public CreateVendorNotificationCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.NotificationType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Message).NotEmpty();
        RuleFor(x => x.Channel).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(30);
    }
}

internal sealed class CreateVendorNotificationCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateVendorNotificationCommand, VendorNotificationDto>
{
    public async Task<Result<VendorNotificationDto>> Handle(CreateVendorNotificationCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var entity = new VendorNotification
        {
            VendorId = vendorId,
            NotificationType = request.NotificationType,
            Title = request.Title,
            Message = request.Message,
            Channel = request.Channel,
            Status = request.Status,
            SentAt = request.Status == "sent" ? DateTimeOffset.UtcNow : null,
            ReadAt = request.Status == "read" ? DateTimeOffset.UtcNow : null
        };

        await repository.AddVendorNotificationAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorNotificationDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.NotificationType,
            entity.Title,
            entity.Message,
            entity.Channel,
            entity.Status,
            entity.SentAt,
            entity.ReadAt));
    }
}

public sealed record GetVendorNotificationsQuery(string VendorId) : IQuery<List<VendorNotificationDto>>;

internal sealed class GetVendorNotificationsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorNotificationsQuery, List<VendorNotificationDto>>
{
    public async Task<Result<List<VendorNotificationDto>>> Handle(GetVendorNotificationsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorNotificationDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorNotificationsAsync(vendorId, cancellationToken);
        var result = rows.Select(x => new VendorNotificationDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.NotificationType,
            x.Title,
            x.Message,
            x.Channel,
            x.Status,
            x.SentAt,
            x.ReadAt)).ToList();

        return Result.Success(result);
    }
}
