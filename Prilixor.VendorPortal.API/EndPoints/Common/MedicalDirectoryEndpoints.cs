using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Prilixor.VendorPortal.Application.Common.MedicalDirectory;

namespace Prilixor.VendorPortal.API.EndPoints.Common;

public static class MedicalDirectoryEndpoints
{
    public static void MapMedicalDirectoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/medical-directory").WithTags("Medical Directory");

        // Hospitals
        group.MapGet("/hospitals", async ([FromQuery] string? search, IMediator mediator) =>
        {
            var result = await mediator.Send(new SearchHospitalsQuery(search));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });

        group.MapPost("/hospitals", async ([FromBody] CreateHospitalCommand command, IMediator mediator) =>
        {
            var result = await mediator.Send(command);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });

        // Doctors
        group.MapGet("/doctors", async ([FromQuery] Guid? hospitalId, [FromQuery] string? search, IMediator mediator) =>
        {
            var result = await mediator.Send(new SearchDoctorsQuery(hospitalId, search));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });

        group.MapPost("/doctors", async ([FromBody] CreateDoctorCommand command, IMediator mediator) =>
        {
            var result = await mediator.Send(command);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });
    }
}
