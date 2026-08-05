using Prilixor.VendorPortal.Domain.WebsiteContent;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IWebsiteContentRepository
{
    Task<WebsiteHomeContent?> GetHomeContentAsync(CancellationToken ct = default);
    Task UpdateHomeContentAsync(WebsiteHomeContent home, List<WebsiteHomeFeature> features, CancellationToken ct = default);

    Task<WebsiteAboutContent?> GetAboutContentAsync(CancellationToken ct = default);
    Task UpdateAboutContentAsync(WebsiteAboutContent about, CancellationToken ct = default);

    Task<WebsiteAudienceCategory?> GetAudienceCategoryByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertAudienceCategoryAsync(WebsiteAudienceCategory item, CancellationToken ct = default);
    Task DeleteAudienceCategoryAsync(Guid id, CancellationToken ct = default);

    Task<WebsiteServicesHeader?> GetServicesHeaderAsync(CancellationToken ct = default);
    Task UpdateServicesHeaderAsync(WebsiteServicesHeader header, CancellationToken ct = default);

    Task<WebsiteServiceItem?> GetServiceItemByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertServiceItemAsync(WebsiteServiceItem item, CancellationToken ct = default);
    Task DeleteServiceItemAsync(Guid id, CancellationToken ct = default);

    Task<List<WebsiteFaqCategory>> GetFaqCategoriesAsync(CancellationToken ct = default);
    Task<WebsiteFaqCategory?> GetFaqCategoryByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertFaqCategoryAsync(WebsiteFaqCategory cat, CancellationToken ct = default);

    Task<List<WebsiteFaqItem>> GetFaqItemsAsync(CancellationToken ct = default);
    Task<WebsiteFaqItem?> GetFaqItemByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertFaqItemAsync(WebsiteFaqItem item, CancellationToken ct = default);
    Task DeleteFaqItemAsync(Guid id, CancellationToken ct = default);

    Task<WebsiteContactContent?> GetContactContentAsync(CancellationToken ct = default);
    Task UpdateContactContentAsync(WebsiteContactContent contact, CancellationToken ct = default);

    Task<WebsiteRentVsBuyContent?> GetRentVsBuyContentAsync(CancellationToken ct = default);
    Task UpdateRentVsBuyHeaderAsync(WebsiteRentVsBuyContent header, CancellationToken ct = default);

    Task<WebsiteRentVsBuyFeatureRow?> GetRentVsBuyFeatureByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertRentVsBuyFeatureAsync(WebsiteRentVsBuyFeatureRow item, CancellationToken ct = default);
    Task DeleteRentVsBuyFeatureAsync(Guid id, CancellationToken ct = default);

    Task<WebsiteRentVsBuyCard?> GetRentVsBuyCardByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertRentVsBuyCardAsync(WebsiteRentVsBuyCard item, CancellationToken ct = default);
    Task DeleteRentVsBuyCardAsync(Guid id, CancellationToken ct = default);

    Task<WebsiteGlobalSettings?> GetGlobalSettingsAsync(CancellationToken ct = default);
    Task UpdateGlobalSettingsAsync(WebsiteGlobalSettings settings, CancellationToken ct = default);

    Task<WebsiteHowItWorksHeader?> GetHowItWorksHeaderAsync(CancellationToken ct = default);
    Task UpdateHowItWorksHeaderAsync(WebsiteHowItWorksHeader header, CancellationToken ct = default);
    Task<WebsiteHowItWorksStep?> GetHowItWorksStepByIdAsync(Guid id, CancellationToken ct = default);
    Task UpsertHowItWorksStepAsync(WebsiteHowItWorksStep step, CancellationToken ct = default);
    Task DeleteHowItWorksStepAsync(Guid id, CancellationToken ct = default);
}


