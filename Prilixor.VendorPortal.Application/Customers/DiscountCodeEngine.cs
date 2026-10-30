namespace Prilixor.VendorPortal.Application.Customers;

public sealed record DiscountLineInput(
    decimal ItemSubtotal,
    string OrderType,
    Guid ProductId,
    Guid CategoryId);

public sealed record DiscountCodeDefinition(
    Guid Id,
    string Code,
    string DiscountType,
    decimal DiscountValue,
    decimal? MaxDiscountAmount,
    decimal? MinimumItemTotal,
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    bool IsActive,
    int? MaxTotalUses,
    int? MaxUsesPerCustomer,
    string AppliesTo,
    bool ShowToCustomers,
    IReadOnlySet<Guid> ProductIds,
    IReadOnlySet<Guid> CategoryIds);

public sealed record DiscountEvaluation(
    bool Applied,
    string? Message,
    decimal TotalDiscount,
    IReadOnlyList<decimal> LineDiscounts);

public static class DiscountCodeEngine
{
    public const string InvalidMessage = "This discount code is not valid.";
    public const string InactiveMessage = "This code is not active.";
    public const string NotStartedMessage = "This code is not active yet.";
    public const string ExpiredMessage = "This code has expired.";
    public const string TotalLimitMessage = "This code has reached its use limit.";
    public const string CustomerLimitMessage = "You have already used this code the maximum number of times.";
    public const string MinimumMessage = "Add more eligible items to use this code.";
    public const string NotEligibleMessage = "This code does not apply to the items in this checkout.";

    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var code = raw.Trim().ToUpperInvariant();
        if (code.Length is < 3 or > 20)
            return null;

        foreach (var ch in code)
        {
            if (ch is not (>= 'A' and <= 'Z' or >= '0' and <= '9' or '-'))
                return null;
        }

        return code;
    }

    public static DiscountEvaluation Evaluate(
        DiscountCodeDefinition code,
        IReadOnlyList<DiscountLineInput> lines,
        int totalUses,
        int customerUses,
        DateTimeOffset now)
    {
        var zeros = Enumerable.Repeat(0m, lines.Count).ToArray();
        if (!code.IsActive)
            return Reject(InactiveMessage, zeros);
        if (code.StartsAt is { } starts && now < starts)
            return Reject(NotStartedMessage, zeros);
        if (code.EndsAt is { } ends && now > ends)
            return Reject(ExpiredMessage, zeros);
        if (code.MaxTotalUses is int totalLimit && totalUses >= totalLimit)
            return Reject(TotalLimitMessage, zeros);
        if (code.MaxUsesPerCustomer is int customerLimit && customerUses >= customerLimit)
            return Reject(CustomerLimitMessage, zeros);

        var eligibleIndexes = new List<int>();
        for (var i = 0; i < lines.Count; i++)
        {
            if (IsEligible(code, lines[i]))
                eligibleIndexes.Add(i);
        }

        if (eligibleIndexes.Count == 0)
            return Reject(NotEligibleMessage, zeros);

        var eligibleSum = eligibleIndexes.Sum(i => lines[i].ItemSubtotal);
        if (code.MinimumItemTotal is decimal minimum && eligibleSum < minimum)
            return Reject(MinimumMessage, zeros);

        var totalDiscount = ComputeTotal(code, eligibleSum);
        if (totalDiscount <= 0m)
            return Reject(NotEligibleMessage, zeros);

        var shares = Allocate(totalDiscount, lines.Select(l => l.ItemSubtotal).ToArray(), eligibleIndexes);
        var applied = RoundMoney(shares.Sum());
        return new DiscountEvaluation(true, null, applied, shares);
    }

    public static DiscountCodeDefinition? PickBestPublic(
        IReadOnlyList<(DiscountCodeDefinition Code, int TotalUses, int CustomerUses)> candidates,
        IReadOnlyList<DiscountLineInput> lines,
        DateTimeOffset now)
    {
        DiscountCodeDefinition? best = null;
        var bestAmount = 0m;
        foreach (var candidate in candidates)
        {
            if (!candidate.Code.ShowToCustomers)
                continue;

            var evaluation = Evaluate(candidate.Code, lines, candidate.TotalUses, candidate.CustomerUses, now);
            if (!evaluation.Applied || evaluation.TotalDiscount <= bestAmount)
                continue;

            best = candidate.Code;
            bestAmount = evaluation.TotalDiscount;
        }

        return best;
    }

    public static string OfferLabel(DiscountCodeDefinition code)
    {
        if (string.Equals(code.DiscountType, "fixed", StringComparison.OrdinalIgnoreCase))
            return $"Use {code.Code} for ₹{code.DiscountValue:0.##} off the item price.";

        var cap = code.MaxDiscountAmount is > 0m
            ? $", up to ₹{code.MaxDiscountAmount.Value:0.##}"
            : "";
        return $"Use {code.Code} for {code.DiscountValue:0.##}% off the item price{cap}.";
    }

    public static bool IsEligible(DiscountCodeDefinition code, DiscountLineInput line)
    {
        if (line.ItemSubtotal <= 0m)
            return false;

        var applies = (code.AppliesTo ?? "both").Trim().ToLowerInvariant();
        if (applies == "rent" && !string.Equals(line.OrderType, "rent", StringComparison.OrdinalIgnoreCase))
            return false;
        if (applies == "buy" && !string.Equals(line.OrderType, "buy", StringComparison.OrdinalIgnoreCase))
            return false;

        var hasProducts = code.ProductIds.Count > 0;
        var hasCategories = code.CategoryIds.Count > 0;
        if (!hasProducts && !hasCategories)
            return true;

        var productHit = hasProducts && code.ProductIds.Contains(line.ProductId);
        var categoryHit = hasCategories && code.CategoryIds.Contains(line.CategoryId);
        if (hasProducts && hasCategories)
            return productHit || categoryHit;
        return hasProducts ? productHit : categoryHit;
    }

    public static decimal[] Allocate(decimal totalDiscount, IReadOnlyList<decimal> bases, IReadOnlyList<int> eligibleIndexes)
    {
        var result = new decimal[bases.Count];
        if (totalDiscount <= 0m || eligibleIndexes.Count == 0)
            return result;

        var sum = eligibleIndexes.Sum(i => bases[i]);
        if (sum <= 0m)
            return result;

        totalDiscount = RoundMoney(Math.Min(totalDiscount, sum));
        decimal assigned = 0m;
        for (var n = 0; n < eligibleIndexes.Count - 1; n++)
        {
            var index = eligibleIndexes[n];
            var raw = totalDiscount * bases[index] / sum;
            var share = FloorMoney(raw);
            if (share > bases[index])
                share = bases[index];
            if (assigned + share > totalDiscount)
                share = RoundMoney(totalDiscount - assigned);
            result[index] = share;
            assigned += share;
        }

        var last = eligibleIndexes[^1];
        var remainder = RoundMoney(totalDiscount - assigned);
        if (remainder < 0m)
            remainder = 0m;
        if (remainder > bases[last])
        {
            var overflow = remainder - bases[last];
            result[last] = bases[last];
            for (var n = eligibleIndexes.Count - 2; n >= 0 && overflow > 0m; n--)
            {
                var index = eligibleIndexes[n];
                var room = bases[index] - result[index];
                var take = room < overflow ? room : overflow;
                if (take <= 0m)
                    continue;
                result[index] = RoundMoney(result[index] + take);
                overflow = RoundMoney(overflow - take);
            }
        }
        else
        {
            result[last] = remainder;
        }

        return result;
    }

    private static decimal ComputeTotal(DiscountCodeDefinition code, decimal eligibleSum)
    {
        decimal total;
        if (string.Equals(code.DiscountType, "fixed", StringComparison.OrdinalIgnoreCase))
            total = code.DiscountValue;
        else
            total = eligibleSum * code.DiscountValue / 100m;

        if (code.MaxDiscountAmount is > 0m && total > code.MaxDiscountAmount.Value)
            total = code.MaxDiscountAmount.Value;
        if (total > eligibleSum)
            total = eligibleSum;
        return RoundMoney(total);
    }

    private static DiscountEvaluation Reject(string message, decimal[] zeros) =>
        new(false, message, 0m, zeros);

    public static decimal RoundMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal FloorMoney(decimal value) =>
        Math.Floor(value * 100m) / 100m;
}
