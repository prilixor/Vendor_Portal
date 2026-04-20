using Prilixor.Shared.Models;
using MediatR;

namespace Prilixor.Shared.Abstractions.CQRS
{
    public interface IQuery<TResponse> : IRequest<Result<TResponse>>
    {
    }
}
