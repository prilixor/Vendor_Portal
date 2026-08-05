using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.WebsiteContent;

namespace Prilixor.VendorPortal.API.EndPoints.Common;

public sealed class PublicWebsiteContentEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<FullWebsiteContentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("common/website-content");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<FullWebsiteContentDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new GetFullWebsiteContentQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
