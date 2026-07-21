using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetAdminCustomersRequest
{
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public sealed class GetAdminCustomersEndpoint(IMediator mediator)
    : Endpoint<GetAdminCustomersRequest, Results<Ok<List<AdminCustomerListItemDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("customers");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.CustomersView}");
    }

    public override async Task<Results<Ok<List<AdminCustomerListItemDto>>, ProblemHttpResult>> ExecuteAsync(
        GetAdminCustomersRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetAdminCustomersQuery(req.Search, req.Page, req.PageSize), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminCustomerDetailEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<AdminCustomerDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("customers/{customerId}");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.CustomersView}");
    }

    public override async Task<Results<Ok<AdminCustomerDetailDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("customerId");
        if (!Guid.TryParse(idStr, out var customerId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid customer id.", statusCode: 400);

        var result = await mediator.Send(new GetAdminCustomerDetailQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AdminPlaceCustomerOrdersRequest
{
    public string? CustomerAddressId { get; set; }
    public string DeliveryOption { get; set; } = "standard";
    public List<CartLineApiRequest> Lines { get; set; } = [];
}

public sealed class CartLineApiRequest
{
    public Guid ListingId { get; set; }
    public int Quantity { get; set; } = 1;
    public int RentalDays { get; set; }
    public string OrderType { get; set; } = "rent";
    public Guid? ProductVariantId { get; set; }
    public Guid? DoctorId { get; set; }
    public Guid? HospitalId { get; set; }
    public string? ContactNumber { get; set; }
    public string? ReferenceNumber { get; set; }
}

public sealed class AdminPlaceCustomerOrdersEndpoint(IMediator mediator)
    : Endpoint<AdminPlaceCustomerOrdersRequest, Results<Ok<PlaceCustomerOrdersResultDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("customers/{customerId}/orders");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.CustomersPlaceOrder}");
    }

    public override async Task<Results<Ok<PlaceCustomerOrdersResultDto>, ProblemHttpResult>> ExecuteAsync(
        AdminPlaceCustomerOrdersRequest req, CancellationToken ct)
    {
        var adminIdStr = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminIdStr, out var adminId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var idStr = Route<string>("customerId");
        if (!Guid.TryParse(idStr, out var customerId))
            return TypedResults.Problem(title: "validation.error", detail: "Invalid customer id.", statusCode: 400);

        Guid? addressId = null;
        if (!string.IsNullOrWhiteSpace(req.CustomerAddressId))
        {
            if (!Guid.TryParse(req.CustomerAddressId, out var aid))
                return TypedResults.Problem(title: "validation.error", detail: "Invalid address id.", statusCode: 400);
            addressId = aid;
        }

        var lines = req.Lines.Select(l => new CartLineRequest(
            l.ListingId, l.Quantity, l.RentalDays, l.OrderType,
            l.ProductVariantId, l.DoctorId, l.HospitalId, l.ContactNumber, l.ReferenceNumber)).ToList();

        var result = await mediator.Send(new PlaceCustomerOrdersCommand(
            customerId, addressId, req.DeliveryOption, lines, adminId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
