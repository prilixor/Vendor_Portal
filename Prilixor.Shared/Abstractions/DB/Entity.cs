namespace Prilixor.Shared.Abstractions.DB
{
    public abstract class Entity<T> : IEntity<T> where T : IEquatable<T>
    {
        private List<IDomainEvent> _domainEvents = [];
        public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

        protected Entity(T id) => Id = id;
        protected Entity()
        {
        }

        public T Id { get; set; } = default!;

        public void AddDomainEvent(IDomainEvent eventItem)
        {
            _domainEvents.Add(eventItem);
        }

        public void RemoveDomainEvent(IDomainEvent eventItem)
        {
            _domainEvents.Remove(eventItem);
        }

        public void ClearDomainEvents()
        {
            _domainEvents.Clear();
        }
    }

    public abstract class Entity : Entity<string>
    {
    }

    public interface IEntity<T> : IEntity where T : IEquatable<T>
    {
        T Id { get; set; }
    }

    public interface IEntity
    {
        IReadOnlyCollection<IDomainEvent> DomainEvents { get; }
        void AddDomainEvent(IDomainEvent eventItem);
        void RemoveDomainEvent(IDomainEvent eventItem);
        void ClearDomainEvents();
    }
}
