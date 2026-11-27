using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record EquipmentEmergencyDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    string? CustomerPhone,
    string VendorName,
    string ProductName,
    string Reason,
    string ReasonLabel,
    string? Note,
    string Status,
    bool VendorNotified,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AcknowledgedAt = null,
    DateTimeOffset? ResolvedAt = null);

public sealed record CustomerEquipmentEmergencyStateDto(
    bool Eligible,
    EquipmentEmergencyDto? Emergency);

public sealed record EmergencyListingSnapshot(
    Guid VendorId,
    string VendorName,
    string ProductName,
    bool EmergencySupportEnabled);

public sealed record GetCustomerEquipmentEmergencyQuery(Guid CustomerId, Guid OrderId)
    : IQuery<CustomerEquipmentEmergencyStateDto>;

internal sealed class GetCustomerEquipmentEmergencyQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerEquipmentEmergencyQuery, CustomerEquipmentEmergencyStateDto>
{
    public async Task<Result<CustomerEquipmentEmergencyStateDto>> Handle(
        GetCustomerEquipmentEmergencyQuery request,
        CancellationToken cancellationToken)
    {
        var order = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<CustomerEquipmentEmergencyStateDto>(
                new Error("emergency.order_not_found", "Order not found.", ErrorCategory.NotFound));
        }

        var eligible = await EquipmentEmergencyRules.IsEligibleAsync(customers, order, cancellationToken);
        var latest = await customers.GetLatestOrderEmergencyAsync(order.Order.Id, cancellationToken);
        return Result.Success(new CustomerEquipmentEmergencyStateDto(eligible, latest is null ? null : EquipmentEmergencyMapper.ToDto(latest)));
    }
}

public sealed record RaiseEquipmentEmergencyCommand(Guid CustomerId, Guid OrderId, string Reason, string? Note)
    : ICommand<EquipmentEmergencyDto>;

public sealed class RaiseEquipmentEmergencyCommandValidator : AbstractValidator<RaiseEquipmentEmergencyCommand>
{
    public RaiseEquipmentEmergencyCommandValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Reason).Must(EquipmentEmergencyReasons.IsKnown)
            .WithMessage("Choose what is wrong with the equipment.");
        RuleFor(x => x.Note).MaximumLength(1000);
    }
}

internal sealed class RaiseEquipmentEmergencyCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IPlatformEmergencySettingsService emergencySettings)
    : ICommandHandler<RaiseEquipmentEmergencyCommand, EquipmentEmergencyDto>
{
    public async Task<Result<EquipmentEmergencyDto>> Handle(
        RaiseEquipmentEmergencyCommand request,
        CancellationToken cancellationToken)
    {
        var order = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (order is null)
        {
            return Result.Failure<EquipmentEmergencyDto>(
                new Error("emergency.order_not_found", "Order not found.", ErrorCategory.NotFound));
        }

        if (!EquipmentEmergencyRules.IsWithCustomer(order.Order.Status))
        {
            return Result.Failure<EquipmentEmergencyDto>(
                new Error("emergency.not_delivered", "Emergency is available after the equipment is delivered.", ErrorCategory.Validation));
        }

        var listing = order.Listing is null
            ? null
            : await customers.GetEmergencyListingSnapshotAsync(order.Listing.Id, cancellationToken);
        if (listing is null || !listing.EmergencySupportEnabled)
        {
            return Result.Failure<EquipmentEmergencyDto>(
                new Error("emergency.not_enabled", "This product does not have emergency support.", ErrorCategory.Validation));
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var reason = request.Reason.Trim().ToLowerInvariant();
        // One live emergency per order (open or acknowledged). A new one can be raised only after admin resolves it.
        var active = await customers.GetActiveOrderEmergencyAsync(order.Order.Id, cancellationToken);
        if (active is not null)
        {
            active.Reason = reason;
            active.Note = note;
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Success(EquipmentEmergencyMapper.ToDto(active));
        }

        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        var alertVendor = await emergencySettings.IsVendorAlertEnabledAsync(cancellationToken);
        var entity = new CustomerOrderEmergency
        {
            Id = Guid.CreateVersion7(),
            CustomerRentalOrderId = order.Order.Id,
            CustomerId = request.CustomerId,
            VendorId = listing.VendorId,
            OrderNumber = order.Order.OrderNumber,
            CustomerName = string.IsNullOrWhiteSpace(customer?.FullName) ? "Customer" : customer!.FullName.Trim(),
            CustomerPhone = string.IsNullOrWhiteSpace(customer?.Phone) ? null : customer!.Phone!.Trim(),
            VendorName = listing.VendorName,
            ProductName = listing.ProductName,
            Reason = reason,
            Note = note,
            Status = EquipmentEmergencyStatuses.Open,
            VendorNotified = false,
        };

        await customers.AddOrderEmergencyAsync(entity, cancellationToken);
        await customers.AddCustomerNotificationAsync(new CustomerNotification
        {
            Id = Guid.CreateVersion7(),
            CustomerId = request.CustomerId,
            Title = "Emergency sent to BlinksMed",
            Body = $"We received your emergency for {entity.ProductName} on order {entity.OrderNumber}. An admin can see it now.",
            NotificationType = CustomerNotificationTypes.EquipmentEmergency,
            RelatedOrderId = order.Order.Id,
        }, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        if (alertVendor)
        {
            var notified = await TryNotifyVendorAsync(entity, cancellationToken);
            if (notified)
            {
                entity.VendorNotified = true;
                await customers.SaveChangesAsync(cancellationToken);
            }
        }

        return Result.Success(EquipmentEmergencyMapper.ToDto(entity));
    }

    private async Task<bool> TryNotifyVendorAsync(CustomerOrderEmergency entity, CancellationToken cancellationToken)
    {
        var vendor = await vendors.GetVendorByIdAsync(entity.VendorId, cancellationToken);
        if (vendor is null)
            return false;

        var reason = EquipmentEmergencyReasons.Label(entity.Reason) ?? entity.Reason;
        // The customer's free-text note is for admin only: it can contain phone numbers or addresses.
        await vendors.AddVendorNotificationAsync(new VendorNotification
        {
            Id = Guid.CreateVersion7(),
            VendorId = entity.VendorId,
            NotificationType = "equipment_emergency",
            RelatedOrderId = entity.CustomerRentalOrderId,
            Title = "Equipment emergency",
            Message = $"Emergency on order {entity.OrderNumber} for {entity.ProductName}. {reason}.",
            Channel = "in_app",
            Status = "sent",
            SentAt = DateTimeOffset.UtcNow,
        }, cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);
        return true;
    }
}

/// <summary>
/// What a vendor may see about an emergency. Customer name, phone and address are not included,
/// and neither is the customer's free-text note (it can contain contact details), so
/// <c>Note</c> is always null for vendors.
/// </summary>
public sealed record VendorEquipmentEmergencyDto(
    Guid Id,
    string OrderNumber,
    string ProductName,
    string ReasonLabel,
    string? Note,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AcknowledgedAt,
    DateTimeOffset? ResolvedAt);

public sealed record VendorOrderEmergencyDto(VendorEquipmentEmergencyDto? Emergency);

public sealed record GetVendorOrderEmergencyQuery(Guid VendorId, Guid OrderId) : IQuery<VendorOrderEmergencyDto>;

internal sealed class GetVendorOrderEmergencyQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorOrderEmergencyQuery, VendorOrderEmergencyDto>
{
    public async Task<Result<VendorOrderEmergencyDto>> Handle(
        GetVendorOrderEmergencyQuery request,
        CancellationToken cancellationToken)
    {
        var latest = await customers.GetLatestOrderEmergencyAsync(request.OrderId, cancellationToken);

        // Only the vendor who owns the order, and only when admin chose to alert vendors for it.
        if (latest is null || latest.VendorId != request.VendorId || !latest.VendorNotified)
            return Result.Success(new VendorOrderEmergencyDto(null));

        var dto = EquipmentEmergencyMapper.ToDto(latest);
        return Result.Success(new VendorOrderEmergencyDto(new VendorEquipmentEmergencyDto(
            dto.Id,
            dto.OrderNumber,
            dto.ProductName,
            dto.ReasonLabel,
            null,
            dto.Status,
            dto.CreatedAt,
            dto.AcknowledgedAt,
            dto.ResolvedAt)));
    }
}

public sealed record PagedEquipmentEmergenciesDto(
    List<EquipmentEmergencyDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int OpenCount,
    int AcknowledgedCount,
    int ResolvedCount);

/// <summary>Paged list for the admin Equipment Emergency tab. Status: all, open, acknowledged, resolved or live.</summary>
public sealed record GetEquipmentEmergencyPageQuery(string? Status, int Page = 1, int PageSize = 15) : IQuery<PagedEquipmentEmergenciesDto>;

internal sealed class GetEquipmentEmergencyPageQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetEquipmentEmergencyPageQuery, PagedEquipmentEmergenciesDto>
{
    public async Task<Result<PagedEquipmentEmergenciesDto>> Handle(
        GetEquipmentEmergencyPageQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);
        var (items, total) = await customers.ListOrderEmergencyPageAsync(request.Status, page, pageSize, cancellationToken);
        var counts = await customers.GetEmergencyStatusCountsAsync(cancellationToken);
        return Result.Success(new PagedEquipmentEmergenciesDto(
            items.Select(EquipmentEmergencyMapper.ToDto).ToList(),
            total,
            page,
            pageSize,
            counts.Open,
            counts.Acknowledged,
            counts.Resolved));
    }
}

public sealed record GetRecentEquipmentEmergenciesQuery(int Take = 30, Guid? OrderId = null, string? Status = null) : IQuery<List<EquipmentEmergencyDto>>;

internal sealed class GetRecentEquipmentEmergenciesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetRecentEquipmentEmergenciesQuery, List<EquipmentEmergencyDto>>
{
    public async Task<Result<List<EquipmentEmergencyDto>>> Handle(
        GetRecentEquipmentEmergenciesQuery request,
        CancellationToken cancellationToken)
    {
        var take = Math.Clamp(request.Take, 1, 50);
        var rows = await customers.ListRecentOrderEmergenciesAsync(take, request.OrderId, request.Status, cancellationToken);
        return Result.Success(rows.Select(EquipmentEmergencyMapper.ToDto).ToList());
    }
}

public sealed record AcknowledgeEquipmentEmergencyCommand(Guid EmergencyId, Guid AdminId) : ICommand<EquipmentEmergencyDto>;

internal sealed class AcknowledgeEquipmentEmergencyCommandHandler(ICustomerRepository customers)
    : ICommandHandler<AcknowledgeEquipmentEmergencyCommand, EquipmentEmergencyDto>
{
    public async Task<Result<EquipmentEmergencyDto>> Handle(
        AcknowledgeEquipmentEmergencyCommand request,
        CancellationToken cancellationToken)
    {
        var entity = await customers.GetOrderEmergencyByIdAsync(request.EmergencyId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<EquipmentEmergencyDto>(
                new Error("emergency.not_found", "Emergency not found.", ErrorCategory.NotFound));
        }

        // Only an open emergency can be acknowledged. Acknowledged or resolved ones are returned unchanged.
        if (string.Equals(entity.Status, EquipmentEmergencyStatuses.Open, StringComparison.OrdinalIgnoreCase))
        {
            entity.Status = EquipmentEmergencyStatuses.Acknowledged;
            entity.AcknowledgedAt = DateTimeOffset.UtcNow;
            entity.AcknowledgedByAdminId = request.AdminId;
            await customers.AddCustomerNotificationAsync(new CustomerNotification
            {
                Id = Guid.CreateVersion7(),
                CustomerId = entity.CustomerId,
                Title = "BlinksMed received your emergency",
                Body = $"Our team has seen your emergency for {entity.ProductName} on order {entity.OrderNumber} and is working on it. If the patient is in danger, call 108 or 112.",
                NotificationType = CustomerNotificationTypes.EquipmentEmergency,
                RelatedOrderId = entity.CustomerRentalOrderId,
            }, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(EquipmentEmergencyMapper.ToDto(entity));
    }
}

public sealed record ResolveEquipmentEmergencyCommand(Guid EmergencyId, Guid AdminId) : ICommand<EquipmentEmergencyDto>;

internal sealed class ResolveEquipmentEmergencyCommandHandler(ICustomerRepository customers)
    : ICommandHandler<ResolveEquipmentEmergencyCommand, EquipmentEmergencyDto>
{
    public async Task<Result<EquipmentEmergencyDto>> Handle(
        ResolveEquipmentEmergencyCommand request,
        CancellationToken cancellationToken)
    {
        var entity = await customers.GetOrderEmergencyByIdAsync(request.EmergencyId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<EquipmentEmergencyDto>(
                new Error("emergency.not_found", "Emergency not found.", ErrorCategory.NotFound));
        }

        if (EquipmentEmergencyStatuses.IsActive(entity.Status))
        {
            var now = DateTimeOffset.UtcNow;
            // Resolving straight from open also counts as seen.
            if (string.Equals(entity.Status, EquipmentEmergencyStatuses.Open, StringComparison.OrdinalIgnoreCase))
            {
                entity.AcknowledgedAt = now;
                entity.AcknowledgedByAdminId = request.AdminId;
            }

            entity.Status = EquipmentEmergencyStatuses.Resolved;
            entity.ResolvedAt = now;
            entity.ResolvedByAdminId = request.AdminId;
            await customers.AddCustomerNotificationAsync(new CustomerNotification
            {
                Id = Guid.CreateVersion7(),
                CustomerId = entity.CustomerId,
                Title = "Emergency marked resolved",
                Body = $"BlinksMed marked the emergency for {entity.ProductName} on order {entity.OrderNumber} as resolved. If the problem comes back, tap Emergency again.",
                NotificationType = CustomerNotificationTypes.EquipmentEmergency,
                RelatedOrderId = entity.CustomerRentalOrderId,
            }, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(EquipmentEmergencyMapper.ToDto(entity));
    }
}

internal static class EquipmentEmergencyRules
{
    public static bool IsWithCustomer(string? status)
    {
        var compact = (status ?? string.Empty).Trim().ToLowerInvariant().Replace(' ', '_');
        return compact is "active" or "delivered";
    }

    public static async Task<bool> IsEligibleAsync(
        ICustomerRepository customers,
        CustomerRentalOrderWithListing order,
        CancellationToken cancellationToken)
    {
        if (!IsWithCustomer(order.Order.Status) || order.Listing is null)
            return false;

        var listing = await customers.GetEmergencyListingSnapshotAsync(order.Listing.Id, cancellationToken);
        return listing?.EmergencySupportEnabled == true;
    }
}

internal static class EquipmentEmergencyMapper
{
    public static EquipmentEmergencyDto ToDto(CustomerOrderEmergency entity)
    {
        var created = entity.CreatedOnUtc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(entity.CreatedOnUtc, DateTimeKind.Utc)
            : entity.CreatedOnUtc.ToUniversalTime();
        return new EquipmentEmergencyDto(
            entity.Id,
            entity.CustomerRentalOrderId,
            entity.OrderNumber,
            entity.CustomerName,
            entity.CustomerPhone,
            entity.VendorName,
            entity.ProductName,
            entity.Reason,
            EquipmentEmergencyReasons.Label(entity.Reason) ?? entity.Reason,
            entity.Note,
            entity.Status,
            entity.VendorNotified,
            new DateTimeOffset(created, TimeSpan.Zero),
            entity.AcknowledgedAt,
            entity.ResolvedAt);
    }
}
