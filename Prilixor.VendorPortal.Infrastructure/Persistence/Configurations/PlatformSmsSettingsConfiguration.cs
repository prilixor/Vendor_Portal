using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Prilixor.VendorPortal.Domain.Platform;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Configurations;

public sealed class PlatformSmsSettingsConfiguration : IEntityTypeConfiguration<PlatformSmsSettings>
{
    public void Configure(EntityTypeBuilder<PlatformSmsSettings> builder)
    {
        builder.ToTable("platform_sms_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");

        builder.Property(x => x.TransactionalSmsEnabled).HasColumnName("transactional_sms_enabled").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderPlaced).HasColumnName("customer_order_placed").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderConfirmed).HasColumnName("customer_order_confirmed").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderCancelled).HasColumnName("customer_order_cancelled").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderStatusUpdated).HasColumnName("customer_order_status_updated").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderDispatchFailed).HasColumnName("customer_order_dispatch_failed").HasDefaultValue(false);
        builder.Property(x => x.CustomerOrderExpiring).HasColumnName("customer_order_expiring").HasDefaultValue(false);
        builder.Property(x => x.VendorNewOrder).HasColumnName("vendor_new_order").HasDefaultValue(false);
        builder.Property(x => x.VendorAccountApproved).HasColumnName("vendor_account_approved").HasDefaultValue(false);
        builder.Property(x => x.VendorAccountRejected).HasColumnName("vendor_account_rejected").HasDefaultValue(false);
        builder.Property(x => x.VendorAccountSuspended).HasColumnName("vendor_account_suspended").HasDefaultValue(false);
        builder.Property(x => x.VendorAccountBanned).HasColumnName("vendor_account_banned").HasDefaultValue(false);
        builder.Property(x => x.VendorAccountReactivated).HasColumnName("vendor_account_reactivated").HasDefaultValue(false);
        builder.Property(x => x.VendorBankVerified).HasColumnName("vendor_bank_verified").HasDefaultValue(false);
        builder.Property(x => x.VendorDocumentVerified).HasColumnName("vendor_document_verified").HasDefaultValue(false);
        builder.Property(x => x.VendorServiceAreaUpdated).HasColumnName("vendor_service_area_updated").HasDefaultValue(false);

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
