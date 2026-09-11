using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Legal;

namespace Prilixor.VendorPortal.Application.Admin.LegalDocuments;

public sealed record PendingLegalReconsentQuery(string ActorType, Guid ActorId)
    : IQuery<IReadOnlyList<PendingLegalReconsentDto>>;

internal sealed class PendingLegalReconsentQueryHandler(ILegalAcceptanceRecorder recorder)
    : IQueryHandler<PendingLegalReconsentQuery, IReadOnlyList<PendingLegalReconsentDto>>
{
    public async Task<Result<IReadOnlyList<PendingLegalReconsentDto>>> Handle(
        PendingLegalReconsentQuery request,
        CancellationToken cancellationToken)
    {
        var pending = await recorder.ListPendingReconsentAsync(request.ActorType, request.ActorId, cancellationToken);
        return Result.Success(pending);
    }
}

public sealed record RecordLegalAcceptanceCommand(
    string ActorType,
    Guid ActorId,
    string Screen,
    bool AcceptedLegal,
    string? SourceSurface,
    string? SignedName,
    string? IpAddress,
    string? UserAgent) : ICommand<int>;

internal sealed class RecordLegalAcceptanceCommandHandler(ILegalAcceptanceRecorder recorder)
    : ICommandHandler<RecordLegalAcceptanceCommand, int>
{
    public async Task<Result<int>> Handle(RecordLegalAcceptanceCommand request, CancellationToken cancellationToken)
    {
        var built = await recorder.BuildScreenAcceptancesAsync(
            request.ActorType,
            request.ActorId,
            request.SourceSurface,
            request.Screen,
            request.AcceptedLegal,
            null,
            request.IpAddress,
            request.UserAgent,
            request.SignedName,
            cancellationToken);
        if (!built.IsSuccess)
            return Result.Failure<int>(built.Errors);

        var rows = built.Value.Select(row =>
        {
            row.ActorId = request.ActorId;
            return row;
        }).ToList();
        await recorder.SaveAcceptancesAsync(rows, cancellationToken);
        return Result.Success(rows.Count);
    }
}

public sealed record ListAdminLegalAcceptancesQuery(
    string? ActorType,
    Guid? DocumentId,
    string? Screen) : IQuery<IReadOnlyList<LegalAcceptanceAdminDto>>;

internal sealed class ListAdminLegalAcceptancesQueryHandler(
    ILegalDocumentRepository repository,
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<ListAdminLegalAcceptancesQuery, IReadOnlyList<LegalAcceptanceAdminDto>>
{
    public async Task<Result<IReadOnlyList<LegalAcceptanceAdminDto>>> Handle(
        ListAdminLegalAcceptancesQuery request,
        CancellationToken cancellationToken)
    {
        var rows = await repository.ListAcceptancesForAdminAsync(
            request.ActorType, request.DocumentId, request.Screen, 400, cancellationToken);

        var customerIds = rows
            .Where(r => r.ActorType == LegalCatalog.ActorTypes.Customer)
            .Select(r => r.ActorId)
            .Distinct()
            .ToList();
        var vendorIds = rows
            .Where(r => r.ActorType == LegalCatalog.ActorTypes.Vendor)
            .Select(r => r.ActorId)
            .Distinct()
            .ToList();

        var customerNames = new Dictionary<Guid, (string Name, string? Email)>();
        foreach (var id in customerIds)
        {
            var customer = await customers.GetCustomerByIdAsync(id, cancellationToken);
            if (customer is null)
                continue;
            var name = string.IsNullOrWhiteSpace(customer.FullName) ? customer.Email : customer.FullName;
            customerNames[id] = (name, customer.Email);
        }

        var vendorNames = new Dictionary<Guid, (string Name, string? Email)>();
        foreach (var id in vendorIds)
        {
            var vendor = await vendors.GetVendorByIdAsync(id, cancellationToken);
            var profile = await vendors.GetVendorProfileAsync(id, cancellationToken);
            if (vendor is null && profile is null)
                continue;
            vendorNames[id] = (
                !string.IsNullOrWhiteSpace(profile?.BusinessName) ? profile!.BusinessName : (vendor?.Email ?? id.ToString("D")),
                vendor?.Email);
        }

        var list = rows.Select(row =>
        {
            var (name, email) = row.ActorType == LegalCatalog.ActorTypes.Vendor
                ? vendorNames.GetValueOrDefault(row.ActorId, (row.ActorId.ToString("D"), (string?)null))
                : customerNames.GetValueOrDefault(row.ActorId, (row.ActorId.ToString("D"), (string?)null));
            return new LegalAcceptanceAdminDto
            {
                Id = row.Id,
                ActorType = row.ActorType,
                ActorId = row.ActorId,
                ActorName = name,
                ActorEmail = email,
                DocumentId = row.DocumentId,
                DocumentTitle = row.Document?.Title ?? row.DocumentId.ToString("D"),
                DocumentSlug = row.Document?.Slug ?? "",
                VersionId = row.VersionId,
                VersionNumber = row.Version?.VersionNumber ?? 0,
                AcceptedAt = row.AcceptedAt,
                SourceSurface = row.SourceSurface,
                SourceScreen = row.SourceScreen,
                SignedName = row.SignedName,
                IpAddress = row.IpAddress,
            };
        }).ToList();

        return Result.Success<IReadOnlyList<LegalAcceptanceAdminDto>>(list);
    }
}
