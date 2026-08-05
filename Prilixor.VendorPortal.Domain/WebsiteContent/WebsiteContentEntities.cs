using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.WebsiteContent;

public class WebsiteHomeContent : AuditableEntity<Guid>, ISoftDelete
{
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroAccent { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public string PrimaryCtaLabel { get; set; } = string.Empty;
    public string PrimaryCtaLink { get; set; } = string.Empty;
    public string SecondaryCtaLabel { get; set; } = string.Empty;
    public string SecondaryCtaLink { get; set; } = string.Empty;
    public string TrustLabel { get; set; } = string.Empty;
    public string? HeroImageUrl { get; set; }

    public ICollection<WebsiteHomeFeature> Features { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteHomeFeature : AuditableEntity<Guid>, ISoftDelete
{
    public Guid HomeContentId { get; set; }
    public WebsiteHomeContent? HomeContent { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteAboutContent : AuditableEntity<Guid>, ISoftDelete
{
    public string BannerTitle { get; set; } = string.Empty;
    public string BannerAccent { get; set; } = string.Empty;
    public string BannerSub { get; set; } = string.Empty;
    public string MissionTitle { get; set; } = "Our Mission";
    public string MissionText { get; set; } = string.Empty;
    public string VisionTitle { get; set; } = "Our Vision";
    public string VisionText { get; set; } = string.Empty;

    public ICollection<WebsiteAudienceCategory> Audiences { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteAudienceCategory : AuditableEntity<Guid>, ISoftDelete
{
    public Guid? AboutContentId { get; set; }
    public WebsiteAboutContent? AboutContent { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteServicesHeader : AuditableEntity<Guid>, ISoftDelete
{
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;

    public ICollection<WebsiteServiceItem> Services { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteServiceItem : AuditableEntity<Guid>, ISoftDelete
{
    public Guid? HeaderId { get; set; }
    public WebsiteServicesHeader? Header { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteFaqCategory : AuditableEntity<Guid>, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<WebsiteFaqItem> FaqItems { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteFaqItem : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CategoryId { get; set; }
    public WebsiteFaqCategory? Category { get; set; }

    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public bool IsPublished { get; set; } = true;
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteContactContent : AuditableEntity<Guid>, ISoftDelete
{
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroAccent { get; set; } = string.Empty;
    public string HeroSub { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string OperatingHours { get; set; } = string.Empty;
    public string InstitutionalNote { get; set; } = string.Empty;

    public string CtaTitle { get; set; } = string.Empty;
    public string CtaDescription { get; set; } = string.Empty;
    public string CtaButtonText { get; set; } = string.Empty;
    public string CtaButtonLink { get; set; } = string.Empty;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteRentVsBuyContent : AuditableEntity<Guid>, ISoftDelete
{
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;

    public ICollection<WebsiteRentVsBuyFeatureRow> Features { get; set; } = [];
    public ICollection<WebsiteRentVsBuyCard> Cards { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteRentVsBuyFeatureRow : AuditableEntity<Guid>, ISoftDelete
{
    public Guid RentVsBuyId { get; set; }
    public WebsiteRentVsBuyContent? RentVsBuy { get; set; }

    public string FeatureLabel { get; set; } = string.Empty;
    public string WeeklyValue { get; set; } = string.Empty;
    public string MonthlyValue { get; set; } = string.Empty;
    public string PurchaseValue { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteRentVsBuyCard : AuditableEntity<Guid>, ISoftDelete
{
    public Guid RentVsBuyId { get; set; }
    public WebsiteRentVsBuyContent? RentVsBuy { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteGlobalSettings : AuditableEntity<Guid>, ISoftDelete
{
    public bool ShowLandingPage { get; set; } = true;
    public bool ShowAboutSection { get; set; } = true;
    public bool ShowServicesSection { get; set; } = true;
    public bool ShowRentVsBuySection { get; set; } = true;
    public bool ShowFaqSection { get; set; } = true;
    public bool ShowContactSection { get; set; } = true;
    public bool ShowHowItWorksSection { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteHowItWorksHeader : AuditableEntity<Guid>, ISoftDelete
{
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;

    public ICollection<WebsiteHowItWorksStep> Steps { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public class WebsiteHowItWorksStep : AuditableEntity<Guid>, ISoftDelete
{
    public Guid? HeaderId { get; set; }
    public WebsiteHowItWorksHeader? Header { get; set; }

    public int StepNumber { get; set; } = 1;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}


