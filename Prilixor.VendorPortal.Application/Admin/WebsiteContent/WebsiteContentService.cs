using MediatR;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.WebsiteContent;

namespace Prilixor.VendorPortal.Application.Admin.WebsiteContent;

public record GetFullWebsiteContentQuery : IRequest<Result<FullWebsiteContentDto>>;

public record UpdateHomeContentCommand(
    string HeroTitle,
    string HeroAccent,
    string HeroSubtitle,
    string PrimaryCtaLabel,
    string PrimaryCtaLink,
    string SecondaryCtaLabel,
    string SecondaryCtaLink,
    string TrustLabel,
    string? HeroImageUrl,
    List<HomeFeatureDto> Features
) : IRequest<Result<HomeContentDto>>;

public record UpdateAboutContentCommand(
    string BannerTitle,
    string BannerAccent,
    string BannerSub,
    string MissionTitle,
    string MissionText,
    string VisionTitle,
    string VisionText
) : IRequest<Result<AboutContentDto>>;

public record UpsertAudienceCategoryCommand(
    Guid? Id,
    string Title,
    string Description,
    string? IconName,
    string? CustomIconUrl,
    int SortOrder
) : IRequest<Result<AudienceCategoryDto>>;

public record DeleteAudienceCategoryCommand(Guid Id) : IRequest<Result<bool>>;

public record UpdateServicesHeaderCommand(
    string Eyebrow,
    string Title,
    string AccentText,
    string Subtitle
) : IRequest<Result<ServicesHeaderDto>>;

public record UpsertServiceItemCommand(
    Guid? Id,
    string Title,
    string Description,
    string? IconName,
    string? CustomIconUrl,
    int SortOrder
) : IRequest<Result<ServiceItemDto>>;

public record DeleteServiceItemCommand(Guid Id) : IRequest<Result<bool>>;

public record UpsertFaqCategoryCommand(
    Guid? Id,
    string Name
) : IRequest<Result<FaqCategoryDto>>;

public record UpsertFaqItemCommand(
    Guid? Id,
    Guid CategoryId,
    string Question,
    string Answer,
    bool IsPublished
) : IRequest<Result<FaqItemDto>>;

public record DeleteFaqItemCommand(Guid Id) : IRequest<Result<bool>>;

public record UpdateContactContentCommand(
    string HeroTitle,
    string HeroAccent,
    string HeroSub,
    string Phone,
    string Email,
    string OperatingHours,
    string InstitutionalNote,
    string CtaTitle,
    string CtaDescription,
    string CtaButtonText,
    string CtaButtonLink
) : IRequest<Result<ContactContentDto>>;

public record UpdateRentVsBuyHeaderCommand(
    string Eyebrow,
    string Title,
    string AccentText,
    string Subtitle
) : IRequest<Result<RentVsBuyContentDto>>;

public record UpsertRentVsBuyFeatureCommand(
    Guid? Id,
    string FeatureLabel,
    string WeeklyValue,
    string MonthlyValue,
    string PurchaseValue,
    int SortOrder
) : IRequest<Result<RentVsBuyFeatureRowDto>>;

public record DeleteRentVsBuyFeatureCommand(Guid Id) : IRequest<Result<bool>>;

public record UpsertRentVsBuyCardCommand(
    Guid? Id,
    string Title,
    string Description,
    int SortOrder
) : IRequest<Result<RentVsBuyCardDto>>;

public record DeleteRentVsBuyCardCommand(Guid Id) : IRequest<Result<bool>>;

public record UpdateGlobalSettingsCommand(
    bool ShowLandingPage,
    bool ShowAboutSection,
    bool ShowServicesSection,
    bool ShowRentVsBuySection,
    bool ShowFaqSection,
    bool ShowContactSection,
    bool ShowHowItWorksSection
) : IRequest<Result<WebsiteSettingsDto>>;

public record UpdateHowItWorksHeaderCommand(
    string Eyebrow,
    string Title,
    string AccentText,
    string Subtitle
) : IRequest<Result<HowItWorksHeaderDto>>;

public record UpsertHowItWorksStepCommand(
    Guid? Id,
    int StepNumber,
    string Title,
    string Description,
    string? IconName,
    string? CustomIconUrl,
    int SortOrder,
    bool IsActive
) : IRequest<Result<HowItWorksStepDto>>;

public record DeleteHowItWorksStepCommand(Guid Id) : IRequest<Result<bool>>;

public class WebsiteContentQueryHandler(IWebsiteContentRepository repository)
    : IRequestHandler<GetFullWebsiteContentQuery, Result<FullWebsiteContentDto>>,
      IRequestHandler<UpdateHomeContentCommand, Result<HomeContentDto>>,
      IRequestHandler<UpdateAboutContentCommand, Result<AboutContentDto>>,
      IRequestHandler<UpsertAudienceCategoryCommand, Result<AudienceCategoryDto>>,
      IRequestHandler<DeleteAudienceCategoryCommand, Result<bool>>,
      IRequestHandler<UpdateServicesHeaderCommand, Result<ServicesHeaderDto>>,
      IRequestHandler<UpsertServiceItemCommand, Result<ServiceItemDto>>,
      IRequestHandler<DeleteServiceItemCommand, Result<bool>>,
      IRequestHandler<UpsertFaqCategoryCommand, Result<FaqCategoryDto>>,
      IRequestHandler<UpsertFaqItemCommand, Result<FaqItemDto>>,
      IRequestHandler<DeleteFaqItemCommand, Result<bool>>,
      IRequestHandler<UpdateContactContentCommand, Result<ContactContentDto>>,
      IRequestHandler<UpdateRentVsBuyHeaderCommand, Result<RentVsBuyContentDto>>,
      IRequestHandler<UpsertRentVsBuyFeatureCommand, Result<RentVsBuyFeatureRowDto>>,
      IRequestHandler<DeleteRentVsBuyFeatureCommand, Result<bool>>,
      IRequestHandler<UpsertRentVsBuyCardCommand, Result<RentVsBuyCardDto>>,
      IRequestHandler<DeleteRentVsBuyCardCommand, Result<bool>>,
      IRequestHandler<UpdateGlobalSettingsCommand, Result<WebsiteSettingsDto>>,
      IRequestHandler<UpdateHowItWorksHeaderCommand, Result<HowItWorksHeaderDto>>,
      IRequestHandler<UpsertHowItWorksStepCommand, Result<HowItWorksStepDto>>,
      IRequestHandler<DeleteHowItWorksStepCommand, Result<bool>>
{
    public async Task<Result<FullWebsiteContentDto>> Handle(GetFullWebsiteContentQuery request, CancellationToken ct)
    {
        var home = await repository.GetHomeContentAsync(ct);
        var about = await repository.GetAboutContentAsync(ct);
        var services = await repository.GetServicesHeaderAsync(ct);
        var faqCategories = await repository.GetFaqCategoriesAsync(ct);
        var faqItems = await repository.GetFaqItemsAsync(ct);
        var contact = await repository.GetContactContentAsync(ct);
        var rentVsBuy = await repository.GetRentVsBuyContentAsync(ct);
        var howItWorks = await repository.GetHowItWorksHeaderAsync(ct);
        var settings = await repository.GetGlobalSettingsAsync(ct);

        var dto = new FullWebsiteContentDto
        {
            Home = home != null ? MapHome(home) : new HomeContentDto(),
            About = about != null ? MapAbout(about) : new AboutContentDto(),
            Services = services != null ? MapServices(services) : new ServicesHeaderDto(),
            FaqCategories = faqCategories.Select(c => new FaqCategoryDto { Id = c.Id, Name = c.Name, Slug = c.Slug, SortOrder = c.SortOrder, IsActive = c.IsActive }).ToList(),
            Faqs = faqItems.Select(f => new FaqItemDto { Id = f.Id, CategoryId = f.CategoryId, CategoryName = f.Category?.Name ?? "General", Question = f.Question, Answer = f.Answer, IsPublished = f.IsPublished, SortOrder = f.SortOrder }).ToList(),
            Contact = contact != null ? MapContact(contact) : new ContactContentDto(),
            RentVsBuy = rentVsBuy != null ? MapRentVsBuy(rentVsBuy) : new RentVsBuyContentDto(),
            HowItWorks = howItWorks != null ? MapHowItWorks(howItWorks) : new HowItWorksSectionDto(),
            Settings = settings != null ? MapSettings(settings) : new WebsiteSettingsDto()
        };

        return Result<FullWebsiteContentDto>.Success(dto);
    }

    public async Task<Result<HomeContentDto>> Handle(UpdateHomeContentCommand request, CancellationToken ct)
    {
        var home = new WebsiteHomeContent
        {
            HeroTitle = request.HeroTitle,
            HeroAccent = request.HeroAccent,
            HeroSubtitle = request.HeroSubtitle,
            PrimaryCtaLabel = request.PrimaryCtaLabel,
            PrimaryCtaLink = request.PrimaryCtaLink,
            SecondaryCtaLabel = request.SecondaryCtaLabel,
            SecondaryCtaLink = request.SecondaryCtaLink,
            TrustLabel = request.TrustLabel,
            HeroImageUrl = request.HeroImageUrl
        };

        var features = request.Features?.Select(f => new WebsiteHomeFeature
        {
            Title = f.Title,
            Subtitle = f.Subtitle,
            IconName = f.IconName,
            CustomIconUrl = f.CustomIconUrl,
            SortOrder = f.SortOrder,
            IsActive = f.IsActive
        }).ToList() ?? [];

        await repository.UpdateHomeContentAsync(home, features, ct);
        var updated = await repository.GetHomeContentAsync(ct);
        return Result<HomeContentDto>.Success(updated != null ? MapHome(updated) : MapHome(home));
    }

    public async Task<Result<AboutContentDto>> Handle(UpdateAboutContentCommand request, CancellationToken ct)
    {
        var about = new WebsiteAboutContent
        {
            BannerTitle = request.BannerTitle,
            BannerAccent = request.BannerAccent,
            BannerSub = request.BannerSub,
            MissionTitle = request.MissionTitle,
            MissionText = request.MissionText,
            VisionTitle = request.VisionTitle,
            VisionText = request.VisionText
        };

        await repository.UpdateAboutContentAsync(about, ct);
        var updated = await repository.GetAboutContentAsync(ct);
        return Result<AboutContentDto>.Success(updated != null ? MapAbout(updated) : MapAbout(about));
    }

    public async Task<Result<AudienceCategoryDto>> Handle(UpsertAudienceCategoryCommand request, CancellationToken ct)
    {
        var item = new WebsiteAudienceCategory
        {
            Id = request.Id ?? Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            IconName = request.IconName,
            CustomIconUrl = request.CustomIconUrl,
            SortOrder = request.SortOrder
        };

        await repository.UpsertAudienceCategoryAsync(item, ct);
        var saved = await repository.GetAudienceCategoryByIdAsync(item.Id, ct);
        var target = saved ?? item;
        return Result<AudienceCategoryDto>.Success(new AudienceCategoryDto
        {
            Id = target.Id,
            Title = target.Title,
            Description = target.Description,
            IconName = target.IconName,
            CustomIconUrl = target.CustomIconUrl,
            SortOrder = target.SortOrder,
            IsActive = target.IsActive
        });
    }

    public async Task<Result<bool>> Handle(DeleteAudienceCategoryCommand request, CancellationToken ct)
    {
        await repository.DeleteAudienceCategoryAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<ServicesHeaderDto>> Handle(UpdateServicesHeaderCommand request, CancellationToken ct)
    {
        var header = new WebsiteServicesHeader
        {
            Eyebrow = request.Eyebrow,
            Title = request.Title,
            AccentText = request.AccentText,
            Subtitle = request.Subtitle
        };

        await repository.UpdateServicesHeaderAsync(header, ct);
        var updated = await repository.GetServicesHeaderAsync(ct);
        return Result<ServicesHeaderDto>.Success(updated != null ? MapServices(updated) : MapServices(header));
    }

    public async Task<Result<ServiceItemDto>> Handle(UpsertServiceItemCommand request, CancellationToken ct)
    {
        var item = new WebsiteServiceItem
        {
            Id = request.Id ?? Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            IconName = request.IconName,
            CustomIconUrl = request.CustomIconUrl,
            SortOrder = request.SortOrder
        };

        await repository.UpsertServiceItemAsync(item, ct);
        var saved = await repository.GetServiceItemByIdAsync(item.Id, ct);
        var target = saved ?? item;
        return Result<ServiceItemDto>.Success(new ServiceItemDto
        {
            Id = target.Id,
            Title = target.Title,
            Description = target.Description,
            IconName = target.IconName,
            CustomIconUrl = target.CustomIconUrl,
            SortOrder = target.SortOrder,
            IsActive = target.IsActive
        });
    }

    public async Task<Result<bool>> Handle(DeleteServiceItemCommand request, CancellationToken ct)
    {
        await repository.DeleteServiceItemAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<FaqCategoryDto>> Handle(UpsertFaqCategoryCommand request, CancellationToken ct)
    {
        var cat = new WebsiteFaqCategory
        {
            Id = request.Id ?? Guid.NewGuid(),
            Name = request.Name,
            Slug = request.Name.ToLower().Replace(" ", "-").Replace("&", "and")
        };

        await repository.UpsertFaqCategoryAsync(cat, ct);
        var saved = await repository.GetFaqCategoryByIdAsync(cat.Id, ct);
        var target = saved ?? cat;
        return Result<FaqCategoryDto>.Success(new FaqCategoryDto { Id = target.Id, Name = target.Name, Slug = target.Slug, SortOrder = target.SortOrder, IsActive = target.IsActive });
    }

    public async Task<Result<FaqItemDto>> Handle(UpsertFaqItemCommand request, CancellationToken ct)
    {
        var item = new WebsiteFaqItem
        {
            Id = request.Id ?? Guid.NewGuid(),
            CategoryId = request.CategoryId,
            Question = request.Question,
            Answer = request.Answer,
            IsPublished = request.IsPublished
        };

        await repository.UpsertFaqItemAsync(item, ct);
        var saved = await repository.GetFaqItemByIdAsync(item.Id, ct);
        var target = saved ?? item;

        return Result<FaqItemDto>.Success(new FaqItemDto
        {
            Id = target.Id,
            CategoryId = target.CategoryId,
            CategoryName = target.Category?.Name ?? "General",
            Question = target.Question,
            Answer = target.Answer,
            IsPublished = target.IsPublished,
            SortOrder = target.SortOrder
        });
    }

    public async Task<Result<bool>> Handle(DeleteFaqItemCommand request, CancellationToken ct)
    {
        await repository.DeleteFaqItemAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<ContactContentDto>> Handle(UpdateContactContentCommand request, CancellationToken ct)
    {
        var contact = new WebsiteContactContent
        {
            HeroTitle = request.HeroTitle,
            HeroAccent = request.HeroAccent,
            HeroSub = request.HeroSub,
            Phone = request.Phone,
            Email = request.Email,
            OperatingHours = request.OperatingHours,
            InstitutionalNote = request.InstitutionalNote,
            CtaTitle = request.CtaTitle,
            CtaDescription = request.CtaDescription,
            CtaButtonText = request.CtaButtonText,
            CtaButtonLink = request.CtaButtonLink
        };

        await repository.UpdateContactContentAsync(contact, ct);
        var updated = await repository.GetContactContentAsync(ct);
        return Result<ContactContentDto>.Success(updated != null ? MapContact(updated) : MapContact(contact));
    }

    public async Task<Result<RentVsBuyContentDto>> Handle(UpdateRentVsBuyHeaderCommand request, CancellationToken ct)
    {
        var header = new WebsiteRentVsBuyContent
        {
            Eyebrow = request.Eyebrow,
            Title = request.Title,
            AccentText = request.AccentText,
            Subtitle = request.Subtitle
        };

        await repository.UpdateRentVsBuyHeaderAsync(header, ct);
        var updated = await repository.GetRentVsBuyContentAsync(ct);
        return Result<RentVsBuyContentDto>.Success(updated != null ? MapRentVsBuy(updated) : MapRentVsBuy(header));
    }

    public async Task<Result<RentVsBuyFeatureRowDto>> Handle(UpsertRentVsBuyFeatureCommand request, CancellationToken ct)
    {
        var item = new WebsiteRentVsBuyFeatureRow
        {
            Id = request.Id ?? Guid.NewGuid(),
            FeatureLabel = request.FeatureLabel,
            WeeklyValue = request.WeeklyValue,
            MonthlyValue = request.MonthlyValue,
            PurchaseValue = request.PurchaseValue,
            SortOrder = request.SortOrder
        };

        await repository.UpsertRentVsBuyFeatureAsync(item, ct);
        var saved = await repository.GetRentVsBuyFeatureByIdAsync(item.Id, ct);
        var target = saved ?? item;

        return Result<RentVsBuyFeatureRowDto>.Success(new RentVsBuyFeatureRowDto
        {
            Id = target.Id,
            FeatureLabel = target.FeatureLabel,
            WeeklyValue = target.WeeklyValue,
            MonthlyValue = target.MonthlyValue,
            PurchaseValue = target.PurchaseValue,
            SortOrder = target.SortOrder
        });
    }

    public async Task<Result<bool>> Handle(DeleteRentVsBuyFeatureCommand request, CancellationToken ct)
    {
        await repository.DeleteRentVsBuyFeatureAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<RentVsBuyCardDto>> Handle(UpsertRentVsBuyCardCommand request, CancellationToken ct)
    {
        var item = new WebsiteRentVsBuyCard
        {
            Id = request.Id ?? Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            SortOrder = request.SortOrder
        };

        await repository.UpsertRentVsBuyCardAsync(item, ct);
        var saved = await repository.GetRentVsBuyCardByIdAsync(item.Id, ct);
        var target = saved ?? item;

        return Result<RentVsBuyCardDto>.Success(new RentVsBuyCardDto
        {
            Id = target.Id,
            Title = target.Title,
            Description = target.Description,
            SortOrder = target.SortOrder
        });
    }

    public async Task<Result<bool>> Handle(DeleteRentVsBuyCardCommand request, CancellationToken ct)
    {
        await repository.DeleteRentVsBuyCardAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    public async Task<Result<WebsiteSettingsDto>> Handle(UpdateGlobalSettingsCommand request, CancellationToken ct)
    {
        var settings = new WebsiteGlobalSettings
        {
            ShowLandingPage = request.ShowLandingPage,
            ShowAboutSection = request.ShowAboutSection,
            ShowServicesSection = request.ShowServicesSection,
            ShowRentVsBuySection = request.ShowRentVsBuySection,
            ShowFaqSection = request.ShowFaqSection,
            ShowContactSection = request.ShowContactSection,
            ShowHowItWorksSection = request.ShowHowItWorksSection
        };

        await repository.UpdateGlobalSettingsAsync(settings, ct);
        var updated = await repository.GetGlobalSettingsAsync(ct);
        return Result<WebsiteSettingsDto>.Success(updated != null ? MapSettings(updated) : MapSettings(settings));
    }

    private static HomeContentDto MapHome(WebsiteHomeContent h) => new()
    {
        Id = h.Id,
        HeroTitle = h.HeroTitle,
        HeroAccent = h.HeroAccent,
        HeroSubtitle = h.HeroSubtitle,
        PrimaryCtaLabel = h.PrimaryCtaLabel,
        PrimaryCtaLink = h.PrimaryCtaLink,
        SecondaryCtaLabel = h.SecondaryCtaLabel,
        SecondaryCtaLink = h.SecondaryCtaLink,
        TrustLabel = h.TrustLabel,
        HeroImageUrl = h.HeroImageUrl,
        Features = h.Features?.Where(f => !f.IsDeleted).Select(f => new HomeFeatureDto
        {
            Id = f.Id,
            Title = f.Title,
            Subtitle = f.Subtitle,
            IconName = f.IconName,
            CustomIconUrl = f.CustomIconUrl,
            SortOrder = f.SortOrder,
            IsActive = f.IsActive
        }).OrderBy(f => f.SortOrder).ToList() ?? []
    };

    private static AboutContentDto MapAbout(WebsiteAboutContent a) => new()
    {
        Id = a.Id,
        BannerTitle = a.BannerTitle,
        BannerAccent = a.BannerAccent,
        BannerSub = a.BannerSub,
        MissionTitle = a.MissionTitle,
        MissionText = a.MissionText,
        VisionTitle = a.VisionTitle,
        VisionText = a.VisionText,
        Audiences = a.Audiences?.Where(x => !x.IsDeleted).Select(x => new AudienceCategoryDto
        {
            Id = x.Id,
            Title = x.Title,
            Description = x.Description,
            IconName = x.IconName,
            CustomIconUrl = x.CustomIconUrl,
            SortOrder = x.SortOrder,
            IsActive = x.IsActive
        }).OrderBy(x => x.SortOrder).ToList() ?? []
    };

    private static ServicesHeaderDto MapServices(WebsiteServicesHeader s) => new()
    {
        Id = s.Id,
        Eyebrow = s.Eyebrow,
        Title = s.Title,
        AccentText = s.AccentText,
        Subtitle = s.Subtitle,
        Services = s.Services?.Where(x => !x.IsDeleted).Select(x => new ServiceItemDto
        {
            Id = x.Id,
            Title = x.Title,
            Description = x.Description,
            IconName = x.IconName,
            CustomIconUrl = x.CustomIconUrl,
            SortOrder = x.SortOrder,
            IsActive = x.IsActive
        }).OrderBy(x => x.SortOrder).ToList() ?? []
    };

    private static ContactContentDto MapContact(WebsiteContactContent c) => new()
    {
        Id = c.Id,
        HeroTitle = c.HeroTitle,
        HeroAccent = c.HeroAccent,
        HeroSub = c.HeroSub,
        Phone = c.Phone,
        Email = c.Email,
        OperatingHours = c.OperatingHours,
        InstitutionalNote = c.InstitutionalNote,
        CtaTitle = c.CtaTitle,
        CtaDescription = c.CtaDescription,
        CtaButtonText = c.CtaButtonText,
        CtaButtonLink = c.CtaButtonLink
    };

    private static RentVsBuyContentDto MapRentVsBuy(WebsiteRentVsBuyContent r) => new()
    {
        Id = r.Id,
        Eyebrow = r.Eyebrow,
        Title = r.Title,
        AccentText = r.AccentText,
        Subtitle = r.Subtitle,
        Features = r.Features?.Where(x => !x.IsDeleted).Select(x => new RentVsBuyFeatureRowDto
        {
            Id = x.Id,
            FeatureLabel = x.FeatureLabel,
            WeeklyValue = x.WeeklyValue,
            MonthlyValue = x.MonthlyValue,
            PurchaseValue = x.PurchaseValue,
            SortOrder = x.SortOrder
        }).OrderBy(x => x.SortOrder).ToList() ?? [],
        Cards = r.Cards?.Where(x => !x.IsDeleted).Select(x => new RentVsBuyCardDto
        {
            Id = x.Id,
            Title = x.Title,
            Description = x.Description,
            SortOrder = x.SortOrder
        }).OrderBy(x => x.SortOrder).ToList() ?? []
    };

    private static WebsiteSettingsDto MapSettings(WebsiteGlobalSettings s) => new()
    {
        Id = s.Id,
        ShowLandingPage = s.ShowLandingPage,
        ShowAboutSection = s.ShowAboutSection,
        ShowServicesSection = s.ShowServicesSection,
        ShowRentVsBuySection = s.ShowRentVsBuySection,
        ShowFaqSection = s.ShowFaqSection,
        ShowContactSection = s.ShowContactSection,
        ShowHowItWorksSection = s.ShowHowItWorksSection
    };

    public async Task<Result<HowItWorksHeaderDto>> Handle(UpdateHowItWorksHeaderCommand request, CancellationToken ct)
    {
        var header = new WebsiteHowItWorksHeader
        {
            Eyebrow = request.Eyebrow,
            Title = request.Title,
            AccentText = request.AccentText,
            Subtitle = request.Subtitle
        };

        await repository.UpdateHowItWorksHeaderAsync(header, ct);
        var updated = await repository.GetHowItWorksHeaderAsync(ct);
        return Result<HowItWorksHeaderDto>.Success(updated != null ? MapHowItWorksHeader(updated) : new HowItWorksHeaderDto());
    }

    public async Task<Result<HowItWorksStepDto>> Handle(UpsertHowItWorksStepCommand request, CancellationToken ct)
    {
        var step = new WebsiteHowItWorksStep
        {
            Id = request.Id ?? Guid.NewGuid(),
            StepNumber = request.StepNumber,
            Title = request.Title,
            Description = request.Description,
            IconName = request.IconName,
            CustomIconUrl = request.CustomIconUrl,
            SortOrder = request.SortOrder,
            IsActive = request.IsActive
        };

        await repository.UpsertHowItWorksStepAsync(step, ct);
        var saved = await repository.GetHowItWorksStepByIdAsync(step.Id, ct);
        return Result<HowItWorksStepDto>.Success(saved != null ? MapHowItWorksStep(saved) : new HowItWorksStepDto());
    }

    public async Task<Result<bool>> Handle(DeleteHowItWorksStepCommand request, CancellationToken ct)
    {
        await repository.DeleteHowItWorksStepAsync(request.Id, ct);
        return Result<bool>.Success(true);
    }

    private static HowItWorksHeaderDto MapHowItWorksHeader(WebsiteHowItWorksHeader h) => new()
    {
        Id = h.Id,
        Eyebrow = h.Eyebrow,
        Title = h.Title,
        AccentText = h.AccentText,
        Subtitle = h.Subtitle
    };

    private static HowItWorksStepDto MapHowItWorksStep(WebsiteHowItWorksStep s) => new()
    {
        Id = s.Id,
        HeaderId = s.HeaderId,
        StepNumber = s.StepNumber,
        Title = s.Title,
        Description = s.Description,
        IconName = s.IconName,
        CustomIconUrl = s.CustomIconUrl,
        SortOrder = s.SortOrder,
        IsActive = s.IsActive
    };

    private static HowItWorksSectionDto MapHowItWorks(WebsiteHowItWorksHeader h) => new()
    {
        Header = MapHowItWorksHeader(h),
        Steps = h.Steps?.Where(x => !x.IsDeleted).Select(MapHowItWorksStep).OrderBy(x => x.SortOrder).ToList() ?? []
    };
}


