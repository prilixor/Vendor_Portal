using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Customers;

public sealed class CustomersRouteGroup : Group
{
    public CustomersRouteGroup()
    {
        Configure("customers", _ => { });
    }
}

public sealed class RegisterCustomerRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

public sealed class RegisterCustomerEndpoint(IMediator mediator)
    : Endpoint<RegisterCustomerRequest, Results<Ok<CustomerRegisteredDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("register");
        AllowAnonymous();
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerRegisteredDto>, ProblemHttpResult>> ExecuteAsync(RegisterCustomerRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new RegisterCustomerCommand(req.Email, req.Password, req.FullName, req.Phone), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerCatalogRequest
{
    [QueryParam]
    public string? Category { get; set; }
    
    [QueryParam]
    public string? Search { get; set; }
}

public sealed class GetCustomerCatalogEndpoint(IMediator mediator)
    : Endpoint<GetCustomerCatalogRequest, Results<Ok<List<CustomerCatalogListingDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/listings");
        AllowAnonymous();
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerCatalogListingDto>>, ProblemHttpResult>> ExecuteAsync(GetCustomerCatalogRequest req, CancellationToken ct)
    {
        Guid? customerId = null;
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(subject, out var parsedCustomerId))
        {
            customerId = parsedCustomerId;
        }

        var result = await mediator.Send(new GetCustomerCatalogListingsQuery(req.Category, req.Search, customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

/// <summary>Active product categories for customer browse filters (public).</summary>
public sealed class GetCustomerCatalogCategoriesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/categories");
        AllowAnonymous();
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<ProductCategoryDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetProductCategoriesQuery(), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        var active = result.Value.Where(c => c.IsActive).OrderBy(c => c.CategoryName, StringComparer.OrdinalIgnoreCase).ToList();
        return TypedResults.Ok(active);
    }
}

/// <summary>Active rental-duration icons for customer renting-chart legend (public).</summary>
public sealed class GetCustomerRentalDurationIconsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<RentalDurationIconDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/rental-duration-icons");
        AllowAnonymous();
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<RentalDurationIconDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetRentalDurationIconsQuery(ActiveOnly: true), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CustomerListingDetailResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public decimal VendorRating { get; set; }
    public string ServiceAreaHint { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal DailyRent { get; set; }
    public decimal WeeklyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public string ListingStatus { get; set; } = string.Empty;
    public int AvailableQuantity { get; set; }
    public string AvailabilityStatus { get; set; } = "available";
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = [];
    public bool IsRentEnabled { get; set; } = true;
    public bool IsBuyEnabled { get; set; }
    /// <summary>True when this listing is a chemical (drives buy-only + chemical spec display on the customer UI).</summary>
    public bool IsChemical { get; set; }
    public decimal? BuyPrice { get; set; }
    public string? CasNumber { get; set; }
    public string? ChemicalFormula { get; set; }
    public decimal? PurityPercentage { get; set; }
    public decimal? MolecularWeight { get; set; }
    public string? BaseUnit { get; set; }
    public string? SdsDocumentUrl { get; set; }
    public string? CoaDocumentUrl { get; set; }
    /// <summary>Customer-facing packaging sizes (SKUs) with per-size price and live stock.</summary>
    public List<CustomerListingVariantResponse> Variants { get; set; } = [];
    public List<VariantInventoryItemResponse> VariantInventory { get; set; } = [];
    /// <summary>Active day-based rental pricing plans (sorted).</summary>
    public List<ProductRentalPricingPlanDto> RentalPricingPlans { get; set; } = [];
}

/// <summary>Per-variant stock for customer-side availability display.</summary>
public sealed class VariantInventoryItemResponse
{
    public Guid ProductVariantId { get; set; }
    public int AvailableQuantity { get; set; }
}

/// <summary>Customer-safe packaging size (SKU): price + live stock, without vendor cost.</summary>
public sealed class CustomerListingVariantResponse
{
    public string Id { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public decimal SizeValue { get; set; }
    public string SizeUnit { get; set; } = string.Empty;
    public decimal BuyPrice { get; set; }
    public bool IsActive { get; set; }
    public int AvailableQuantity { get; set; }
}

public sealed class GetCustomerListingDetailRequest
{
    public string ListingId { get; set; } = string.Empty;
}

public sealed class GetCustomerListingDetailEndpoint(ICustomerRepository customers)
    : Endpoint<GetCustomerListingDetailRequest, Results<Ok<CustomerListingDetailResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/listings/{ListingId}");
        AllowAnonymous();
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerListingDetailResponse>, ProblemHttpResult>> ExecuteAsync(GetCustomerListingDetailRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(req.ListingId, out var listingId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid listing id.", statusCode: 400);

        var agg = await customers.GetListingForCustomerAsync(listingId, ct);
        if (agg is null || !CustomerCatalogListingStatus.IsVisibleOnPublicCatalog(agg.ListingStatus)
                       || !string.Equals(agg.VendorAccountStatus, "active", StringComparison.OrdinalIgnoreCase))
            return TypedResults.Problem(title: "customers.listing_not_found", detail: "Listing not found.", statusCode: 404);

        var hint = string.IsNullOrWhiteSpace(agg.CategoryName) ? "Service area on request" : $"{agg.CategoryName} · rentals";
        var availableQuantity = Math.Max(0, agg.InventoryAvailable);
        var availabilityStatus = availableQuantity <= 0
            ? "out_of_stock"
            : (availableQuantity <= 3 ? "low_stock" : "available");

        var activeVariantBuyPrices = agg.Variants
            .Where(v => v.IsActive && v.BuyPrice > 0)
            .Select(v => v.BuyPrice)
            .ToList();
        var resolvedBuyPrice = agg.BuyPrice
            ?? (activeVariantBuyPrices.Count > 0 ? activeVariantBuyPrices.Min() : null);

        var res = new CustomerListingDetailResponse
        {
            Id = agg.ListingId,
            Title = agg.ListingTitle,
            VendorName = string.IsNullOrWhiteSpace(agg.VendorBusinessName) ? "Vendor" : agg.VendorBusinessName,
            VendorRating = 4.8m,
            ServiceAreaHint = hint,
            CategoryName = agg.CategoryName,
            DailyRent = agg.DailyRent,
            WeeklyRent = agg.WeeklyRent,
            MonthlyRent = agg.MonthlyRent,
            SecurityDeposit = agg.SecurityDeposit,
            PrescriptionRequired = agg.CategoryPrescriptionRequired,
            DepositRequired = agg.CategoryDepositRequired,
            ListingStatus = agg.ListingStatus,
            AvailableQuantity = availableQuantity,
            AvailabilityStatus = availabilityStatus,
            Description = agg.Description,
            ImageUrls = agg.ImageUrls.Count > 0 ? agg.ImageUrls : [],
            IsRentEnabled = agg.IsRentEnabled,
            IsBuyEnabled = agg.IsBuyEnabled,
            IsChemical = agg.IsChemical,
            BuyPrice = resolvedBuyPrice,
            CasNumber = agg.CasNumber,
            ChemicalFormula = agg.ChemicalFormula,
            PurityPercentage = agg.PurityPercentage,
            MolecularWeight = agg.MolecularWeight,
            BaseUnit = agg.BaseUnit,
            SdsDocumentUrl = agg.SdsDocumentUrl,
            CoaDocumentUrl = agg.CoaDocumentUrl,
            Variants = agg.Variants
                .Where(v => v.IsActive)
                .Select(v => new CustomerListingVariantResponse
                {
                    Id = v.Id,
                    ProductId = v.ProductId,
                    Sku = v.Sku,
                    SizeValue = v.SizeValue,
                    SizeUnit = v.SizeUnit,
                    BuyPrice = v.BuyPrice,
                    IsActive = v.IsActive,
                    AvailableQuantity = agg.VariantInventory
                        .FirstOrDefault(vi => vi.ProductVariantId.ToString() == v.Id)?.AvailableQuantity ?? 0,
                })
                .OrderBy(v => v.SizeValue)
                .ToList(),
            VariantInventory = agg.VariantInventory
                .Select(vi => new VariantInventoryItemResponse
                {
                    ProductVariantId = vi.ProductVariantId,
                    AvailableQuantity = vi.AvailableQuantity,
                })
                .ToList(),
            RentalPricingPlans = agg.RentalPricingPlans
                .Where(p => p.IsActive)
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.DurationDays)
                .ToList(),
        };

        return TypedResults.Ok(res);
    }
}

public sealed class GetCustomerProfileEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<CustomerProfileDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/profile");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerProfileDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerProfileQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateCustomerProfileRequest
{
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
}

public sealed class UpdateCustomerProfileEndpoint(IMediator mediator)
    : Endpoint<UpdateCustomerProfileRequest, Results<Ok<CustomerProfileDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("me/profile");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerProfileDto>, ProblemHttpResult>> ExecuteAsync(UpdateCustomerProfileRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new UpdateCustomerProfileCommand(customerId, req.FullName, req.Phone), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerAddressesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<CustomerAddressDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/addresses");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerAddressDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerAddressesQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddCustomerAddressRequest
{
    public string? Label { get; set; }
    public string Line1 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postal { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool SetAsDefault { get; set; }
}

public sealed class AddCustomerAddressEndpoint(IMediator mediator)
    : Endpoint<AddCustomerAddressRequest, Results<Ok<CustomerAddressDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/addresses");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerAddressDto>, ProblemHttpResult>> ExecuteAsync(AddCustomerAddressRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new AddCustomerAddressCommand(
            customerId,
            req.Label,
            req.Line1,
            req.City,
            req.State,
            req.Postal,
            req.Latitude,
            req.Longitude,
            req.SetAsDefault), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateCustomerAddressRequest
{
    public string AddressId { get; set; } = string.Empty;
    public string? Label { get; set; }
    public string Line1 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postal { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool SetAsDefault { get; set; }
}

public sealed class UpdateCustomerAddressEndpoint(IMediator mediator)
    : Endpoint<UpdateCustomerAddressRequest, Results<Ok<CustomerAddressDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("me/addresses/{AddressId}");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerAddressDto>, ProblemHttpResult>> ExecuteAsync(UpdateCustomerAddressRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.AddressId, out var addressId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid address id.", statusCode: 400);

        var result = await mediator.Send(new UpdateCustomerAddressCommand(
            customerId,
            addressId,
            req.Label,
            req.Line1,
            req.City,
            req.State,
            req.Postal,
            req.Latitude,
            req.Longitude,
            req.SetAsDefault), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteCustomerAddressRequest
{
    public string AddressId { get; set; } = string.Empty;
}

public sealed class DeleteCustomerAddressEndpoint(IMediator mediator)
    : Endpoint<DeleteCustomerAddressRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("me/addresses/{AddressId}");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(DeleteCustomerAddressRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.AddressId, out var addressId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid address id.", statusCode: 400);

        var result = await mediator.Send(new DeleteCustomerAddressCommand(customerId, addressId), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class CartLineDto
{
    public Guid ListingId { get; set; }
    public int Quantity { get; set; }
    /// <summary>Number of periods for <see cref="RentalPeriodUnit"/>.</summary>
    public int RentalDays { get; set; }
    /// <summary>day | week | month. Defaults to day for backward compatibility.</summary>
    public string RentalPeriodUnit { get; set; } = "day";
    public string OrderType { get; set; } = "rent";
    public Guid? ProductVariantId { get; set; }
    public Guid? DoctorId { get; set; }
    public Guid? HospitalId { get; set; }
    public string? ContactNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public Guid? RentalPricingPlanId { get; set; }
    public DateOnly? RentalStartDate { get; set; }
}

public sealed class PlaceCustomerOrdersRequest
{
    public Guid? CustomerAddressId { get; set; }
    public string DeliveryOption { get; set; } = "standard";
    public List<CartLineDto> Lines { get; set; } = [];
}

public sealed class CustomerOrderExpirationsRequest
{
    public int WithinDays { get; set; } = 7;
}

public sealed class QuoteCustomerOrdersEndpoint(IMediator mediator)
    : Endpoint<PlaceCustomerOrdersRequest, Results<Ok<CustomerOrderQuoteDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/quote");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerOrderQuoteDto>, ProblemHttpResult>> ExecuteAsync(PlaceCustomerOrdersRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var lines = req.Lines.ConvertAll(l => new CartLineRequest(
            l.ListingId, l.Quantity, l.RentalDays, l.RentalPeriodUnit, l.OrderType, l.ProductVariantId,
            l.DoctorId, l.HospitalId, l.ContactNumber, l.ReferenceNumber,
            l.RentalPricingPlanId, l.RentalStartDate));
        var result = await mediator.Send(new QuoteCustomerOrdersCommand(
            customerId,
            req.CustomerAddressId,
            req.DeliveryOption,
            lines), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class PlaceCustomerOrdersEndpoint(IMediator mediator)
    : Endpoint<PlaceCustomerOrdersRequest, Results<Ok<PlaceCustomerOrdersResultDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<PlaceCustomerOrdersResultDto>, ProblemHttpResult>> ExecuteAsync(PlaceCustomerOrdersRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var lines = req.Lines.ConvertAll(l => new CartLineRequest(
            l.ListingId, l.Quantity, l.RentalDays, l.RentalPeriodUnit, l.OrderType, l.ProductVariantId,
            l.DoctorId, l.HospitalId, l.ContactNumber, l.ReferenceNumber,
            l.RentalPricingPlanId, l.RentalStartDate));
        var result = await mediator.Send(new PlaceCustomerOrdersCommand(
            customerId,
            req.CustomerAddressId,
            req.DeliveryOption,
            lines), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerOrdersEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<CustomerOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerOrderDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerOrdersQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerOrderExpirationsEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderExpirationsRequest, Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders/expirations");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<ExpiringOrderDto>>, ProblemHttpResult>> ExecuteAsync(CustomerOrderExpirationsRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerOrderExpirationsQuery(customerId, req.WithinDays), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CustomerOrderIdRequest
{
    public string OrderId { get; set; } = string.Empty;
}

public sealed class GetCustomerOrderDetailEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderIdRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders/{OrderId}");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(CustomerOrderIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new GetCustomerOrderDetailQuery(customerId, orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CancelCustomerOrderEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderIdRequest, Results<Ok<CustomerOrderDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("me/orders/{OrderId}/cancel");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerOrderDto>, ProblemHttpResult>> ExecuteAsync(CustomerOrderIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new CancelCustomerOrderCommand(customerId, orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetCustomerNotificationsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<CustomerNotificationDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/notifications");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerNotificationDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerNotificationsQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CustomerNotificationIdRouteRequest
{
    public string NotificationId { get; set; } = string.Empty;
}

public sealed class MarkCustomerNotificationReadEndpoint(IMediator mediator)
    : Endpoint<CustomerNotificationIdRouteRequest, Results<Ok<CustomerNotificationDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("me/notifications/{NotificationId}/read");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerNotificationDto>, ProblemHttpResult>> ExecuteAsync(CustomerNotificationIdRouteRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.NotificationId, out var notificationId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid notification id.", statusCode: 400);

        var result = await mediator.Send(new MarkCustomerNotificationReadCommand(customerId, notificationId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CustomerNotificationsMarkAllReadResponse
{
    public int UpdatedCount { get; init; }
}

public sealed class MarkAllCustomerNotificationsReadEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<CustomerNotificationsMarkAllReadResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Patch("me/notifications/read-all");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerNotificationsMarkAllReadResponse>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new MarkAllCustomerNotificationsReadCommand(customerId), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        return TypedResults.Ok(new CustomerNotificationsMarkAllReadResponse { UpdatedCount = result.Value });
    }
}

public sealed class GetCustomerNotificationPreferenceEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<CustomerNotificationPreferenceDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/notification-preferences");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerNotificationPreferenceDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerNotificationPreferenceQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateCustomerNotificationPreferenceRequest
{
    public bool OrderStatusUpdatesEnabled { get; set; }
    public bool ExpirationRemindersEnabled { get; set; }
    public bool DepositRefundsEnabled { get; set; }
    public bool DirectMessagesEnabled { get; set; }
    public bool MarketingEmailsEnabled { get; set; }
}

public sealed class UpdateCustomerNotificationPreferenceEndpoint(IMediator mediator)
    : Endpoint<UpdateCustomerNotificationPreferenceRequest, Results<Ok<CustomerNotificationPreferenceDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("me/notification-preferences");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerNotificationPreferenceDto>, ProblemHttpResult>> ExecuteAsync(UpdateCustomerNotificationPreferenceRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new UpsertCustomerNotificationPreferenceCommand(
            customerId,
            req.OrderStatusUpdatesEnabled,
            req.ExpirationRemindersEnabled,
            req.DepositRefundsEnabled,
            req.DirectMessagesEnabled,
            req.MarketingEmailsEnabled), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class QuoteExtensionRequest
{
    public string OrderId { get; set; } = string.Empty;
    public int AdditionalDays { get; set; } = 1;
}

public sealed class QuoteExtensionEndpoint(IMediator mediator)
    : Endpoint<QuoteExtensionRequest, Results<Ok<ExtensionQuoteDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/extensions/quote");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<ExtensionQuoteDto>, ProblemHttpResult>> ExecuteAsync(QuoteExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new QuoteExtensionCommand(customerId, orderId, req.AdditionalDays), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ProcessExtensionRequest
{
    public string OrderId { get; set; } = string.Empty;
    public int AdditionalDays { get; set; } = 1;
    public string PaymentIntentId { get; set; } = string.Empty;
}

public sealed class RequestExtensionResponse
{
    public Guid ExtensionId { get; init; }
}

public sealed class RequestExtensionEndpoint(IMediator mediator)
    : Endpoint<ProcessExtensionRequest, Results<Ok<RequestExtensionResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/extensions");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<RequestExtensionResponse>, ProblemHttpResult>> ExecuteAsync(ProcessExtensionRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new RequestExtensionCommand(customerId, orderId, req.AdditionalDays), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        return TypedResults.Ok(new RequestExtensionResponse { ExtensionId = result.Value });
    }
}

public sealed class QuoteBuyoutRequest
{
    public string OrderId { get; set; } = string.Empty;
}

public sealed class QuoteBuyoutEndpoint(IMediator mediator)
    : Endpoint<QuoteBuyoutRequest, Results<Ok<BuyoutQuoteDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/buyouts/quote");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<BuyoutQuoteDto>, ProblemHttpResult>> ExecuteAsync(QuoteBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new QuoteBuyoutCommand(customerId, orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ProcessBuyoutRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string PaymentIntentId { get; set; } = string.Empty;
}

public sealed class RequestBuyoutResponse
{
    public Guid BuyoutId { get; init; }
}

public sealed class RequestBuyoutEndpoint(IMediator mediator)
    : Endpoint<ProcessBuyoutRequest, Results<Ok<RequestBuyoutResponse>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/buyouts");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<RequestBuyoutResponse>, ProblemHttpResult>> ExecuteAsync(ProcessBuyoutRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new RequestBuyoutCommand(customerId, orderId), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        return TypedResults.Ok(new RequestBuyoutResponse { BuyoutId = result.Value });
    }
}

public sealed class CustomerOrderImageIdRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string ImageId { get; set; } = string.Empty;
}

public sealed class GetCustomerOrderImagesEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderIdRequest, Results<Ok<List<CustomerOrderImageDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders/{OrderId}/images");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerOrderImageDto>>, ProblemHttpResult>> ExecuteAsync(CustomerOrderIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new GetCustomerOrderImagesQuery(customerId, orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UploadCustomerOrderImageEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderIdRequest, Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/images");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        AllowFileUploads();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerOrderImageDto>, ProblemHttpResult>> ExecuteAsync(CustomerOrderIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var file = Files.FirstOrDefault();
        if (file is null || file.Length <= 0)
            return TypedResults.Problem(title: "customers.order_images.missing_file", detail: "Image file is required.", statusCode: 400);

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var publicBase = new Uri($"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}");

        var result = await mediator.Send(
            new UploadCustomerOrderImageCommand(
                customerId,
                orderId,
                file.FileName,
                file.ContentType,
                ms.ToArray(),
                publicBase),
            ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteCustomerOrderImageEndpoint(IMediator mediator)
    : Endpoint<CustomerOrderImageIdRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("me/orders/{OrderId}/images/{ImageId}");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(CustomerOrderImageIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        if (!Guid.TryParse(req.OrderId, out var orderId) || !Guid.TryParse(req.ImageId, out var imageId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order or image id.", statusCode: 400);

        var result = await mediator.Send(new DeleteCustomerOrderImageCommand(customerId, orderId, imageId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}
