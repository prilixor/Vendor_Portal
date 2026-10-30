using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetDiscountCodesEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<DiscountCodeDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("catalog/discount-codes");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<DiscountCodeDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetDiscountCodesQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SaveDiscountCodeRequest
{
    public Guid? Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string DiscountType { get; set; } = "percentage";
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal? MinimumItemTotal { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MaxTotalUses { get; set; }
    public int? MaxUsesPerCustomer { get; set; }
    public string AppliesTo { get; set; } = "both";
    public bool ShowToCustomers { get; set; }
    public List<Guid> ProductIds { get; set; } = [];
    public List<Guid> CategoryIds { get; set; } = [];
}

public sealed class SaveDiscountCodeEndpoint(IMediator mediator)
    : Endpoint<SaveDiscountCodeRequest, Results<Ok<DiscountCodeDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("catalog/discount-codes");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<DiscountCodeDto>, ProblemHttpResult>> ExecuteAsync(
        SaveDiscountCodeRequest req,
        CancellationToken ct)
    {
        var result = await mediator.Send(new SaveDiscountCodeCommand(
            req.Id,
            req.Code,
            req.DiscountType,
            req.DiscountValue,
            req.MaxDiscountAmount,
            req.MinimumItemTotal,
            req.StartsAt,
            req.EndsAt,
            req.IsActive,
            req.MaxTotalUses,
            req.MaxUsesPerCustomer,
            req.AppliesTo,
            req.ShowToCustomers,
            req.ProductIds,
            req.CategoryIds), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
