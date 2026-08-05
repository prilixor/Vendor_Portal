using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.VendorPortal.Domain.Support;
using Prilixor.Shared.Abstractions.DB;
using Microsoft.EntityFrameworkCore;
using Prilixor.VendorPortal.Domain.Common;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected ApplicationDbContext(DbContextOptions options)
        : base(options)
    {
    }

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
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<VendorProductListing> VendorProductListings => Set<VendorProductListing>();
    public DbSet<VendorProductImage> VendorProductImages => Set<VendorProductImage>();
    public DbSet<VendorProductDocument> VendorProductDocuments => Set<VendorProductDocument>();
    public DbSet<VendorInventory> VendorInventory => Set<VendorInventory>();
    public DbSet<VendorInventoryMovement> VendorInventoryMovements => Set<VendorInventoryMovement>();
    public DbSet<VendorNotificationPreference> VendorNotificationPreferences => Set<VendorNotificationPreference>();
    public DbSet<VendorNotification> VendorNotifications => Set<VendorNotification>();
    public DbSet<VendorPushSubscription> VendorPushSubscriptions => Set<VendorPushSubscription>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<AdminRole> AdminRoles => Set<AdminRole>();
    public DbSet<AdminPermission> AdminPermissions => Set<AdminPermission>();
    public DbSet<AdminRolePermission> AdminRolePermissions => Set<AdminRolePermission>();
    public DbSet<AdminImpersonationExchange> AdminImpersonationExchanges => Set<AdminImpersonationExchange>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();
    public DbSet<VendorProductAsset> VendorProductAssets => Set<VendorProductAsset>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<HospitalDoctor> HospitalDoctors => Set<HospitalDoctor>();
    public DbSet<ChemicalProperty> ChemicalProperties => Set<ChemicalProperty>();
    public DbSet<VendorVariantInventory> VendorVariantInventories => Set<VendorVariantInventory>();
    public DbSet<RentalDurationMaster> RentalDurationMasters => Set<RentalDurationMaster>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHomeContent> WebsiteHomeContents => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHomeContent>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHomeFeature> WebsiteHomeFeatures => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHomeFeature>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteAboutContent> WebsiteAboutContents => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteAboutContent>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteAudienceCategory> WebsiteAudienceCategories => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteAudienceCategory>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteServicesHeader> WebsiteServicesHeaders => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteServicesHeader>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteServiceItem> WebsiteServiceItems => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteServiceItem>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteFaqCategory> WebsiteFaqCategories => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteFaqCategory>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteFaqItem> WebsiteFaqItems => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteFaqItem>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteContactContent> WebsiteContactContents => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteContactContent>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHowItWorksHeader> WebsiteHowItWorksHeaders => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHowItWorksHeader>();
    public DbSet<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHowItWorksStep> WebsiteHowItWorksSteps => Set<Prilixor.VendorPortal.Domain.WebsiteContent.WebsiteHowItWorksStep>();
    public DbSet<RentalDurationIcon> RentalDurationIcons => Set<RentalDurationIcon>();
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
            entity.Property(x => x.SupportPhone).HasColumnName("support_phone").IsRequired(false);
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.IsEmailVerified).HasColumnName("email_verified");
            entity.Property(x => x.EmailVerificationToken).HasColumnName("email_verification_token");
            entity.Property(x => x.VerificationTokenExpiryUtc).HasColumnName("verification_token_expiry_utc");
            entity.Property(x => x.AccountStatus).HasColumnName("account_status");
            entity.Property(x => x.RegistrationStage).HasColumnName("registration_stage");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.TermsAcceptedAt).HasColumnName("terms_accepted_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
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
            entity.Property(x => x.BranchName).HasColumnName("branch_name");
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
            entity.Property(x => x.IsChemical).HasColumnName("is_chemical");
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
            entity.Property(x => x.DailyRent).HasColumnName("daily_rent");
            entity.Property(x => x.WeeklyRent).HasColumnName("weekly_rent");
            entity.Property(x => x.MonthlyRent).HasColumnName("monthly_rent");
            entity.Property(x => x.SecurityDeposit).HasColumnName("security_deposit");
            entity.Property(x => x.BuyPrice).HasColumnName("buy_price");
            entity.Property(x => x.VendorDailyRent).HasColumnName("vendor_daily_rent");
            entity.Property(x => x.VendorWeeklyRent).HasColumnName("vendor_weekly_rent");
            entity.Property(x => x.VendorMonthlyRent).HasColumnName("vendor_monthly_rent");
            entity.Property(x => x.VendorSecurityDeposit).HasColumnName("vendor_security_deposit");
            entity.Property(x => x.VendorBuyPrice).HasColumnName("vendor_buy_price");
            entity.Property(x => x.GstPercent).HasColumnName("gst_percent");
            entity.Property(x => x.IsRentEnabled).HasColumnName("is_rent_enabled");
            entity.Property(x => x.IsBuyEnabled).HasColumnName("is_buy_enabled");
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
            entity.HasMany(x => x.ProductImages)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId);
            entity.HasOne(x => x.ChemicalProperty)
                .WithOne(x => x.Product)
                .HasForeignKey<ChemicalProperty>(x => x.ProductId);
            entity.HasMany(x => x.Variants)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId);
            entity.HasMany(x => x.RentalPricingPlans)
                .WithOne(x => x.Product)
                .HasForeignKey(x => x.ProductId);
        });

        modelBuilder.Entity<ChemicalProperty>(entity =>
        {
            entity.ToTable("chemical_properties");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.CasNumber).HasColumnName("cas_number");
            entity.Property(x => x.ChemicalFormula).HasColumnName("chemical_formula");
            entity.Property(x => x.PurityPercentage).HasColumnName("purity_percentage");
            entity.Property(x => x.MolecularWeight).HasColumnName("molecular_weight");
            entity.Property(x => x.BaseUnit).HasColumnName("base_unit");
            entity.Property(x => x.SdsDocumentUrl).HasColumnName("sds_document_url");
            entity.Property(x => x.CoaDocumentUrl).HasColumnName("coa_document_url");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
        });

        modelBuilder.Entity<ProductVariant>(entity =>
        {
            entity.ToTable("product_variants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.Sku).HasColumnName("sku");
            entity.Property(x => x.SizeValue).HasColumnName("size_value");
            entity.Property(x => x.SizeUnit).HasColumnName("size_unit");
            entity.Property(x => x.VendorPrice).HasColumnName("vendor_price");
            entity.Property(x => x.BuyPrice).HasColumnName("buy_price");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.HasOne(x => x.Product)
                .WithMany(x => x.Variants)
                .HasForeignKey(x => x.ProductId);
        });

        modelBuilder.Entity<ProductRentalPricingPlan>(entity =>
        {
            entity.ToTable("product_rental_pricing_plans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.DurationLabel).HasColumnName("duration_label");
            entity.Property(x => x.DurationDays).HasColumnName("duration_days");
            entity.Property(x => x.BillingCycles).HasColumnName("billing_cycles");
            entity.Property(x => x.NormalPrice).HasColumnName("normal_price");
            entity.Property(x => x.DiscountType).HasColumnName("discount_type");
            entity.Property(x => x.DiscountValue).HasColumnName("discount_value");
            entity.Property(x => x.FinalRentalPrice).HasColumnName("final_rental_price");
            entity.Property(x => x.IsRecommended).HasColumnName("is_recommended");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.RentalDurationMasterId).HasColumnName("rental_duration_master_id");
            entity.Property(x => x.RentalDurationIconId).HasColumnName("rental_duration_icon_id");
            entity.Property(x => x.IconUrl).HasColumnName("icon_url");
            entity.Property(x => x.IconThumbnailUrl).HasColumnName("icon_thumbnail_url");
            entity.Property(x => x.ValueTier).HasColumnName("value_tier");
            entity.Property(x => x.IconName).HasColumnName("icon_name");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);
            entity.HasOne(x => x.Product)
                .WithMany(x => x.RentalPricingPlans)
                .HasForeignKey(x => x.ProductId);
        });

        modelBuilder.Entity<RentalDurationMaster>(entity =>
        {
            entity.ToTable("rental_duration_masters");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.DurationLabel).HasColumnName("duration_label");
            entity.Property(x => x.DurationDays).HasColumnName("duration_days");
            entity.Property(x => x.BillingCycles).HasColumnName("billing_cycles");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<RentalDurationIcon>(entity =>
        {
            entity.ToTable("rental_duration_icons");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.ValueTier).HasColumnName("value_tier");
            entity.Property(x => x.ImageUrl).HasColumnName("image_url");
            entity.Property(x => x.ThumbnailUrl).HasColumnName("thumbnail_url");
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.ToTable("product_images");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProductId).HasColumnName("product_id");
            entity.Property(x => x.ImageUrl).HasColumnName("image_url");
            entity.Property(x => x.ThumbnailUrl).HasColumnName("thumbnail_url");
            entity.Property(x => x.DisplayOrder).HasColumnName("display_order");
            entity.Property(x => x.IsPrimary).HasColumnName("is_primary");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Product)
                .WithMany(x => x.ProductImages)
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
            entity.Property(x => x.WeeklyRent).HasColumnName("weekly_rent");
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
            entity.Property(x => x.ThumbnailUrl).HasColumnName("thumbnail_url");
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
            entity.Property(x => x.EventAt).HasColumnName("event_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<VendorProductAsset>(entity =>
        {
            entity.ToTable("vendor_product_assets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.ProductVariantId).HasColumnName("product_variant_id");
            entity.Property(x => x.AssetTag).HasColumnName("asset_tag");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.Condition).HasColumnName("condition");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            
            entity.HasIndex(x => new { x.VendorProductListingId, x.AssetTag }).IsUnique();
            
            entity.HasOne(x => x.VendorProductListing)
                .WithMany()
                .HasForeignKey(x => x.VendorProductListingId);

            entity.HasOne(x => x.ProductVariant)
                .WithMany()
                .HasForeignKey(x => x.ProductVariantId)
                .OnDelete(DeleteBehavior.SetNull);
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

        modelBuilder.Entity<VendorPushSubscription>(entity =>
        {
            entity.ToTable("vendor_push_subscriptions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.Endpoint).HasColumnName("endpoint");
            entity.Property(x => x.P256DH).HasColumnName("p256dh");
            entity.Property(x => x.Auth).HasColumnName("auth");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.PushSubscriptions)
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
            entity.Property(x => x.RoleId).HasColumnName("role_id");
            entity.Property(x => x.IsSystemUser).HasColumnName("is_system_user");
            entity.Property(x => x.MustChangePassword).HasColumnName("must_change_password");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.HasOne(x => x.AdminRole)
                .WithMany(x => x.Users)
                .HasForeignKey(x => x.RoleId)
                .IsRequired(false);
            entity.HasMany(x => x.AuditLogs)
                .WithOne(x => x.AdminUser)
                .HasForeignKey(x => x.AdminId);
        });

        modelBuilder.Entity<AdminRole>(entity =>
        {
            entity.ToTable("admin_roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.IsSystem).HasColumnName("is_system");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<AdminPermission>(entity =>
        {
            entity.ToTable("admin_permissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.Category).HasColumnName("category");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        });

        modelBuilder.Entity<AdminRolePermission>(entity =>
        {
            entity.ToTable("admin_role_permissions");
            entity.HasKey(x => new { x.RoleId, x.PermissionId });
            entity.Property(x => x.RoleId).HasColumnName("role_id");
            entity.Property(x => x.PermissionId).HasColumnName("permission_id");
            entity.HasOne(x => x.Role)
                .WithMany(x => x.RolePermissions)
                .HasForeignKey(x => x.RoleId);
            entity.HasOne(x => x.Permission)
                .WithMany(x => x.RolePermissions)
                .HasForeignKey(x => x.PermissionId);
        });

        modelBuilder.Entity<AdminImpersonationExchange>(entity =>
        {
            entity.ToTable("admin_impersonation_exchanges");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CodeHash).HasColumnName("code_hash");
            entity.Property(x => x.AdminUserId).HasColumnName("admin_user_id");
            entity.Property(x => x.TargetType).HasColumnName("target_type");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.CustomerId).HasColumnName("customer_id");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.ConsumedAt).HasColumnName("consumed_at");
            entity.Property(x => x.IsConsumed).HasColumnName("is_consumed");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
        });

        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.ToTable("admin_audit_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.AdminId).HasColumnName("admin_user_id");
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

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.ToTable("support_tickets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorId).HasColumnName("vendor_id");
            entity.Property(x => x.TicketNumber).HasColumnName("ticket_number");
            entity.Property(x => x.Category).HasColumnName("category");
            entity.Property(x => x.Subject).HasColumnName("subject");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);

            entity.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId);
        });

        modelBuilder.Entity<SupportMessage>(entity =>
        {
            entity.ToTable("support_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.TicketId).HasColumnName("ticket_id");
            entity.Property(x => x.SenderId).HasColumnName("sender_id");
            entity.Property(x => x.SenderType).HasColumnName("sender_type");
            entity.Property(x => x.Message).HasColumnName("message");
            entity.Property(x => x.AttachmentUrls).HasColumnName("attachment_urls");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);

            entity.HasOne(x => x.Ticket)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.TicketId);
        });

        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.ToTable("doctors");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200);
            entity.Property(x => x.UniqueCode).HasColumnName("unique_code").HasMaxLength(20);
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(255);
            entity.Property(x => x.Specialization).HasColumnName("specialization").HasMaxLength(150);
            entity.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(30);
            entity.Property(x => x.IsActive).HasColumnName("is_active");

            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");

            entity.HasIndex(x => x.UniqueCode).IsUnique().HasFilter("is_deleted = false");
        });

        modelBuilder.Entity<Hospital>(entity =>
        {
            entity.ToTable("hospitals");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(x => x.AddressLine1).HasColumnName("address_line_1").HasMaxLength(500);
            entity.Property(x => x.City).HasColumnName("city").HasMaxLength(120);
            entity.Property(x => x.State).HasColumnName("state").HasMaxLength(120);
            entity.Property(x => x.PostalCode).HasColumnName("postal_code").HasMaxLength(20);
            entity.Property(x => x.Latitude).HasColumnName("latitude").HasPrecision(9, 6);
            entity.Property(x => x.Longitude).HasColumnName("longitude").HasPrecision(9, 6);
            entity.Property(x => x.ContactNumber).HasColumnName("contact_number").HasMaxLength(30);
            entity.Property(x => x.IsActive).HasColumnName("is_active");

            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by");
            entity.Property(x => x.ModifiedBy).HasColumnName("updated_by");
            entity.Property(x => x.IsDeleted).HasColumnName("is_deleted");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedBy).HasColumnName("deleted_by");
        });

        modelBuilder.Entity<HospitalDoctor>(entity =>
        {
            entity.ToTable("hospital_doctors");
            entity.HasKey(x => new { x.HospitalId, x.DoctorId });
            entity.Property(x => x.HospitalId).HasColumnName("hospital_id");
            entity.Property(x => x.DoctorId).HasColumnName("doctor_id");

            entity.HasOne(x => x.Hospital)
                .WithMany(h => h.Doctors)
                .HasForeignKey(x => x.HospitalId);

            entity.HasOne(x => x.Doctor)
                .WithMany(d => d.Hospitals)
                .HasForeignKey(x => x.DoctorId);
        });

        modelBuilder.Entity<VendorVariantInventory>(entity =>
        {
            entity.ToTable("vendor_variant_inventory");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.VendorProductListingId).HasColumnName("vendor_product_listing_id");
            entity.Property(x => x.ProductVariantId).HasColumnName("product_variant_id");
            entity.Property(x => x.TotalQuantity).HasColumnName("total_quantity");
            entity.Property(x => x.AvailableQuantity).HasColumnName("available_quantity");
            entity.Property(x => x.ReservedQuantity).HasColumnName("reserved_quantity");
            entity.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
            entity.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
            entity.Ignore(x => x.CreatedBy);
            entity.Ignore(x => x.ModifiedBy);

            entity.HasOne(x => x.VendorProductListing)
                .WithMany()
                .HasForeignKey(x => x.VendorProductListingId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.ProductVariant)
                .WithMany()
                .HasForeignKey(x => x.ProductVariantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.VendorProductListingId, x.ProductVariantId }).IsUnique();
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
