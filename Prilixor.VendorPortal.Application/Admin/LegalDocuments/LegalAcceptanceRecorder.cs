using Prilixor.Shared.Abstractions.DI;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Application.Admin.LegalDocuments;

public sealed class LegalAcceptanceRecorder(ILegalDocumentRepository repository)
    : ILegalAcceptanceRecorder, IScopedService
{
    public Task<Result<IReadOnlyList<LegalAcceptance>>> BuildRegisterAcceptancesAsync(
        string actorType,
        Guid actorId,
        string? sourceSurface,
        bool acceptedLegal,
        IReadOnlyList<string>? acceptedSlugs,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default) =>
        BuildScreenAcceptancesAsync(
            actorType, actorId, sourceSurface, LegalCatalog.Screens.Register,
            acceptedLegal, acceptedSlugs, ipAddress, userAgent, null, ct);

    public async Task<Result<IReadOnlyList<LegalAcceptance>>> BuildScreenAcceptancesAsync(
        string actorType,
        Guid actorId,
        string? sourceSurface,
        string screen,
        bool acceptedLegal,
        IReadOnlyList<string>? acceptedSlugs,
        string? ipAddress,
        string? userAgent,
        string? signedName = null,
        CancellationToken ct = default)
    {
        var surface = NormalizeSurface(sourceSurface, actorType);
        var normalizedScreen = string.IsNullOrWhiteSpace(screen)
            ? LegalCatalog.Screens.Register
            : screen.Trim().ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var docs = await repository.ListDocumentsAsync(ct);
        var required = new List<(LegalDocument Doc, LegalDocumentVersion Version)>();

        foreach (var doc in docs)
        {
            var published = doc.Versions.FirstOrDefault(v =>
                v.Status == LegalCatalog.VersionStatuses.Published && v.EffectiveFrom <= now);
            if (published is null)
                continue;

            var placement = doc.Placements.FirstOrDefault(p =>
                p.Surface == surface
                && p.Screen == normalizedScreen
                && p.IsVisible
                && p.IsRequiredToProceed);
            if (placement is null)
                continue;

            required.Add((doc, published));
        }

        if (required.Count == 0)
            return Result.Success<IReadOnlyList<LegalAcceptance>>([]);

        if (!acceptedLegal)
        {
            return Result.Failure<IReadOnlyList<LegalAcceptance>>(new Error(
                "legal.acceptance_required",
                RequiredMessage(normalizedScreen),
                ErrorCategory.Validation));
        }

        if (normalizedScreen == LegalCatalog.Screens.Onboarding
            && required.Count > 0
            && string.IsNullOrWhiteSpace(signedName))
        {
            return Result.Failure<IReadOnlyList<LegalAcceptance>>(new Error(
                "legal.signature_required",
                "Type your full name to electronically sign the Vendor / Seller Policy.",
                ErrorCategory.Validation));
        }

        if (acceptedSlugs is { Count: > 0 })
        {
            var provided = acceptedSlugs
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim().ToLowerInvariant())
                .ToHashSet();
            var missing = required.Where(r => !provided.Contains(r.Doc.Slug)).Select(r => r.Doc.Title).ToList();
            if (missing.Count > 0)
            {
                return Result.Failure<IReadOnlyList<LegalAcceptance>>(new Error(
                    "legal.acceptance_incomplete",
                    "Please agree to: " + string.Join(", ", missing) + ".",
                    ErrorCategory.Validation));
            }
        }

        var signature = Truncate(signedName, 200);
        var rows = required.Select(item => new LegalAcceptance
        {
            Id = Guid.NewGuid(),
            ActorType = actorType,
            ActorId = actorId,
            DocumentId = item.Doc.Id,
            VersionId = item.Version.Id,
            AcceptedAt = now,
            SourceSurface = surface,
            SourceScreen = normalizedScreen,
            IpAddress = Truncate(ipAddress, 64),
            UserAgent = userAgent,
            SignedName = signature,
            CreatedOnUtc = DateTime.UtcNow,
            ModifiedOnUtc = DateTime.UtcNow,
            CreatedBy = actorId == Guid.Empty ? null : actorId,
        }).ToList();

        return Result.Success<IReadOnlyList<LegalAcceptance>>(rows);
    }

    public async Task<IReadOnlyList<PendingLegalReconsentDto>> ListPendingReconsentAsync(
        string actorType,
        Guid actorId,
        CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var docs = await repository.ListDocumentsAsync(ct);
        var acceptances = await repository.ListAcceptancesForActorAsync(actorType, actorId, ct);
        var pending = new List<PendingLegalReconsentDto>();

        foreach (var type in LegalCatalog.MaterialReconsentTypes)
        {
            if (type == LegalCatalog.DocumentTypes.VendorSellerPolicy
                && actorType != LegalCatalog.ActorTypes.Vendor)
                continue;

            var doc = docs.FirstOrDefault(d => d.DocumentType == type);
            if (doc is null)
                continue;

            var published = doc.Versions.FirstOrDefault(v =>
                v.Status == LegalCatalog.VersionStatuses.Published && v.EffectiveFrom <= now);
            if (published is null)
                continue;

            var last = acceptances
                .Where(a => a.DocumentId == doc.Id)
                .OrderByDescending(a => a.AcceptedAt)
                .FirstOrDefault();

            // Terms, Privacy, and Vendor / Seller: any new published version
            // must be re-accepted. The admin "material" switch is easy to miss
            // on a draft, which previously skipped the vendor/customer gate.
            if (last is not null && last.VersionId == published.Id)
                continue;

            pending.Add(new PendingLegalReconsentDto(
                doc.Slug,
                doc.Title,
                doc.PublicPath ?? "/" + doc.Slug,
                published.VersionNumber,
                published.EffectiveFrom));
        }

        return pending;
    }

    public async Task<bool> HasAcceptedCurrentDocumentAsync(
        string actorType,
        Guid actorId,
        string documentType,
        CancellationToken ct = default,
        bool requireSignedName = false)
    {
        var now = DateTimeOffset.UtcNow;
        var docs = await repository.ListDocumentsAsync(ct);
        var doc = docs.FirstOrDefault(d => d.DocumentType == documentType);
        if (doc is null)
            return true;

        var published = doc.Versions.FirstOrDefault(v =>
            v.Status == LegalCatalog.VersionStatuses.Published && v.EffectiveFrom <= now);
        if (published is null)
            return true;

        var acceptances = await repository.ListAcceptancesForActorAsync(actorType, actorId, ct);
        return acceptances.Any(a =>
            a.DocumentId == doc.Id
            && a.VersionId == published.Id
            && (!requireSignedName || !string.IsNullOrWhiteSpace(a.SignedName)));
    }

    public Task SaveAcceptancesAsync(IReadOnlyList<LegalAcceptance> rows, CancellationToken ct = default) =>
        rows.Count == 0 ? Task.CompletedTask : repository.AddAcceptancesAsync(rows, ct);

    private static string RequiredMessage(string screen) => screen switch
    {
        LegalCatalog.Screens.Checkout => "Please agree to the rental, cancellation, and shipping policies before placing this order.",
        LegalCatalog.Screens.Prescription => "Please consent to the Privacy Policy before sharing prescription or health information.",
        LegalCatalog.Screens.Onboarding => "Please electronically sign the Vendor / Seller Policy to continue.",
        _ => "Please agree to the required terms and policies to continue.",
    };

    private static string NormalizeSurface(string? sourceSurface, string actorType)
    {
        var surface = sourceSurface?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(surface) && LegalCatalog.Surfaces.All.Contains(surface))
            return surface;

        return actorType == LegalCatalog.ActorTypes.Vendor
            ? LegalCatalog.Surfaces.VendorWeb
            : LegalCatalog.Surfaces.CustomerWeb;
    }

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
