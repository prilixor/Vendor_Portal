using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerNotificationDto(
    Guid Id,
    string Title,
    string Body,
    string NotificationType,
    Guid? RelatedOrderId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt);

internal static class CustomerNotificationMapping
{
    internal static DateTimeOffset ToCreatedAtOffset(DateTime createdOnUtc)
    {
        var utc = createdOnUtc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(createdOnUtc, DateTimeKind.Utc)
            : createdOnUtc.ToUniversalTime();
        return new DateTimeOffset(utc, TimeSpan.Zero);
    }

    internal static CustomerNotificationDto ToDto(CustomerNotification n) => new(
        n.Id,
        n.Title,
        n.Body,
        n.NotificationType,
        n.RelatedOrderId,
        ToCreatedAtOffset(n.CreatedOnUtc),
        n.ReadAt);
}

public sealed record GetCustomerNotificationsQuery(Guid CustomerId) : IQuery<List<CustomerNotificationDto>>;

internal sealed class GetCustomerNotificationsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerNotificationsQuery, List<CustomerNotificationDto>>
{
    public async Task<Result<List<CustomerNotificationDto>>> Handle(GetCustomerNotificationsQuery request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<List<CustomerNotificationDto>>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var rows = await customers.GetCustomerNotificationsAsync(request.CustomerId, cancellationToken);
        return Result.Success(rows.ConvertAll(CustomerNotificationMapping.ToDto));
    }
}

public sealed record MarkCustomerNotificationReadCommand(Guid CustomerId, Guid NotificationId) : ICommand<CustomerNotificationDto>;

internal sealed class MarkCustomerNotificationReadCommandHandler(ICustomerRepository customers)
    : ICommandHandler<MarkCustomerNotificationReadCommand, CustomerNotificationDto>
{
    public async Task<Result<CustomerNotificationDto>> Handle(MarkCustomerNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var n = await customers.GetCustomerNotificationByIdAsync(request.CustomerId, request.NotificationId, cancellationToken);
        if (n is null)
            return Result.Failure<CustomerNotificationDto>(new Error("customers.notification_not_found", "Notification not found.", ErrorCategory.NotFound));

        if (n.ReadAt is null)
        {
            n.ReadAt = DateTimeOffset.UtcNow;
            n.ModifiedOnUtc = DateTime.UtcNow;
            await customers.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(CustomerNotificationMapping.ToDto(n));
    }
}

public sealed record MarkAllCustomerNotificationsReadCommand(Guid CustomerId) : ICommand<int>;

internal sealed class MarkAllCustomerNotificationsReadCommandHandler(ICustomerRepository customers)
    : ICommandHandler<MarkAllCustomerNotificationsReadCommand, int>
{
    public async Task<Result<int>> Handle(MarkAllCustomerNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<int>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var updated = await customers.MarkAllCustomerNotificationsReadAsync(request.CustomerId, cancellationToken);
        if (updated > 0)
            await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(updated);
    }
}

public sealed record CreateCustomerNotificationCommand(
    Guid CustomerId,
    string NotificationType,
    string Title,
    string Body,
    Guid? RelatedOrderId = null) : ICommand<CustomerNotificationDto>;

internal sealed class CreateCustomerNotificationCommandHandler(ICustomerRepository customers)
    : ICommandHandler<CreateCustomerNotificationCommand, CustomerNotificationDto>
{
    public async Task<Result<CustomerNotificationDto>> Handle(CreateCustomerNotificationCommand request, CancellationToken cancellationToken)
    {
        var entity = new CustomerNotification
        {
            CustomerId = request.CustomerId,
            NotificationType = request.NotificationType,
            Title = request.Title,
            Body = request.Body,
            RelatedOrderId = request.RelatedOrderId,
            CreatedOnUtc = DateTime.UtcNow
        };

        await customers.AddCustomerNotificationAsync(entity, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(CustomerNotificationMapping.ToDto(entity));
    }
}
