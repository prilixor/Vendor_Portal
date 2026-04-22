using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.Shared.Abstractions.DB;
using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public sealed class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : DbContext(options)
{
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<VendorProfile> VendorProfiles => Set<VendorProfile>();
    public DbSet<VendorDocument> VendorDocuments => Set<VendorDocument>();
    public DbSet<VendorVerificationRequest> VendorVerificationRequests => Set<VendorVerificationRequest>();
    public DbSet<VendorServiceArea> VendorServiceAreas => Set<VendorServiceArea>();
    public DbSet<VendorWorkingHour> VendorWorkingHours => Set<VendorWorkingHour>();
    public DbSet<VendorAvailabilityOverride> VendorAvailabilityOverrides => Set<VendorAvailabilityOverride>();
    public DbSet<VendorBankAccount> VendorBankAccounts => Set<VendorBankAccount>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<VendorProductListing> VendorProductListings => Set<VendorProductListing>();
    public DbSet<VendorProductImage> VendorProductImages => Set<VendorProductImage>();
    public DbSet<VendorProductDocument> VendorProductDocuments => Set<VendorProductDocument>();
    public DbSet<VendorInventory> VendorInventory => Set<VendorInventory>();
    public DbSet<VendorInventoryMovement> VendorInventoryMovements => Set<VendorInventoryMovement>();
    public DbSet<VendorNotificationPreference> VendorNotificationPreferences => Set<VendorNotificationPreference>();
    public DbSet<VendorNotification> VendorNotifications => Set<VendorNotification>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Ignore<List<IDomainEvent>>()
            .ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.ToTable("vendors");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.EmailVerified).HasColumnName("email_verified");
            entity.Property(x => x.AccountStatus).HasColumnName("account_status");
            entity.Property(x => x.RegistrationStage).HasColumnName("registration_stage");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<VendorProfile>(entity =>
        {
            entity.ToTable("vendor_profiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.BusinessName).HasColumnName("business_name");
            entity.Property(x => x.OwnerName).HasColumnName("owner_name");
            entity.Property(x => x.SupportPhone).HasColumnName("support_phone");
            entity.Property(x => x.GstNumber).HasColumnName("gst_number");
            entity.Property(x => x.AddressLine1).HasColumnName("address_line_1");
            entity.Property(x => x.AddressLine2).HasColumnName("address_line_2");
            entity.Property(x => x.City).HasColumnName("city");
            entity.Property(x => x.State).HasColumnName("state");
            entity.Property(x => x.PostalCode).HasColumnName("postal_code");
            entity.Property(x => x.Latitude).HasColumnName("latitude");
            entity.Property(x => x.Longitude).HasColumnName("longitude");
            entity.Property(x => x.OnboardingCompleted).HasColumnName("onboarding_completed");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithOne(x => x.Profile)
                .HasForeignKey<VendorProfile>(x => x.VendorId);
        });

        modelBuilder.Entity<VendorDocument>(entity =>
        {
            entity.ToTable("vendor_documents");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.DocumentType).HasColumnName("document_type");
            entity.Property(x => x.FileUrl).HasColumnName("file_url");
            entity.Property(x => x.DocumentNumber).HasColumnName("document_number");
            entity.Property(x => x.VerificationStatus).HasColumnName("verification_status");
            entity.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            entity.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.Documents)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<VendorVerificationRequest>(entity =>
        {
            entity.ToTable("vendor_verification_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.ReviewStatus).HasColumnName("review_status");
            entity.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            entity.Property(x => x.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(x => x.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.VerificationRequests)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<VendorServiceArea>(entity =>
        {
            entity.ToTable("vendor_service_areas");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.AreaName).HasColumnName("area_name");
            entity.Property(x => x.City).HasColumnName("city");
            entity.Property(x => x.CenterLatitude).HasColumnName("center_latitude");
            entity.Property(x => x.CenterLongitude).HasColumnName("center_longitude");
            entity.Property(x => x.ServiceRadiusKm).HasColumnName("service_radius_km");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.ServiceAreas)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<VendorWorkingHour>(entity =>
        {
            entity.ToTable("vendor_working_hours");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.DayOfWeek).HasColumnName("day_of_week");
            entity.Property(x => x.IsOpen).HasColumnName("is_open");
            entity.Property(x => x.OpenTime).HasColumnName("open_time");
            entity.Property(x => x.CloseTime).HasColumnName("close_time");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.WorkingHours)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<VendorAvailabilityOverride>(entity =>
        {
            entity.ToTable("vendor_availability_overrides");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.OverrideDate).HasColumnName("override_date");
            entity.Property(x => x.IsAvailable).HasColumnName("is_available");
            entity.Property(x => x.StartTime).HasColumnName("start_time");
            entity.Property(x => x.EndTime).HasColumnName("end_time");
            entity.Property(x => x.Reason).HasColumnName("reason");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.AvailabilityOverrides)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<VendorBankAccount>(entity =>
        {
            entity.ToTable("vendor_bank_accounts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.AccountHolderName).HasColumnName("account_holder_name");
            entity.Property(x => x.BankName).HasColumnName("bank_name");
            entity.Property(x => x.AccountNumber).HasColumnName("account_number");
            entity.Property(x => x.IfscCode).HasColumnName("ifsc_code");
            entity.Property(x => x.VerificationStatus).HasColumnName("verification_status");
            entity.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.BankAccounts)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<ProductCategory>(entity =>
        {
            entity.ToTable("product_categories");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CategoryName).HasColumnName("category_name");
            entity.Property(x => x.PrescriptionRequired).HasColumnName("prescription_required");
            entity.Property(x => x.DepositRequired).HasColumnName("deposit_required");
            entity.Property(x => x.InstallationRequired).HasColumnName("installation_required");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasMany(x => x.Products)
                .WithOne(x => x.Category)
                .HasForeignKey(x => x.CategoryId);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CategoryId).HasColumnName("category_id");
            entity.Property(x => x.ProductName).HasColumnName("product_name");
            entity.Property(x => x.BrandName).HasColumnName("brand_name");
            entity.Property(x => x.ModelName).HasColumnName("model_name");
            entity.Property(x => x.ShortDescription).HasColumnName("short_description");
            entity.Property(x => x.LongDescription).HasColumnName("long_description");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasMany(x => x.VendorProductListings)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId);
        });

        modelBuilder.Entity<VendorProductListing>(entity =>
        {
            entity.ToTable("vendor_product_listings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.ListingTitle).HasColumnName("listing_title");
            entity.Property(x => x.DailyRent).HasColumnName("daily_rent");
            entity.Property(x => x.MonthlyRent).HasColumnName("monthly_rent");
            entity.Property(x => x.SecurityDeposit).HasColumnName("security_deposit");
            entity.Property(x => x.AvailableQuantity).HasColumnName("available_quantity");
            entity.Property(x => x.ListingStatus).HasColumnName("listing_status");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.ProductListings)
                .HasForeignKey(x => x.VendorId);
            entity.HasOne(x => x.Product)
                .WithMany(x => x.VendorProductListings)
                .HasForeignKey(x => x.ProductId);
            entity.HasOne(x => x.Inventory)
                .WithOne(x => x.VendorProductListing)
                .HasForeignKey<VendorInventory>(x => x.VendorProductListingId);
        });

        modelBuilder.Entity<VendorProductImage>(entity =>
        {
            entity.ToTable("vendor_product_images");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.ImageUrl).HasColumnName("image_url");
            entity.Property(x => x.DisplayOrder).HasColumnName("display_order");
            entity.Property(x => x.IsPrimary).HasColumnName("is_primary");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.VendorProductListing)
                .WithMany(x => x.Images)
                .HasForeignKey(x => x.VendorProductListingId);
        });

        modelBuilder.Entity<VendorProductDocument>(entity =>
        {
            entity.ToTable("vendor_product_documents");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.DocumentType).HasColumnName("document_type");
            entity.Property(x => x.FileUrl).HasColumnName("file_url");
            entity.Property(x => x.VerificationStatus).HasColumnName("verification_status");
            entity.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            entity.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.VendorProductListing)
                .WithMany(x => x.Documents)
                .HasForeignKey(x => x.VendorProductListingId);
        });

        modelBuilder.Entity<VendorInventory>(entity =>
        {
            entity.ToTable("vendor_inventory");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.TotalQuantity).HasColumnName("total_quantity");
            entity.Property(x => x.AvailableQuantity).HasColumnName("available_quantity");
            entity.Property(x => x.ReservedQuantity).HasColumnName("reserved_quantity");
            entity.Property(x => x.RentedQuantity).HasColumnName("rented_quantity");
            entity.Property(x => x.BlockedQuantity).HasColumnName("blocked_quantity");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasMany(x => x.Movements)
                .WithOne(x => x.VendorInventory)
                .HasForeignKey(x => x.VendorInventoryId);
        });

        modelBuilder.Entity<VendorInventoryMovement>(entity =>
        {
            entity.ToTable("vendor_inventory_movements");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorInventoryId).HasColumnName("vendor_inventory_id");
            entity.Property(x => x.MovementType).HasColumnName("movement_type");
            entity.Property(x => x.Quantity).HasColumnName("quantity");
            entity.Property(x => x.ReferenceType).HasColumnName("reference_type");
            entity.Property(x => x.ReferenceId).HasColumnName("reference_id");
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<VendorNotificationPreference>(entity =>
        {
            entity.ToTable("vendor_notification_preferences");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.EmailNotificationsEnabled).HasColumnName("email_notifications_enabled");
            entity.Property(x => x.PushNotificationsEnabled).HasColumnName("push_notifications_enabled");
            entity.Property(x => x.NewOrderNotifications).HasColumnName("new_order_notifications");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithOne(x => x.NotificationPreference)
                .HasForeignKey<VendorNotificationPreference>(x => x.VendorId);
        });

        modelBuilder.Entity<VendorNotification>(entity =>
        {
            entity.ToTable("vendor_notifications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.NotificationType).HasColumnName("notification_type");
            entity.Property(x => x.Title).HasColumnName("title");
            entity.Property(x => x.Message).HasColumnName("message");
            entity.Property(x => x.Channel).HasColumnName("channel");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.SentAt).HasColumnName("sent_at");
            entity.Property(x => x.ReadAt).HasColumnName("read_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.Notifications)
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.ToTable("admin_users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.FullName).HasColumnName("full_name");
            entity.Property(x => x.Role).HasColumnName("role");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasMany(x => x.AuditLogs)
                .WithOne(x => x.AdminUser)
                .HasForeignKey(x => x.AdminUserId);
        });

        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.ToTable("admin_audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(x => x.ActionType).HasColumnName("action_type");
            entity.Property(x => x.EntityType).HasColumnName("entity_type");
            entity.Property(x => x.EntityId).HasColumnName("entity_id");
            entity.Property(x => x.OldValue).HasColumnName("old_value").HasColumnType("jsonb");
            entity.Property(x => x.NewValue).HasColumnName("new_value").HasColumnType("jsonb");
            entity.Property(x => x.Notes).HasColumnName("notes");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("password_reset_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.Token).HasColumnName("token");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.IsUsed).HasColumnName("is_used");
            entity.Property(x => x.UsedAt).HasColumnName("used_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });
    }
}
