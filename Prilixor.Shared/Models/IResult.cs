namespace Prilixor.Shared.Models
{
    public interface IResult
    {
        bool IsSuccess { get; }
        IReadOnlyList<Error> Errors { get; }
    }

    public interface IResult<T> : IResult
    {
        T Value { get; }
    }
}
