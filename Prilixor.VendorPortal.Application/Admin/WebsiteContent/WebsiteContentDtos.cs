namespace Prilixor.VendorPortal.Application.Admin.WebsiteContent;

public class HomeFeatureDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class HomeContentDto
{
    public Guid Id { get; set; }
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroAccent { get; set; } = string.Empty;
    public string HeroSubtitle { get; set; } = string.Empty;
    public string PrimaryCtaLabel { get; set; } = string.Empty;
    public string PrimaryCtaLink { get; set; } = string.Empty;
    public string SecondaryCtaLabel { get; set; } = string.Empty;
    public string SecondaryCtaLink { get; set; } = string.Empty;
    public string TrustLabel { get; set; } = string.Empty;
    public string? HeroImageUrl { get; set; }

    public List<HomeFeatureDto> Features { get; set; } = [];
}

public class AudienceCategoryDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AboutContentDto
{
    public Guid Id { get; set; }
    public string BannerTitle { get; set; } = string.Empty;
    public string BannerAccent { get; set; } = string.Empty;
    public string BannerSub { get; set; } = string.Empty;
    public string MissionTitle { get; set; } = "Our Mission";
    public string MissionText { get; set; } = string.Empty;
    public string VisionTitle { get; set; } = "Our Vision";
    public string VisionText { get; set; } = string.Empty;

    public List<AudienceCategoryDto> Audiences { get; set; } = [];
}

public class ServiceItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ServicesHeaderDto
{
    public Guid Id { get; set; }
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;

    public List<ServiceItemDto> Services { get; set; } = [];
}

public class FaqCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class FaqItemDto
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public bool IsPublished { get; set; } = true;
    public int SortOrder { get; set; }
}

public class ContactContentDto
{
    public Guid Id { get; set; }
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
}

public class RentVsBuyFeatureRowDto
{
    public Guid Id { get; set; }
    public string FeatureLabel { get; set; } = string.Empty;
    public string WeeklyValue { get; set; } = string.Empty;
    public string MonthlyValue { get; set; } = string.Empty;
    public string PurchaseValue { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class RentVsBuyCardDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class RentVsBuyContentDto
{
    public Guid Id { get; set; }
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;

    public List<RentVsBuyFeatureRowDto> Features { get; set; } = [];
    public List<RentVsBuyCardDto> Cards { get; set; } = [];
}

public class WebsiteSettingsDto
{
    public Guid Id { get; set; }
    public bool ShowLandingPage { get; set; } = true;
    public bool ShowAboutSection { get; set; } = true;
    public bool ShowServicesSection { get; set; } = true;
    public bool ShowRentVsBuySection { get; set; } = true;
    public bool ShowFaqSection { get; set; } = true;
    public bool ShowContactSection { get; set; } = true;
    public bool ShowHowItWorksSection { get; set; } = true;
}

public class HowItWorksHeaderDto
{
    public Guid Id { get; set; }
    public string Eyebrow { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string AccentText { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
}

public class HowItWorksStepDto
{
    public Guid Id { get; set; }
    public Guid? HeaderId { get; set; }
    public int StepNumber { get; set; } = 1;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? IconName { get; set; }
    public string? CustomIconUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class HowItWorksSectionDto
{
    public HowItWorksHeaderDto Header { get; set; } = new();
    public List<HowItWorksStepDto> Steps { get; set; } = [];
}

public class FullWebsiteContentDto
{
    public HomeContentDto Home { get; set; } = new();
    public AboutContentDto About { get; set; } = new();
    public ServicesHeaderDto Services { get; set; } = new();
    public List<FaqCategoryDto> FaqCategories { get; set; } = [];
    public List<FaqItemDto> Faqs { get; set; } = [];
    public ContactContentDto Contact { get; set; } = new();
    public RentVsBuyContentDto RentVsBuy { get; set; } = new();
    public HowItWorksSectionDto HowItWorks { get; set; } = new();
    public WebsiteSettingsDto Settings { get; set; } = new();
}


