using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.LegalDocuments;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class UpdateLegalDocumentRequest
{
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? PublicPath { get; set; }
    public string Audience { get; set; } = "both";
    public int SortOrder { get; set; }
    public bool IsRequiredAcceptance { get; set; }
    public List<LegalPlacementDto> Placements { get; set; } = [];
}

public sealed class SaveLegalDocumentDraftRequest
{
    public string? ContentHtml { get; set; }
    public string? ContentMarkdown { get; set; }
    public string? ChangeSummary { get; set; }
}

public sealed class PublishLegalDocumentRequest
{
    public Guid? VersionId { get; set; }
    public DateTimeOffset? EffectiveFrom { get; set; }
    public string? ChangeSummary { get; set; }
    public bool IsMaterialChange { get; set; }
}

public sealed class ListAdminLegalDocumentsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<LegalDocumentListItemDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("legal-documents");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<LegalDocumentListItemDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var result = await mediator.Send(new ListAdminLegalDocumentsQuery(), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminLegalDocumentEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("legal-documents/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid legal document ID.");

        var result = await mediator.Send(new GetAdminLegalDocumentQuery(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminLegalDocumentEndpoint(IMediator mediator)
    : Endpoint<UpdateLegalDocumentRequest, Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("legal-documents/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>> ExecuteAsync(
        UpdateLegalDocumentRequest req, CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid legal document ID.");

        var actor = HttpContext.ResolveAdminUserId();
        Guid? actorId = Guid.TryParse(actor, out var parsed) ? parsed : null;

        var result = await mediator.Send(new UpdateLegalDocumentCommand(
            id,
            actorId,
            req.Title,
            req.Slug,
            req.Summary,
            req.PublicPath,
            req.Audience,
            req.SortOrder,
            req.IsRequiredAcceptance,
            req.Placements), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class SaveAdminLegalDocumentDraftEndpoint(IMediator mediator)
    : Endpoint<SaveLegalDocumentDraftRequest, Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("legal-documents/{id}/draft");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>> ExecuteAsync(
        SaveLegalDocumentDraftRequest req, CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid legal document ID.");

        var actor = HttpContext.ResolveAdminUserId();
        Guid? actorId = Guid.TryParse(actor, out var parsed) ? parsed : null;

        var result = await mediator.Send(new SaveLegalDocumentDraftCommand(
            id, actorId, req.ContentHtml, req.ContentMarkdown, req.ChangeSummary), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class PublishAdminLegalDocumentEndpoint(IMediator mediator)
    : Endpoint<PublishLegalDocumentRequest, Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("legal-documents/{id}/publish");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<LegalDocumentDetailDto>, ProblemHttpResult>> ExecuteAsync(
        PublishLegalDocumentRequest req, CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid legal document ID.");

        var actor = HttpContext.ResolveAdminUserId();
        Guid? actorId = Guid.TryParse(actor, out var parsed) ? parsed : null;

        var result = await mediator.Send(new PublishLegalDocumentCommand(
            id, actorId, req.VersionId, req.EffectiveFrom, req.ChangeSummary, req.IsMaterialChange), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class ListAdminLegalDocumentVersionsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<LegalDocumentVersionSummaryDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("legal-documents/{id}/versions");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<LegalDocumentVersionSummaryDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        if (!Guid.TryParse(idStr, out var id))
            return TypedResults.Problem("Invalid legal document ID.");

        var result = await mediator.Send(new ListLegalDocumentVersionsQuery(id), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminLegalDocumentVersionEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<LegalDocumentVersionDetailDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("legal-documents/{id}/versions/{versionId}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<LegalDocumentVersionDetailDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var idStr = Route<string>("id");
        var versionStr = Route<string>("versionId");
        if (!Guid.TryParse(idStr, out var id) || !Guid.TryParse(versionStr, out var versionId))
            return TypedResults.Problem("Invalid legal document or version ID.");

        var result = await mediator.Send(new GetLegalDocumentVersionQuery(id, versionId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
