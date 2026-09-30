using System.Text.Json;
using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Extensions;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminAlertFeedQuery(
    string? Tab,
    int Page = 1,
    int PageSize = 15) : IQuery<AdminAlertFeedResult>;

public sealed class GetAdminAlertFeedQueryValidator : AbstractValidator<GetAdminAlertFeedQuery>
{
    public GetAdminAlertFeedQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminAlertFeedQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetAdminAlertFeedQuery, AdminAlertFeedResult>
{
    private static readonly HashSet<string> Tabs = ["all", "orders", "vendors", "listings", "logs"];

    public async Task<Result<AdminAlertFeedResult>> Handle(
        GetAdminAlertFeedQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var tab = (request.Tab ?? "all").Trim().ToLowerInvariant();
        if (!Tabs.Contains(tab)) tab = "all";

        // Vendor repo shares DbContext instances — do not run its queries in parallel.
        var orderCountTask = customers.CountCriticalAdminOrdersAsync(cancellationToken);
        var vendorCount = await vendors.CountPendingVendorsAsync(cancellationToken);
        var listingCount = await vendors.CountListingPricingAlertsAsync(cancellationToken);
        var logCount = await vendors.CountAdminAuditLogsAsync(cancellationToken);
        var orderCount = await orderCountTask;

        var counts = new AdminAlertFeedCounts
        {
            Orders = orderCount,
            Vendors = vendorCount,
            Listings = listingCount,
            Logs = logCount,
            All = orderCount + vendorCount + listingCount,
        };

        List<AdminAlertFeedItem> items;
        int totalCount;

        switch (tab)
        {
            case "orders":
            {
                var orders = await customers.SearchAdminOrderSummariesAsync(
                    new AdminOrderListQuerySpec
                    {
                        Status = "critical",
                        Page = page,
                        PageSize = pageSize,
                    },
                    cancellationToken);
                items = orders.Items.Select(MapOrder).ToList();
                totalCount = orders.TotalCount;
                break;
            }
            case "vendors":
            {
                var pending = await vendors.SearchPendingVendorAlertsAsync(page * pageSize, cancellationToken);
                items = pending
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(MapVendor)
                    .ToList();
                totalCount = counts.Vendors;
                break;
            }
            case "listings":
            {
                var logs = await vendors.SearchAdminAlertAuditLogsAsync("listing", page, pageSize, cancellationToken);
                items = logs.Items.Select(MapListing).ToList();
                totalCount = logs.TotalCount;
                break;
            }
            case "logs":
            {
                var logs = await vendors.SearchAdminAlertAuditLogsAsync("all", page, pageSize, cancellationToken);
                items = logs.Items.Select(MapLog).ToList();
                totalCount = logs.TotalCount;
                break;
            }
            default:
            {
                var take = page * pageSize;
                var ordersTask = customers.SearchAdminOrderSummariesAsync(
                    new AdminOrderListQuerySpec
                    {
                        Status = "critical",
                        Page = 1,
                        PageSize = take,
                    },
                    cancellationToken);
                var vendorsTask = vendors.SearchPendingVendorAlertsAsync(take, cancellationToken);
                var listingsTask = vendors.SearchAdminAlertAuditLogsAsync("listing", 1, take, cancellationToken);
                await Task.WhenAll(ordersTask, vendorsTask, listingsTask);

                var merged = ordersTask.Result.Items.Select(MapOrder)
                    .Concat(vendorsTask.Result.Select(MapVendor))
                    .Concat(listingsTask.Result.Items.Select(MapListing))
                    .OrderByDescending(x => x.Timestamp)
                    .ToList();

                items = merged.Skip((page - 1) * pageSize).Take(pageSize).ToList();
                totalCount = counts.All;
                break;
            }
        }

        return Result.Success(new AdminAlertFeedResult
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            Counts = counts,
        });
    }

    private static AdminAlertFeedItem MapOrder(AdminOrderListRow order)
    {
        var shortNumber = string.Join("-", order.OrderNumber.Split('-').Take(3));
        return new AdminAlertFeedItem
        {
            Id = $"order-{order.OrderId}-{order.Status}",
            Type = "order",
            Title = $"Order {shortNumber} Dispatch Failed",
            Description = $"Vendor dispatch reassignment failed for item \"{order.ListingTitle}\". High priority action required.",
            Status = order.Status,
            Timestamp = order.CreatedOnUtc,
            Link = "/admin/orders?tab=dispatch_failed",
            OrderId = order.OrderId.ToString(),
            OrderNumber = order.OrderNumber,
            ListingTitle = order.ListingTitle,
            CustomerName = order.CustomerName,
            VendorName = order.VendorName,
            Amount = order.TotalAmount,
        };
    }

    private static AdminAlertFeedItem MapVendor(AdminAlertPendingVendorRow vendor)
    {
        var displayName = string.IsNullOrWhiteSpace(vendor.BusinessName) ? vendor.OwnerName : vendor.BusinessName;
        return new AdminAlertFeedItem
        {
            Id = $"vendor-{vendor.Id}",
            Type = "vendor",
            Title = "Vendor Onboarding Pending Approval",
            Description = $"New vendor \"{displayName}\" has submitted document details and requires validation.",
            Status = vendor.AccountStatus,
            Timestamp = vendor.CreatedOnUtc.ToSafeDateTimeOffset(),
            Link = $"/admin/vendors/{vendor.Id}?tab=docs",
            VendorId = vendor.Id,
            Company = vendor.BusinessName,
            OwnerName = vendor.OwnerName,
            Email = vendor.Email,
        };
    }

    private static AdminAlertFeedItem MapListing(AdminAuditLogDto log)
    {
        var created = (log.ActionType ?? string.Empty).Contains("created", StringComparison.OrdinalIgnoreCase);
        var kind = ResolveListingKind(log.NewValue, log.Notes);
        var listingTitle = ExtractListingTitle(log.Notes) ?? "Listing";
        return new AdminAlertFeedItem
        {
            Id = $"listing-{log.Id}",
            Type = "listing",
            Title = created ? "New vendor listing needs pricing" : "Vendor listing updated",
            Description = string.IsNullOrWhiteSpace(log.Notes)
                ? $"A vendor {(created ? "created" : "updated")} a {kind} listing. Review catalog pricing."
                : log.Notes,
            Status = created ? "created" : "updated",
            Timestamp = log.CreatedAt,
            Link = kind == "chemical" ? "/admin/chemicals" : "/admin/products",
            Kind = kind,
            Notes = log.Notes,
            ListingTitle = listingTitle,
            ActionType = log.ActionType,
            EntityType = log.EntityType,
        };
    }

    private static AdminAlertFeedItem MapLog(AdminAuditLogDto log)
    {
        return new AdminAlertFeedItem
        {
            Id = log.Id,
            Type = "log",
            Title = log.ActionType,
            Description = log.Notes ?? string.Empty,
            Status = log.ActionType,
            Timestamp = log.CreatedAt,
            Link = "/admin/audit-logs",
            ActionType = log.ActionType,
            EntityType = log.EntityType,
            AdminId = log.AdminId,
            AdminName = log.AdminName,
            AdminEmail = log.AdminEmail,
            OldValue = log.OldValue,
            NewValue = log.NewValue,
            Notes = log.Notes,
        };
    }

    private static string ResolveListingKind(string? newValue, string? notes)
    {
        var kind = "product";
        if (!string.IsNullOrWhiteSpace(newValue))
        {
            try
            {
                using var doc = JsonDocument.Parse(newValue);
                if (doc.RootElement.TryGetProperty("kind", out var k))
                {
                    var value = k.GetString();
                    if (value is "chemical" or "product") kind = value;
                }
            }
            catch (JsonException)
            {
                // ignore malformed JSON
            }
        }

        if ((notes ?? string.Empty).Contains("chemical", StringComparison.OrdinalIgnoreCase))
        {
            kind = "chemical";
        }

        return kind;
    }

    private static string? ExtractListingTitle(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes)) return null;
        const string prefix = "listing \"";
        var start = notes.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
        if (start < 0) return null;
        start += prefix.Length;
        var end = notes.IndexOf('"', start);
        return end > start ? notes[start..end] : null;
    }
}
