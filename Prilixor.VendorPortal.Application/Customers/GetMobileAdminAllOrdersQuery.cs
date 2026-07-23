using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record GetMobileAdminAllOrdersQuery(int Page = 1, int PageSize = 20) : IQuery<PagedResult<AdminOrderDto>>;

internal sealed class GetMobileAdminAllOrdersQueryHandler(
    ICustomerRepository customers)
    : IQueryHandler<GetMobileAdminAllOrdersQuery, PagedResult<AdminOrderDto>>
{
    public async Task<Result<PagedResult<AdminOrderDto>>> Handle(GetMobileAdminAllOrdersQuery request, CancellationToken cancellationToken)
    {
        var rows = await customers.GetAllCustomerOrdersForAdminAsync(cancellationToken);
        
        var totalCount = rows.Count;
        var pagedRows = rows
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(r => new AdminOrderDto(
                r.Order.Id,
                r.Order.OrderNumber,
                r.Order.CustomerId,
                r.Order.Customer?.FullName ?? "Customer",
                r.Order.Customer?.Email ?? "customer@example.com",
                (r.Order.Status == "dispatch_failed" || r.Order.Status == "awaiting_vendor_acceptance") 
                    ? "Unassigned" 
                    : (r.Listing?.Vendor?.Profile?.BusinessName ?? r.Listing?.Vendor?.Email ?? "Vendor"),
                !string.IsNullOrEmpty(r.VariantDescription) 
                    ? $"{r.Listing?.ListingTitle ?? "Deleted Product"} ({r.VariantDescription})" 
                    : (r.Listing?.ListingTitle ?? "Deleted Product"),
                r.Order.Status,
                r.Order.OrderType,
                r.Order.Quantity,
                r.Order.RentalDays,
                r.Order.TotalAmount,
                r.Order.DepositAmount,
                r.Order.VendorSubtotalAmount,
                r.Order.CreatedOnUtc,
                r.Order.StartDate,
                r.Order.EndDate,
                r.ListingPrimaryImageUrl,
                r.Order.IsExtended,
                DoctorId: r.Doctor?.Id,
                DoctorName: r.Doctor?.FullName,
                DoctorSpecialization: r.Doctor?.Specialization,
                HospitalId: null,
                HospitalName: null,
                HospitalCity: null,
                DoctorContactNumber: r.Doctor?.ContactNumber
            )).ToList();

        var result = new PagedResult<AdminOrderDto>(pagedRows, totalCount, request.Page, request.PageSize);
        return Result.Success(result);
    }
}
