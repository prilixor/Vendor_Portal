using MediatR;

namespace Prilixor.Shared.Abstractions.DB
{
    public interface IDomainEventHandler<T> : INotificationHandler<T>
        where T : IDomainEvent
    {
    }
}
