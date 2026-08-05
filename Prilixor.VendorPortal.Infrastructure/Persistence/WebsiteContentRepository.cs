using Microsoft.EntityFrameworkCore;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.WebsiteContent;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public class WebsiteContentRepository(CommonPortalDbContext dbContext) : IWebsiteContentRepository
{
    public async Task<WebsiteHomeContent?> GetHomeContentAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteHomeContent>()
            .Include(x => x.Features.Where(f => !f.IsDeleted))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateHomeContentAsync(WebsiteHomeContent home, List<WebsiteHomeFeature> features, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteHomeContent>()
            .Include(x => x.Features)
            .FirstOrDefaultAsync(ct);

        if (existing == null)
        {
            dbContext.Set<WebsiteHomeContent>().Add(home);
            existing = home;
        }
        else
        {
            existing.HeroTitle = home.HeroTitle;
            existing.HeroAccent = home.HeroAccent;
            existing.HeroSubtitle = home.HeroSubtitle;
            existing.PrimaryCtaLabel = home.PrimaryCtaLabel;
            existing.PrimaryCtaLink = home.PrimaryCtaLink;
            existing.SecondaryCtaLabel = home.SecondaryCtaLabel;
            existing.SecondaryCtaLink = home.SecondaryCtaLink;
            existing.TrustLabel = home.TrustLabel;
            existing.HeroImageUrl = home.HeroImageUrl;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        if (features != null)
        {
            dbContext.Set<WebsiteHomeFeature>().RemoveRange(existing.Features);
            existing.Features.Clear();

            int sort = 1;
            foreach (var f in features)
            {
                existing.Features.Add(new WebsiteHomeFeature
                {
                    HomeContentId = existing.Id,
                    Title = f.Title,
                    Subtitle = f.Subtitle,
                    IconName = f.IconName,
                    CustomIconUrl = f.CustomIconUrl,
                    SortOrder = sort++,
                    IsActive = true
                });
            }
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteAboutContent?> GetAboutContentAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteAboutContent>()
            .Include(x => x.Audiences.Where(a => !a.IsDeleted))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateAboutContentAsync(WebsiteAboutContent about, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteAboutContent>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteAboutContent>().Add(about);
        }
        else
        {
            existing.BannerTitle = about.BannerTitle;
            existing.BannerAccent = about.BannerAccent;
            existing.BannerSub = about.BannerSub;
            existing.MissionTitle = about.MissionTitle;
            existing.MissionText = about.MissionText;
            existing.VisionTitle = about.VisionTitle;
            existing.VisionText = about.VisionText;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteAudienceCategory?> GetAudienceCategoryByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteAudienceCategory>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertAudienceCategoryAsync(WebsiteAudienceCategory item, CancellationToken ct = default)
    {
        var about = await dbContext.Set<WebsiteAboutContent>().FirstOrDefaultAsync(ct);
        if (about == null)
        {
            about = new WebsiteAboutContent();
            dbContext.Set<WebsiteAboutContent>().Add(about);
            await dbContext.SaveChangesAsync(ct);
        }

        var existing = await dbContext.Set<WebsiteAudienceCategory>().FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (existing == null)
        {
            item.AboutContentId = about.Id;
            dbContext.Set<WebsiteAudienceCategory>().Add(item);
        }
        else
        {
            existing.Title = item.Title;
            existing.Description = item.Description;
            existing.IconName = item.IconName;
            existing.CustomIconUrl = item.CustomIconUrl;
            existing.SortOrder = item.SortOrder;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteAudienceCategoryAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteAudienceCategory>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<WebsiteServicesHeader?> GetServicesHeaderAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteServicesHeader>()
            .Include(x => x.Services.Where(s => !s.IsDeleted))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateServicesHeaderAsync(WebsiteServicesHeader header, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteServicesHeader>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteServicesHeader>().Add(header);
        }
        else
        {
            existing.Eyebrow = header.Eyebrow;
            existing.Title = header.Title;
            existing.AccentText = header.AccentText;
            existing.Subtitle = header.Subtitle;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteServiceItem?> GetServiceItemByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteServiceItem>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertServiceItemAsync(WebsiteServiceItem item, CancellationToken ct = default)
    {
        var header = await dbContext.Set<WebsiteServicesHeader>().FirstOrDefaultAsync(ct);
        if (header == null)
        {
            header = new WebsiteServicesHeader();
            dbContext.Set<WebsiteServicesHeader>().Add(header);
            await dbContext.SaveChangesAsync(ct);
        }

        var existing = await dbContext.Set<WebsiteServiceItem>().FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (existing == null)
        {
            item.HeaderId = header.Id;
            dbContext.Set<WebsiteServiceItem>().Add(item);
        }
        else
        {
            existing.Title = item.Title;
            existing.Description = item.Description;
            existing.IconName = item.IconName;
            existing.CustomIconUrl = item.CustomIconUrl;
            existing.SortOrder = item.SortOrder;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteServiceItemAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteServiceItem>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<List<WebsiteFaqCategory>> GetFaqCategoriesAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteFaqCategory>()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.SortOrder)
            .AsNoTracking()
            .ToListAsync(ct);
    }

    public async Task<WebsiteFaqCategory?> GetFaqCategoryByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteFaqCategory>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertFaqCategoryAsync(WebsiteFaqCategory cat, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteFaqCategory>().FirstOrDefaultAsync(x => x.Id == cat.Id, ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteFaqCategory>().Add(cat);
        }
        else
        {
            existing.Name = cat.Name;
            existing.Slug = cat.Slug;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<List<WebsiteFaqItem>> GetFaqItemsAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteFaqItem>()
            .Include(f => f.Category)
            .Where(f => !f.IsDeleted)
            .OrderBy(f => f.SortOrder)
            .AsNoTracking()
            .ToListAsync(ct);
    }

    public async Task<WebsiteFaqItem?> GetFaqItemByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteFaqItem>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertFaqItemAsync(WebsiteFaqItem item, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteFaqItem>().FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteFaqItem>().Add(item);
        }
        else
        {
            existing.CategoryId = item.CategoryId;
            existing.Question = item.Question;
            existing.Answer = item.Answer;
            existing.IsPublished = item.IsPublished;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteFaqItemAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteFaqItem>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<WebsiteContactContent?> GetContactContentAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteContactContent>()
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateContactContentAsync(WebsiteContactContent contact, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteContactContent>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteContactContent>().Add(contact);
        }
        else
        {
            existing.HeroTitle = contact.HeroTitle;
            existing.HeroAccent = contact.HeroAccent;
            existing.HeroSub = contact.HeroSub;
            existing.Phone = contact.Phone;
            existing.Email = contact.Email;
            existing.OperatingHours = contact.OperatingHours;
            existing.InstitutionalNote = contact.InstitutionalNote;
            existing.CtaTitle = contact.CtaTitle;
            existing.CtaDescription = contact.CtaDescription;
            existing.CtaButtonText = contact.CtaButtonText;
            existing.CtaButtonLink = contact.CtaButtonLink;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteRentVsBuyContent?> GetRentVsBuyContentAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteRentVsBuyContent>()
            .Include(x => x.Features.Where(f => !f.IsDeleted))
            .Include(x => x.Cards.Where(c => !c.IsDeleted))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateRentVsBuyHeaderAsync(WebsiteRentVsBuyContent header, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteRentVsBuyContent>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteRentVsBuyContent>().Add(header);
        }
        else
        {
            existing.Eyebrow = header.Eyebrow;
            existing.Title = header.Title;
            existing.AccentText = header.AccentText;
            existing.Subtitle = header.Subtitle;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteRentVsBuyFeatureRow?> GetRentVsBuyFeatureByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteRentVsBuyFeatureRow>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertRentVsBuyFeatureAsync(WebsiteRentVsBuyFeatureRow item, CancellationToken ct = default)
    {
        var header = await dbContext.Set<WebsiteRentVsBuyContent>().FirstOrDefaultAsync(ct);
        if (header == null)
        {
            header = new WebsiteRentVsBuyContent();
            dbContext.Set<WebsiteRentVsBuyContent>().Add(header);
            await dbContext.SaveChangesAsync(ct);
        }

        var existing = await dbContext.Set<WebsiteRentVsBuyFeatureRow>().FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (existing == null)
        {
            item.RentVsBuyId = header.Id;
            dbContext.Set<WebsiteRentVsBuyFeatureRow>().Add(item);
        }
        else
        {
            existing.FeatureLabel = item.FeatureLabel;
            existing.WeeklyValue = item.WeeklyValue;
            existing.MonthlyValue = item.MonthlyValue;
            existing.PurchaseValue = item.PurchaseValue;
            existing.SortOrder = item.SortOrder;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteRentVsBuyFeatureAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteRentVsBuyFeatureRow>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<WebsiteRentVsBuyCard?> GetRentVsBuyCardByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteRentVsBuyCard>().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
    }

    public async Task UpsertRentVsBuyCardAsync(WebsiteRentVsBuyCard item, CancellationToken ct = default)
    {
        var header = await dbContext.Set<WebsiteRentVsBuyContent>().FirstOrDefaultAsync(ct);
        if (header == null)
        {
            header = new WebsiteRentVsBuyContent();
            dbContext.Set<WebsiteRentVsBuyContent>().Add(header);
            await dbContext.SaveChangesAsync(ct);
        }

        var existing = await dbContext.Set<WebsiteRentVsBuyCard>().FirstOrDefaultAsync(x => x.Id == item.Id, ct);
        if (existing == null)
        {
            item.RentVsBuyId = header.Id;
            dbContext.Set<WebsiteRentVsBuyCard>().Add(item);
        }
        else
        {
            existing.Title = item.Title;
            existing.Description = item.Description;
            existing.SortOrder = item.SortOrder;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteRentVsBuyCardAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteRentVsBuyCard>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<WebsiteGlobalSettings?> GetGlobalSettingsAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteGlobalSettings>()
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateGlobalSettingsAsync(WebsiteGlobalSettings settings, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteGlobalSettings>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteGlobalSettings>().Add(settings);
        }
        else
        {
            existing.ShowLandingPage = settings.ShowLandingPage;
            existing.ShowAboutSection = settings.ShowAboutSection;
            existing.ShowServicesSection = settings.ShowServicesSection;
            existing.ShowRentVsBuySection = settings.ShowRentVsBuySection;
            existing.ShowFaqSection = settings.ShowFaqSection;
            existing.ShowContactSection = settings.ShowContactSection;
            existing.ShowHowItWorksSection = settings.ShowHowItWorksSection;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteHowItWorksHeader?> GetHowItWorksHeaderAsync(CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteHowItWorksHeader>()
            .Include(x => x.Steps.Where(s => !s.IsDeleted))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpdateHowItWorksHeaderAsync(WebsiteHowItWorksHeader header, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteHowItWorksHeader>().FirstOrDefaultAsync(ct);
        if (existing == null)
        {
            dbContext.Set<WebsiteHowItWorksHeader>().Add(header);
        }
        else
        {
            existing.Eyebrow = header.Eyebrow;
            existing.Title = header.Title;
            existing.AccentText = header.AccentText;
            existing.Subtitle = header.Subtitle;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<WebsiteHowItWorksStep?> GetHowItWorksStepByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await dbContext.Set<WebsiteHowItWorksStep>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);
    }

    public async Task UpsertHowItWorksStepAsync(WebsiteHowItWorksStep step, CancellationToken ct = default)
    {
        var header = await dbContext.Set<WebsiteHowItWorksHeader>().FirstOrDefaultAsync(ct);
        if (header == null)
        {
            header = new WebsiteHowItWorksHeader
            {
                Eyebrow = "HOW IT WORKS",
                Title = "From browsing to",
                AccentText = "delivery.",
                Subtitle = "Five simple steps to get the equipment and supplies you need."
            };
            dbContext.Set<WebsiteHowItWorksHeader>().Add(header);
            await dbContext.SaveChangesAsync(ct);
        }

        var existing = await dbContext.Set<WebsiteHowItWorksStep>().FirstOrDefaultAsync(x => x.Id == step.Id, ct);
        if (existing == null)
        {
            step.HeaderId = header.Id;
            dbContext.Set<WebsiteHowItWorksStep>().Add(step);
        }
        else
        {
            existing.StepNumber = step.StepNumber;
            existing.Title = step.Title;
            existing.Description = step.Description;
            existing.IconName = step.IconName;
            existing.CustomIconUrl = step.CustomIconUrl;
            existing.SortOrder = step.SortOrder;
            existing.IsActive = step.IsActive;
            existing.ModifiedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task DeleteHowItWorksStepAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await dbContext.Set<WebsiteHowItWorksStep>().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (existing != null)
        {
            existing.IsDeleted = true;
            await dbContext.SaveChangesAsync(ct);
        }
    }
}


