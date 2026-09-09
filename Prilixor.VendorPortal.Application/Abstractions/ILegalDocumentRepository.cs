using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface ILegalDocumentRepository
{
    Task EnsureSeededAsync(CancellationToken ct = default);

    Task<List<LegalDocument>> ListDocumentsAsync(CancellationToken ct = default);
    Task<LegalDocument?> GetDocumentByIdAsync(Guid id, bool includeVersions, CancellationToken ct = default);
    Task<LegalDocument?> GetDocumentBySlugOrPathAsync(string slugOrPath, CancellationToken ct = default);
    Task<LegalDocument?> GetDocumentBySlugAsync(string slug, Guid? excludingId = null, CancellationToken ct = default);

    Task UpdateDocumentAsync(LegalDocument document, CancellationToken ct = default);
    Task ReplacePlacementsAsync(LegalDocument document, IReadOnlyList<LegalDocumentPlacement> placements, Guid? actorId, CancellationToken ct = default);

    Task<LegalDocumentVersion?> GetVersionByIdAsync(Guid documentId, Guid versionId, CancellationToken ct = default);
    Task<List<LegalDocumentVersion>> ListVersionsAsync(Guid documentId, CancellationToken ct = default);
    Task AddVersionAsync(LegalDocumentVersion version, CancellationToken ct = default);
    Task UpdateVersionAsync(LegalDocumentVersion version, CancellationToken ct = default);

    Task SaveChangesAsync(CancellationToken ct = default);
}
