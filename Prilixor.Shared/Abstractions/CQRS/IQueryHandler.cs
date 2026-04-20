using Prilixor.Shared.Models;
using MediatR;

namespace Prilixor.Shared.Abstractions.CQRS
{
    public interface IQueryHandler<TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
        where TQuery : IQuery<TResponse>
    {
    }
}
