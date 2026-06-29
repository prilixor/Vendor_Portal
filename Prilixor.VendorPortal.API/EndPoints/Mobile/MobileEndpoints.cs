using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Mobile;

public sealed class MobileApiGroup : Group
{
    public MobileApiGroup()
    {
        Configure("mobile", ep =>
        {
            ep.Description(x => x.WithTags("Mobile"));
        });
    }
}

public sealed class GetMobileVendorsRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class GetMobileVendorsEndpoint(IMediator mediator)
    : Endpoint<GetMobileVendorsRequest, Results<Ok<PagedResult<VendorDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("vendors");
        Group<MobileApiGroup>();
    }

    public override async Task<Results<Ok<PagedResult<VendorDto>>, ProblemHttpResult>> ExecuteAsync(GetMobileVendorsRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetMobileVendorsQuery(req.Page, req.PageSize), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetMobileAdminOrdersRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class GetMobileAdminOrdersEndpoint(IMediator mediator)
    : Endpoint<GetMobileAdminOrdersRequest, Results<Ok<PagedResult<AdminOrderDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("admin/orders");
        Group<MobileApiGroup>();
    }

    public override async Task<Results<Ok<PagedResult<AdminOrderDto>>, ProblemHttpResult>> ExecuteAsync(GetMobileAdminOrdersRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetMobileAdminAllOrdersQuery(req.Page, req.PageSize), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
