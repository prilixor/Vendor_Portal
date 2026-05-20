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
    public string? Category { get; set; }
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
        var result = await mediator.Send(new GetCustomerCatalogListingsQuery(req.Category, req.Search), ct);
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

public sealed class CustomerListingDetailResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public decimal VendorRating { get; set; }
    public string ServiceAreaHint { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal DailyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public string ListingStatus { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = [];
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

        var res = new CustomerListingDetailResponse
        {
            Id = agg.ListingId,
            Title = agg.ListingTitle,
            VendorName = string.IsNullOrWhiteSpace(agg.VendorBusinessName) ? "Vendor" : agg.VendorBusinessName,
            VendorRating = 4.8m,
            ServiceAreaHint = hint,
            CategoryName = agg.CategoryName,
            DailyRent = agg.DailyRent,
            MonthlyRent = agg.MonthlyRent,
            SecurityDeposit = agg.SecurityDeposit,
            PrescriptionRequired = agg.CategoryPrescriptionRequired,
            DepositRequired = agg.CategoryDepositRequired,
            ListingStatus = agg.ListingStatus,
            Description = agg.Description,
            ImageUrls = agg.ImageUrls.Count > 0 ? agg.ImageUrls : [],
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
    public int RentalDays { get; set; }
}

public sealed class PlaceCustomerOrdersRequest
{
    public Guid? CustomerAddressId { get; set; }
    public string DeliveryOption { get; set; } = "standard";
    public List<CartLineDto> Lines { get; set; } = [];
}

public sealed class PlaceCustomerOrdersEndpoint(IMediator mediator)
    : Endpoint<PlaceCustomerOrdersRequest, Results<Ok<List<CustomerOrderDto>>, ProblemHttpResult>>
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

    public override async Task<Results<Ok<List<CustomerOrderDto>>, ProblemHttpResult>> ExecuteAsync(PlaceCustomerOrdersRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var lines = req.Lines.ConvertAll(l => new CartLineRequest(l.ListingId, l.Quantity, l.RentalDays));
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
