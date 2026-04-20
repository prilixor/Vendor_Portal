using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Prilixor.VendorPortal.API.Extensions
{
    public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {
            var errorId = Guid.NewGuid().ToString();
            logger.LogError(exception, "An unhandled exception has occurred: {ErrorId}. {ExceptionMessage}", errorId, exception.Message);

            var problemDetails = new ProblemDetails
            {
                Title = "Server error occurred while processing your request.",
                Status = StatusCodes.Status500InternalServerError,
                Extensions = new Dictionary<string, object?> { { "ErrorId", errorId } }
            };

            if (environment.IsDevelopment())
            {
                problemDetails.Detail = exception.ToString();
            }

            httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken: cancellationToken);
            return true;
        }
    }
}
