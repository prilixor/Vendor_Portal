using FluentValidation;
using MediatR;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Behaviours
{
    public class ValidationBehaviour<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
        : IPipelineBehavior<TRequest, TResponse>
        where TRequest : notnull
    {
        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            if (!validators.Any())
                return await next();

            var context = new ValidationContext<TRequest>(request);

            var validationResults = await Task.WhenAll(
                validators.Select(v => v.ValidateAsync(context, cancellationToken)));

            var failures = validationResults
                .SelectMany(r => r.Errors)
                .Where(f => f != null)
                .ToList();

            if (failures.Count != 0)
            {
                var errors = failures
                    .Select(f => new Error(f.PropertyName, f.ErrorMessage, ErrorCategory.Validation))
                    .ToList();

                // If TResponse is Result or Result<T>, return a failure result
                if (typeof(TResponse) == typeof(Result))
                {
                    return (TResponse)(object)Result.Failure(errors);
                }

                var resultType = typeof(TResponse);
                if (resultType.IsGenericType && resultType.GetGenericTypeDefinition() == typeof(Result<>))
                {
                    var failureMethod = typeof(Result)
                        .GetMethods()
                        .First(m => m.Name == "Failure" && m.IsGenericMethod && m.GetParameters()[0].ParameterType == typeof(IReadOnlyList<Error>))
                        .MakeGenericMethod(resultType.GetGenericArguments()[0]);

                    return (TResponse)failureMethod.Invoke(null, [errors])!;
                }

                throw new ValidationException(failures);
            }

            return await next();
        }
    }
}
