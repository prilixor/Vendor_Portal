using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerFavoriteDto(
    Guid Id,
    Guid CustomerId,
    Guid VendorProductListingId,
    DateTimeOffset AddedAtUtc);

// Query
public sealed record GetCustomerFavoritesQuery(Guid CustomerId) : IQuery<List<CustomerFavoriteDto>>;

internal sealed class GetCustomerFavoritesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerFavoritesQuery, List<CustomerFavoriteDto>>
{
    public async Task<Result<List<CustomerFavoriteDto>>> Handle(
        GetCustomerFavoritesQuery request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<List<CustomerFavoriteDto>>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var favorites = await customers.GetCustomerFavoritesAsync(request.CustomerId, cancellationToken);
        var dtos = favorites.ConvertAll(f => new CustomerFavoriteDto(f.Id, f.CustomerId, f.VendorProductListingId, f.AddedAtUtc));
        return Result.Success(dtos);
    }
}

// Add Command
public sealed record AddCustomerFavoriteCommand(Guid CustomerId, Guid VendorProductListingId) : ICommand<CustomerFavoriteDto>;

internal sealed class AddCustomerFavoriteCommandHandler(ICustomerRepository customers)
    : ICommandHandler<AddCustomerFavoriteCommand, CustomerFavoriteDto>
{
    public async Task<Result<CustomerFavoriteDto>> Handle(
        AddCustomerFavoriteCommand request, 
        CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<CustomerFavoriteDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        // Check if listing exists/is active
        var listing = await customers.GetListingForCustomerAsync(request.VendorProductListingId, cancellationToken);
        if (listing is null)
            return Result.Failure<CustomerFavoriteDto>(new Error("listings.not_found", "Listing not found or unavailable.", ErrorCategory.NotFound));

        var existing = await customers.GetCustomerFavoriteAsync(request.CustomerId, request.VendorProductListingId, cancellationToken);
        if (existing is not null)
            return Result.Success(new CustomerFavoriteDto(existing.Id, existing.CustomerId, existing.VendorProductListingId, existing.AddedAtUtc));

        var favorite = new CustomerFavorite
        {
            Id = Guid.NewGuid(),
            CustomerId = request.CustomerId,
            VendorProductListingId = request.VendorProductListingId,
            AddedAtUtc = DateTimeOffset.UtcNow
        };

        await customers.AddCustomerFavoriteAsync(favorite, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success(new CustomerFavoriteDto(favorite.Id, favorite.CustomerId, favorite.VendorProductListingId, favorite.AddedAtUtc));
    }
}

// Remove Command
public sealed record RemoveCustomerFavoriteCommand(Guid CustomerId, Guid VendorProductListingId) : ICommand;

internal sealed class RemoveCustomerFavoriteCommandHandler(ICustomerRepository customers)
    : ICommandHandler<RemoveCustomerFavoriteCommand>
{
    public async Task<Result> Handle(
        RemoveCustomerFavoriteCommand request, 
        CancellationToken cancellationToken)
    {
        var existing = await customers.GetCustomerFavoriteAsync(request.CustomerId, request.VendorProductListingId, cancellationToken);
        if (existing is null)
            return Result.Success();

        await customers.RemoveCustomerFavoriteAsync(existing, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
