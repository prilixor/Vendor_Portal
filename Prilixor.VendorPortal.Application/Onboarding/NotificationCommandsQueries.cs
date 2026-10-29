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
    bool NewOrderNotifications,
    bool SmsNotificationsEnabled = true) : ICommand<VendorNotificationPreferenceDto>;

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
        entity.SmsNotificationsEnabled = request.SmsNotificationsEnabled;

        await repository.UpsertVendorNotificationPreferenceAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorNotificationPreferenceDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.EmailNotificationsEnabled,
            entity.PushNotificationsEnabled,
            entity.NewOrderNotifications,
            entity.SmsNotificationsEnabled));
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
        
        // Return default preferences if none exist
        if (entity is null)
        {
            return Result.Success(new VendorNotificationPreferenceDto(
                Guid.Empty.ToString(),
                vendorId.ToString(),
                true,  // EmailNotificationsEnabled
                true,  // PushNotificationsEnabled
                true,  // NewOrderNotifications
                true)); // SmsNotificationsEnabled
        }

        return Result.Success(new VendorNotificationPreferenceDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.EmailNotificationsEnabled,
            entity.PushNotificationsEnabled,
            entity.NewOrderNotifications,
            entity.SmsNotificationsEnabled));
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

internal sealed class CreateVendorNotificationCommandHandler(
    IVendorOnboardingRepository repository,
    IPushNotificationService pushNotificationService)
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

        // Send push notification if enabled
        var preferences = await repository.GetVendorNotificationPreferenceAsync(vendorId, cancellationToken);
        if (preferences?.PushNotificationsEnabled == true)
        {
            await pushNotificationService.SendPushNotificationToVendorAsync(
                vendorId,
                request.Title,
                request.Message,
                request.NotificationType,
                cancellationToken);
        }

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

public sealed record GetUnreadNotificationCountQuery(string VendorId) : IQuery<int>;

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

internal sealed class GetUnreadNotificationCountQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetUnreadNotificationCountQuery, int>
{
    public async Task<Result<int>> Handle(GetUnreadNotificationCountQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<int>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var count = await repository.GetUnreadNotificationCountAsync(vendorId, cancellationToken);
        return Result.Success(count);
    }
}

public sealed record MarkVendorNotificationAsReadCommand(string VendorId, string NotificationId) : ICommand<VendorNotificationDto>;

public sealed class MarkVendorNotificationAsReadCommandValidator : AbstractValidator<MarkVendorNotificationAsReadCommand>
{
    public MarkVendorNotificationAsReadCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.NotificationId).NotEmpty();
    }
}

internal sealed class MarkVendorNotificationAsReadCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<MarkVendorNotificationAsReadCommand, VendorNotificationDto>
{
    public async Task<Result<VendorNotificationDto>> Handle(MarkVendorNotificationAsReadCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.NotificationId, out var notificationId))
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.notifications.invalid_id", "Notification id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetVendorNotificationByIdAsync(vendorId, notificationId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.notifications.not_found", "Notification not found.", ErrorCategory.NotFound));
        }

        entity.Status = "read";
        entity.ReadAt ??= DateTimeOffset.UtcNow;

        await repository.UpdateVendorNotificationAsync(entity, cancellationToken);
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

public sealed record MarkAllVendorNotificationsAsReadCommand(string VendorId) : ICommand<int>;

public sealed class MarkAllVendorNotificationsAsReadCommandValidator : AbstractValidator<MarkAllVendorNotificationsAsReadCommand>
{
    public MarkAllVendorNotificationsAsReadCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
    }
}

internal sealed class MarkAllVendorNotificationsAsReadCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<MarkAllVendorNotificationsAsReadCommand, int>
{
    public async Task<Result<int>> Handle(MarkAllVendorNotificationsAsReadCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<int>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<int>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var notifications = await repository.GetVendorNotificationsAsync(vendorId, cancellationToken);
        var unread = notifications.Where(n => n.ReadAt is null || !string.Equals(n.Status, "read", StringComparison.OrdinalIgnoreCase)).ToList();

        if (unread.Count == 0)
        {
            return Result.Success(0);
        }

        foreach (var entity in unread)
        {
            entity.Status = "read";
            entity.ReadAt ??= DateTimeOffset.UtcNow;
            await repository.UpdateVendorNotificationAsync(entity, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success(unread.Count);
    }
}

public sealed record MarkVendorNotificationAsUnreadCommand(string VendorId, string NotificationId) : ICommand<VendorNotificationDto>;

public sealed class MarkVendorNotificationAsUnreadCommandValidator : AbstractValidator<MarkVendorNotificationAsUnreadCommand>
{
    public MarkVendorNotificationAsUnreadCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.NotificationId).NotEmpty();
    }
}

internal sealed class MarkVendorNotificationAsUnreadCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<MarkVendorNotificationAsUnreadCommand, VendorNotificationDto>
{
    public async Task<Result<VendorNotificationDto>> Handle(MarkVendorNotificationAsUnreadCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.NotificationId, out var notificationId))
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.notifications.invalid_id", "Notification id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetVendorNotificationByIdAsync(vendorId, notificationId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorNotificationDto>(new Error("vendors.notifications.not_found", "Notification not found.", ErrorCategory.NotFound));
        }

        entity.Status = entity.SentAt is null ? "pending" : "sent";
        entity.ReadAt = null;

        await repository.UpdateVendorNotificationAsync(entity, cancellationToken);
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
