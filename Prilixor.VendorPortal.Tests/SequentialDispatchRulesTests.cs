using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.Tests;

public class SequentialDispatchRulesTests
{
    [Fact]
    public void SelectUniqueVendors_keeps_one_listing_per_vendor()
    {
        var vendor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var closerLowStock = new RankedDispatchCandidate(vendor, Guid.Parse("11111111-1111-1111-1111-111111111111"), 1.2m, 1);
        var fartherHighStock = new RankedDispatchCandidate(vendor, Guid.Parse("22222222-2222-2222-2222-222222222222"), 1.2m, 9);

        var selected = SequentialDispatchRules.SelectUniqueVendors(
            [closerLowStock, fartherHighStock],
            excludeVendorIds: new HashSet<Guid>(),
            preferredVendorIds: new HashSet<Guid>(),
            take: 5);

        Assert.Single(selected);
        Assert.Equal(fartherHighStock.ListingId, selected[0].ListingId);
        Assert.Equal(9, selected[0].InventoryAvailable);
    }

    [Fact]
    public void SelectUniqueVendors_orders_by_distance_then_preferred_sibling()
    {
        var near = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var farPreferred = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var ranked = new[]
        {
            new RankedDispatchCandidate(farPreferred, Guid.NewGuid(), 8m, 4),
            new RankedDispatchCandidate(near, Guid.NewGuid(), 1m, 2),
        };

        var selected = SequentialDispatchRules.SelectUniqueVendors(
            ranked,
            excludeVendorIds: new HashSet<Guid>(),
            preferredVendorIds: new HashSet<Guid> { farPreferred },
            take: 5);

        Assert.Equal(near, selected[0].VendorId);
        Assert.Equal(farPreferred, selected[1].VendorId);
    }

    [Fact]
    public void SelectUniqueVendors_pickup_tie_prefers_sibling_vendor()
    {
        var sibling = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var other = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var ranked = new[]
        {
            new RankedDispatchCandidate(other, Guid.NewGuid(), 0m, 3),
            new RankedDispatchCandidate(sibling, Guid.NewGuid(), 0m, 3),
        };

        var selected = SequentialDispatchRules.SelectUniqueVendors(
            ranked,
            excludeVendorIds: new HashSet<Guid>(),
            preferredVendorIds: new HashSet<Guid> { sibling },
            take: 5);

        Assert.Equal(sibling, selected[0].VendorId);
    }

    [Fact]
    public void SelectUniqueVendors_caps_at_five_and_skips_excluded()
    {
        var excluded = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var ranked = Enumerable.Range(0, 8)
            .Select(i => new RankedDispatchCandidate(Guid.NewGuid(), Guid.NewGuid(), i, 1))
            .Append(new RankedDispatchCandidate(excluded, Guid.NewGuid(), 0.1m, 99))
            .ToList();

        var selected = SequentialDispatchRules.SelectUniqueVendors(
            ranked,
            excludeVendorIds: new HashSet<Guid> { excluded },
            preferredVendorIds: new HashSet<Guid>(),
            take: 15);

        Assert.Equal(5, selected.Count);
        Assert.DoesNotContain(selected, x => x.VendorId == excluded);
    }

    [Theory]
    [InlineData("CRT-20260915-123456-01", "CRT-20260915-123456")]
    [InlineData("CRT-1", "CRT")]
    [InlineData("NOSUFFIX", null)]
    public void CheckoutGroupPrefix_parses_line_suffix(string orderNumber, string? expected)
    {
        Assert.Equal(expected, SequentialDispatchRules.CheckoutGroupPrefix(orderNumber));
    }

    [Fact]
    public void SelectUniqueVendors_admin_pin_puts_chosen_vendor_first()
    {
        var chosen = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var nearer = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var ranked = new[]
        {
            new RankedDispatchCandidate(nearer, Guid.NewGuid(), 5m, 2),
            new RankedDispatchCandidate(chosen, Guid.NewGuid(), 70m, 2),
        };

        var selected = SequentialDispatchRules.SelectUniqueVendors(
            ranked,
            excludeVendorIds: new HashSet<Guid>(),
            preferredVendorIds: new HashSet<Guid>(),
            take: 5,
            pinFirstVendorId: chosen);

        Assert.Equal(chosen, selected[0].VendorId);
        Assert.Equal(nearer, selected[1].VendorId);
    }

    [Fact]
    public void HasBeenAttempted_does_not_treat_queued_or_superseded_expired_as_a_turn()
    {
        Assert.False(SequentialDispatchRules.HasBeenAttempted(SequentialDispatchRules.Queued));
        Assert.False(SequentialDispatchRules.HasBeenAttempted(SequentialDispatchRules.Expired));
        Assert.True(SequentialDispatchRules.HasBeenAttempted(SequentialDispatchRules.Pending));
        Assert.True(SequentialDispatchRules.HasBeenAttempted(SequentialDispatchRules.Accepted));
        Assert.True(SequentialDispatchRules.HasBeenAttempted(SequentialDispatchRules.Rejected));
    }
}
