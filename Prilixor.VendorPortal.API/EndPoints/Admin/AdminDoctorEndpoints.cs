using FastEndpoints;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Prilixor.VendorPortal.API.EndPoints.Vendors;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Admin.Doctors;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;

namespace Prilixor.VendorPortal.API.EndPoints.Admin;

public sealed class CreateAdminDoctorRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Specialization { get; set; }
    public string? ContactNumber { get; set; }
    public bool SendEmail { get; set; } = true;
}

public sealed class UpdateAdminDoctorRequest
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Specialization { get; set; }
    public string? ContactNumber { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class ListAdminDoctorsEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<List<DoctorDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("doctors");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<List<DoctorDto>>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var search = Query<string?>("search", false);
        var isActive = Query<bool?>("isActive", false);
        var result = await mediator.Send(new ListAdminDoctorsQuery(search, isActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetAdminDoctorEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok<DoctorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("doctors/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<DoctorDto>, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var doctorId))
            return TypedResults.Problem("Doctor ID is required.");

        var result = await mediator.Send(new GetAdminDoctorQuery(doctorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class CreateAdminDoctorEndpoint(IMediator mediator)
    : Endpoint<CreateAdminDoctorRequest, Results<Ok<DoctorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("doctors");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<DoctorDto>, ProblemHttpResult>> ExecuteAsync(CreateAdminDoctorRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new CreateAdminDoctorCommand(
            req.FullName,
            req.Email,
            req.Specialization,
            req.ContactNumber,
            req.SendEmail), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateAdminDoctorEndpoint(IMediator mediator)
    : Endpoint<UpdateAdminDoctorRequest, Results<Ok<DoctorDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("doctors/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok<DoctorDto>, ProblemHttpResult>> ExecuteAsync(UpdateAdminDoctorRequest req, CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var doctorId))
            return TypedResults.Problem("Doctor ID is required.");

        var result = await mediator.Send(new UpdateAdminDoctorCommand(
            doctorId,
            req.FullName,
            req.Email,
            req.Specialization,
            req.ContactNumber,
            req.IsActive), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteAdminDoctorEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("doctors/{id}");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var doctorId))
            return TypedResults.Problem("Doctor ID is required.");

        var result = await mediator.Send(new SoftDeleteAdminDoctorCommand(doctorId, null), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class ResendAdminDoctorEmailEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<Ok, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("doctors/{id}/resend-email");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<Ok, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var doctorId))
            return TypedResults.Problem("Doctor ID is required.");

        var result = await mediator.Send(new ResendAdminDoctorEmailCommand(doctorId), ct);
        return result.IsSuccess ? TypedResults.Ok() : result.ToErrorResponse();
    }
}

public sealed class GetAdminDoctorQrEndpoint(IMediator mediator)
    : EndpointWithoutRequest<Results<FileContentHttpResult, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("doctors/{id}/qr.png");
        Group<AdminApiGroup>();
        Policies("Perm:catalog.manage");
    }

    public override async Task<Results<FileContentHttpResult, ProblemHttpResult>> ExecuteAsync(CancellationToken ct)
    {
        var id = Route<string>("id");
        if (!Guid.TryParse(id, out var doctorId))
            return TypedResults.Problem("Doctor ID is required.");

        var result = await mediator.Send(new GetAdminDoctorQrQuery(doctorId), ct);
        if (!result.IsSuccess)
            return result.ToErrorResponse();

        return TypedResults.File(result.Value!, "image/png", fileDownloadName: $"doctor-{doctorId:N}-qr.png");
    }
}
