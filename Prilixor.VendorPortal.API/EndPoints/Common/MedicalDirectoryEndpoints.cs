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
        var group = app.MapGroup("api/medical-directory").WithTags("Medical Directory").AllowAnonymous();

        // Public lookup — customers search by Unique ID (or name) among Admin-curated doctors.
        group.MapGet("/doctors", async ([FromQuery] string? search, IMediator mediator) =>
        {
            var result = await mediator.Send(new SearchDoctorsQuery(search));
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Errors);
        });

        group.MapGet("/doctors/by-code/{code}", async (string code, IMediator mediator) =>
        {
            var result = await mediator.Send(new GetDoctorByUniqueCodeQuery(code));
            if (!result.IsSuccess)
                return Results.NotFound(result.Errors);
            return Results.Ok(result.Value);
        });

        group.MapGet("/doctors/by-code/{code}/qr.png", async (string code, IMediator mediator) =>
        {
            var result = await mediator.Send(new GetPublicDoctorQrQuery(code));
            if (!result.IsSuccess)
                return Results.NotFound(result.Errors);
            return Results.File(result.Value!, "image/png", fileDownloadName: $"blinksmed-{code}-qr.png");
        });
    }
}
