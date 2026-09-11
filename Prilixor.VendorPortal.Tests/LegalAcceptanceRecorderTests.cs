using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Admin.LegalDocuments;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Tests;

public class LegalAcceptanceRecorderTests
{
    [Fact]
    public async Task Customer_register_requires_accepted_legal_when_placements_are_required()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Customer,
            Guid.Empty,
            LegalCatalog.Surfaces.CustomerWeb,
            acceptedLegal: false,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(result.IsFailure);
        Assert.Contains(result.Errors, e => e.Code == "legal.acceptance_required");
    }

    [Fact]
    public async Task Customer_register_records_terms_and_privacy_only()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Customer,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.CustomerWeb,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: "127.0.0.1",
            userAgent: "test");

        Assert.True(result.IsSuccess);
        var slugs = Slugs(result.Value);
        Assert.Equal(2, slugs.Count);
        Assert.Contains("terms-of-use", slugs);
        Assert.Contains("privacy-policy", slugs);
        Assert.DoesNotContain("vendor-seller-policy", slugs);
    }

    [Fact]
    public async Task Vendor_register_records_terms_privacy_and_seller_policy()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Vendor,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.VendorWeb,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(result.IsSuccess);
        var slugs = Slugs(result.Value);
        Assert.Equal(3, slugs.Count);
        Assert.Contains("terms-of-use", slugs);
        Assert.Contains("privacy-policy", slugs);
        Assert.Contains("vendor-seller-policy", slugs);
    }

    [Fact]
    public async Task Vendor_mobile_uses_same_required_register_set()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Vendor,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.VendorMobile,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Count);
        Assert.All(result.Value, row => Assert.Equal(LegalCatalog.Surfaces.VendorMobile, row.SourceSurface));
    }

    [Fact]
    public async Task Accepted_slugs_must_cover_every_required_document()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Vendor,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.VendorWeb,
            acceptedLegal: true,
            acceptedSlugs: ["terms-of-use", "privacy-policy"],
            ipAddress: null,
            userAgent: null);

        Assert.True(result.IsFailure);
        Assert.Contains(result.Errors, e => e.Code == "legal.acceptance_incomplete");
    }

    [Fact]
    public async Task Customer_checkout_requires_rental_refund_and_shipping()
    {
        var recorder = CreateRecorder();
        var denied = await recorder.BuildScreenAcceptancesAsync(
            LegalCatalog.ActorTypes.Customer,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.CustomerWeb,
            LegalCatalog.Screens.Checkout,
            acceptedLegal: false,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(denied.IsFailure);

        var accepted = await recorder.BuildScreenAcceptancesAsync(
            LegalCatalog.ActorTypes.Customer,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.CustomerWeb,
            LegalCatalog.Screens.Checkout,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(accepted.IsSuccess);
        var slugs = Slugs(accepted.Value);
        Assert.Equal(3, slugs.Count);
        Assert.Contains("rental-and-purchase-policy", slugs);
        Assert.Contains("cancellation-refund-policy", slugs);
        Assert.Contains("shipping-delivery-policy", slugs);
    }

    [Fact]
    public async Task Vendor_onboarding_requires_typed_name()
    {
        var recorder = CreateRecorder();
        var denied = await recorder.BuildScreenAcceptancesAsync(
            LegalCatalog.ActorTypes.Vendor,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.VendorWeb,
            LegalCatalog.Screens.Onboarding,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null,
            signedName: "  ");

        Assert.True(denied.IsFailure);
        Assert.Contains(denied.Errors, e => e.Code == "legal.signature_required");

        var accepted = await recorder.BuildScreenAcceptancesAsync(
            LegalCatalog.ActorTypes.Vendor,
            Guid.NewGuid(),
            LegalCatalog.Surfaces.VendorWeb,
            LegalCatalog.Screens.Onboarding,
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null,
            signedName: "Pankaj Zalera");

        Assert.True(accepted.IsSuccess);
        Assert.Contains(accepted.Value, row => row.SignedName == "Pankaj Zalera");
        Assert.Contains(Slugs(accepted.Value), slug => slug == "vendor-seller-policy");
    }

    [Fact]
    public async Task Unknown_surface_defaults_to_web_for_actor_type()
    {
        var recorder = CreateRecorder();
        var result = await recorder.BuildRegisterAcceptancesAsync(
            LegalCatalog.ActorTypes.Customer,
            Guid.NewGuid(),
            "not-a-surface",
            acceptedLegal: true,
            acceptedSlugs: null,
            ipAddress: null,
            userAgent: null);

        Assert.True(result.IsSuccess);
        Assert.All(result.Value, row => Assert.Equal(LegalCatalog.Surfaces.CustomerWeb, row.SourceSurface));
        Assert.Equal(2, result.Value.Count);
    }

    [Fact]
    public async Task Vendor_reconsent_pending_when_terms_version_changes()
    {
        var vendorId = Guid.NewGuid();
        var repo = new SeedCatalogLegalDocumentRepository();
        var terms = repo.Document(LegalCatalog.DocumentTypes.TermsOfUse);
        var v1 = terms.Versions.Single();
        repo.AddAcceptance(new LegalAcceptance
        {
            Id = Guid.NewGuid(),
            ActorType = LegalCatalog.ActorTypes.Vendor,
            ActorId = vendorId,
            DocumentId = terms.Id,
            VersionId = v1.Id,
            AcceptedAt = DateTimeOffset.UtcNow.AddDays(-2),
            SourceSurface = LegalCatalog.Surfaces.VendorWeb,
            SourceScreen = LegalCatalog.Screens.Register,
        });
        repo.PublishNext(terms, versionNumber: 4, isMaterialChange: false);

        var pending = await new LegalAcceptanceRecorder(repo).ListPendingReconsentAsync(
            LegalCatalog.ActorTypes.Vendor, vendorId);

        Assert.Contains(pending, p => p.Slug == "terms-of-use" && p.VersionNumber == 4);
    }

    [Fact]
    public async Task Vendor_reconsent_not_pending_when_current_terms_already_accepted()
    {
        var vendorId = Guid.NewGuid();
        var repo = new SeedCatalogLegalDocumentRepository();
        var terms = repo.Document(LegalCatalog.DocumentTypes.TermsOfUse);
        var current = terms.Versions.Single(v => v.Status == LegalCatalog.VersionStatuses.Published);
        repo.AddAcceptance(new LegalAcceptance
        {
            Id = Guid.NewGuid(),
            ActorType = LegalCatalog.ActorTypes.Vendor,
            ActorId = vendorId,
            DocumentId = terms.Id,
            VersionId = current.Id,
            AcceptedAt = DateTimeOffset.UtcNow,
            SourceSurface = LegalCatalog.Surfaces.VendorWeb,
            SourceScreen = LegalCatalog.Screens.Reconsent,
        });

        var pending = await new LegalAcceptanceRecorder(repo).ListPendingReconsentAsync(
            LegalCatalog.ActorTypes.Vendor, vendorId);

        Assert.DoesNotContain(pending, p => p.Slug == "terms-of-use");
    }

    private static LegalAcceptanceRecorder CreateRecorder() =>
        new(new SeedCatalogLegalDocumentRepository());

    private static HashSet<string> Slugs(IReadOnlyList<LegalAcceptance> rows)
    {
        var byId = LegalCatalog.SeedDocuments.ToDictionary(d => d.Id, d => d.Slug);
        return rows.Select(r => byId[r.DocumentId]).ToHashSet();
    }

    private sealed class SeedCatalogLegalDocumentRepository : ILegalDocumentRepository
    {
        private readonly List<LegalDocument> _documents = BuildSeededDocuments();
        private readonly List<LegalAcceptance> _acceptances = [];

        public LegalDocument Document(string documentType) =>
            _documents.First(d => d.DocumentType == documentType);

        public void AddAcceptance(LegalAcceptance row) => _acceptances.Add(row);

        public void PublishNext(LegalDocument doc, int versionNumber, bool isMaterialChange)
        {
            foreach (var version in doc.Versions.Where(v => v.Status == LegalCatalog.VersionStatuses.Published))
                version.Status = LegalCatalog.VersionStatuses.Archived;

            doc.Versions.Add(new LegalDocumentVersion
            {
                Id = Guid.NewGuid(),
                DocumentId = doc.Id,
                VersionNumber = versionNumber,
                Status = LegalCatalog.VersionStatuses.Published,
                ContentHtml = "<p>Updated</p>",
                IsMaterialChange = isMaterialChange,
                EffectiveFrom = DateTimeOffset.UtcNow.AddMinutes(-1),
                PublishedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            });
        }

        public Task<List<LegalDocument>> ListDocumentsAsync(CancellationToken ct = default) =>
            Task.FromResult(_documents);

        public Task EnsureSeededAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<LegalDocument?> GetDocumentByIdAsync(Guid id, bool includeVersions, CancellationToken ct = default) =>
            Task.FromResult(_documents.FirstOrDefault(d => d.Id == id));
        public Task<LegalDocument?> GetDocumentBySlugOrPathAsync(string slugOrPath, CancellationToken ct = default) =>
            Task.FromResult(_documents.FirstOrDefault(d => d.Slug == slugOrPath || d.PublicPath == slugOrPath));
        public Task<LegalDocument?> GetDocumentBySlugAsync(string slug, Guid? excludingId = null, CancellationToken ct = default) =>
            Task.FromResult(_documents.FirstOrDefault(d => d.Slug == slug && d.Id != excludingId));
        public Task UpdateDocumentAsync(LegalDocument document, CancellationToken ct = default) => Task.CompletedTask;
        public Task ReplacePlacementsAsync(LegalDocument document, IReadOnlyList<LegalDocumentPlacement> placements, Guid? actorId, CancellationToken ct = default) =>
            Task.CompletedTask;
        public Task<LegalDocumentVersion?> GetVersionByIdAsync(Guid documentId, Guid versionId, CancellationToken ct = default) =>
            Task.FromResult<LegalDocumentVersion?>(null);
        public Task<List<LegalDocumentVersion>> ListVersionsAsync(Guid documentId, CancellationToken ct = default) =>
            Task.FromResult(new List<LegalDocumentVersion>());
        public Task AddVersionAsync(LegalDocumentVersion version, CancellationToken ct = default) => Task.CompletedTask;
        public Task UpdateVersionAsync(LegalDocumentVersion version, CancellationToken ct = default) => Task.CompletedTask;
        public Task ArchiveOtherPublishedVersionsAsync(Guid documentId, Guid exceptVersionId, Guid? actorId, CancellationToken ct = default) =>
            Task.CompletedTask;
        public Task AddAcceptancesAsync(IReadOnlyList<LegalAcceptance> acceptances, CancellationToken ct = default) =>
            Task.CompletedTask;
        public Task<List<LegalAcceptance>> ListAcceptancesForActorAsync(string actorType, Guid actorId, CancellationToken ct = default) =>
            Task.FromResult(_acceptances.Where(a => a.ActorType == actorType && a.ActorId == actorId).ToList());
        public Task<List<LegalAcceptance>> ListAcceptancesForAdminAsync(
            string? actorType, Guid? documentId, string? screen, int take, CancellationToken ct = default) =>
            Task.FromResult(_acceptances
                .Where(a =>
                    (string.IsNullOrWhiteSpace(actorType) || a.ActorType == actorType)
                    && (!documentId.HasValue || a.DocumentId == documentId)
                    && (string.IsNullOrWhiteSpace(screen) || a.SourceScreen == screen))
                .Take(take)
                .ToList());
        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;

        private static List<LegalDocument> BuildSeededDocuments()
        {
            var now = DateTimeOffset.UtcNow;
            var docs = new List<LegalDocument>();
            foreach (var spec in LegalCatalog.SeedDocuments)
            {
                var doc = new LegalDocument
                {
                    Id = spec.Id,
                    Slug = spec.Slug,
                    DocumentType = spec.DocumentType,
                    Title = spec.Title,
                    Audience = spec.Audience,
                    Summary = spec.Summary,
                    PublicPath = spec.PublicPath,
                    SortOrder = spec.SortOrder,
                    IsRequiredAcceptance = spec.IsRequiredAcceptance,
                };

                doc.Versions.Add(new LegalDocumentVersion
                {
                    Id = Guid.NewGuid(),
                    DocumentId = spec.Id,
                    VersionNumber = 1,
                    Status = LegalCatalog.VersionStatuses.Published,
                    ContentHtml = "<p>Published</p>",
                    EffectiveFrom = now.AddDays(-1),
                    PublishedAt = now.AddDays(-1),
                });

                foreach (var surface in LegalCatalog.Surfaces.All)
                {
                    foreach (var screen in LegalCatalog.Screens.All)
                    {
                        var defaults = LegalCatalog.DefaultPlacement(spec.DocumentType, surface, screen);
                        doc.Placements.Add(new LegalDocumentPlacement
                        {
                            Id = Guid.NewGuid(),
                            DocumentId = spec.Id,
                            Surface = surface,
                            Screen = screen,
                            IsVisible = defaults.IsVisible,
                            IsRequiredToProceed = defaults.IsRequiredToProceed,
                            SortOrder = spec.SortOrder,
                        });
                    }
                }

                docs.Add(doc);
            }

            return docs;
        }
    }
}
