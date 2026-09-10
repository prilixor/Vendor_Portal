namespace Prilixor.VendorPortal.Application.Admin.LegalDocuments;

public class LegalPlacementDto
{
    public string Surface { get; set; } = string.Empty;
    public string Screen { get; set; } = string.Empty;
    public bool IsVisible { get; set; }
    public bool IsRequiredToProceed { get; set; }
    public int SortOrder { get; set; }
}

public class LegalDocumentListItemDto
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? PublicPath { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequiredAcceptance { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? PublishedVersionNumber { get; set; }
    public int? DraftVersionNumber { get; set; }
    public DateTimeOffset? EffectiveFrom { get; set; }
    public DateTimeOffset? LastUpdated { get; set; }
    public Guid? UpdatedBy { get; set; }
}

public class LegalDocumentDetailDto : LegalDocumentListItemDto
{
    public Guid? PublishedVersionId { get; set; }
    public Guid? DraftVersionId { get; set; }
    public string? ContentHtml { get; set; }
    public string? ContentMarkdown { get; set; }
    public string? DraftContentHtml { get; set; }
    public string? DraftContentMarkdown { get; set; }
    public string? ChangeSummary { get; set; }
    public bool IsMaterialChange { get; set; }
    public List<LegalPlacementDto> Placements { get; set; } = [];
}

public class LegalDocumentVersionSummaryDto
{
    public Guid Id { get; set; }
    public int VersionNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ChangeSummary { get; set; }
    public bool IsMaterialChange { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public Guid? PublishedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
}

public class LegalDocumentVersionDetailDto : LegalDocumentVersionSummaryDto
{
    public Guid DocumentId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ContentHtml { get; set; } = string.Empty;
    public string? ContentMarkdown { get; set; }
}

public class PublicLegalDocumentListItemDto
{
    public string Slug { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? PublicPath { get; set; }
    public int SortOrder { get; set; }
    public int VersionNumber { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; }
    public DateTimeOffset LastUpdated { get; set; }
    public bool IsRequiredToProceed { get; set; }
}

public class PublicLegalDocumentDetailDto : PublicLegalDocumentListItemDto
{
    public string ContentHtml { get; set; } = string.Empty;
}
