using System.Security.Claims;
using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Admin.LegalDocuments;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public sealed class RegisterVendorRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? SupportPhone { get; set; }
    public string? Phone { get; set; }
    public bool AcceptedLegal { get; set; }
    public string? SourceSurface { get; set; }
    public List<string>? AcceptedSlugs { get; set; }
}

public sealed class UpsertVendorProfileRequest : VendorIdRequest
{
    public string BusinessName { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string SupportPhone { get; set; } = string.Empty;
    public string? GstNumber { get; set; }
    public string AddressLine1 { get; set; } = string.Empty;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public sealed class AddVendorDocumentRequest : VendorIdRequest
{
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
    public string? OriginalFileName { get; set; }
}

public sealed class DeleteVendorDocumentRequest : VendorIdRequest
{
    public string DocumentId { get; set; } = string.Empty;
}

public sealed class RegisterVendorEndpoint(IMediator mediator)
    : Endpoint<RegisterVendorRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("register");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(RegisterVendorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new RegisterVendorCommand(
            req.Email,
            req.Password,
            req.SupportPhone ?? req.Phone ?? string.Empty,
            req.AcceptedLegal,
            req.SourceSurface,
            req.AcceptedSlugs,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            HttpContext.Request.Headers.UserAgent.ToString()), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorByIdEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<VendorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorDto>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorByIdQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertVendorProfileEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorProfileRequest, Results<Ok<VendorProfileDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/profile");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProfileDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorProfileRequest req, CancellationToken ct)
    {
        var command = new UpsertVendorProfileCommand(
            req.VendorId,
            req.BusinessName,
            req.OwnerName,
            req.SupportPhone,
            req.GstNumber,
            req.AddressLine1,
            req.AddressLine2,
            req.City,
            req.State,
            req.PostalCode,
            req.Latitude,
            req.Longitude);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorProfileEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<VendorProfileDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/profile");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorProfileDto>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorProfileQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class AddVendorDocumentEndpoint(IMediator mediator)
    : Endpoint<AddVendorDocumentRequest, Results<Ok<VendorDocumentDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/documents");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorDocumentDto>, ProblemHttpResult>> ExecuteAsync(AddVendorDocumentRequest req, CancellationToken ct)
    {
        var command = new AddVendorDocumentCommand(req.VendorId, req.DocumentType, req.FileUrl, req.DocumentNumber, req.OriginalFileName);
        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorDocumentsEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorDocumentDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/documents");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorDocumentDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorDocumentsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorDocumentEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorDocumentRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/documents/{documentId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorDocumentRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorDocumentCommand(req.VendorId, req.DocumentId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class CreateVendorVerificationRequestEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<VendorVerificationRequestDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/verification-requests");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorVerificationRequestDto>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateVendorVerificationRequestCommand(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorVerificationRequestsEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorVerificationRequestDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/verification-requests");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorVerificationRequestDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorVerificationRequestsQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorLegalReconsentEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<IReadOnlyList<PendingLegalReconsentDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/legal-reconsent");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<IReadOnlyList<PendingLegalReconsentDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId)
            || !Guid.TryParse(req.VendorId, out var routeId)
            || vendorId != routeId)
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new PendingLegalReconsentQuery(LegalCatalog.ActorTypes.Vendor, vendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class RecordVendorLegalAcceptanceRequest : VendorIdRequest
{
    public string Screen { get; set; } = "reconsent";
    public bool AcceptedLegal { get; set; }
    public string? SourceSurface { get; set; }
    public string? SignedName { get; set; }
}

public sealed class RecordVendorLegalAcceptanceEndpoint(IMediator mediator)
    : Endpoint<RecordVendorLegalAcceptanceRequest, Results<Ok<int>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/legal-acceptances");
        AuthSchemes(JwtBearerDefaults.AuthenticationScheme);
        Policies("VendorOnly");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<int>, ProblemHttpResult>> ExecuteAsync(RecordVendorLegalAcceptanceRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var vendorId)
            || !Guid.TryParse(req.VendorId, out var routeId)
            || vendorId != routeId)
            return TypedResults.Problem(title: "auth.forbidden", detail: "Invalid token.", statusCode: 401);

        var result = await mediator.Send(new RecordLegalAcceptanceCommand(
            LegalCatalog.ActorTypes.Vendor,
            vendorId,
            req.Screen,
            req.AcceptedLegal,
            req.SourceSurface ?? LegalCatalog.Surfaces.VendorWeb,
            req.SignedName,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            HttpContext.Request.Headers.UserAgent.ToString()), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}
