using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed class AdminOrderDetailResult
{
    public List<AdminOrderDto> Items { get; init; } = [];
}

public sealed record GetAdminOrderDetailQuery(Guid OrderId) : IQuery<AdminOrderDetailResult>;

internal sealed class GetAdminOrderDetailQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminOrderDetailQuery, AdminOrderDetailResult>
{
    public async Task<Result<AdminOrderDetailResult>> Handle(
        GetAdminOrderDetailQuery request,
        CancellationToken cancellationToken)
    {
        var rows = await customers.GetCustomerOrderGroupForAdminAsync(request.OrderId, cancellationToken);
        if (rows is null)
            return Result.Failure<AdminOrderDetailResult>(
                new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        return Result.Success(new AdminOrderDetailResult
        {
            Items = rows.Select(ToDto).ToList(),
        });
    }

    private static AdminOrderDto ToDto(CustomerRentalOrderWithListing r)
    {
        var o = r.Order;
        return new AdminOrderDto(
            o.Id,
            o.OrderNumber,
            o.CustomerId,
            o.Customer?.FullName ?? "Customer",
            o.Customer?.Email ?? "customer@example.com",
            (o.Status == "dispatch_failed" || o.Status == "awaiting_vendor_acceptance")
                ? "Unassigned"
                : (r.Listing?.Vendor?.Profile?.BusinessName ?? r.Listing?.Vendor?.Email ?? "Vendor"),
            !string.IsNullOrEmpty(r.VariantDescription)
                ? $"{r.Listing?.ListingTitle ?? "Deleted Product"} ({r.VariantDescription})"
                : (r.Listing?.ListingTitle ?? "Deleted Product"),
            o.Status,
            o.OrderType,
            o.Quantity,
            o.RentalDays,
            o.TotalAmount,
            o.DepositAmount,
            o.VendorSubtotalAmount,
            o.CreatedOnUtc,
            o.StartDate,
            o.EndDate,
            r.ListingPrimaryImageUrl,
            o.IsExtended,
            DoctorId: r.Doctor?.Id,
            DoctorName: r.Doctor?.FullName,
            DoctorSpecialization: r.Doctor?.Specialization,
            HospitalId: null,
            HospitalName: null,
            HospitalCity: null,
            DoctorContactNumber: r.Doctor?.ContactNumber,
            DoctorUniqueCode: r.Doctor?.UniqueCode);
    }
}
