using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class GetVendorListingPricingEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<VendorListingPricingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("vendors/{vendorId}/listings/{listingId}/pricing");
        Group<AdminApiGroup>();
    }

    public override async Task<Results<Ok<VendorListingPricingDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(
            new GetVendorListingPricingQuery(Route<string>("vendorId") ?? "", Route<string>("listingId") ?? ""),
            ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SetVendorListingPricingRequest
{
    public bool IsCustomPricing { get; set; }
    public decimal? DailyRent { get; set; }
    public decimal? SecurityDeposit { get; set; }
    public decimal? BuyPrice { get; set; }
    public decimal? VendorDailyRent { get; set; }
    public decimal? VendorBuyPrice { get; set; }
    public List<SetVendorListingVariantPriceRequest> Variants { get; set; } = [];
}

public sealed class SetVendorListingVariantPriceRequest
{
    public string VariantId { get; set; } = string.Empty;
    public decimal BuyPrice { get; set; }
    public decimal VendorPrice { get; set; }
}

public sealed class SetVendorListingPricingEndpoint(IMediator mediator)
    : Endpoint<SetVendorListingPricingRequest, Results<Ok<VendorListingPricingDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("vendors/{vendorId}/listings/{listingId}/pricing");
        Group<AdminApiGroup>();
        Policies($"Perm:{AdminPermissions.VendorsProductPrice}");
    }

    public override async Task<Results<Ok<VendorListingPricingDto>, ProblemHttpResult>> ExecuteAsync(
        SetVendorListingPricingRequest req,
        CancellationToken ct)
    {
        var adminId = HttpContext.ResolveAdminUserId();
        if (!Guid.TryParse(adminId, out var actorId))
            return TypedResults.Problem(title: "auth.forbidden", detail: "Admin identity required.", statusCode: 401);

        var result = await mediator.Send(new SetVendorListingPricingCommand(
            Route<string>("vendorId") ?? "",
            Route<string>("listingId") ?? "",
            actorId,
            req.IsCustomPricing,
            req.DailyRent,
            req.SecurityDeposit,
            req.BuyPrice,
            req.VendorDailyRent,
            req.VendorBuyPrice,
            (req.Variants ?? []).Select(v => new SetVendorListingVariantPrice(v.VariantId, v.BuyPrice, v.VendorPrice)).ToList()), ct);

        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
