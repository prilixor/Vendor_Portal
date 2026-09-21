using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.LegalDocuments;

namespace Prilixor.VendorPortal.API.EndPoints.Common;

public sealed class PublicLegalDocumentsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<PublicLegalDocumentListItemDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("common/legal-documents");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<List<PublicLegalDocumentListItemDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var surface = Query<string?>("surface", false);
        var screen = Query<string?>("screen", false);
        var result = await mediator.Send(new ListPublicLegalDocumentsQuery(surface, screen), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class PublicLegalDocumentBySlugEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<PublicLegalDocumentDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("common/legal-documents/{slug}");
        AllowAnonymous();
    }

    public override async Task<Results<Ok<PublicLegalDocumentDetailDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var slug = Route<string>("slug");
        if (string.IsNullOrWhiteSpace(slug))
            return TypedResults.Problem("Slug is required.");

        var surface = Query<string?>("surface", false);
        var result = await mediator.Send(new GetPublicLegalDocumentQuery(slug, surface), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
