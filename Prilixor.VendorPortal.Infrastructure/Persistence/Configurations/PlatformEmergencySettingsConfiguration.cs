using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Prilixor.VendorPortal.Domain.Platform;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Configurations;

public sealed class PlatformEmergencySettingsConfiguration : IEntityTypeConfiguration<PlatformEmergencySettings>
{
    public void Configure(EntityTypeBuilder<PlatformEmergencySettings> builder)
    {
        builder.ToTable("platform_emergency_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.AlertVendorEnabled).HasColumnName("alert_vendor_enabled").HasDefaultValue(false);
        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");
        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
