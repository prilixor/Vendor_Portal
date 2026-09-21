using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Legal;

public class LegalDocument : AuditableEntity<Guid>, ISoftDelete
{
    public string Slug { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Audience { get; set; } = LegalCatalog.Audiences.Both;
    public string? Summary { get; set; }
    public string? PublicPath { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequiredAcceptance { get; set; }

    public ICollection<LegalDocumentVersion> Versions { get; set; } = [];
    public ICollection<LegalDocumentPlacement> Placements { get; set; } = [];
    public ICollection<LegalAcceptance> Acceptances { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public void StampModified(Guid? actorId)
    {
        LegalAudit.SetModifiedBy(this, actorId);
    }
}

public class LegalDocumentVersion : AuditableEntity<Guid>, ISoftDelete
{
    public Guid DocumentId { get; set; }
    public LegalDocument? Document { get; set; }

    public int VersionNumber { get; set; }
    public string ContentHtml { get; set; } = string.Empty;
    public string? ContentMarkdown { get; set; }
    public string Status { get; set; } = LegalCatalog.VersionStatuses.Draft;
    public string? ChangeSummary { get; set; }
    public bool IsMaterialChange { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public Guid? PublishedBy { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public void StampModified(Guid? actorId)
    {
        LegalAudit.SetModifiedBy(this, actorId);
    }
}

public class LegalDocumentPlacement : AuditableEntity<Guid>, ISoftDelete
{
    public Guid DocumentId { get; set; }
    public LegalDocument? Document { get; set; }

    public string Surface { get; set; } = string.Empty;
    public string Screen { get; set; } = string.Empty;
    public bool IsVisible { get; set; }
    public bool IsRequiredToProceed { get; set; }
    public int SortOrder { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public void StampModified(Guid? actorId)
    {
        LegalAudit.SetModifiedBy(this, actorId);
    }
}

public class LegalAcceptance : AuditableEntity<Guid>, ISoftDelete
{
    public string ActorType { get; set; } = string.Empty;
    public Guid ActorId { get; set; }
    public Guid DocumentId { get; set; }
    public LegalDocument? Document { get; set; }
    public Guid VersionId { get; set; }
    public LegalDocumentVersion? Version { get; set; }
    public DateTimeOffset AcceptedAt { get; set; }
    public string SourceSurface { get; set; } = string.Empty;
    public string SourceScreen { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? SignedName { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}

public static class LegalAudit
{
    public static void SetModifiedBy(AuditableEntity<Guid> entity, Guid? actorId)
    {
        typeof(AuditableEntity<Guid>)
            .GetProperty(nameof(AuditableEntity<Guid>.ModifiedBy))!
            .SetValue(entity, actorId);
        entity.ModifiedOnUtc = DateTime.UtcNow;
    }
}
