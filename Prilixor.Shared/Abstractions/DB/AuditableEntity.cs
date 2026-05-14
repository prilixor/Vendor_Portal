namespace Prilixor.Shared.Abstractions.DB
{
    public class AuditableEntity : Entity, IAuditable
    {
        public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; init; }
        public DateTime? ModifiedOnUtc { get; set; }
    public Guid? ModifiedBy { get; private set; }
    }

    public class AuditableEntity<T> : Entity<T>, IAuditable
        where T : IEquatable<T>
    {
        public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public Guid? CreatedBy { get; init; }
        public DateTime? ModifiedOnUtc { get; set; }
    public Guid? ModifiedBy { get; private set; }
    }
}
