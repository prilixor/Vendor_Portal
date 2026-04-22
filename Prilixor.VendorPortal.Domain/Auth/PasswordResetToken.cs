using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Auth;

public class PasswordResetToken : Entity<Guid>
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
