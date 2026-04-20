namespace Prilixor.Shared.Models
{
    public class Result : IResult
    {
        protected internal Result(bool isSuccess, IReadOnlyList<Error> errors)
        {
            if (isSuccess && errors.Any() ||
                !isSuccess && !errors.Any())
            {
                throw new InvalidOperationException();
            }

            IsSuccess = isSuccess;
            Errors = errors;
        }

        public bool IsSuccess { get; }
        public bool IsFailure => !IsSuccess;
        public IReadOnlyList<Error> Errors { get; }

        public static Result Success() => new(true, []);
        public static Result Failure(Error error) => new(false, [error]);
        public static Result Failure(IReadOnlyList<Error> errors) => new(false, errors);

        public static Result<T> Success<T>(T value) => new(value, true, []);
        public static Result<T> Failure<T>(Error error) => new(default!, false, [error]);
        public static Result<T> Failure<T>(IReadOnlyList<Error> errors) => new(default!, false, errors);
    }

    public class Result<T> : Result, IResult<T>
    {
        protected internal Result(T value, bool isSuccess, IReadOnlyList<Error> errors)
            : base(isSuccess, errors)
        {
            Value = value;
        }

        public T Value { get; }

        public static implicit operator T(Result<T> result) => result.Value;
        public static implicit operator Result<T>(T value) => Success(value);

        public TResult Match<TResult>(Func<T, TResult> onSuccess, Func<IReadOnlyList<Error>, TResult> onFailure)
            => IsSuccess ? onSuccess(Value) : onFailure(Errors);

        public Result<TResult> Map<TResult>(Func<T, TResult> mapper)
            => IsSuccess ? Success(mapper(Value)) : Failure<TResult>(Errors);
    }
}
