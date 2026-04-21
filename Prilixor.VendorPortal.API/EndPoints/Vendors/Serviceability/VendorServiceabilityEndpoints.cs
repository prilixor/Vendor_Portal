using FastEndpoints;
using Prilixor.VendorPortal.API.Extensions;
using Prilixor.VendorPortal.Application.Onboarding;
using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Prilixor.VendorPortal.API.EndPoints.Vendors;

public class CreateVendorServiceAreaRequest : VendorIdRequest
{
    public string AreaName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public decimal CenterLatitude { get; set; }
    public decimal CenterLongitude { get; set; }
    public decimal ServiceRadiusKm { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateVendorServiceAreaRequest : CreateVendorServiceAreaRequest
{
    public string ServiceAreaId { get; set; } = string.Empty;
}

public sealed class DeleteVendorServiceAreaRequest : VendorIdRequest
{
    public string ServiceAreaId { get; set; } = string.Empty;
}

public sealed class UpsertVendorWorkingHourRequest : VendorIdRequest
{
    public short DayOfWeek { get; set; }
    public bool IsOpen { get; set; } = true;
    public TimeOnly? OpenTime { get; set; }
    public TimeOnly? CloseTime { get; set; }
}

public sealed class UpsertVendorAvailabilityOverrideRequest : VendorIdRequest
{
    public DateOnly OverrideDate { get; set; }
    public bool IsAvailable { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string? Reason { get; set; }
}

public sealed class DeleteVendorAvailabilityOverrideRequest : VendorIdRequest
{
    public string OverrideId { get; set; } = string.Empty;
}

public sealed class CreateVendorServiceAreaEndpoint(IMediator mediator)
    : Endpoint<CreateVendorServiceAreaRequest, Results<Ok<VendorServiceAreaDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Post("{vendorId}/service-areas");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorServiceAreaDto>, ProblemHttpResult>> ExecuteAsync(CreateVendorServiceAreaRequest req, CancellationToken ct)
    {
        var command = new CreateVendorServiceAreaCommand(
            req.VendorId,
            req.AreaName,
            req.City,
            req.CenterLatitude,
            req.CenterLongitude,
            req.ServiceRadiusKm,
            req.IsActive);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpdateVendorServiceAreaEndpoint(IMediator mediator)
    : Endpoint<UpdateVendorServiceAreaRequest, Results<Ok<VendorServiceAreaDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/service-areas/{serviceAreaId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorServiceAreaDto>, ProblemHttpResult>> ExecuteAsync(UpdateVendorServiceAreaRequest req, CancellationToken ct)
    {
        var command = new UpdateVendorServiceAreaCommand(
            req.VendorId,
            req.ServiceAreaId,
            req.AreaName,
            req.City,
            req.CenterLatitude,
            req.CenterLongitude,
            req.ServiceRadiusKm,
            req.IsActive);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorServiceAreasEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorServiceAreaDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/service-areas");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorServiceAreaDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorServiceAreasQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorServiceAreaEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorServiceAreaRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/service-areas/{serviceAreaId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorServiceAreaRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorServiceAreaCommand(req.VendorId, req.ServiceAreaId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}

public sealed class UpsertVendorWorkingHourEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorWorkingHourRequest, Results<Ok<VendorWorkingHourDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/working-hours/{dayOfWeek}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorWorkingHourDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorWorkingHourRequest req, CancellationToken ct)
    {
        var command = new UpsertVendorWorkingHourCommand(
            req.VendorId,
            req.DayOfWeek,
            req.IsOpen,
            req.OpenTime,
            req.CloseTime);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorWorkingHoursEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorWorkingHourDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/working-hours");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorWorkingHourDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorWorkingHoursQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class UpsertVendorAvailabilityOverrideEndpoint(IMediator mediator)
    : Endpoint<UpsertVendorAvailabilityOverrideRequest, Results<Ok<VendorAvailabilityOverrideDto>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Put("{vendorId}/availability-overrides/{overrideDate}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<VendorAvailabilityOverrideDto>, ProblemHttpResult>> ExecuteAsync(UpsertVendorAvailabilityOverrideRequest req, CancellationToken ct)
    {
        var command = new UpsertVendorAvailabilityOverrideCommand(
            req.VendorId,
            req.OverrideDate,
            req.IsAvailable,
            req.StartTime,
            req.EndTime,
            req.Reason);

        var result = await mediator.Send(command, ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class GetVendorAvailabilityOverridesEndpoint(IMediator mediator)
    : Endpoint<VendorIdRequest, Results<Ok<List<VendorAvailabilityOverrideDto>>, ProblemHttpResult>>
{
    public override void Configure()
    {
        Get("{vendorId}/availability-overrides");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<Ok<List<VendorAvailabilityOverrideDto>>, ProblemHttpResult>> ExecuteAsync(VendorIdRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new GetVendorAvailabilityOverridesQuery(req.VendorId), ct);
        return result.IsSuccess ? TypedResults.Ok(result.Value) : result.ToErrorResponse();
    }
}

public sealed class DeleteVendorAvailabilityOverrideEndpoint(IMediator mediator)
    : Endpoint<DeleteVendorAvailabilityOverrideRequest, Results<NoContent, ProblemHttpResult>>
{
    public override void Configure()
    {
        Delete("{vendorId}/availability-overrides/{overrideId}");
        Group<VendorOnboardingGroup>();
    }

    public override async Task<Results<NoContent, ProblemHttpResult>> ExecuteAsync(DeleteVendorAvailabilityOverrideRequest req, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteVendorAvailabilityOverrideCommand(req.VendorId, req.OverrideId), ct);
        return result.IsSuccess ? TypedResults.NoContent() : result.ToErrorResponse();
    }
}
