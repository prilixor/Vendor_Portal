using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Customers;

public sealed class GetCustomerEquipmentEmergencyRequest
{
    public string OrderId { get; set; } = string.Empty;
}

public sealed class GetCustomerEquipmentEmergencyEndpoint(IMediator mediator)
    : Endpoint<GetCustomerEquipmentEmergencyRequest, Results<Ok<CustomerEquipmentEmergencyStateDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("me/orders/{OrderId}/emergency");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<CustomerEquipmentEmergencyStateDto>, ProblemHttpResult>> ExecuteAsync(
        GetCustomerEquipmentEmergencyRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);
        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new GetCustomerEquipmentEmergencyQuery(customerId, orderId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class RaiseCustomerEquipmentEmergencyRequest
{
    public string OrderId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public sealed class RaiseCustomerEquipmentEmergencyEndpoint(IMediator mediator)
    : Endpoint<RaiseCustomerEquipmentEmergencyRequest, Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("me/orders/{OrderId}/emergency");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("CustomerOnly");
        Group<CustomersRouteGroup>();
        DontAutoTag();
        Options(x => x.WithTags("Customers"));
    }

    public override async Task<Results<Ok<EquipmentEmergencyDto>, ProblemHttpResult>> ExecuteAsync(
        RaiseCustomerEquipmentEmergencyRequest req,
        CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var customerId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);
        if (!Guid.TryParse(req.OrderId, out var orderId))
            return TypedResults.Problem(title: "customers.invalid_id", detail: "Invalid order id.", statusCode: 400);

        var result = await mediator.Send(new RaiseEquipmentEmergencyCommand(customerId, orderId, req.Reason, req.Note), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
