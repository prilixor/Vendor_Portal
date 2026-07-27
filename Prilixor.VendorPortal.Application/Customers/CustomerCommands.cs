using FluentValidation;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
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

public sealed record CustomerAddressDto(
    Guid Id,
    string? Label,
    string Line1,
    string City,
    string State,
    string Postal,
    decimal? Latitude,
    decimal? Longitude,
    bool IsDefault);

public sealed record GetCustomerAddressesQuery(Guid CustomerId) : IQuery<List<CustomerAddressDto>>;

internal sealed class GetCustomerAddressesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerAddressesQuery, List<CustomerAddressDto>>
{
    public async Task<Result<List<CustomerAddressDto>>> Handle(GetCustomerAddressesQuery request, CancellationToken cancellationToken)
    {
        var list = await customers.GetCustomerAddressesAsync(request.CustomerId, cancellationToken);
        return Result.Success(list.ConvertAll(a =>
            new CustomerAddressDto(a.Id, a.Label, a.Line1, a.City, a.State, a.Postal, a.Latitude, a.Longitude, a.IsDefault)));
    }
}

public sealed record AddCustomerAddressCommand(
    Guid CustomerId,
    string? Label,
    string Line1,
    string City,
    string State,
    string Postal,
    decimal? Latitude,
    decimal? Longitude,
    bool SetAsDefault)
    : ICommand<CustomerAddressDto>;

public sealed class AddCustomerAddressCommandValidator : AbstractValidator<AddCustomerAddressCommand>
{
    public AddCustomerAddressCommandValidator()
    {
        RuleFor(x => x.Line1).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(120);
        RuleFor(x => x.State).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Postal).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Latitude).InclusiveBetween(-90m, 90m).When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude).InclusiveBetween(-180m, 180m).When(x => x.Longitude.HasValue);
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
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsDefault = request.SetAsDefault,
        };

        await customers.AddCustomerAddressAsync(addr, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerAddressDto(
            addr.Id,
            addr.Label,
            addr.Line1,
            addr.City,
            addr.State,
            addr.Postal,
            addr.Latitude,
            addr.Longitude,
            addr.IsDefault));
    }
}

public sealed record UpdateCustomerAddressCommand(
    Guid CustomerId,
    Guid AddressId,
    string? Label,
    string Line1,
    string City,
    string State,
    string Postal,
    decimal? Latitude,
    decimal? Longitude,
    bool SetAsDefault)
    : ICommand<CustomerAddressDto>;

public sealed class UpdateCustomerAddressCommandValidator : AbstractValidator<UpdateCustomerAddressCommand>
{
    public UpdateCustomerAddressCommandValidator()
    {
        RuleFor(x => x.Line1).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(120);
        RuleFor(x => x.State).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Postal).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Latitude).InclusiveBetween(-90m, 90m).When(x => x.Latitude.HasValue);
        RuleFor(x => x.Longitude).InclusiveBetween(-180m, 180m).When(x => x.Longitude.HasValue);
    }
}

internal sealed class UpdateCustomerAddressCommandHandler(ICustomerRepository customers)
    : ICommandHandler<UpdateCustomerAddressCommand, CustomerAddressDto>
{
    public async Task<Result<CustomerAddressDto>> Handle(UpdateCustomerAddressCommand request, CancellationToken cancellationToken)
    {
        var c = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (c is null || c.IsDeleted)
            return Result.Failure<CustomerAddressDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var addr = await customers.GetCustomerAddressByIdAsync(request.CustomerId, request.AddressId, cancellationToken);
        if (addr is null)
            return Result.Failure<CustomerAddressDto>(new Error("customers.address_not_found", "Address not found.", ErrorCategory.NotFound));

        if (request.SetAsDefault)
        {
            var existing = await customers.GetCustomerAddressesAsync(request.CustomerId, cancellationToken);
            foreach (var a in existing.Where(x => x.IsDefault && x.Id != request.AddressId))
            {
                a.IsDefault = false;
                await customers.UpdateCustomerAddressAsync(a, cancellationToken);
            }
        }

        addr.Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();
        addr.Line1 = request.Line1.Trim();
        addr.City = request.City.Trim();
        addr.State = request.State.Trim();
        addr.Postal = request.Postal.Trim();
        addr.Latitude = request.Latitude;
        addr.Longitude = request.Longitude;
        addr.IsDefault = request.SetAsDefault;

        await customers.UpdateCustomerAddressAsync(addr, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerAddressDto(
            addr.Id,
            addr.Label,
            addr.Line1,
            addr.City,
            addr.State,
            addr.Postal,
            addr.Latitude,
            addr.Longitude,
            addr.IsDefault));
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

public sealed record GetCustomerCatalogListingsQuery(string? Category, string? Search, Guid? CustomerId = null) : IQuery<List<CustomerCatalogListingDto>>;

internal sealed class GetCustomerCatalogListingsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerCatalogListingsQuery, List<CustomerCatalogListingDto>>
{
    public async Task<Result<List<CustomerCatalogListingDto>>> Handle(GetCustomerCatalogListingsQuery request, CancellationToken cancellationToken)
    {
        var list = await customers.GetPublicCatalogListingsAsync(request.Category, request.Search, request.CustomerId, cancellationToken);
        return Result.Success(list);
    }
}

public sealed record CartLineRequest(
    Guid ListingId,
    int Quantity,
    int RentalDays,
    string RentalPeriodUnit = "day",
    string OrderType = "rent",
    Guid? ProductVariantId = null,
    Guid? DoctorId = null,
    Guid? HospitalId = null,
    string? ContactNumber = null,
    string? ReferenceNumber = null);

public sealed record CustomerOrderQuoteDto(
    decimal SubtotalAmount,
    decimal DepositAmount,
    decimal ServiceFeeAmount,
    decimal DistanceFeeAmount,
    decimal ExpressFeeAmount,
    decimal GstAmount,
    decimal TotalAmount,
    List<CustomerBuySuggestionDto> BuySuggestions);

public sealed record CustomerBuySuggestionDto(
    Guid ListingId,
    string ListingTitle,
    decimal RentAmount,
    decimal BuyAmount,
    decimal SavingsAmount);

public sealed record QuoteCustomerOrdersCommand(
    Guid CustomerId,
    Guid? CustomerAddressId,
    string DeliveryOption,
    IReadOnlyList<CartLineRequest> Lines) : IQuery<CustomerOrderQuoteDto>;

public sealed record PlaceCustomerOrdersCommand(
    Guid CustomerId,
    Guid? CustomerAddressId,
    string DeliveryOption,
    IReadOnlyList<CartLineRequest> Lines,
    Guid? PlacedByAdminId = null) : ICommand<PlaceCustomerOrdersResultDto>;

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
            l.RuleFor(x => x.RentalDays).GreaterThanOrEqualTo(0).LessThanOrEqualTo(366);
            l.RuleFor(x => x.RentalPeriodUnit).Must(RentalPeriod.IsValid)
                .WithMessage("Rental period unit must be day, week, or month.");
            l.RuleFor(x => x.OrderType).NotEmpty().Must(x =>
                string.Equals(x, "rent", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(x, "buy", StringComparison.OrdinalIgnoreCase));
        });
    }
}

public sealed record FailedCustomerOrderLineDto(
    Guid ListingId,
    int Quantity,
    int RentalDays,
    string OrderType,
    string ReasonCode,
    string Message,
    IReadOnlyList<VariantStockSuggestionDto>? VariantSuggestions = null,
    string RentalPeriodUnit = "day");

/// <summary>Alternate packaging size (SKU) that has stock, offered when the requested size cannot be fulfilled.</summary>
public sealed record VariantStockSuggestionDto(
    Guid ProductVariantId,
    string Sku,
    decimal SizeValue,
    string SizeUnit,
    decimal BuyPrice,
    int AvailableQuantity);

public sealed record PlaceCustomerOrdersResultDto(
    List<CustomerOrderDto> PlacedOrders,
    List<FailedCustomerOrderLineDto> FailedLines);

public sealed record CustomerOrderDto(
    Guid Id,
    string OrderNumber,
    Guid ListingId,
    string ListingTitle,
    string VendorName,
    Guid VendorId,
    string Status,
    DateOnly? StartDate,
    DateOnly? EndDate,
    decimal TotalAmount,
    decimal DepositAmount,
    decimal ServiceFeeAmount,
    decimal DistanceFeeAmount,
    decimal ExpressFeeAmount,
    decimal GstAmount,
    string OrderType,
    int Quantity,
    int RentalDays,
    string RentalPeriodUnit,
    string? ListingPrimaryImageUrl,
    Guid? ProductVariantId = null,
    Guid? DoctorId = null,
    string? DoctorName = null,
    string? DoctorSpecialization = null,
    Guid? HospitalId = null,
    string? HospitalName = null,
    string? HospitalCity = null,
    string? DoctorContactNumber = null,
    string? DoctorUniqueCode = null);
internal static class CustomerOrderPricingRules
{
    public static string NormalizeDeliveryOption(string? option) =>
        string.IsNullOrWhiteSpace(option) ? "standard" : option.Trim().ToLowerInvariant();

    public static string NormalizeOrderType(string? orderType) =>
        string.Equals(orderType?.Trim(), "buy", StringComparison.OrdinalIgnoreCase) ? "buy" : "rent";

    /// <summary>
    /// Unit buy price used for rent-vs-buy comparison (variant price when selected).
    /// </summary>
    public static decimal ResolveUnitBuyPrice(
        VendorProductListingAggregate aggregate,
        CartLineRequest line,
        CustomerPricingOptions options)
    {
        if (line.ProductVariantId.HasValue && line.ProductVariantId.Value != Guid.Empty)
        {
            var variant = aggregate.Variants.FirstOrDefault(v => v.Id == line.ProductVariantId.Value.ToString());
            if (variant != null)
                return variant.BuyPrice;
        }

        return aggregate.BuyPrice ?? (aggregate.DailyRent * options.BuyPriceMultiplierFromDailyRent);
    }

    /// <summary>
    /// When rental subtotal ≥ buy total and buy is enabled, force Buy (customer owns the item).
    /// </summary>
    public static CartLineRequest ApplyRentExceedsBuyRule(
        VendorProductListingAggregate aggregate,
        CartLineRequest line,
        CustomerPricingOptions options,
        out bool convertedToBuy)
    {
        convertedToBuy = false;
        var orderType = NormalizeOrderType(line.OrderType);
        if (orderType != "rent" || !aggregate.IsBuyEnabled)
            return line;

        var rentSubtotal = CalculateLineSubtotal("rent", aggregate, line, options);
        var buyTotal = ResolveUnitBuyPrice(aggregate, line, options) * line.Quantity;
        if (buyTotal <= 0m || rentSubtotal < buyTotal)
            return line;

        convertedToBuy = true;
        return line with { OrderType = "buy", RentalDays = 0, RentalPeriodUnit = RentalPeriod.Day };
    }

    public static bool RequiresAddress(string deliveryOption) =>
        !string.Equals(deliveryOption, "vendor_pickup", StringComparison.OrdinalIgnoreCase);

    public static decimal CalculateExpressFee(string deliveryOption, CustomerPricingOptions options) =>
        string.Equals(deliveryOption, "express", StringComparison.OrdinalIgnoreCase) ? options.ExpressDeliveryFeePerLine : 0m;

    public static decimal CalculateDistanceFee(
        decimal distanceKm,
        CustomerPricingOptions options)
    {
        if (distanceKm <= options.FreeDistanceKm)
            return 0m;

        var extra = distanceKm - options.FreeDistanceKm;
        if (extra <= 0m)
            return 0m;

        var extraKm = Math.Ceiling((double)extra);
        return decimal.Round((decimal)extraKm * options.DistanceFeePerKm, 2, MidpointRounding.AwayFromZero);
    }

    public static decimal CalculateGst(decimal taxableAmount, decimal? gstPercent, CustomerPricingOptions options)
    {
        var effectiveGst = gstPercent ?? options.GstPercent;
        if (taxableAmount <= 0 || effectiveGst <= 0)
            return 0m;

        return decimal.Round((taxableAmount * effectiveGst) / 100m, 2, MidpointRounding.AwayFromZero);
    }

    public static decimal CalculateLineSubtotal(
        string orderType,
        VendorProductListingAggregate aggregate,
        CartLineRequest line,
        CustomerPricingOptions options)
    {
        if (line.ProductVariantId.HasValue && line.ProductVariantId.Value != Guid.Empty)
        {
            var variant = aggregate.Variants.FirstOrDefault(v => v.Id == line.ProductVariantId.Value.ToString());
            if (variant != null)
            {
                if (string.Equals(orderType, "buy", StringComparison.OrdinalIgnoreCase))
                {
                    return variant.BuyPrice * line.Quantity;
                }
                return variant.BuyPrice * line.RentalDays * line.Quantity;
            }
        }

        if (string.Equals(orderType, "buy", StringComparison.OrdinalIgnoreCase))
        {
            var unitBuyPrice = aggregate.BuyPrice ?? (aggregate.DailyRent * options.BuyPriceMultiplierFromDailyRent);
            return unitBuyPrice * line.Quantity;
        }

        var customerRate = RentalPeriod.SelectCustomerRate(
            line.RentalPeriodUnit, aggregate.DailyRent, aggregate.WeeklyRent, aggregate.MonthlyRent);
        return customerRate * line.RentalDays * line.Quantity;
    }

    public static decimal CalculateVendorLineSubtotal(
        string orderType,
        VendorProductListingAggregate aggregate,
        CartLineRequest line,
        CustomerPricingOptions options)
    {
        if (line.ProductVariantId.HasValue && line.ProductVariantId.Value != Guid.Empty)
        {
            var variant = aggregate.Variants.FirstOrDefault(v => v.Id == line.ProductVariantId.Value.ToString());
            if (variant != null)
            {
                if (string.Equals(orderType, "buy", StringComparison.OrdinalIgnoreCase))
                {
                    return variant.VendorPrice * line.Quantity;
                }
                return variant.VendorPrice * line.RentalDays * line.Quantity;
            }
        }

        if (string.Equals(orderType, "buy", StringComparison.OrdinalIgnoreCase))
        {
            var unitVendorBuyPrice = aggregate.VendorBuyPrice ?? (aggregate.VendorDailyRent * options.BuyPriceMultiplierFromDailyRent);
            return unitVendorBuyPrice * line.Quantity;
        }

        var vendorRate = RentalPeriod.SelectVendorRate(
            line.RentalPeriodUnit, aggregate.VendorDailyRent, aggregate.VendorWeeklyRent, aggregate.VendorMonthlyRent);
        return vendorRate * line.RentalDays * line.Quantity;
    }

    public static decimal CalculateDistanceKm(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        const double earthRadiusKm = 6371d;
        static double ToRadians(decimal angle) => (double)angle * Math.PI / 180d;

        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a =
            Math.Sin(dLat / 2d) * Math.Sin(dLat / 2d) +
            Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
            Math.Sin(dLon / 2d) * Math.Sin(dLon / 2d);
        a = Math.Max(0d, Math.Min(1d, a));
        var c = 2d * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1d - a));
        return decimal.Round((decimal)(earthRadiusKm * c), 2, MidpointRounding.AwayFromZero);
    }

    public static DeliveryDistanceResult ResolveDeliveryDistance(
        decimal customerLat,
        decimal customerLng,
        VendorProductListingAggregate aggregate,
        List<VendorServiceArea> vendorServiceAreas,
        CustomerPricingOptions options)
    {
        var activeAreas = vendorServiceAreas
            .Where(a => a.IsActive && !a.IsDeleted)
            .ToList();

        if (activeAreas.Count > 0)
        {
            var withinAreaDistances = activeAreas
                .Select(area =>
                {
                    var distanceKm = CalculateDistanceKm(
                        customerLat,
                        customerLng,
                        area.CenterLatitude,
                        area.CenterLongitude);
                    return new { distanceKm, area.ServiceRadiusKm };
                })
                .Where(x => !options.EnforceVendorServiceRadius || x.distanceKm <= x.ServiceRadiusKm)
                .Select(x => x.distanceKm)
                .OrderBy(x => x)
                .ToList();

            if (withinAreaDistances.Count > 0)
            {
                return DeliveryDistanceResult.Success(withinAreaDistances[0]);
            }

            if (options.EnforceVendorServiceRadius)
            {
                return DeliveryDistanceResult.Fail(
                    "customers.out_of_service_area",
                    "Selected address is outside vendor service area.");
            }
        }

        if (aggregate.VendorLatitude.HasValue && aggregate.VendorLongitude.HasValue)
        {
            var distanceKm = CalculateDistanceKm(
                customerLat,
                customerLng,
                aggregate.VendorLatitude.Value,
                aggregate.VendorLongitude.Value);

            if (options.EnforceVendorServiceRadius && distanceKm > options.DefaultServiceRadiusKm)
            {
                return DeliveryDistanceResult.Fail(
                    "customers.out_of_service_area",
                    "Selected address is outside vendor service area.");
            }

            return DeliveryDistanceResult.Success(distanceKm);
        }

        return DeliveryDistanceResult.Fail(
            "customers.vendor_location_missing",
            "Vendor delivery location is not configured.");
    }
}

internal sealed record DeliveryDistanceResult(bool IsSuccess, decimal DistanceKm, string? ErrorCode, string? ErrorMessage)
{
    public static DeliveryDistanceResult Success(decimal distanceKm) => new(true, distanceKm, null, null);
    public static DeliveryDistanceResult Fail(string errorCode, string errorMessage) => new(false, 0m, errorCode, errorMessage);
}

internal sealed class QuoteCustomerOrdersCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions)
    : IQueryHandler<QuoteCustomerOrdersCommand, CustomerOrderQuoteDto>
{
    public async Task<Result<CustomerOrderQuoteDto>> Handle(QuoteCustomerOrdersCommand request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var deliveryOption = CustomerOrderPricingRules.NormalizeDeliveryOption(request.DeliveryOption);
        CustomerAddress? address = null;
        if (request.CustomerAddressId is { } aid)
        {
            address = await customers.GetCustomerAddressByIdAsync(request.CustomerId, aid, cancellationToken);
            if (address is null)
                return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.address_not_found", "Address not found.", ErrorCategory.Validation));
        }
        else if (CustomerOrderPricingRules.RequiresAddress(deliveryOption))
        {
            return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.address_required", "Please select a delivery address.", ErrorCategory.Validation));
        }

        if (CustomerOrderPricingRules.RequiresAddress(deliveryOption) &&
            (!address?.Latitude.HasValue ?? true || !address.Longitude.HasValue))
        {
            return Result.Failure<CustomerOrderQuoteDto>(new Error(
                "customers.address_pin_required",
                "Selected address is missing map location. Please add an address with a pinned map location.",
                ErrorCategory.Validation));
        }

        var options = pricingOptions.Value;
        decimal subtotalAmount = 0m;
        decimal depositAmount = 0m;
        decimal serviceFeeAmount = 0m;
        decimal distanceFeeAmount = 0m;
        decimal expressFeeAmount = 0m;
        decimal gstAmount = 0m;
        var buySuggestions = new List<CustomerBuySuggestionDto>();
        var vendorAreasByVendorId = new Dictionary<Guid, List<VendorServiceArea>>();

        foreach (var line in request.Lines)
        {
            var orderType = CustomerOrderPricingRules.NormalizeOrderType(line.OrderType);
            if (orderType == "rent" && line.RentalDays <= 0)
            {
                return Result.Failure<CustomerOrderQuoteDto>(new Error(
                    "customers.rental_days_required",
                    "Rental days must be greater than zero for rent orders.",
                    ErrorCategory.Validation));
            }

            var agg = await customers.GetListingForCustomerAsync(line.ListingId, cancellationToken);
            if (agg is null)
                return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

            if (orderType == "buy" && !agg.IsBuyEnabled)
            {
                return Result.Failure<CustomerOrderQuoteDto>(new Error(
                    "customers.buy_not_enabled",
                    $"Buy is not enabled for \"{agg.ListingTitle}\".",
                    ErrorCategory.Validation));
            }
            if (orderType == "rent" && !agg.IsRentEnabled)
            {
                return Result.Failure<CustomerOrderQuoteDto>(new Error(
                    "customers.rent_not_enabled",
                    $"Rent is not enabled for \"{agg.ListingTitle}\".",
                    ErrorCategory.Validation));
            }

            if (!CustomerCatalogListingStatus.IsVisibleOnPublicCatalog(agg.ListingStatus))
                return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.listing_unavailable", "Listing is not available.", ErrorCategory.Validation));

            if (!string.Equals(agg.VendorAccountStatus, "active", StringComparison.OrdinalIgnoreCase))
                return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.vendor_inactive", "Vendor is not accepting rentals.", ErrorCategory.Validation));

            var trackedListing = await vendors.GetVendorProductListingByIdAsync(agg.VendorId, agg.ListingId, cancellationToken);
            if (trackedListing is null)
                return Result.Failure<CustomerOrderQuoteDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

            if (line.ProductVariantId.HasValue)
            {
                var variantInv = await vendors.GetVariantInventoryByListingIdAsync(agg.ListingId, cancellationToken);
                var specificVariant = variantInv.FirstOrDefault(vi => vi.ProductVariantId == line.ProductVariantId.Value);
                var varAvailable = specificVariant?.AvailableQuantity ?? 0;
                if (varAvailable < line.Quantity)
                    return Result.Failure<CustomerOrderQuoteDto>(new Error(
                        "customers.insufficient_stock",
                        $"Not enough availability for \"{trackedListing.ListingTitle}\" ({specificVariant?.ProductVariant?.Sku ?? "Selected size"}).",
                        ErrorCategory.Validation));
            }
            else
            {
                var inventory = await vendors.GetVendorInventoryByListingIdAsync(agg.ListingId, cancellationToken);
                var available = inventory?.AvailableQuantity ?? trackedListing.AvailableQuantity;
                if (available < line.Quantity)
                    return Result.Failure<CustomerOrderQuoteDto>(new Error(
                        "customers.insufficient_stock",
                        $"Not enough availability for \"{trackedListing.ListingTitle}\".",
                        ErrorCategory.Validation));
            }

            var depositPerUnit = agg.CategoryDepositRequired ? agg.SecurityDeposit : 0m;
            var lineSubtotal = CustomerOrderPricingRules.CalculateLineSubtotal(orderType, agg, line, options);
            if (orderType == "rent")
            {
                var equivalentBuyAmount = decimal.Round(
                    CustomerOrderPricingRules.ResolveUnitBuyPrice(agg, line, options) * line.Quantity,
                    2,
                    MidpointRounding.AwayFromZero);
                if (equivalentBuyAmount > 0 && lineSubtotal >= equivalentBuyAmount)
                {
                    buySuggestions.Add(new CustomerBuySuggestionDto(
                        agg.ListingId,
                        trackedListing.ListingTitle,
                        decimal.Round(lineSubtotal, 2, MidpointRounding.AwayFromZero),
                        equivalentBuyAmount,
                        decimal.Round(Math.Max(0, lineSubtotal - equivalentBuyAmount), 2, MidpointRounding.AwayFromZero)));
                }
            }
            var lineDeposit = orderType == "buy" ? 0m : depositPerUnit * line.Quantity;
            var lineExpressFee = CustomerOrderPricingRules.CalculateExpressFee(deliveryOption, options);
            decimal lineDistanceFee = 0m;

            if (CustomerOrderPricingRules.RequiresAddress(deliveryOption))
            {
                if (!vendorAreasByVendorId.TryGetValue(agg.VendorId, out var vendorAreas))
                {
                    vendorAreas = await vendors.GetVendorServiceAreasAsync(agg.VendorId, cancellationToken);
                    vendorAreasByVendorId[agg.VendorId] = vendorAreas;
                }

                var distanceResult = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address!.Latitude!.Value,
                    address.Longitude!.Value,
                    agg,
                    vendorAreas,
                    options);
                if (!distanceResult.IsSuccess)
                {
                    return Result.Failure<CustomerOrderQuoteDto>(new Error(
                        distanceResult.ErrorCode ?? "customers.delivery_distance_error",
                        distanceResult.ErrorMessage ?? "Unable to validate delivery distance.",
                        ErrorCategory.Validation));
                }

                lineDistanceFee = CustomerOrderPricingRules.CalculateDistanceFee(distanceResult.DistanceKm, options);
            }
            var lineServiceFee = options.BaseServiceFeePerLine + lineExpressFee + lineDistanceFee;
            var lineGst = CustomerOrderPricingRules.CalculateGst(lineSubtotal + lineServiceFee, agg.GstPercent, options);

            subtotalAmount += lineSubtotal;
            depositAmount += lineDeposit;
            serviceFeeAmount += lineServiceFee;
            distanceFeeAmount += lineDistanceFee;
            expressFeeAmount += lineExpressFee;
            gstAmount += lineGst;
        }

        return Result.Success(new CustomerOrderQuoteDto(
            decimal.Round(subtotalAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(depositAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(serviceFeeAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(distanceFeeAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(expressFeeAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(gstAmount, 2, MidpointRounding.AwayFromZero),
            decimal.Round(subtotalAmount + depositAmount + serviceFeeAmount + gstAmount, 2, MidpointRounding.AwayFromZero),
            buySuggestions));
    }
}

internal sealed class PlaceCustomerOrdersCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions)
    : ICommandHandler<PlaceCustomerOrdersCommand, PlaceCustomerOrdersResultDto>
{
    public async Task<Result<PlaceCustomerOrdersResultDto>> Handle(PlaceCustomerOrdersCommand request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<PlaceCustomerOrdersResultDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var deliveryOption = CustomerOrderPricingRules.NormalizeDeliveryOption(request.DeliveryOption);
        CustomerAddress? address = null;
        if (request.CustomerAddressId is { } aid)
        {
            address = await customers.GetCustomerAddressByIdAsync(request.CustomerId, aid, cancellationToken);
            if (address is null)
                return Result.Failure<PlaceCustomerOrdersResultDto>(new Error("customers.address_not_found", "Address not found.", ErrorCategory.Validation));
        }
        else if (CustomerOrderPricingRules.RequiresAddress(deliveryOption))
        {
            return Result.Failure<PlaceCustomerOrdersResultDto>(new Error("customers.address_required", "Please select a delivery address.", ErrorCategory.Validation));
        }

        if (CustomerOrderPricingRules.RequiresAddress(deliveryOption) &&
            (!address?.Latitude.HasValue ?? true || !address.Longitude.HasValue))
        {
            return Result.Failure<PlaceCustomerOrdersResultDto>(new Error(
                "customers.address_pin_required",
                "Selected address is missing map location. Please add an address with a pinned map location.",
                ErrorCategory.Validation));
        }

        var options = pricingOptions.Value;
        var placed = new List<CustomerOrderDto>();
        var failed = new List<FailedCustomerOrderLineDto>();
        var vendorAreasByVendorId = new Dictionary<Guid, List<VendorServiceArea>>();
        var baseOrderNumber = await GenerateUniqueOrderNumber(customers, cancellationToken);
        var lineIndex = 0;

        // NOTE: remaining body unchanged — marker for PlacedByAdminId already set on order entity below
        // We keep the original method body by not duplicating; only the order creation site was patched.

        foreach (var line in request.Lines)
        {
            var agg = await customers.GetListingForCustomerAsync(line.ListingId, cancellationToken);
            if (agg is null)
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    CustomerOrderPricingRules.NormalizeOrderType(line.OrderType),
                    "customers.listing_not_found",
                    "Listing not found."));
                continue;
            }

            var effectiveLine = CustomerOrderPricingRules.ApplyRentExceedsBuyRule(agg, line, options, out _);
            var orderType = CustomerOrderPricingRules.NormalizeOrderType(effectiveLine.OrderType);
            if (orderType == "rent" && effectiveLine.RentalDays <= 0)
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.rental_days_required",
                    "Rental days must be greater than zero for rent orders."));
                continue;
            }

            // Reject rent when cost ≥ buy but buy is disabled (cannot auto-convert).
            if (CustomerOrderPricingRules.NormalizeOrderType(line.OrderType) == "rent"
                && !agg.IsBuyEnabled
                && CustomerOrderPricingRules.ResolveUnitBuyPrice(agg, line, options) > 0)
            {
                var rentSub = CustomerOrderPricingRules.CalculateLineSubtotal("rent", agg, line, options);
                var buyTot = CustomerOrderPricingRules.ResolveUnitBuyPrice(agg, line, options) * line.Quantity;
                if (rentSub >= buyTot)
                {
                    failed.Add(new FailedCustomerOrderLineDto(
                        line.ListingId,
                        line.Quantity,
                        line.RentalDays,
                        "rent",
                        "customers.rent_exceeds_buy",
                        $"Rental cost for \"{agg.ListingTitle}\" meets or exceeds the item value. Choose a shorter rental period."));
                    continue;
                }
            }

            if (orderType == "buy" && !agg.IsBuyEnabled)
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.buy_not_enabled",
                    $"Buy is not enabled for \"{agg.ListingTitle}\"."));
                continue;
            }
            if (orderType == "rent" && !agg.IsRentEnabled)
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.rent_not_enabled",
                    $"Rent is not enabled for \"{agg.ListingTitle}\"."));
                continue;
            }

            if (!CustomerCatalogListingStatus.IsVisibleOnPublicCatalog(agg.ListingStatus))
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.listing_unavailable",
                    "Listing is not available."));
                continue;
            }

            if (!string.Equals(agg.VendorAccountStatus, "active", StringComparison.OrdinalIgnoreCase))
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.vendor_inactive",
                    "Vendor is not accepting orders."));
                continue;
            }

            var trackedListing = await vendors.GetVendorProductListingByIdAsync(agg.VendorId, agg.ListingId, cancellationToken);
            if (trackedListing is null)
            {
                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.listing_not_found",
                    "Listing not found."));
                continue;
            }

            if (line.ProductVariantId.HasValue)
            {
                var variantInv = await vendors.GetVariantInventoryByListingIdAsync(agg.ListingId, cancellationToken);
                var specificVariant = variantInv.FirstOrDefault(vi => vi.ProductVariantId == line.ProductVariantId.Value);
                var varAvailable = specificVariant?.AvailableQuantity ?? 0;
                if (varAvailable < line.Quantity)
                {
                    var suggestions = BuildVariantSuggestions(agg, variantInv, line.ProductVariantId.Value);
                    var suggestionHint = suggestions.Count > 0
                        ? " Other sizes are in stock — see suggestions."
                        : string.Empty;
                    failed.Add(new FailedCustomerOrderLineDto(
                        line.ListingId,
                        line.Quantity,
                        line.RentalDays,
                        orderType,
                        "customers.insufficient_stock",
                        $"Not enough availability for \"{trackedListing.ListingTitle}\" ({specificVariant?.ProductVariant?.Sku ?? "Selected size"}).{suggestionHint}",
                        suggestions));
                    continue;
                }
            }
            else
            {
                var inventory = await vendors.GetVendorInventoryByListingIdAsync(agg.ListingId, cancellationToken);
                var available = inventory?.AvailableQuantity ?? trackedListing.AvailableQuantity;
                if (available < line.Quantity)
                {
                    failed.Add(new FailedCustomerOrderLineDto(
                        line.ListingId,
                        line.Quantity,
                        line.RentalDays,
                        orderType,
                        "customers.insufficient_stock",
                        $"Not enough availability for \"{trackedListing.ListingTitle}\"."));
                    continue;
                }
            }

            // Doctor reference is optional (Admin-curated Unique ID lookup on customer side later).
            // Do not block place-order when category has prescription_required.

            var depositPerUnit = agg.CategoryDepositRequired ? agg.SecurityDeposit : 0m;
            var subtotal = CustomerOrderPricingRules.CalculateLineSubtotal(orderType, agg, effectiveLine, options);
            var vendorSubtotal = CustomerOrderPricingRules.CalculateVendorLineSubtotal(orderType, agg, effectiveLine, options);
            var deposit = orderType == "buy" ? 0m : depositPerUnit * effectiveLine.Quantity;
            var expressFee = CustomerOrderPricingRules.CalculateExpressFee(deliveryOption, options);

            decimal distanceFee = 0m;
            if (CustomerOrderPricingRules.RequiresAddress(deliveryOption))
            {
                if (!vendorAreasByVendorId.TryGetValue(agg.VendorId, out var vendorAreas))
                {
                    vendorAreas = await vendors.GetVendorServiceAreasAsync(agg.VendorId, cancellationToken);
                    vendorAreasByVendorId[agg.VendorId] = vendorAreas;
                }

                var distanceResult = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address!.Latitude!.Value,
                    address.Longitude!.Value,
                    agg,
                    vendorAreas,
                    options);
                if (!distanceResult.IsSuccess)
                {
                    failed.Add(new FailedCustomerOrderLineDto(
                        line.ListingId,
                        line.Quantity,
                        line.RentalDays,
                        orderType,
                        distanceResult.ErrorCode ?? "customers.delivery_distance_error",
                        distanceResult.ErrorMessage ?? "Unable to validate delivery distance."));
                    continue;
                }

                distanceFee = CustomerOrderPricingRules.CalculateDistanceFee(distanceResult.DistanceKm, options);
            }

            var fees = options.BaseServiceFeePerLine + expressFee + distanceFee;
            var gstAmount = CustomerOrderPricingRules.CalculateGst(subtotal + fees, agg.GstPercent, options);
            var total = subtotal + deposit + fees + gstAmount;

            var orderNumber = $"{baseOrderNumber}-{lineIndex + 1:D2}";
            lineIndex++;
            var start = DateOnly.FromDateTime(DateTime.UtcNow.Date);
            var periodUnit = RentalPeriod.Normalize(effectiveLine.RentalPeriodUnit);
            var end = orderType == "buy"
                ? start
                : RentalPeriod.AddPeriods(start, periodUnit, effectiveLine.RentalDays);

            var order = new CustomerRentalOrder
            {
                OrderNumber = orderNumber,
                CustomerId = request.CustomerId,
                VendorProductListingId = agg.ListingId,
                CustomerAddressId = request.CustomerAddressId,
                Quantity = effectiveLine.Quantity,
                RentalDays = orderType == "buy" ? 0 : effectiveLine.RentalDays,
                RentalPeriodUnit = orderType == "buy" ? RentalPeriod.Day : periodUnit,
                OrderType = orderType,
                DeliveryOption = deliveryOption,
                Status = "awaiting_vendor_acceptance",
                SubtotalAmount = subtotal,
                VendorSubtotalAmount = vendorSubtotal,
                DepositAmount = deposit,
                ServiceFeeAmount = fees,
                DistanceFeeAmount = distanceFee,
                ExpressFeeAmount = expressFee,
                GstAmount = gstAmount,
                TotalAmount = total,
                StartDate = start,
                EndDate = end,
                ProductVariantId = effectiveLine.ProductVariantId,
                PlacedByAdminId = request.PlacedByAdminId,
            };

            if (effectiveLine.DoctorId.HasValue)
            {
                var doctor = await customers.GetDoctorByIdAsync(effectiveLine.DoctorId.Value, cancellationToken);
                if (doctor is null || !doctor.IsActive)
                {
                    failed.Add(new FailedCustomerOrderLineDto(
                        line.ListingId,
                        line.Quantity,
                        line.RentalDays,
                        orderType,
                        "customers.doctor_not_found",
                        "Doctor reference was not found or is inactive."));
                    continue;
                }

                order.DoctorReference = new CustomerOrderDoctorReference
                {
                    DoctorId = doctor.Id,
                };
            }

            await customers.AddCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            var candidateListings = await customers.GetCandidateListingsByProductIdAsync(agg.ProductId, cancellationToken);
            var eligibleCandidates = new List<(VendorProductListingAggregate Candidate, decimal DistanceKm)>();
            foreach (var candidate in candidateListings.Where(c => c.VendorId != Guid.Empty))
            {
                var candidateListing = await vendors.GetVendorProductListingByIdAsync(candidate.VendorId, candidate.ListingId, cancellationToken);
                if (candidateListing is null)
                    continue;

                if (line.ProductVariantId.HasValue)
                {
                    var variantInv = await vendors.GetVariantInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
                    var specificVariant = variantInv.FirstOrDefault(vi => vi.ProductVariantId == line.ProductVariantId.Value);
                    var varAvailable = specificVariant?.AvailableQuantity ?? 0;
                    if (varAvailable < line.Quantity)
                        continue;
                }
                else
                {
                    var candidateInventory = await vendors.GetVendorInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
                    var candidateAvailable = candidateInventory?.AvailableQuantity ?? candidateListing.AvailableQuantity;
                    if (candidateAvailable < line.Quantity)
                        continue;
                }

                decimal distanceKm = 0m;
                if (CustomerOrderPricingRules.RequiresAddress(deliveryOption))
                {
                    if (!vendorAreasByVendorId.TryGetValue(candidate.VendorId, out var vendorAreas))
                    {
                        vendorAreas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                        vendorAreasByVendorId[candidate.VendorId] = vendorAreas;
                    }

                    var candidateDistance = CustomerOrderPricingRules.ResolveDeliveryDistance(
                        address!.Latitude!.Value,
                        address.Longitude!.Value,
                        candidate,
                        vendorAreas,
                        options);
                    if (!candidateDistance.IsSuccess)
                        continue;

                    distanceKm = candidateDistance.DistanceKm;
                }

                eligibleCandidates.Add((candidate, distanceKm));
            }

            var ranked = eligibleCandidates
                .OrderBy(x => x.DistanceKm)
                .ThenByDescending(x => x.Candidate.InventoryAvailable)
                .Take(Math.Max(1, options.MaxDispatchVendorsPerLine))
                .ToList();

            var now = DateTimeOffset.UtcNow;
            for (var i = 0; i < ranked.Count; i++)
            {
                var candidate = ranked[i].Candidate;
                var offer = new CustomerOrderVendorOffer
                {
                    CustomerRentalOrderId = order.Id,
                    VendorId = candidate.VendorId,
                    VendorProductListingId = candidate.ListingId,
                    OfferRank = i + 1,
                    Status = "pending",
                    ExpiresAt = now.AddMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes)),
                };
                await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
            }
            await customers.SaveChangesAsync(cancellationToken);

            if (ranked.Count == 0)
            {
                order.Status = "dispatch_failed";
                await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
                await customers.SaveChangesAsync(cancellationToken);

                failed.Add(new FailedCustomerOrderLineDto(
                    line.ListingId,
                    line.Quantity,
                    line.RentalDays,
                    orderType,
                    "customers.dispatch_no_vendor",
                    "No eligible vendor available right now."));
                continue;
            }

            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = request.CustomerId,
                    Title = $"Order {order.OrderNumber} submitted",
                    Body = $"Your {orderType} request for \"{trackedListing.ListingTitle}\" is awaiting vendor acceptance.",
                    NotificationType = "order_pending",
                    RelatedOrderId = order.Id,
                },
                cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            foreach (var r in ranked)
            {
                var candidate = r.Candidate;
                await vendors.AddVendorNotificationAsync(new VendorNotification
                {
                    VendorId = candidate.VendorId,
                    NotificationType = "dispatch_offer",
                    Title = $"New order request {order.OrderNumber}",
                    Message = $"You have a new {orderType} request for \"{trackedListing.ListingTitle}\".",
                    Channel = "in_app",
                    Status = "sent",
                    SentAt = DateTimeOffset.UtcNow
                }, cancellationToken);
            }

            await vendors.SaveChangesAsync(cancellationToken);

            var vendorDisplay = string.IsNullOrWhiteSpace(agg.VendorBusinessName) ? "Vendor" : agg.VendorBusinessName!;
            var primaryImg = agg.ImageUrls.Count > 0 ? agg.ImageUrls[0] : null;
            var placementTitle = trackedListing.ListingTitle;
            if (order.ProductVariantId.HasValue && agg.Variants != null)
            {
                var variant = agg.Variants.FirstOrDefault(v => string.Equals(v.Id, order.ProductVariantId.Value.ToString(), StringComparison.OrdinalIgnoreCase));
                if (variant != null)
                {
                    placementTitle += $" ({Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(variant.SizeValue, variant.SizeUnit)})";
                }
            }
            placed.Add(new CustomerOrderDto(
                order.Id,
                order.OrderNumber,
                order.VendorProductListingId,
                placementTitle,
                vendorDisplay,
                agg.VendorId,
                CustomerOrderStatusMapper.ToDisplay(order.Status),
                order.StartDate,
                order.EndDate,
                order.TotalAmount,
                order.DepositAmount,
                order.ServiceFeeAmount,
                order.DistanceFeeAmount,
                order.ExpressFeeAmount,
                order.GstAmount,
                order.OrderType,
                order.Quantity,
                order.RentalDays,
                order.RentalPeriodUnit,
                primaryImg,
                ProductVariantId: order.ProductVariantId,
                DoctorId: order.DoctorReference?.DoctorId,
                HospitalId: null));
        }

        if (request.PlacedByAdminId is Guid adminId && placed.Count > 0)
        {
            await vendors.AddAdminAuditLogAsync(new Domain.Vendors.AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = adminId,
                ActionType = "CUSTOMER_ORDER_PLACED_BY_ADMIN",
                EntityType = "Customer",
                EntityId = request.CustomerId,
                Notes = $"Placed {placed.Count} order(s); failed={failed.Count}"
            }, cancellationToken);
            await vendors.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(new PlaceCustomerOrdersResultDto(placed, failed));
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

    /// <summary>
    /// Builds alternate packaging-size suggestions for a chemical listing when the requested size (SKU)
    /// cannot be fulfilled. Returns sibling variants of the same listing that currently have stock,
    /// ordered by most-available first, so the customer can be nudged toward a size we can actually ship.
    /// </summary>
    private static List<VariantStockSuggestionDto> BuildVariantSuggestions(
        VendorProductListingAggregate agg,
        IReadOnlyCollection<VendorVariantInventory> variantInventory,
        Guid requestedVariantId)
    {
        return variantInventory
            .Where(vi => vi.ProductVariantId != requestedVariantId && vi.AvailableQuantity > 0)
            .OrderByDescending(vi => vi.AvailableQuantity)
            .Select(vi => new VariantStockSuggestionDto(
                vi.ProductVariantId,
                vi.ProductVariant?.Sku ?? string.Empty,
                vi.ProductVariant?.SizeValue ?? 0m,
                vi.ProductVariant?.SizeUnit ?? string.Empty,
                agg.Variants.FirstOrDefault(v => v.Id == vi.ProductVariantId.ToString())?.BuyPrice ?? 0m,
                vi.AvailableQuantity))
            .ToList();
    }
}

public sealed record GetCustomerOrdersQuery(Guid CustomerId) : IQuery<List<CustomerOrderDto>>;

internal sealed class GetCustomerOrdersQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrdersQuery, List<CustomerOrderDto>>
{
    public async Task<Result<List<CustomerOrderDto>>> Handle(GetCustomerOrdersQuery request, CancellationToken cancellationToken)
    {
        var rows = await customers.GetCustomerOrdersAsync(request.CustomerId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var changed = false;
        foreach (var row in rows)
        {
            changed |= await DispatchStateReconciler.ReconcileAwaitingOrderAsync(customers, row.Order.Id, now, cancellationToken);
        }

        if (changed)
        {
            await customers.SaveChangesAsync(cancellationToken);
            rows = await customers.GetCustomerOrdersAsync(request.CustomerId, cancellationToken);
        }

        var list = new List<CustomerOrderDto>();
        foreach (var row in rows)
        {
            var o = row.Order;
            var listing = row.Listing;
            var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
            var title = listing?.ListingTitle ?? "Listing unavailable";
            if (!string.IsNullOrEmpty(row.VariantDescription))
            {
                title += $" ({row.VariantDescription})";
            }
            list.Add(new CustomerOrderDto(
                o.Id,
                o.OrderNumber,
                o.VendorProductListingId,
                title,
                vendorName ?? "Vendor",
                listing?.VendorId ?? Guid.Empty,
                CustomerOrderStatusMapper.ToDisplay(o.Status),
                o.StartDate,
                o.EndDate,
                o.TotalAmount,
                o.DepositAmount,
                o.ServiceFeeAmount,
                o.DistanceFeeAmount,
                o.ExpressFeeAmount,
                o.GstAmount,
                o.OrderType,
                o.Quantity,
                o.RentalDays,
                o.RentalPeriodUnit,
                row.ListingPrimaryImageUrl,
                ProductVariantId: o.ProductVariantId,
                DoctorId: row.Doctor?.Id,
                DoctorName: row.Doctor?.FullName,
                DoctorSpecialization: row.Doctor?.Specialization,
                HospitalId: null,
                HospitalName: null,
                HospitalCity: null,
                DoctorContactNumber: row.Doctor?.ContactNumber,
                DoctorUniqueCode: row.Doctor?.UniqueCode));
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
        var changed = await DispatchStateReconciler.ReconcileAwaitingOrderAsync(customers, request.OrderId, DateTimeOffset.UtcNow, cancellationToken);
        if (changed)
            await customers.SaveChangesAsync(cancellationToken);

        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        var listing = row.Listing;
        var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
        var title = listing?.ListingTitle ?? "Listing unavailable";
        if (!string.IsNullOrEmpty(row.VariantDescription))
        {
            title += $" ({row.VariantDescription})";
        }
        return Result.Success(new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            title,
            vendorName ?? "Vendor",
            listing?.VendorId ?? Guid.Empty,
            CustomerOrderStatusMapper.ToDisplay(o.Status),
            o.StartDate,
            o.EndDate,
            o.TotalAmount,
            o.DepositAmount,
            o.ServiceFeeAmount,
            o.DistanceFeeAmount,
            o.ExpressFeeAmount,
            o.GstAmount,
            o.OrderType,
            o.Quantity,
            o.RentalDays,
            o.RentalPeriodUnit,
            row.ListingPrimaryImageUrl,
            ProductVariantId: o.ProductVariantId,
            DoctorId: row.Doctor?.Id,
            DoctorName: row.Doctor?.FullName,
            DoctorSpecialization: row.Doctor?.Specialization,
            HospitalId: null,
            HospitalName: null,
            HospitalCity: null,
            DoctorContactNumber: row.Doctor?.ContactNumber,
            DoctorUniqueCode: row.Doctor?.UniqueCode));
    }
}

internal static class CustomerOrderStatusMapper
{
    public static string ToDisplay(string status) => status.ToLowerInvariant() switch
    {
        "pending" => "Pending",
        "awaiting_vendor_acceptance" => "Awaiting vendor acceptance",
        "confirmed" => "Confirmed",
        "in_transit" => "In transit",
        "active" => "Active",
        "returned" => "Returned",
        "dispatch_failed" => "Dispatch failed",
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
        var isCancellable =
            string.Equals(o.Status, "pending", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(o.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase);
        if (!isCancellable)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_cancellable", "Only pending orders can be cancelled.", ErrorCategory.Validation));

        var agg = await customers.GetListingForCustomerAsync(o.VendorProductListingId, cancellationToken);
        if (agg is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.listing_not_found", "Listing not found.", ErrorCategory.NotFound));

        if (!string.Equals(o.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase))
        {
            if (o.ProductVariantId.HasValue)
            {
                var variantInv = await vendors.GetVariantInventoryByListingIdAsync(o.VendorProductListingId, cancellationToken);
                var specificVariant = variantInv.FirstOrDefault(vi => vi.ProductVariantId == o.ProductVariantId.Value);
                if (specificVariant is not null)
                {
                    specificVariant.AvailableQuantity += o.Quantity;
                    specificVariant.ReservedQuantity = Math.Max(0, specificVariant.ReservedQuantity - o.Quantity);
                    await vendors.UpsertVariantInventoryAsync(specificVariant, cancellationToken);
                }
                
                // Sync global aggregates
                var refreshed = await vendors.GetVariantInventoryByListingIdAsync(o.VendorProductListingId, cancellationToken);
                var totalAvailable = refreshed.Sum(x => x.AvailableQuantity);
                var totalStock = refreshed.Sum(x => x.TotalQuantity);
                var totalReserved = refreshed.Sum(x => x.ReservedQuantity);

                var listing = await vendors.GetVendorProductListingByIdAsync(agg.VendorId, o.VendorProductListingId, cancellationToken);
                if (listing is not null)
                {
                    listing.AvailableQuantity = totalAvailable;
                    await vendors.UpdateVendorProductListingAsync(listing, cancellationToken);
                }

                var inventory = await vendors.GetVendorInventoryByListingIdAsync(o.VendorProductListingId, cancellationToken);
                if (inventory is not null)
                {
                    inventory.AvailableQuantity = totalAvailable;
                    inventory.TotalQuantity = totalStock;
                    inventory.ReservedQuantity = totalReserved;
                    await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
                    var movement = new VendorInventoryMovement
                    {
                        VendorInventoryId = inventory.Id,
                        MovementType = "reservation_released",
                        Quantity = o.Quantity,
                        ReferenceType = "customer_rental_order",
                        ReferenceId = o.Id,
                        Notes = $"Cancellation {o.OrderNumber} (Variant {specificVariant?.ProductVariant?.Sku ?? "Selected size"})",
                        EventAt = DateTimeOffset.UtcNow,
                    };
                    await vendors.AddVendorInventoryMovementAsync(movement, cancellationToken);
                }
            }
            else
            {
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
            }
        }

        o.Status = "cancelled";
        await customers.UpdateCustomerRentalOrderAsync(o, cancellationToken);

        var listingTitleForNotif = row.Listing?.ListingTitle ?? agg.ListingTitle ?? "Listing unavailable";
        if (!string.IsNullOrEmpty(row.VariantDescription))
        {
            listingTitleForNotif += $" ({row.VariantDescription})";
        }
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
        if (!string.IsNullOrEmpty(row.VariantDescription))
        {
            listingTitle += $" ({row.VariantDescription})";
        }
        return Result.Success(new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            listingTitle,
            vendorName ?? "Vendor",
            listingNav?.VendorId ?? agg.VendorId,
            "Cancelled",
            o.StartDate,
            o.EndDate,
            o.TotalAmount,
            o.DepositAmount,
            o.ServiceFeeAmount,
            o.DistanceFeeAmount,
            o.ExpressFeeAmount,
            o.GstAmount,
            o.OrderType,
            o.Quantity,
            o.RentalDays,
            o.RentalPeriodUnit,
            row.ListingPrimaryImageUrl,
            ProductVariantId: o.ProductVariantId,
            DoctorId: row.Doctor?.Id,
            DoctorName: row.Doctor?.FullName,
            DoctorSpecialization: row.Doctor?.Specialization,
            HospitalId: null,
            HospitalName: null,
            HospitalCity: null,
            DoctorContactNumber: row.Doctor?.ContactNumber,
            DoctorUniqueCode: row.Doctor?.UniqueCode));
    }
}
