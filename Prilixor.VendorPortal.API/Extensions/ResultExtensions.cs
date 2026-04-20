using Prilixor.Shared.Models;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Prilixor.VendorPortal.API.Extensions
{
    public static class ResultExtensions
    {
        public static ProblemHttpResult ToErrorResponse(this Result result)
        {
            if (result.IsSuccess)
            {
                throw new InvalidOperationException("Cannot create an error response from a successful result.");
            }

            var firstError = result.Errors.FirstOrDefault();
            var statusCode = GetStatusCodeForError(firstError);

            return TypedResults.Problem(
                statusCode: statusCode,
                title: firstError?.Code ?? "Error",
                detail: firstError?.Description ?? "An error occurred",
                extensions: new Dictionary<string, object?>
                {
                    { "errors", result.Errors }
                });
        }

        private static int GetStatusCodeForError(Error? error)
        {
            return error?.Category switch
            {
                ErrorCategory.NotFound => StatusCodes.Status404NotFound,
                ErrorCategory.Validation => StatusCodes.Status400BadRequest,
                ErrorCategory.Unauthorized => StatusCodes.Status401Unauthorized,
                ErrorCategory.Forbidden => StatusCodes.Status403Forbidden,
                _ => StatusCodes.Status500InternalServerError
            };
        }
    }
}
