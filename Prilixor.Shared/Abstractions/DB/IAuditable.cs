namespace Prilixor.Shared.Abstractions.DB
{
    public interface IAuditable
    {
        public DateTime CreatedOnUtc { get; }
        public DateTime? ModifiedOnUtc { get; }
    public Guid? CreatedBy { get; }
    public Guid? ModifiedBy { get; }
    }
}
