using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.Hospitals;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class CreateAdminHospitalRequest
{
    public string Name { get; set; } = string.Empty;
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? ContactNumber { get; set; }
    public List<Guid>? DoctorIds { get; set; }
}

public sealed class UpdateAdminHospitalRequest
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? ContactNumber { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Guid>? DoctorIds { get; set; }
}

public sealed class ListAdminHospitalsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<HospitalDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("hospitals");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<HospitalDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var search = Query<string?>("search", false);
        var isActive = Query<bool?>("isActive", false);
        var result = await mediator.Send(new ListAdminHospitalsQuery(search, isActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminHospitalEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<HospitalDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("hospitals/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HospitalDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var hospitalId))
            return TypedResults.Problem("Hospital ID is required.");

        var result = await mediator.Send(new GetAdminHospitalQuery(hospitalId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateAdminHospitalEndpoint(IMediator mediator)
    : Endpoint<CreateAdminHospitalRequest, Results<Ok<HospitalDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("hospitals");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HospitalDto>, ProblemHttpResult>> ExecuteAsync(CreateAdminHospitalRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateAdminHospitalCommand(
            req.Name,
            req.AddressLine1,
            req.City,
            req.State,
            req.PostalCode,
            req.Latitude,
            req.Longitude,
            req.ContactNumber,
            req.DoctorIds), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminHospitalEndpoint(IMediator mediator)
    : Endpoint<UpdateAdminHospitalRequest, Results<Ok<HospitalDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("hospitals/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<HospitalDto>, ProblemHttpResult>> ExecuteAsync(UpdateAdminHospitalRequest req, CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var hospitalId))
            return TypedResults.Problem("Hospital ID is required.");

        var result = await mediator.Send(new UpdateAdminHospitalCommand(
            hospitalId,
            req.Name,
            req.AddressLine1,
            req.City,
            req.State,
            req.PostalCode,
            req.Latitude,
            req.Longitude,
            req.ContactNumber,
            req.IsActive,
            req.DoctorIds), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteAdminHospitalEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("hospitals/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var hospitalId))
            return TypedResults.Problem("Hospital ID is required.");

        var result = await mediator.Send(new SoftDeleteAdminHospitalCommand(hospitalId, null), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}
