namespace Prilixor.Shared.Abstractions.DB
{
    public interface ISoftDelete
    {
        bool IsDeleted { get; }
    }
}
