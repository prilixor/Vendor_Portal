using System.Text.Json.Serialization;

namespace Prilixor.Shared.Models
{
    public sealed record Error(
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("description")] string? Description = null,
        [property: JsonPropertyName("category")] ErrorCategory? Category = null)
    {
        public static implicit operator Result(Error error) => Result.Failure(error);
    };
}
