using Microsoft.EntityFrameworkCore;
using Prilixor.Shared.Abstractions.DB;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

/// <summary>
/// Customer portal bounded context. Uses configuration key <c>CustomerPortalConnection</c> or falls back to <c>DefaultConnection</c> when unset.
/// </summary>
public sealed class CustomerPortalDbContext(DbContextOptions<CustomerPortalDbContext> options)
    : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();
    public DbSet<CustomerRentalOrder> CustomerRentalOrders => Set<CustomerRentalOrder>();
    public DbSet<CustomerOrderVendorOffer> CustomerOrderVendorOffers => Set<CustomerOrderVendorOffer>();
    public DbSet<CustomerNotification> CustomerNotifications => Set<CustomerNotification>();
    public DbSet<CustomerNotificationPreference> CustomerNotificationPreferences => Set<CustomerNotificationPreference>();
    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Ignore<List<IDomainEvent>>();

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("customers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.FullName).HasColumnName("full_name");
            entity.Property(x => x.Phone).HasColumnName("phone");
            entity.Property(x => x.IsEmailVerified).HasColumnName("email_verified");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasMany(x => x.Addresses).WithOne(x => x.Customer).HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<CustomerAddress>(entity =>
        {
            entity.ToTable("customer_addresses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.Label).HasColumnName("label");
            entity.Property(x => x.Line1).HasColumnName("line_1");
            entity.Property(x => x.City).HasColumnName("city");
            entity.Property(x => x.State).HasColumnName("state");
            entity.Property(x => x.Postal).HasColumnName("postal");
            entity.Property(x => x.Latitude).HasColumnName("latitude");
            entity.Property(x => x.Longitude).HasColumnName("longitude");
            entity.Property(x => x.IsDefault).HasColumnName("is_default");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        // Listing id references vendor DB — no cross-database FK.
        modelBuilder.Entity<CustomerRentalOrder>(entity =>
        {
            entity.ToTable("customer_rental_orders");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OrderNumber).HasColumnName("order_number");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.CustomerAddressId).HasColumnName("customer_address_id");
            entity.Property(x => x.Quantity).HasColumnName("quantity");
            entity.Property(x => x.RentalDays).HasColumnName("rental_days");
            entity.Property(x => x.OrderType).HasColumnName("order_type");
            entity.Property(x => x.DeliveryOption).HasColumnName("delivery_option");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.SubtotalAmount).HasColumnName("subtotal_amount");
            entity.Property(x => x.DepositAmount).HasColumnName("deposit_amount");
            entity.Property(x => x.ServiceFeeAmount).HasColumnName("service_fee_amount");
            entity.Property(x => x.DistanceFeeAmount).HasColumnName("distance_fee_amount");
            entity.Property(x => x.ExpressFeeAmount).HasColumnName("express_fee_amount");
            entity.Property(x => x.GstAmount).HasColumnName("gst_amount");
            entity.Property(x => x.TotalAmount).HasColumnName("total_amount");
            entity.Property(x => x.StartDate).HasColumnName("start_date");
            entity.Property(x => x.EndDate).HasColumnName("end_date");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.CustomerAddress)
                .WithMany()
                .HasForeignKey(x => x.CustomerAddressId)
                .IsRequired(false);
            entity.HasOne(x => x.Customer)
                .WithMany(x => x.Orders)
                .HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<CustomerOrderVendorOffer>(entity =>
        {
            entity.ToTable("customer_order_vendor_offers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerRentalOrderId).HasColumnName("customer_rental_order_id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.OfferRank).HasColumnName("offer_rank");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.RespondedAt).HasColumnName("responded_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.CustomerRentalOrder)
                .WithMany()
                .HasForeignKey(x => x.CustomerRentalOrderId);
        });

        modelBuilder.Entity<CustomerNotification>(entity =>
        {
            entity.ToTable("customer_notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.Title).HasColumnName("title");
            entity.Property(x => x.Body).HasColumnName("body");
            entity.Property(x => x.NotificationType).HasColumnName("notification_type");
            entity.Property(x => x.RelatedOrderId).HasColumnName("related_order_id");
            entity.Property(x => x.ReadAt).HasColumnName("read_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.HasOne(x => x.Customer)
                .WithMany(x => x.Notifications)
                .HasForeignKey(x => x.CustomerId);
        });

        modelBuilder.Entity<CustomerNotificationPreference>(entity =>
        {
            entity.ToTable("customer_notification_preferences");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.OrderStatusUpdatesEnabled).HasColumnName("order_status_updates_enabled");
            entity.Property(x => x.ExpirationRemindersEnabled).HasColumnName("expiration_reminders_enabled");
            entity.Property(x => x.DepositRefundsEnabled).HasColumnName("deposit_refunds_enabled");
            entity.Property(x => x.DirectMessagesEnabled).HasColumnName("direct_messages_enabled");
            entity.Property(x => x.MarketingEmailsEnabled).HasColumnName("marketing_emails_enabled");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Customer)
                .WithOne()
                .HasForeignKey<CustomerNotificationPreference>(x => x.CustomerId);
        });

        modelBuilder.Entity<ChatSession>(entity =>
        {
            entity.ToTable("chat_sessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.OrderId).HasColumnName("order_id").IsRequired(false);
            entity.Property(x => x.Subject).HasColumnName("subject");
            entity.Property(x => x.LastMessageAt).HasColumnName("last_message_at");
            entity.Property(x => x.IsClosed).HasColumnName("is_closed");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.Ignore(x => x.Vendor);
            entity.HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId);
            entity.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .IsRequired(false);
        });

        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.ToTable("chat_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ChatSessionId).HasColumnName("chat_session_id");
            entity.Property(x => x.SenderType).HasColumnName("sender_type");
            entity.Property(x => x.MessageText).HasColumnName("message_text");
            entity.Property(x => x.SentAt).HasColumnName("sent_at");
            entity.Property(x => x.IsRead).HasColumnName("is_read");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.ChatSession)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ChatSessionId);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker
            .Entries()
            .Where(e => e.Entity is IAuditable && (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entityEntry in entries)
        {
            var auditable = (IAuditable)entityEntry.Entity;
            if (entityEntry.State == EntityState.Added)
            {
                if (auditable.CreatedOnUtc == default)
                {
                    auditable.CreatedOnUtc = DateTime.UtcNow;
                }

                if (auditable.ModifiedOnUtc is null)
                {
                    auditable.ModifiedOnUtc = DateTime.UtcNow;
                }
            }
            else
            {
                auditable.ModifiedOnUtc = DateTime.UtcNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
