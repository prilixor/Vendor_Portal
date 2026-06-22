using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Customers;

public sealed class GetCustomerFavoritesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<CustomerFavoriteDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/favorites");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<List<CustomerFavoriteDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new GetCustomerFavoritesQuery(customerId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddCustomerFavoriteRequest
{
    public Guid VendorProductListingId { get; set; }
}

public sealed class AddCustomerFavoriteEndpoint(IMediator mediator)
    : Endpoint<AddCustomerFavoriteRequest, Results<Ok<CustomerFavoriteDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/favorites");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerFavoriteDto>, ProblemHttpResult>> ExecuteAsync(AddCustomerFavoriteRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new AddCustomerFavoriteCommand(customerId, req.VendorProductListingId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class RemoveCustomerFavoriteRequest
{
    public Guid ListingId { get; set; }
}

public sealed class RemoveCustomerFavoriteEndpoint(IMediator mediator)
    : Endpoint<RemoveCustomerFavoriteRequest, Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("me/favorites/{ListingId}");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(RemoveCustomerFavoriteRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new RemoveCustomerFavoriteCommand(customerId, req.ListingId), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}
