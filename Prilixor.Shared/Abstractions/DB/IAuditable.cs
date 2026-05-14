namespace Prilixor.Shared.Abstractions.DB
{
    public interface IAuditable
    {
        public DateTime CreatedOnUtc { get; set; }
        public DateTime? ModifiedOnUtc { get; set; }
    public Guid? CreatedBy { get; }
    public Guid? ModifiedBy { get; }
    }
}
