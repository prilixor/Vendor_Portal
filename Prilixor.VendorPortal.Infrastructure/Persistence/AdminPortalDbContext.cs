using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

/// <summary>
/// Admin portal bounded context.
/// Uses configuration key <c>AdminPortalConnection</c> and falls back to <c>DefaultConnection</c> when unset.
/// </summary>
public sealed class AdminPortalDbContext(DbContextOptions<AdminPortalDbContext> options)
    : ApplicationDbContext(options)
{
    public DbSet<Prilixor.VendorPortal.Domain.Auth.RefreshToken> RefreshTokens { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Prilixor.VendorPortal.Domain.Auth.RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Token).HasColumnName("token");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.IsRevoked).HasColumnName("is_revoked");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });
    }
}
