namespace Prilixor.Shared.Abstractions.DB
{
    public class AuditableEntity : Entity, IAuditable
    {
        public DateTime CreatedOnUtc { get; init; }
    public Guid? CreatedBy { get; init; }
        public DateTime? ModifiedOnUtc { get; private set; }
    public Guid? ModifiedBy { get; private set; }
    }

    public class AuditableEntity<T> : Entity<T>, IAuditable
        where T : IEquatable<T>
    {
        public DateTime CreatedOnUtc { get; init; }
    public Guid? CreatedBy { get; init; }
        public DateTime? ModifiedOnUtc { get; private set; }
    public Guid? ModifiedBy { get; private set; }
    }
}
