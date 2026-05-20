using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerRegisteredDto(Guid Id, string Email, string FullName);

public sealed record RegisterCustomerCommand(string Email, string Password, string FullName, string? Phone)
    : ICommand<CustomerRegisteredDto>;

public sealed class RegisterCustomerCommandValidator : AbstractValidator<RegisterCustomerCommand>
{
    public RegisterCustomerCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.FullName).NotEmpty().MinimumLength(2).MaximumLength(200);
    }
}

internal sealed class RegisterCustomerCommandHandler(
    ICustomerRepository customers,
    IPasswordHasherService passwordHasher)
    : ICommandHandler<RegisterCustomerCommand, CustomerRegisteredDto>
{
    public async Task<Result<CustomerRegisteredDto>> Handle(RegisterCustomerCommand request, CancellationToken cancellationToken)
    {
        var existing = await customers.GetCustomerByEmailAsync(request.Email, cancellationToken);
        if (existing is not null)
        {
            return Result.Failure<CustomerRegisteredDto>(new Error(
                "customers.email_exists",
                "An account already exists for this email.",
                ErrorCategory.Validation));
        }

        var entity = new Customer
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHasher.HashPassword(request.Password),
            FullName = request.FullName.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            IsEmailVerified = true,
        };

        await customers.AddCustomerAsync(entity, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = entity.Id,
                Title = "Welcome to the portal",
                Body = "Browse listings and request your first rental.",
                NotificationType = CustomerNotificationTypes.Welcome,
            },
            cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerRegisteredDto(entity.Id, entity.Email, entity.FullName));
    }
}

public sealed record CustomerProfileDto(Guid Id, string Email, string FullName, string? Phone);

public sealed record GetCustomerProfileQuery(Guid CustomerId) : IQuery<CustomerProfileDto>;

internal sealed class GetCustomerProfileQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerProfileQuery, CustomerProfileDto>
{
    public async Task<Result<CustomerProfileDto>> Handle(GetCustomerProfileQuery request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<CustomerProfileDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        return Result.Success(new CustomerProfileDto(c.Id, c.Email, c.FullName, c.Phone));
    }
}

public sealed record UpdateCustomerProfileCommand(Guid CustomerId, string FullName, string? Phone) : ICommand<CustomerProfileDto>;

public sealed class UpdateCustomerProfileCommandValidator : AbstractValidator<UpdateCustomerProfileCommand>
{
    public UpdateCustomerProfileCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MinimumLength(2).MaximumLength(200);
    }
}

internal sealed class UpdateCustomerProfileCommandHandler(ICustomerRepository customers)
    : ICommandHandler<UpdateCustomerProfileCommand, CustomerProfileDto>
{
    public async Task<Result<CustomerProfileDto>> Handle(UpdateCustomerProfileCommand request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<CustomerProfileDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        c.FullName = request.FullName.Trim();
        c.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        await customers.UpdateCustomerAsync(c, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerProfileDto(c.Id, c.Email, c.FullName, c.Phone));
    }
}

public sealed record CustomerAddressDto(Guid Id, string? Label, string Line1, string City, string State, string Postal, bool IsDefault);

public sealed record GetCustomerAddressesQuery(Guid CustomerId) : IQuery<List<CustomerAddressDto>>;

internal sealed class GetCustomerAddressesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerAddressesQuery, List<CustomerAddressDto>>
{
    public async Task<Result<List<CustomerAddressDto>>> Handle(GetCustomerAddressesQuery request, CancellationToken cancellationToken)
    {
        var list = await customers.GetCustomerAddressesAsync(request.CustomerId, cancellationToken);
        return Result.Success(list.ConvertAll(a =>
            new CustomerAddressDto(a.Id, a.Label, a.Line1, a.City, a.State, a.Postal, a.IsDefault)));
    }
}

public sealed record AddCustomerAddressCommand(Guid CustomerId, string? Label, string Line1, string City, string State, string Postal, bool SetAsDefault)
    : ICommand<CustomerAddressDto>;

public sealed class AddCustomerAddressCommandValidator : AbstractValidator<AddCustomerAddressCommand>
{
    public AddCustomerAddressCommandValidator()
    {
        RuleFor(x => x.Line1).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(120);
        RuleFor(x => x.State).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Postal).NotEmpty().MaximumLength(30);
    }
}

internal sealed class AddCustomerAddressCommandHandler(ICustomerRepository customers)
    : ICommandHandler<AddCustomerAddressCommand, CustomerAddressDto>
{
    public async Task<Result<CustomerAddressDto>> Handle(AddCustomerAddressCommand request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<CustomerAddressDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        if (request.SetAsDefault)
        {
            var existing = await customers.GetCustomerAddressesAsync(request.CustomerId, cancellationToken);
            foreach (var a in existing.Where(x => x.IsDefault))
            {
                a.IsDefault = false;
                await customers.UpdateCustomerAddressAsync(a, cancellationToken);
            }
        }

        var addr = new CustomerAddress
        {
            CustomerId = request.CustomerId,
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim(),
            Line1 = request.Line1.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            Postal = request.Postal.Trim(),
            IsDefault = request.SetAsDefault,
        };

        await customers.AddCustomerAddressAsync(addr, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerAddressDto(addr.Id, addr.Label, addr.Line1, addr.City, addr.State, addr.Postal, addr.IsDefault));
    }
}

public sealed record DeleteCustomerAddressCommand(Guid CustomerId, Guid AddressId) : ICommand;

internal sealed class DeleteCustomerAddressCommandHandler(ICustomerRepository customers)
    : ICommandHandler<DeleteCustomerAddressCommand>
{
    public async Task<Result> Handle(DeleteCustomerAddressCommand request, CancellationToken cancellationToken)
    {
        var a = await customers.GetCustomerAddressByIdAsync(request.CustomerId, request.AddressId, cancellationToken);
        if (a is null)
            return Result.Failure(new Error("customers.address_not_found", "Address not found.", ErrorCategory.NotFound));

        a.IsDeleted = true;
        a.DeletedAt = DateTimeOffset.UtcNow;
        await customers.UpdateCustomerAddressAsync(a, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

public sealed record GetCustomerCatalogListingsQuery(string? Category, string? Search) : IQuery<List<CustomerCatalogListingDto>>;

internal sealed class GetCustomerCatalogListingsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerCatalogListingsQuery, List<CustomerCatalogListingDto>>
{
    public async Task<Result<List<CustomerCatalogListingDto>>> Handle(GetCustomerCatalogListingsQuery request, CancellationToken cancellationToken)
    {
        var list = await customers.GetPublicCatalogListingsAsync(request.Category, request.Search, cancellationToken);
        return Result.Success(list);
    }
}

public sealed record CartLineRequest(Guid ListingId, int Quantity, int RentalDays);

public sealed record PlaceCustomerOrdersCommand(
    Guid CustomerId,
    Guid? CustomerAddressId,
    string DeliveryOption,
    IReadOnlyList<CartLineRequest> Lines) : ICommand<List<CustomerOrderDto>>;

public sealed class PlaceCustomerOrdersCommandValidator : AbstractValidator<PlaceCustomerOrdersCommand>
{
    public PlaceCustomerOrdersCommandValidator()
    {
        RuleFor(x => x.DeliveryOption).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Lines).NotEmpty();
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.ListingId).NotEmpty();
            l.RuleFor(x => x.Quantity).GreaterThan(0);
            l.RuleFor(x => x.RentalDays).GreaterThan(0).LessThanOrEqualTo(366);
        });
    }
}

public sealed record CustomerOrderDto(
    Guid Id,
    string OrderNumber,
    Guid ListingId,
    string ListingTitle,
    string VendorName,
    string Status,
    DateOnly? StartDate,
    DateOnly? EndDate,
    decimal TotalAmount,
    decimal DepositAmount,
    int Quantity,
    int RentalDays,
    string? ListingPrimaryImageUrl);

internal sealed class PlaceCustomerOrdersCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<PlaceCustomerOrdersCommand, List<CustomerOrderDto>>
{
    public async Task<Result<List<CustomerOrderDto>>> Handle(PlaceCustomerOrdersCommand request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<List<CustomerOrderDto>>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        if (request.CustomerAddressId is { } aid)
        {
            var addr = await customers.GetCustomerAddressByIdAsync(request.CustomerId, aid, cancellationToken);
            if (addr is null)
                return Result.Failure<List<CustomerOrderDto>>(new Error("customers.address_not_found", "Address not found.", ErrorCategory.Validation));
        }

        const decimal serviceFeePerLine = 12m;
        var dtos = new List<CustomerOrderDto>();

        foreach (var line in request.Lines)
        {
            var agg = await customers.GetListingForCustomerAsync(line.ListingId, cancellationToken);
            if (agg is null)
                return Result.Failure<List<CustomerOrderDto>>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

            if (!CustomerCatalogListingStatus.IsVisibleOnPublicCatalog(agg.ListingStatus))
                return Result.Failure<List<CustomerOrderDto>>(new Error("customers.listing_unavailable", "Listing is not available.", ErrorCategory.Validation));

            if (!string.Equals(agg.VendorAccountStatus, "active", StringComparison.OrdinalIgnoreCase))
                return Result.Failure<List<CustomerOrderDto>>(new Error("customers.vendor_inactive", "Vendor is not accepting rentals.", ErrorCategory.Validation));

            var trackedListing = await vendors.GetVendorProductListingByIdAsync(agg.VendorId, agg.ListingId, cancellationToken);
            if (trackedListing is null)
                return Result.Failure<List<CustomerOrderDto>>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

            var inventory = await vendors.GetVendorInventoryByListingIdAsync(agg.ListingId, cancellationToken);
            var available = inventory?.AvailableQuantity ?? trackedListing.AvailableQuantity;
            if (available < line.Quantity)
                return Result.Failure<List<CustomerOrderDto>>(new Error(
                    "customers.insufficient_stock",
                    $"Not enough availability for \"{trackedListing.ListingTitle}\".",
                    ErrorCategory.Validation));

            var depositPerUnit = agg.CategoryDepositRequired ? agg.SecurityDeposit : 0m;
            var subtotal = agg.DailyRent * line.RentalDays * line.Quantity;
            var deposit = depositPerUnit * line.Quantity;
            var fees = serviceFeePerLine;
            var total = subtotal + deposit + fees;

            var orderNumber = await GenerateUniqueOrderNumber(customers, cancellationToken);
            var start = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var end = start.AddDays(line.RentalDays);

            var order = new CustomerRentalOrder
            {
                OrderNumber = orderNumber,
                CustomerId = request.CustomerId,
                VendorProductListingId = agg.ListingId,
                CustomerAddressId = request.CustomerAddressId,
                Quantity = line.Quantity,
                RentalDays = line.RentalDays,
                DeliveryOption = string.IsNullOrWhiteSpace(request.DeliveryOption) ? "standard" : request.DeliveryOption.Trim(),
                Status = "pending",
                SubtotalAmount = subtotal,
                DepositAmount = deposit,
                ServiceFeeAmount = fees,
                TotalAmount = total,
                StartDate = start,
                EndDate = end,
            };

            await customers.AddCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = request.CustomerId,
                    Title = $"Order {order.OrderNumber} submitted",
                    Body = $"Your rental request for \"{trackedListing.ListingTitle}\" is pending vendor confirmation.",
                    NotificationType = "order_pending",
                    RelatedOrderId = order.Id,
                },
                cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            if (inventory is not null)
            {
                inventory.AvailableQuantity -= line.Quantity;
                inventory.ReservedQuantity += line.Quantity;
                await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);

                var movement = new VendorInventoryMovement
                {
                    VendorInventoryId = inventory.Id,
                    MovementType = "reserved",
                    Quantity = line.Quantity,
                    ReferenceType = "customer_rental_order",
                    ReferenceId = order.Id,
                    Notes = $"Customer order {order.OrderNumber}",
                    EventAt = DateTimeOffset.UtcNow,
                };
                await vendors.AddVendorInventoryMovementAsync(movement, cancellationToken);
            }
            else
            {
                trackedListing.AvailableQuantity -= line.Quantity;
                await vendors.UpdateVendorProductListingAsync(trackedListing, cancellationToken);
            }

            await vendors.SaveChangesAsync(cancellationToken);

            var vendorDisplay = string.IsNullOrWhiteSpace(agg.VendorBusinessName) ? "Vendor" : agg.VendorBusinessName!;
            var primaryImg = agg.ImageUrls.Count > 0 ? agg.ImageUrls[0] : null;
            dtos.Add(new CustomerOrderDto(
                order.Id,
                order.OrderNumber,
                order.VendorProductListingId,
                trackedListing.ListingTitle,
                vendorDisplay,
                CustomerOrderStatusMapper.ToDisplay(order.Status),
                order.StartDate,
                order.EndDate,
                order.TotalAmount,
                order.DepositAmount,
                order.Quantity,
                order.RentalDays,
                primaryImg));
        }

        return Result.Success(dtos);
    }

    private static async Task<string> GenerateUniqueOrderNumber(ICustomerRepository customers, CancellationToken cancellationToken)
    {
        var rnd = new Random();
        for (var i = 0; i < 20; i++)
        {
            var n = $"CRT-{DateTime.UtcNow:yyyyMMdd}-{rnd.Next(100000, 999999)}";
            if (!await customers.OrderNumberExistsAsync(n, cancellationToken))
                return n;
        }

        return $"CRT-{Guid.NewGuid():N}"[..24];
    }
}

public sealed record GetCustomerOrdersQuery(Guid CustomerId) : IQuery<List<CustomerOrderDto>>;

internal sealed class GetCustomerOrdersQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrdersQuery, List<CustomerOrderDto>>
{
    public async Task<Result<List<CustomerOrderDto>>> Handle(GetCustomerOrdersQuery request, CancellationToken cancellationToken)
    {
        var rows = await customers.GetCustomerOrdersAsync(request.CustomerId, cancellationToken);
        var list = new List<CustomerOrderDto>();
        foreach (var row in rows)
        {
            var o = row.Order;
            var listing = row.Listing;
            var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
            var title = listing?.ListingTitle ?? "Listing unavailable";
            list.Add(new CustomerOrderDto(
                o.Id,
                o.OrderNumber,
                o.VendorProductListingId,
                title,
                vendorName ?? "Vendor",
                CustomerOrderStatusMapper.ToDisplay(o.Status),
                o.StartDate,
                o.EndDate,
                o.TotalAmount,
                o.DepositAmount,
                o.Quantity,
                o.RentalDays,
                row.ListingPrimaryImageUrl));
        }

        return Result.Success(list);
    }
}

public sealed record GetCustomerOrderDetailQuery(Guid CustomerId, Guid OrderId) : IQuery<CustomerOrderDto>;

internal sealed class GetCustomerOrderDetailQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrderDetailQuery, CustomerOrderDto>
{
    public async Task<Result<CustomerOrderDto>> Handle(GetCustomerOrderDetailQuery request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        var listing = row.Listing;
        var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
        var title = listing?.ListingTitle ?? "Listing unavailable";
        return Result.Success(new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            title,
            vendorName ?? "Vendor",
            CustomerOrderStatusMapper.ToDisplay(o.Status),
            o.StartDate,
            o.EndDate,
            o.TotalAmount,
            o.DepositAmount,
            o.Quantity,
            o.RentalDays,
            row.ListingPrimaryImageUrl));
    }
}

internal static class CustomerOrderStatusMapper
{
    public static string ToDisplay(string status) => status.ToLowerInvariant() switch
    {
        "pending" => "Pending",
        "confirmed" => "Confirmed",
        "in_transit" => "In transit",
        "active" => "Active",
        "returned" => "Returned",
        "cancelled" => "Cancelled",
        _ => status
    };
}

/// <summary>Cancel pending rental request (local state only until vendor workflow exists).</summary>
public sealed record CancelCustomerOrderCommand(Guid CustomerId, Guid OrderId) : ICommand<CustomerOrderDto>;

internal sealed class CancelCustomerOrderCommandHandler(ICustomerRepository customers, IVendorOnboardingRepository vendors)
    : ICommandHandler<CancelCustomerOrderCommand, CustomerOrderDto>
{
    public async Task<Result<CustomerOrderDto>> Handle(CancelCustomerOrderCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        if (!string.Equals(o.Status, "pending", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_cancellable", "Only pending orders can be cancelled.", ErrorCategory.Validation));

        var agg = await customers.GetListingForCustomerAsync(o.VendorProductListingId, cancellationToken);
        if (agg is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

        var inventory = await vendors.GetVendorInventoryByListingIdAsync(o.VendorProductListingId, cancellationToken);
        if (inventory is not null)
        {
            inventory.AvailableQuantity += o.Quantity;
            inventory.ReservedQuantity = Math.Max(0, inventory.ReservedQuantity - o.Quantity);
            await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
            var movement = new VendorInventoryMovement
            {
                VendorInventoryId = inventory.Id,
                MovementType = "reservation_released",
                Quantity = o.Quantity,
                ReferenceType = "customer_rental_order",
                ReferenceId = o.Id,
                Notes = $"Cancellation {o.OrderNumber}",
                EventAt = DateTimeOffset.UtcNow,
            };
            await vendors.AddVendorInventoryMovementAsync(movement, cancellationToken);
        }
        else
        {
            var listing = await vendors.GetVendorProductListingByIdAsync(agg.VendorId, o.VendorProductListingId, cancellationToken);
            if (listing is not null)
            {
                listing.AvailableQuantity += o.Quantity;
                await vendors.UpdateVendorProductListingAsync(listing, cancellationToken);
            }
        }

        o.Status = "cancelled";
        await customers.UpdateCustomerRentalOrderAsync(o, cancellationToken);

        var listingTitleForNotif = row.Listing?.ListingTitle ?? agg.ListingTitle ?? "Listing unavailable";
        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = request.CustomerId,
                Title = $"Order {o.OrderNumber} cancelled",
                Body = $"Your rental request for \"{listingTitleForNotif}\" was cancelled.",
                NotificationType = CustomerNotificationTypes.OrderCancelled,
                RelatedOrderId = o.Id,
            },
            cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        var listingNav = row.Listing;
        var vendorName = listingNav?.Vendor?.Profile?.BusinessName ?? listingNav?.Vendor?.Email ?? agg.VendorBusinessName ?? "Vendor";
        var listingTitle = listingNav?.ListingTitle ?? agg.ListingTitle ?? "Listing unavailable";
        return Result.Success(new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            listingTitle,
            vendorName ?? "Vendor",
            "Cancelled",
            o.StartDate,
            o.EndDate,
            o.TotalAmount,
            o.DepositAmount,
            o.Quantity,
            o.RentalDays,
            row.ListingPrimaryImageUrl));
    }
}
