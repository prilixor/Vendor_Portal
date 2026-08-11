using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Prilixor.VendorPortal.Infrastructure.Exceptions;

namespace Prilixor.VendorPortal.API.Extensions
{
    public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {
            // Browser/app reload aborts in-flight HTTP while EF/Npgsql is still reading.
            // That surfaces as OperationCanceledException — expected, not a server bug.
            // Visual Studio may still break on "thrown" if that exception type is enabled
            // under Debug → Windows → Exception Settings; uncheck OperationCanceledException.
            if (exception is OperationCanceledException)
            {
                if (!httpContext.Response.HasStarted)
                {
                    httpContext.Response.StatusCode = 499; // Client Closed Request
                }

                return true;
            }

            var errorId = Guid.NewGuid().ToString();
            logger.LogError(exception, "An unhandled exception has occurred: {ErrorId}. {ExceptionMessage}", errorId, exception.Message);

            int statusCode = StatusCodes.Status500InternalServerError;
            string title = "Server error occurred while processing your request.";

            // S3 storage failures should return 503 (Service Unavailable) instead of 500
            if (exception is S3StorageException)
            {
                statusCode = StatusCodes.Status503ServiceUnavailable;
                title = exception.Message; // Use the custom message for S3 errors
            }

            var problemDetails = new ProblemDetails
            {
                Title = title,
                Status = statusCode,
                Extensions = new Dictionary<string, object?> { { "ErrorId", errorId } }
            };

            if (environment.IsDevelopment())
            {
                problemDetails.Detail = exception.ToString();
            }

            httpContext.Response.StatusCode = statusCode;
            await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken: cancellationToken);
            return true;
        }
    }
}
