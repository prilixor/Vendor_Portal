using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RegisterPushSubscriptionCommand(
    string VendorId,
    string Endpoint,
    string P256DH,
    string Auth) : ICommand<VendorPushSubscriptionDto>;

public sealed class RegisterPushSubscriptionCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<RegisterPushSubscriptionCommand, VendorPushSubscriptionDto>
{
    public async Task<Result<VendorPushSubscriptionDto>> Handle(
        RegisterPushSubscriptionCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorPushSubscriptionDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
            return Result.Failure<VendorPushSubscriptionDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));

        var existing = await repository.GetVendorPushSubscriptionAsync(vendorId, cancellationToken);
        if (existing != null)
        {
            existing.Endpoint = request.Endpoint;
            existing.P256DH = request.P256DH;
            existing.Auth = request.Auth;
            await repository.UpsertVendorPushSubscriptionAsync(existing, cancellationToken);
            await repository.SaveChangesAsync(cancellationToken);

            return Result.Success(new VendorPushSubscriptionDto(
                existing.Id.ToString(),
                existing.VendorId.ToString(),
                existing.Endpoint,
                existing.P256DH,
                existing.Auth));
        }

        var subscription = new VendorPushSubscription
        {
            VendorId = vendorId,
            Endpoint = request.Endpoint,
            P256DH = request.P256DH,
            Auth = request.Auth,
            CreatedOnUtc = DateTime.UtcNow
        };

        await repository.UpsertVendorPushSubscriptionAsync(subscription, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorPushSubscriptionDto(
            subscription.Id.ToString(),
            subscription.VendorId.ToString(),
            subscription.Endpoint,
            subscription.P256DH,
            subscription.Auth));
    }
}

public sealed record UnregisterPushSubscriptionCommand(string VendorId) : ICommand<bool>;

public sealed class UnregisterPushSubscriptionCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UnregisterPushSubscriptionCommand, bool>
{
    public async Task<Result<bool>> Handle(
        UnregisterPushSubscriptionCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<bool>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        await repository.DeleteVendorPushSubscriptionAsync(vendorId, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}

public sealed record GetPushSubscriptionQuery(string VendorId) : IQuery<VendorPushSubscriptionDto?>;

public sealed class GetPushSubscriptionQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetPushSubscriptionQuery, VendorPushSubscriptionDto?>
{
    public async Task<Result<VendorPushSubscriptionDto?>> Handle(
        GetPushSubscriptionQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorPushSubscriptionDto?>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var subscription = await repository.GetVendorPushSubscriptionAsync(vendorId, cancellationToken);

        if (subscription == null)
            return Result.Success<VendorPushSubscriptionDto?>(null);

        return Result.Success<VendorPushSubscriptionDto?>(new VendorPushSubscriptionDto(
            subscription.Id.ToString(),
            subscription.VendorId.ToString(),
            subscription.Endpoint,
            subscription.P256DH,
            subscription.Auth));
    }
}
