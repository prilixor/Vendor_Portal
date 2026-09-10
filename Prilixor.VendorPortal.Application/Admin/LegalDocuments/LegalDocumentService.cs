using FluentValidation;
using MediatR;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Legal;
using Prilixor.VendorPortal.Domain.Vendors;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Prilixor.VendorPortal.Application.Admin.LegalDocuments;

public record ListAdminLegalDocumentsQuery : IRequest<Result<List<LegalDocumentListItemDto>>>;

public record GetAdminLegalDocumentQuery(Guid Id) : IRequest<Result<LegalDocumentDetailDto>>;

public record UpdateLegalDocumentCommand(
    Guid Id,
    Guid? ActorId,
    string Title,
    string Slug,
    string? Summary,
    string? PublicPath,
    string Audience,
    int SortOrder,
    bool IsRequiredAcceptance,
    List<LegalPlacementDto> Placements) : IRequest<Result<LegalDocumentDetailDto>>;

public record SaveLegalDocumentDraftCommand(
    Guid Id,
    Guid? ActorId,
    string? ContentHtml,
    string? ContentMarkdown,
    string? ChangeSummary) : IRequest<Result<LegalDocumentDetailDto>>;

public record PublishLegalDocumentCommand(
    Guid Id,
    Guid? ActorId,
    Guid? VersionId,
    DateTimeOffset? EffectiveFrom,
    string? ChangeSummary,
    bool IsMaterialChange) : IRequest<Result<LegalDocumentDetailDto>>;

public record ListLegalDocumentVersionsQuery(Guid Id) : IRequest<Result<List<LegalDocumentVersionSummaryDto>>>;

public record GetLegalDocumentVersionQuery(Guid Id, Guid VersionId) : IRequest<Result<LegalDocumentVersionDetailDto>>;

public record ListPublicLegalDocumentsQuery(string? Surface, string? Screen)
    : IRequest<Result<List<PublicLegalDocumentListItemDto>>>;

public record GetPublicLegalDocumentQuery(string Slug) : IRequest<Result<PublicLegalDocumentDetailDto>>;

public sealed class UpdateLegalDocumentCommandValidator : AbstractValidator<UpdateLegalDocumentCommand>
{
    public UpdateLegalDocumentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(120).Matches("^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase letters, numbers, and hyphens.");
        RuleFor(x => x.Audience).NotEmpty().Must(a =>
            a is LegalCatalog.Audiences.Customer
                or LegalCatalog.Audiences.Vendor
                or LegalCatalog.Audiences.Both
                or LegalCatalog.Audiences.Platform);
        RuleForEach(x => x.Placements).ChildRules(p =>
        {
            p.RuleFor(x => x.Surface).Must(s => LegalCatalog.Surfaces.All.Contains(s));
            p.RuleFor(x => x.Screen).Must(s => LegalCatalog.Screens.All.Contains(s));
        });
    }
}

public sealed class SaveLegalDocumentDraftCommandValidator : AbstractValidator<SaveLegalDocumentDraftCommand>
{
    public SaveLegalDocumentDraftCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.ContentHtml) || !string.IsNullOrWhiteSpace(x.ContentMarkdown))
            .WithMessage("Draft content is required.");
    }
}

public sealed class PublishLegalDocumentCommandValidator : AbstractValidator<PublishLegalDocumentCommand>
{
    public PublishLegalDocumentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

public sealed class LegalDocumentHandler(
    ILegalDocumentRepository repository,
    IHtmlSanitizer htmlSanitizer,
    IVendorOnboardingRepository vendors)
    : IRequestHandler<ListAdminLegalDocumentsQuery, Result<List<LegalDocumentListItemDto>>>,
      IRequestHandler<GetAdminLegalDocumentQuery, Result<LegalDocumentDetailDto>>,
      IRequestHandler<UpdateLegalDocumentCommand, Result<LegalDocumentDetailDto>>,
      IRequestHandler<SaveLegalDocumentDraftCommand, Result<LegalDocumentDetailDto>>,
      IRequestHandler<PublishLegalDocumentCommand, Result<LegalDocumentDetailDto>>,
      IRequestHandler<ListLegalDocumentVersionsQuery, Result<List<LegalDocumentVersionSummaryDto>>>,
      IRequestHandler<GetLegalDocumentVersionQuery, Result<LegalDocumentVersionDetailDto>>,
      IRequestHandler<ListPublicLegalDocumentsQuery, Result<List<PublicLegalDocumentListItemDto>>>,
      IRequestHandler<GetPublicLegalDocumentQuery, Result<PublicLegalDocumentDetailDto>>
{
    private static readonly Regex PublicPathRegex = new("^/[-a-z0-9/]+$", RegexOptions.Compiled);

    public async Task<Result<List<LegalDocumentListItemDto>>> Handle(ListAdminLegalDocumentsQuery request, CancellationToken ct)
    {
        var docs = await repository.ListDocumentsAsync(ct);
        return Result.Success(docs.Select(MapListItem).ToList());
    }

    public async Task<Result<LegalDocumentDetailDto>> Handle(GetAdminLegalDocumentQuery request, CancellationToken ct)
    {
        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: true, ct);
        if (doc is null)
            return NotFound<LegalDocumentDetailDto>();
        return Result.Success(MapDetail(doc));
    }

    public async Task<Result<LegalDocumentDetailDto>> Handle(UpdateLegalDocumentCommand request, CancellationToken ct)
    {
        if (request.ActorId is null || request.ActorId == Guid.Empty)
            return Unauthorized<LegalDocumentDetailDto>();

        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: true, ct);
        if (doc is null)
            return NotFound<LegalDocumentDetailDto>();

        var slug = request.Slug.Trim().ToLowerInvariant();
        var existingSlug = await repository.GetDocumentBySlugAsync(slug, request.Id, ct);
        if (existingSlug is not null)
            return Result.Failure<LegalDocumentDetailDto>(new Error("legal.slug_taken", "Another document already uses this slug.", ErrorCategory.Validation));

        var publicPath = NormalizePublicPath(request.PublicPath);

        doc.Title = request.Title.Trim();
        doc.Slug = slug;
        doc.Summary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary.Trim();
        doc.PublicPath = publicPath;
        doc.Audience = request.Audience.Trim().ToLowerInvariant();
        doc.SortOrder = request.SortOrder;
        doc.IsRequiredAcceptance = request.IsRequiredAcceptance;
        doc.StampModified(request.ActorId);

        var placements = (request.Placements ?? [])
            .GroupBy(p => (p.Surface, p.Screen))
            .Select(g => g.Last())
            .Select(p => new LegalDocumentPlacement
            {
                Surface = p.Surface,
                Screen = p.Screen,
                IsVisible = p.IsVisible,
                IsRequiredToProceed = p.IsRequiredToProceed,
                SortOrder = p.SortOrder,
            })
            .ToList();

        await repository.ReplacePlacementsAsync(doc, placements, request.ActorId, ct);
        await repository.UpdateDocumentAsync(doc, ct);
        await repository.SaveChangesAsync(ct);

        var fresh = await repository.GetDocumentByIdAsync(doc.Id, includeVersions: true, ct);
        return Result.Success(MapDetail(fresh!));
    }

    public async Task<Result<LegalDocumentDetailDto>> Handle(SaveLegalDocumentDraftCommand request, CancellationToken ct)
    {
        if (request.ActorId is null || request.ActorId == Guid.Empty)
            return Unauthorized<LegalDocumentDetailDto>();

        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: true, ct);
        if (doc is null)
            return NotFound<LegalDocumentDetailDto>();

        var html = htmlSanitizer.Sanitize(request.ContentHtml);
        if (string.IsNullOrWhiteSpace(html) && !string.IsNullOrWhiteSpace(request.ContentMarkdown))
            html = htmlSanitizer.MarkdownToSanitizedHtml(request.ContentMarkdown);

        if (string.IsNullOrWhiteSpace(html))
            return Result.Failure<LegalDocumentDetailDto>(new Error("legal.content_required", "Draft HTML is empty after sanitizing.", ErrorCategory.Validation));

        var draft = doc.Versions
            .Where(v => v.Status == LegalCatalog.VersionStatuses.Draft)
            .OrderByDescending(v => v.VersionNumber)
            .FirstOrDefault();

        if (draft is null)
        {
            var nextNumber = doc.Versions.Count == 0 ? 1 : doc.Versions.Max(v => v.VersionNumber) + 1;
            var published = CurrentPublished(doc);
            draft = new LegalDocumentVersion
            {
                Id = Guid.NewGuid(),
                DocumentId = doc.Id,
                VersionNumber = nextNumber,
                ContentHtml = html,
                ContentMarkdown = string.IsNullOrWhiteSpace(request.ContentMarkdown) ? published?.ContentMarkdown : request.ContentMarkdown,
                Status = LegalCatalog.VersionStatuses.Draft,
                ChangeSummary = request.ChangeSummary,
                EffectiveFrom = published?.EffectiveFrom ?? DateTimeOffset.UtcNow,
                CreatedBy = request.ActorId,
                CreatedOnUtc = DateTime.UtcNow,
                ModifiedOnUtc = DateTime.UtcNow,
            };
            draft.StampModified(request.ActorId);
            await repository.AddVersionAsync(draft, ct);
        }
        else
        {
            draft.ContentHtml = html;
            if (!string.IsNullOrWhiteSpace(request.ContentMarkdown))
                draft.ContentMarkdown = request.ContentMarkdown;
            if (request.ChangeSummary is not null)
                draft.ChangeSummary = request.ChangeSummary;
            draft.StampModified(request.ActorId);
            await repository.UpdateVersionAsync(draft, ct);
        }

        doc.StampModified(request.ActorId);
        await repository.UpdateDocumentAsync(doc, ct);
        await repository.SaveChangesAsync(ct);

        var fresh = await repository.GetDocumentByIdAsync(doc.Id, includeVersions: true, ct);
        return Result.Success(MapDetail(fresh!));
    }

    public async Task<Result<LegalDocumentDetailDto>> Handle(PublishLegalDocumentCommand request, CancellationToken ct)
    {
        if (request.ActorId is null || request.ActorId == Guid.Empty)
            return Unauthorized<LegalDocumentDetailDto>();

        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: true, ct);
        if (doc is null)
            return NotFound<LegalDocumentDetailDto>();

        LegalDocumentVersion? toPublish = null;
        if (request.VersionId.HasValue)
        {
            toPublish = doc.Versions.FirstOrDefault(v => v.Id == request.VersionId.Value);
            if (toPublish is null)
                return Result.Failure<LegalDocumentDetailDto>(new Error("legal.version_not_found", "Version not found.", ErrorCategory.NotFound));
        }
        else
        {
            toPublish = doc.Versions
                .Where(v => v.Status == LegalCatalog.VersionStatuses.Draft)
                .OrderByDescending(v => v.VersionNumber)
                .FirstOrDefault();
        }

        if (toPublish is null)
            return Result.Failure<LegalDocumentDetailDto>(new Error("legal.draft_required", "Save a draft before publishing.", ErrorCategory.Validation));

        if (string.IsNullOrWhiteSpace(htmlSanitizer.Sanitize(toPublish.ContentHtml)))
            return Result.Failure<LegalDocumentDetailDto>(new Error("legal.content_required", "Cannot publish empty content.", ErrorCategory.Validation));

        var previous = CurrentPublished(doc);
        var oldSnapshot = previous is null
            ? null
            : new { previous.Id, previous.VersionNumber, previous.Status, previous.EffectiveFrom };

        if (previous is not null && previous.Id != toPublish.Id)
        {
            previous.Status = LegalCatalog.VersionStatuses.Archived;
            previous.StampModified(request.ActorId);
            await repository.UpdateVersionAsync(previous, ct);
            await repository.SaveChangesAsync(ct);
        }

        toPublish.ContentHtml = htmlSanitizer.Sanitize(toPublish.ContentHtml);
        toPublish.Status = LegalCatalog.VersionStatuses.Published;
        toPublish.PublishedAt = DateTimeOffset.UtcNow;
        toPublish.PublishedBy = request.ActorId;
        toPublish.EffectiveFrom = request.EffectiveFrom ?? toPublish.EffectiveFrom;
        if (toPublish.EffectiveFrom == default)
            toPublish.EffectiveFrom = DateTimeOffset.UtcNow;
        toPublish.IsMaterialChange = request.IsMaterialChange;
        if (!string.IsNullOrWhiteSpace(request.ChangeSummary))
            toPublish.ChangeSummary = request.ChangeSummary;
        toPublish.StampModified(request.ActorId);
        await repository.UpdateVersionAsync(toPublish, ct);

        doc.StampModified(request.ActorId);
        await repository.UpdateDocumentAsync(doc, ct);

        await vendors.AddAdminAuditLogAsync(new AdminAuditLog
        {
            AdminId = request.ActorId.Value,
            ActionType = "LEGAL_DOCUMENT_PUBLISHED",
            EntityType = "LegalDocument",
            EntityId = doc.Id,
            OldValue = oldSnapshot is null ? null : JsonSerializer.Serialize(oldSnapshot),
            NewValue = JsonSerializer.Serialize(new
            {
                toPublish.Id,
                toPublish.VersionNumber,
                toPublish.Status,
                toPublish.EffectiveFrom,
                toPublish.IsMaterialChange,
                doc.Slug,
                doc.Title,
            }),
            Notes = toPublish.ChangeSummary,
            CreatedOnUtc = DateTime.UtcNow,
            CreatedBy = request.ActorId,
        }, ct);

        await vendors.SaveChangesAsync(ct);

        var fresh = await repository.GetDocumentByIdAsync(doc.Id, includeVersions: true, ct);
        return Result.Success(MapDetail(fresh!));
    }

    public async Task<Result<List<LegalDocumentVersionSummaryDto>>> Handle(ListLegalDocumentVersionsQuery request, CancellationToken ct)
    {
        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: false, ct);
        if (doc is null)
            return NotFound<List<LegalDocumentVersionSummaryDto>>();

        var versions = await repository.ListVersionsAsync(request.Id, ct);
        return Result.Success(versions.Select(MapVersionSummary).ToList());
    }

    public async Task<Result<LegalDocumentVersionDetailDto>> Handle(GetLegalDocumentVersionQuery request, CancellationToken ct)
    {
        var doc = await repository.GetDocumentByIdAsync(request.Id, includeVersions: false, ct);
        if (doc is null)
            return NotFound<LegalDocumentVersionDetailDto>();

        var version = await repository.GetVersionByIdAsync(request.Id, request.VersionId, ct);
        if (version is null)
            return Result.Failure<LegalDocumentVersionDetailDto>(new Error("legal.version_not_found", "Version not found.", ErrorCategory.NotFound));

        return Result.Success(new LegalDocumentVersionDetailDto
        {
            Id = version.Id,
            DocumentId = doc.Id,
            Title = doc.Title,
            VersionNumber = version.VersionNumber,
            Status = version.Status,
            ChangeSummary = version.ChangeSummary,
            IsMaterialChange = version.IsMaterialChange,
            EffectiveFrom = version.EffectiveFrom,
            PublishedAt = version.PublishedAt,
            PublishedBy = version.PublishedBy,
            CreatedAt = new DateTimeOffset(DateTime.SpecifyKind(version.CreatedOnUtc, DateTimeKind.Utc)),
            CreatedBy = version.CreatedBy,
            ContentHtml = version.ContentHtml,
            ContentMarkdown = version.ContentMarkdown,
        });
    }

    public async Task<Result<List<PublicLegalDocumentListItemDto>>> Handle(ListPublicLegalDocumentsQuery request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var docs = await repository.ListDocumentsAsync(ct);
        var surface = request.Surface?.Trim().ToLowerInvariant();
        var screen = request.Screen?.Trim().ToLowerInvariant();

        if (!string.IsNullOrEmpty(surface) && !LegalCatalog.Surfaces.All.Contains(surface))
            return Result.Failure<List<PublicLegalDocumentListItemDto>>(new Error("legal.invalid_surface", "Unknown surface.", ErrorCategory.Validation));
        if (!string.IsNullOrEmpty(screen) && !LegalCatalog.Screens.All.Contains(screen))
            return Result.Failure<List<PublicLegalDocumentListItemDto>>(new Error("legal.invalid_screen", "Unknown screen.", ErrorCategory.Validation));

        var result = new List<PublicLegalDocumentListItemDto>();
        foreach (var doc in docs)
        {
            var published = EffectivePublished(doc, now);
            if (published is null)
                continue;

            LegalDocumentPlacement? placement = null;
            if (!string.IsNullOrEmpty(surface))
            {
                var visibleOnSurface = doc.Placements.Where(p => p.Surface == surface && p.IsVisible);
                if (!string.IsNullOrEmpty(screen))
                    visibleOnSurface = visibleOnSurface.Where(p => p.Screen == screen);
                placement = visibleOnSurface.FirstOrDefault();
                if (placement is null)
                    continue;
            }

            result.Add(MapPublicListItem(doc, published, placement));
        }

        return Result.Success(result);
    }

    public async Task<Result<PublicLegalDocumentDetailDto>> Handle(GetPublicLegalDocumentQuery request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var doc = await repository.GetDocumentBySlugOrPathAsync(request.Slug, ct);
        if (doc is null)
            return NotFound<PublicLegalDocumentDetailDto>();

        var published = EffectivePublished(doc, now);
        if (published is null)
            return NotFound<PublicLegalDocumentDetailDto>();

        var list = MapPublicListItem(doc, published, null);
        return Result.Success(new PublicLegalDocumentDetailDto
        {
            Slug = list.Slug,
            DocumentType = list.DocumentType,
            Title = list.Title,
            Summary = list.Summary,
            PublicPath = list.PublicPath,
            SortOrder = list.SortOrder,
            VersionNumber = list.VersionNumber,
            EffectiveFrom = list.EffectiveFrom,
            LastUpdated = list.LastUpdated,
            IsRequiredToProceed = list.IsRequiredToProceed,
            ContentHtml = published.ContentHtml,
        });
    }

    private static LegalDocumentVersion? CurrentPublished(LegalDocument doc) =>
        doc.Versions.FirstOrDefault(v => v.Status == LegalCatalog.VersionStatuses.Published);

    private static LegalDocumentVersion? EffectivePublished(LegalDocument doc, DateTimeOffset now) =>
        doc.Versions.FirstOrDefault(v =>
            v.Status == LegalCatalog.VersionStatuses.Published && v.EffectiveFrom <= now);

    private static LegalDocumentVersion? CurrentDraft(LegalDocument doc) =>
        doc.Versions
            .Where(v => v.Status == LegalCatalog.VersionStatuses.Draft)
            .OrderByDescending(v => v.VersionNumber)
            .FirstOrDefault();

    private static LegalDocumentListItemDto MapListItem(LegalDocument doc)
    {
        var published = CurrentPublished(doc);
        var draft = CurrentDraft(doc);
        var now = DateTimeOffset.UtcNow;
        var status = "unpublished";
        if (published is not null)
            status = published.EffectiveFrom > now ? "scheduled" : "published";
        else if (draft is not null)
            status = "draft";

        var lastUpdated = doc.ModifiedOnUtc.HasValue
            ? new DateTimeOffset(DateTime.SpecifyKind(doc.ModifiedOnUtc.Value, DateTimeKind.Utc))
            : new DateTimeOffset(DateTime.SpecifyKind(doc.CreatedOnUtc, DateTimeKind.Utc));

        return new LegalDocumentListItemDto
        {
            Id = doc.Id,
            Slug = doc.Slug,
            DocumentType = doc.DocumentType,
            Title = doc.Title,
            Audience = doc.Audience,
            Summary = doc.Summary,
            PublicPath = doc.PublicPath,
            SortOrder = doc.SortOrder,
            IsRequiredAcceptance = doc.IsRequiredAcceptance,
            Status = status,
            PublishedVersionNumber = published?.VersionNumber,
            DraftVersionNumber = draft?.VersionNumber,
            EffectiveFrom = published?.EffectiveFrom,
            LastUpdated = lastUpdated,
            UpdatedBy = doc.ModifiedBy ?? doc.CreatedBy,
        };
    }

    private static LegalDocumentDetailDto MapDetail(LegalDocument doc)
    {
        var list = MapListItem(doc);
        var published = CurrentPublished(doc);
        var draft = CurrentDraft(doc);
        return new LegalDocumentDetailDto
        {
            Id = list.Id,
            Slug = list.Slug,
            DocumentType = list.DocumentType,
            Title = list.Title,
            Audience = list.Audience,
            Summary = list.Summary,
            PublicPath = list.PublicPath,
            SortOrder = list.SortOrder,
            IsRequiredAcceptance = list.IsRequiredAcceptance,
            Status = list.Status,
            PublishedVersionNumber = list.PublishedVersionNumber,
            DraftVersionNumber = list.DraftVersionNumber,
            EffectiveFrom = list.EffectiveFrom,
            LastUpdated = list.LastUpdated,
            UpdatedBy = list.UpdatedBy,
            PublishedVersionId = published?.Id,
            DraftVersionId = draft?.Id,
            ContentHtml = published?.ContentHtml,
            ContentMarkdown = published?.ContentMarkdown,
            DraftContentHtml = draft?.ContentHtml,
            DraftContentMarkdown = draft?.ContentMarkdown,
            ChangeSummary = draft?.ChangeSummary ?? published?.ChangeSummary,
            IsMaterialChange = draft?.IsMaterialChange ?? published?.IsMaterialChange ?? false,
            Placements = doc.Placements
                .OrderBy(p => p.Surface)
                .ThenBy(p => p.Screen)
                .Select(p => new LegalPlacementDto
                {
                    Surface = p.Surface,
                    Screen = p.Screen,
                    IsVisible = p.IsVisible,
                    IsRequiredToProceed = p.IsRequiredToProceed,
                    SortOrder = p.SortOrder,
                })
                .ToList(),
        };
    }

    private static LegalDocumentVersionSummaryDto MapVersionSummary(LegalDocumentVersion version) =>
        new()
        {
            Id = version.Id,
            VersionNumber = version.VersionNumber,
            Status = version.Status,
            ChangeSummary = version.ChangeSummary,
            IsMaterialChange = version.IsMaterialChange,
            EffectiveFrom = version.EffectiveFrom,
            PublishedAt = version.PublishedAt,
            PublishedBy = version.PublishedBy,
            CreatedAt = new DateTimeOffset(DateTime.SpecifyKind(version.CreatedOnUtc, DateTimeKind.Utc)),
            CreatedBy = version.CreatedBy,
        };

    private static PublicLegalDocumentListItemDto MapPublicListItem(
        LegalDocument doc,
        LegalDocumentVersion published,
        LegalDocumentPlacement? placement)
    {
        var lastUpdated = published.PublishedAt
            ?? new DateTimeOffset(DateTime.SpecifyKind(published.ModifiedOnUtc ?? published.CreatedOnUtc, DateTimeKind.Utc));

        return new PublicLegalDocumentListItemDto
        {
            Slug = doc.Slug,
            DocumentType = doc.DocumentType,
            Title = doc.Title,
            Summary = doc.Summary,
            PublicPath = doc.PublicPath,
            SortOrder = doc.SortOrder,
            VersionNumber = published.VersionNumber,
            EffectiveFrom = published.EffectiveFrom,
            LastUpdated = lastUpdated,
            IsRequiredToProceed = placement?.IsRequiredToProceed ?? false,
        };
    }

    private static string? NormalizePublicPath(string? publicPath)
    {
        if (string.IsNullOrWhiteSpace(publicPath))
            return null;
        var trimmed = publicPath.Trim();
        if (!trimmed.StartsWith('/'))
            trimmed = "/" + trimmed.TrimStart('/');
        trimmed = trimmed.TrimEnd('/').ToLowerInvariant();
        if (trimmed == "/")
            return null;
        if (!PublicPathRegex.IsMatch(trimmed))
            return trimmed;
        return trimmed;
    }

    private static Result<T> NotFound<T>() =>
        Result.Failure<T>(new Error("legal.not_found", "Legal document not found.", ErrorCategory.NotFound));

    private static Result<T> Unauthorized<T>() =>
        Result.Failure<T>(new Error("legal.unauthorized", "Admin identity is required.", ErrorCategory.Unauthorized));
}
