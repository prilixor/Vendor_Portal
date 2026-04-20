using Prilixor.Shared.Models;
using MediatR;

namespace Prilixor.Shared.Abstractions.CQRS
{
    public interface ICommand : IRequest<Result>
    {
    }

    public interface ICommand<TResponse> : IRequest<Result<TResponse>>
    {
    }
}
