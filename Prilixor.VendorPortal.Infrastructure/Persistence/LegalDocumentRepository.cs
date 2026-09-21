using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using Prilixor.Shared.Abstractions.DI;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public sealed class LegalDocumentRepository(
    CommonPortalDbContext dbContext,
    IHtmlSanitizer htmlSanitizer,
    ILogger<LegalDocumentRepository> logger) : ILegalDocumentRepository, IScopedService
{
    private static readonly DateTimeOffset SeedEffectiveFrom = new(2026, 9, 8, 0, 0, 0, TimeSpan.Zero);

    private static readonly IReadOnlyDictionary<string, string> SeedResourceByType = new Dictionary<string, string>
    {
        [LegalCatalog.DocumentTypes.TermsOfUse] = "01-terms-of-use.md",
        [LegalCatalog.DocumentTypes.VendorSellerPolicy] = "02-vendor-seller-policy.md",
        [LegalCatalog.DocumentTypes.RentalAndPurchasePolicy] = "03-rental-and-purchase-policy.md",
        [LegalCatalog.DocumentTypes.CancellationRefundPolicy] = "04-cancellation-refund-policy.md",
        [LegalCatalog.DocumentTypes.ShippingDeliveryPolicy] = "05-shipping-delivery-policy.md",
        [LegalCatalog.DocumentTypes.PrivacyPolicy] = "06-privacy-policy.md",
        [LegalCatalog.DocumentTypes.GrievanceRedressalPolicy] = "07-grievance-redressal-policy.md",
    };

    public async Task EnsureSeededAsync(CancellationToken ct = default)
    {
        try
        {
            var documents = await dbContext.LegalDocuments
                .Include(d => d.Versions)
                .Include(d => d.Placements)
                .ToListAsync(ct);

            var changed = false;

            foreach (var spec in LegalCatalog.SeedDocuments)
            {
                var document = documents.FirstOrDefault(d => d.Id == spec.Id || d.DocumentType == spec.DocumentType);
                if (document is null)
                {
                    document = new LegalDocument
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
                        CreatedOnUtc = DateTime.UtcNow,
                        ModifiedOnUtc = DateTime.UtcNow,
                    };
                    dbContext.LegalDocuments.Add(document);
                    documents.Add(document);
                    changed = true;
                }

                foreach (var surface in LegalCatalog.Surfaces.All)
                {
                    foreach (var screen in LegalCatalog.Screens.All)
                    {
                        if (document.Placements.Any(p => p.Surface == surface && p.Screen == screen))
                            continue;

                        var defaults = LegalCatalog.DefaultPlacement(document.DocumentType, surface, screen);
                        dbContext.LegalDocumentPlacements.Add(new LegalDocumentPlacement
                        {
                            Id = Guid.NewGuid(),
                            DocumentId = document.Id,
                            Surface = surface,
                            Screen = screen,
                            IsVisible = defaults.IsVisible,
                            IsRequiredToProceed = defaults.IsRequiredToProceed,
                            SortOrder = document.SortOrder,
                            CreatedOnUtc = DateTime.UtcNow,
                            ModifiedOnUtc = DateTime.UtcNow,
                        });
                        changed = true;
                    }
                }

                if (document.Versions.Count > 0)
                    continue;

                if (!SeedResourceByType.TryGetValue(document.DocumentType, out var fileName))
                    continue;

                var markdown = ReadEmbeddedMarkdown(fileName);
                if (string.IsNullOrWhiteSpace(markdown))
                {
                    logger.LogWarning("Legal seed markdown missing for {DocumentType} ({File})", document.DocumentType, fileName);
                    continue;
                }

                var html = htmlSanitizer.MarkdownToSanitizedHtml(markdown);
                dbContext.LegalDocumentVersions.Add(new LegalDocumentVersion
                {
                    Id = Guid.NewGuid(),
                    DocumentId = document.Id,
                    VersionNumber = 1,
                    ContentMarkdown = markdown,
                    ContentHtml = html,
                    Status = LegalCatalog.VersionStatuses.Published,
                    ChangeSummary = "Initial published version",
                    IsMaterialChange = true,
                    EffectiveFrom = SeedEffectiveFrom,
                    PublishedAt = SeedEffectiveFrom,
                    CreatedOnUtc = DateTime.UtcNow,
                    ModifiedOnUtc = DateTime.UtcNow,
                });
                changed = true;
            }

            if (changed)
                await dbContext.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (IsMissingLegalTable(ex))
        {
            logger.LogWarning("Legal document tables are not migrated yet; skipping seed.");
        }
    }

    public async Task<List<LegalDocument>> ListDocumentsAsync(CancellationToken ct = default)
    {
        return await dbContext.LegalDocuments
            .AsNoTracking()
            .AsSplitQuery()
            .Include(d => d.Placements)
            .Include(d => d.Versions)
            .OrderBy(d => d.SortOrder)
            .ThenBy(d => d.Title)
            .ToListAsync(ct);
    }

    public async Task<LegalDocument?> GetDocumentByIdAsync(Guid id, bool includeVersions, CancellationToken ct = default)
    {
        var query = dbContext.LegalDocuments
            .AsSplitQuery()
            .Include(d => d.Placements)
            .AsQueryable();

        query = includeVersions
            ? query.Include(d => d.Versions)
            : query.Include(d => d.Versions.Where(v =>
                v.Status == LegalCatalog.VersionStatuses.Published
                || v.Status == LegalCatalog.VersionStatuses.Draft));

        return await query.FirstOrDefaultAsync(d => d.Id == id, ct);
    }

    public async Task<LegalDocument?> GetDocumentBySlugOrPathAsync(string slugOrPath, CancellationToken ct = default)
    {
        var key = NormalizeSlugOrPath(slugOrPath);
        if (string.IsNullOrEmpty(key))
            return null;

        return await dbContext.LegalDocuments
            .AsNoTracking()
            .AsSplitQuery()
            .Include(d => d.Placements)
            .Include(d => d.Versions.Where(v => v.Status == LegalCatalog.VersionStatuses.Published))
            .FirstOrDefaultAsync(d =>
                d.Slug == key
                || d.PublicPath == key
                || d.PublicPath == "/" + key, ct);
    }

    public Task<LegalDocument?> GetDocumentBySlugAsync(string slug, Guid? excludingId = null, CancellationToken ct = default)
    {
        var normalized = slug.Trim().ToLowerInvariant();
        var query = dbContext.LegalDocuments.Where(d => d.Slug == normalized);
        if (excludingId.HasValue)
            query = query.Where(d => d.Id != excludingId.Value);
        return query.FirstOrDefaultAsync(ct);
    }

    public Task UpdateDocumentAsync(LegalDocument document, CancellationToken ct = default)
    {
        dbContext.LegalDocuments.Update(document);
        return Task.CompletedTask;
    }

    public Task ReplacePlacementsAsync(
        LegalDocument document,
        IReadOnlyList<LegalDocumentPlacement> placements,
        Guid? actorId,
        CancellationToken ct = default)
    {
        var existing = document.Placements.ToList();
        foreach (var incoming in placements)
        {
            var match = existing.FirstOrDefault(p =>
                p.Surface == incoming.Surface && p.Screen == incoming.Screen);
            if (match is null)
            {
                dbContext.LegalDocumentPlacements.Add(new LegalDocumentPlacement
                {
                    Id = Guid.NewGuid(),
                    DocumentId = document.Id,
                    Surface = incoming.Surface,
                    Screen = incoming.Screen,
                    IsVisible = incoming.IsVisible,
                    IsRequiredToProceed = incoming.IsRequiredToProceed,
                    SortOrder = incoming.SortOrder,
                    CreatedBy = actorId,
                    CreatedOnUtc = DateTime.UtcNow,
                    ModifiedOnUtc = DateTime.UtcNow,
                });
            }
            else
            {
                match.IsVisible = incoming.IsVisible;
                match.IsRequiredToProceed = incoming.IsRequiredToProceed;
                match.SortOrder = incoming.SortOrder;
                match.StampModified(actorId);
            }
        }

        return Task.CompletedTask;
    }

    public Task<LegalDocumentVersion?> GetVersionByIdAsync(Guid documentId, Guid versionId, CancellationToken ct = default) =>
        dbContext.LegalDocumentVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && v.DocumentId == documentId, ct);

    public Task<List<LegalDocumentVersion>> ListVersionsAsync(Guid documentId, CancellationToken ct = default) =>
        dbContext.LegalDocumentVersions
            .AsNoTracking()
            .Where(v => v.DocumentId == documentId)
            .OrderByDescending(v => v.VersionNumber)
            .ThenByDescending(v => v.CreatedOnUtc)
            .ToListAsync(ct);

    public async Task AddVersionAsync(LegalDocumentVersion version, CancellationToken ct = default)
    {
        await dbContext.LegalDocumentVersions.AddAsync(version, ct);
    }

    public Task UpdateVersionAsync(LegalDocumentVersion version, CancellationToken ct = default)
    {
        dbContext.LegalDocumentVersions.Update(version);
        return Task.CompletedTask;
    }

    public async Task ArchiveOtherPublishedVersionsAsync(Guid documentId, Guid exceptVersionId, Guid? actorId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        await dbContext.LegalDocumentVersions
            .Where(v =>
                v.DocumentId == documentId
                && v.Id != exceptVersionId
                && v.Status == LegalCatalog.VersionStatuses.Published)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.Status, LegalCatalog.VersionStatuses.Archived)
                .SetProperty(v => v.ModifiedOnUtc, now)
                .SetProperty(v => v.ModifiedBy, actorId), ct);

        foreach (var entry in dbContext.ChangeTracker.Entries<LegalDocumentVersion>())
        {
            if (entry.Entity.DocumentId != documentId
                || entry.Entity.Id == exceptVersionId
                || !string.Equals(entry.Entity.Status, LegalCatalog.VersionStatuses.Published, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            entry.Entity.Status = LegalCatalog.VersionStatuses.Archived;
            entry.Property(v => v.Status).OriginalValue = LegalCatalog.VersionStatuses.Archived;
            entry.Property(v => v.Status).IsModified = false;
        }
    }

    public async Task AddAcceptancesAsync(IReadOnlyList<LegalAcceptance> acceptances, CancellationToken ct = default)
    {
        if (acceptances.Count == 0)
            return;
        await dbContext.LegalAcceptances.AddRangeAsync(acceptances, ct);
        await dbContext.SaveChangesAsync(ct);
    }

    public Task<List<LegalAcceptance>> ListAcceptancesForActorAsync(string actorType, Guid actorId, CancellationToken ct = default) =>
        dbContext.LegalAcceptances
            .AsNoTracking()
            .Where(a => a.ActorType == actorType && a.ActorId == actorId)
            .OrderByDescending(a => a.AcceptedAt)
            .ToListAsync(ct);

    public Task<List<LegalAcceptance>> ListAcceptancesForAdminAsync(
        string? actorType,
        Guid? documentId,
        string? screen,
        int take,
        CancellationToken ct = default)
    {
        var query = dbContext.LegalAcceptances
            .AsNoTracking()
            .Include(a => a.Document)
            .Include(a => a.Version)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(actorType))
            query = query.Where(a => a.ActorType == actorType.Trim().ToLowerInvariant());
        if (documentId is { } id && id != Guid.Empty)
            query = query.Where(a => a.DocumentId == id);
        if (!string.IsNullOrWhiteSpace(screen))
            query = query.Where(a => a.SourceScreen == screen.Trim().ToLowerInvariant());

        return query
            .OrderByDescending(a => a.AcceptedAt)
            .Take(Math.Clamp(take, 1, 500))
            .ToListAsync(ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default) =>
        dbContext.SaveChangesAsync(ct);

    private static string NormalizeSlugOrPath(string slugOrPath)
    {
        var trimmed = slugOrPath.Trim().Trim('/');
        return trimmed.ToLowerInvariant();
    }

    private static string? ReadEmbeddedMarkdown(string fileName)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resource = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase));
        if (resource is null)
            return null;

        using var stream = assembly.GetManifestResourceStream(resource);
        if (stream is null)
            return null;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private static bool IsMissingLegalTable(Exception ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is PostgresException pg && pg.SqlState == PostgresErrorCodes.UndefinedTable)
                return true;
            if (e.Message.Contains("legal_document", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}
