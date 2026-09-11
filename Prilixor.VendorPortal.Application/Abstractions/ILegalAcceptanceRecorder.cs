using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface ILegalAcceptanceRecorder
{
    Task<Result<IReadOnlyList<LegalAcceptance>>> BuildRegisterAcceptancesAsync(
        string actorType,
        Guid actorId,
        string? sourceSurface,
        bool acceptedLegal,
        IReadOnlyList<string>? acceptedSlugs,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default);

    Task<Result<IReadOnlyList<LegalAcceptance>>> BuildScreenAcceptancesAsync(
        string actorType,
        Guid actorId,
        string? sourceSurface,
        string screen,
        bool acceptedLegal,
        IReadOnlyList<string>? acceptedSlugs,
        string? ipAddress,
        string? userAgent,
        string? signedName = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<PendingLegalReconsentDto>> ListPendingReconsentAsync(
        string actorType,
        Guid actorId,
        CancellationToken ct = default);

    Task<bool> HasAcceptedCurrentDocumentAsync(
        string actorType,
        Guid actorId,
        string documentType,
        CancellationToken ct = default,
        bool requireSignedName = false);

    Task SaveAcceptancesAsync(IReadOnlyList<LegalAcceptance> rows, CancellationToken ct = default);
}

public sealed record PendingLegalReconsentDto(
    string Slug,
    string Title,
    string PublicPath,
    int VersionNumber,
    DateTimeOffset EffectiveFrom);
