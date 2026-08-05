using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Prilixor.VendorPortal.Domain.WebsiteContent;

namespace Prilixor.VendorPortal.Infrastructure.Persistence.Configurations;

public class WebsiteHomeContentConfiguration : IEntityTypeConfiguration<WebsiteHomeContent>
{
    public void Configure(EntityTypeBuilder<WebsiteHomeContent> builder)
    {
        builder.ToTable("website_home_content");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.HeroTitle).HasColumnName("hero_title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.HeroAccent).HasColumnName("hero_accent").HasMaxLength(255).IsRequired();
        builder.Property(x => x.HeroSubtitle).HasColumnName("hero_subtitle").IsRequired();
        builder.Property(x => x.PrimaryCtaLabel).HasColumnName("primary_cta_label").HasMaxLength(100).IsRequired();
        builder.Property(x => x.PrimaryCtaLink).HasColumnName("primary_cta_link").HasMaxLength(255).IsRequired();
        builder.Property(x => x.SecondaryCtaLabel).HasColumnName("secondary_cta_label").HasMaxLength(100).IsRequired();
        builder.Property(x => x.SecondaryCtaLink).HasColumnName("secondary_cta_link").HasMaxLength(255).IsRequired();
        builder.Property(x => x.TrustLabel).HasColumnName("trust_label").IsRequired();
        builder.Property(x => x.HeroImageUrl).HasColumnName("hero_image_url");

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Features)
            .WithOne(f => f.HomeContent)
            .HasForeignKey(f => f.HomeContentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WebsiteHomeFeatureConfiguration : IEntityTypeConfiguration<WebsiteHomeFeature>
{
    public void Configure(EntityTypeBuilder<WebsiteHomeFeature> builder)
    {
        builder.ToTable("website_home_features");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.HomeContentId).HasColumnName("home_content_id");
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Subtitle).HasColumnName("subtitle").HasMaxLength(255).IsRequired();
        builder.Property(x => x.IconName).HasColumnName("icon_name").HasMaxLength(100);
        builder.Property(x => x.CustomIconUrl).HasColumnName("custom_icon_url");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsActive).HasColumnName("is_active");

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

public class WebsiteAboutContentConfiguration : IEntityTypeConfiguration<WebsiteAboutContent>
{
    public void Configure(EntityTypeBuilder<WebsiteAboutContent> builder)
    {
        builder.ToTable("website_about_content");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.BannerTitle).HasColumnName("banner_title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.BannerAccent).HasColumnName("banner_accent").HasMaxLength(255).IsRequired();
        builder.Property(x => x.BannerSub).HasColumnName("banner_sub").IsRequired();
        builder.Property(x => x.MissionTitle).HasColumnName("mission_title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.MissionText).HasColumnName("mission_text").IsRequired();
        builder.Property(x => x.VisionTitle).HasColumnName("vision_title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.VisionText).HasColumnName("vision_text").IsRequired();

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Audiences)
            .WithOne(a => a.AboutContent)
            .HasForeignKey(a => a.AboutContentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WebsiteAudienceCategoryConfiguration : IEntityTypeConfiguration<WebsiteAudienceCategory>
{
    public void Configure(EntityTypeBuilder<WebsiteAudienceCategory> builder)
    {
        builder.ToTable("website_audience_categories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.AboutContentId).HasColumnName("about_content_id");
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").IsRequired();
        builder.Property(x => x.IconName).HasColumnName("icon_name").HasMaxLength(100);
        builder.Property(x => x.CustomIconUrl).HasColumnName("custom_icon_url");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsActive).HasColumnName("is_active");

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

public class WebsiteServicesHeaderConfiguration : IEntityTypeConfiguration<WebsiteServicesHeader>
{
    public void Configure(EntityTypeBuilder<WebsiteServicesHeader> builder)
    {
        builder.ToTable("website_services_header");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Eyebrow).HasColumnName("eyebrow").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.AccentText).HasColumnName("accent_text").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Subtitle).HasColumnName("subtitle").IsRequired();

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Services)
            .WithOne(s => s.Header)
            .HasForeignKey(s => s.HeaderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WebsiteServiceItemConfiguration : IEntityTypeConfiguration<WebsiteServiceItem>
{
    public void Configure(EntityTypeBuilder<WebsiteServiceItem> builder)
    {
        builder.ToTable("website_service_items");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.HeaderId).HasColumnName("header_id");
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").IsRequired();
        builder.Property(x => x.IconName).HasColumnName("icon_name").HasMaxLength(100);
        builder.Property(x => x.CustomIconUrl).HasColumnName("custom_icon_url");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsActive).HasColumnName("is_active");

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

public class WebsiteFaqCategoryConfiguration : IEntityTypeConfiguration<WebsiteFaqCategory>
{
    public void Configure(EntityTypeBuilder<WebsiteFaqCategory> builder)
    {
        builder.ToTable("website_faq_categories");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(100).IsRequired();
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsActive).HasColumnName("is_active");

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.FaqItems)
            .WithOne(f => f.Category)
            .HasForeignKey(f => f.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class WebsiteFaqItemConfiguration : IEntityTypeConfiguration<WebsiteFaqItem>
{
    public void Configure(EntityTypeBuilder<WebsiteFaqItem> builder)
    {
        builder.ToTable("website_faq_items");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CategoryId).HasColumnName("category_id");
        builder.Property(x => x.Question).HasColumnName("question").IsRequired();
        builder.Property(x => x.Answer).HasColumnName("answer").IsRequired();
        builder.Property(x => x.IsPublished).HasColumnName("is_published");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");

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

public class WebsiteContactContentConfiguration : IEntityTypeConfiguration<WebsiteContactContent>
{
    public void Configure(EntityTypeBuilder<WebsiteContactContent> builder)
    {
        builder.ToTable("website_contact_content");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.HeroTitle).HasColumnName("hero_title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.HeroAccent).HasColumnName("hero_accent").HasMaxLength(255).IsRequired();
        builder.Property(x => x.HeroSub).HasColumnName("hero_sub").IsRequired();
        builder.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(50).IsRequired();
        builder.Property(x => x.Email).HasColumnName("email").HasMaxLength(150).IsRequired();
        builder.Property(x => x.OperatingHours).HasColumnName("operating_hours").HasMaxLength(150).IsRequired();
        builder.Property(x => x.InstitutionalNote).HasColumnName("institutional_note").IsRequired();
        builder.Property(x => x.CtaTitle).HasColumnName("cta_title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.CtaDescription).HasColumnName("cta_description").IsRequired();
        builder.Property(x => x.CtaButtonText).HasColumnName("cta_button_text").HasMaxLength(100).IsRequired();
        builder.Property(x => x.CtaButtonLink).HasColumnName("cta_button_link").HasMaxLength(255).IsRequired();

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

public class WebsiteRentVsBuyContentConfiguration : IEntityTypeConfiguration<WebsiteRentVsBuyContent>
{
    public void Configure(EntityTypeBuilder<WebsiteRentVsBuyContent> builder)
    {
        builder.ToTable("website_rent_vs_buy_content");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Eyebrow).HasColumnName("eyebrow").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.AccentText).HasColumnName("accent_text").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Subtitle).HasColumnName("subtitle").IsRequired();

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasMany(x => x.Features)
            .WithOne(f => f.RentVsBuy)
            .HasForeignKey(f => f.RentVsBuyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Cards)
            .WithOne(c => c.RentVsBuy)
            .HasForeignKey(c => c.RentVsBuyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class WebsiteRentVsBuyFeatureRowConfiguration : IEntityTypeConfiguration<WebsiteRentVsBuyFeatureRow>
{
    public void Configure(EntityTypeBuilder<WebsiteRentVsBuyFeatureRow> builder)
    {
        builder.ToTable("website_rent_vs_buy_features");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.RentVsBuyId).HasColumnName("rent_vs_buy_id").IsRequired();
        builder.Property(x => x.FeatureLabel).HasColumnName("feature_label").HasMaxLength(150).IsRequired();
        builder.Property(x => x.WeeklyValue).HasColumnName("weekly_value").HasMaxLength(255).IsRequired();
        builder.Property(x => x.MonthlyValue).HasColumnName("monthly_value").HasMaxLength(255).IsRequired();
        builder.Property(x => x.PurchaseValue).HasColumnName("purchase_value").HasMaxLength(255).IsRequired();
        builder.Property(x => x.SortOrder).HasColumnName("sort_order").HasDefaultValue(1);

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

public class WebsiteRentVsBuyCardConfiguration : IEntityTypeConfiguration<WebsiteRentVsBuyCard>
{
    public void Configure(EntityTypeBuilder<WebsiteRentVsBuyCard> builder)
    {
        builder.ToTable("website_rent_vs_buy_cards");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.RentVsBuyId).HasColumnName("rent_vs_buy_id").IsRequired();
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").IsRequired();
        builder.Property(x => x.SortOrder).HasColumnName("sort_order").HasDefaultValue(1);

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

public class WebsiteGlobalSettingsConfiguration : IEntityTypeConfiguration<WebsiteGlobalSettings>
{
    public void Configure(EntityTypeBuilder<WebsiteGlobalSettings> builder)
    {
        builder.ToTable("website_global_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.ShowLandingPage).HasColumnName("show_landing_page").HasDefaultValue(true);
        builder.Property(x => x.ShowAboutSection).HasColumnName("show_about_section").HasDefaultValue(true);
        builder.Property(x => x.ShowServicesSection).HasColumnName("show_services_section").HasDefaultValue(true);
        builder.Property(x => x.ShowRentVsBuySection).HasColumnName("show_rent_vs_buy_section").HasDefaultValue(true);
        builder.Property(x => x.ShowFaqSection).HasColumnName("show_faq_section").HasDefaultValue(true);
        builder.Property(x => x.ShowContactSection).HasColumnName("show_contact_section").HasDefaultValue(true);
        builder.Property(x => x.ShowHowItWorksSection).HasColumnName("show_how_it_works_section").HasDefaultValue(true);

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

public class WebsiteHowItWorksHeaderConfiguration : IEntityTypeConfiguration<WebsiteHowItWorksHeader>
{
    public void Configure(EntityTypeBuilder<WebsiteHowItWorksHeader> builder)
    {
        builder.ToTable("website_how_it_works_headers");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.Eyebrow).HasColumnName("eyebrow").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(x => x.AccentText).HasColumnName("accent_text").HasMaxLength(255).IsRequired();
        builder.Property(x => x.Subtitle).HasColumnName("subtitle").IsRequired();

        builder.Property(x => x.CreatedOnUtc).HasColumnName("created_at");
        builder.Property(x => x.ModifiedOnUtc).HasColumnName("updated_at");
        builder.Property(x => x.IsDeleted).HasColumnName("is_deleted");

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.ModifiedBy);
        builder.Ignore(x => x.DeletedAt);
        builder.Ignore(x => x.DeletedBy);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Steps)
            .WithOne(s => s.Header)
            .HasForeignKey(s => s.HeaderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WebsiteHowItWorksStepConfiguration : IEntityTypeConfiguration<WebsiteHowItWorksStep>
{
    public void Configure(EntityTypeBuilder<WebsiteHowItWorksStep> builder)
    {
        builder.ToTable("website_how_it_works_steps");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.HeaderId).HasColumnName("header_id");
        builder.Property(x => x.StepNumber).HasColumnName("step_number");
        builder.Property(x => x.Title).HasColumnName("title").HasMaxLength(150).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").IsRequired();
        builder.Property(x => x.IconName).HasColumnName("icon_name").HasMaxLength(100);
        builder.Property(x => x.CustomIconUrl).HasColumnName("custom_icon_url");
        builder.Property(x => x.SortOrder).HasColumnName("sort_order");
        builder.Property(x => x.IsActive).HasColumnName("is_active");

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


