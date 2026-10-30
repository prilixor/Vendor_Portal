using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record DiscountCodeDto(
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
    int UsedCount,
    IReadOnlyList<Guid> ProductIds,
    IReadOnlyList<Guid> CategoryIds);

public sealed record GetDiscountCodesQuery : IQuery<List<DiscountCodeDto>>;

internal sealed class GetDiscountCodesQueryHandler(IDiscountCodeRepository codes)
    : IQueryHandler<GetDiscountCodesQuery, List<DiscountCodeDto>>
{
    public async Task<Result<List<DiscountCodeDto>>> Handle(GetDiscountCodesQuery request, CancellationToken cancellationToken)
    {
        var rows = await codes.ListAsync(cancellationToken);
        var counts = await codes.CountActiveUsesAsync(rows.Select(x => x.Id).ToArray(), Guid.Empty, cancellationToken);
        var list = rows.Select(row =>
        {
            counts.TryGetValue(row.Id, out var use);
            return ToDto(row, use.Total);
        }).ToList();
        return Result.Success(list);
    }

    internal static DiscountCodeDto ToDto(DiscountCode row, int usedCount) =>
        new(
            row.Id,
            row.Code,
            row.DiscountType,
            row.DiscountValue,
            row.MaxDiscountAmount,
            row.MinimumItemTotal,
            row.StartsAt,
            row.EndsAt,
            row.IsActive,
            row.MaxTotalUses,
            row.MaxUsesPerCustomer,
            row.AppliesTo,
            row.ShowToCustomers,
            usedCount,
            row.Products.Select(x => x.ProductId).ToList(),
            row.Categories.Select(x => x.CategoryId).ToList());
}

public sealed record SaveDiscountCodeCommand(
    Guid? Id,
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
    IReadOnlyList<Guid> ProductIds,
    IReadOnlyList<Guid> CategoryIds) : ICommand<DiscountCodeDto>;

public sealed class SaveDiscountCodeCommandValidator : AbstractValidator<SaveDiscountCodeCommand>
{
    public SaveDiscountCodeCommandValidator()
    {
        RuleFor(x => x.Code)
            .Must(code => DiscountCodeEngine.Normalize(code) is not null)
            .WithMessage("Use 3 to 20 letters, numbers, or hyphens.");
        RuleFor(x => x.DiscountType)
            .Must(type => type is "percentage" or "fixed")
            .WithMessage("Choose a percent or a fixed amount.");
        RuleFor(x => x.DiscountValue).GreaterThan(0);
        RuleFor(x => x.DiscountValue)
            .LessThanOrEqualTo(100)
            .When(x => x.DiscountType == "percentage")
            .WithMessage("A percent discount cannot be more than 100.");
        RuleFor(x => x.MaxDiscountAmount).GreaterThan(0).When(x => x.MaxDiscountAmount.HasValue);
        RuleFor(x => x.MinimumItemTotal).GreaterThanOrEqualTo(0).When(x => x.MinimumItemTotal.HasValue);
        RuleFor(x => x.EndsAt)
            .GreaterThan(x => x.StartsAt!.Value)
            .When(x => x.StartsAt.HasValue && x.EndsAt.HasValue)
            .WithMessage("The end must be after the start.");
        RuleFor(x => x.MaxTotalUses).GreaterThan(0).When(x => x.MaxTotalUses.HasValue);
        RuleFor(x => x.MaxUsesPerCustomer).GreaterThan(0).When(x => x.MaxUsesPerCustomer.HasValue);
        RuleFor(x => x.AppliesTo)
            .Must(value => value is "rent" or "buy" or "both")
            .WithMessage("Choose rent, buy, or both.");
    }
}

internal sealed class SaveDiscountCodeCommandHandler(IDiscountCodeRepository codes)
    : ICommandHandler<SaveDiscountCodeCommand, DiscountCodeDto>
{
    public async Task<Result<DiscountCodeDto>> Handle(SaveDiscountCodeCommand request, CancellationToken cancellationToken)
    {
        var normalized = DiscountCodeEngine.Normalize(request.Code);
        if (normalized is null)
        {
            return Result.Failure<DiscountCodeDto>(new Error(
                "discount.invalid_code",
                "Use 3 to 20 letters, numbers, or hyphens.",
                ErrorCategory.Validation));
        }

        var existingCode = await codes.GetByCodeAsync(normalized, cancellationToken);
        DiscountCode entity;
        if (request.Id is Guid id)
        {
            var loaded = await codes.GetByIdAsync(id, cancellationToken);
            if (loaded is null)
            {
                return Result.Failure<DiscountCodeDto>(new Error(
                    "discount.not_found",
                    "Discount code not found.",
                    ErrorCategory.NotFound));
            }

            entity = loaded;

            if (existingCode is not null && existingCode.Id != entity.Id)
            {
                return Result.Failure<DiscountCodeDto>(new Error(
                    "discount.duplicate",
                    "That code is already in use.",
                    ErrorCategory.Validation));
            }
        }
        else
        {
            if (existingCode is not null)
            {
                return Result.Failure<DiscountCodeDto>(new Error(
                    "discount.duplicate",
                    "That code is already in use.",
                    ErrorCategory.Validation));
            }

            entity = new DiscountCode { Id = Guid.CreateVersion7() };
            await codes.AddAsync(entity, cancellationToken);
        }

        entity.Code = normalized;
        entity.DiscountType = request.DiscountType.Trim().ToLowerInvariant();
        entity.DiscountValue = request.DiscountValue;
        entity.MaxDiscountAmount = request.MaxDiscountAmount is > 0m ? request.MaxDiscountAmount : null;
        entity.MinimumItemTotal = request.MinimumItemTotal is >= 0m ? request.MinimumItemTotal : null;
        entity.StartsAt = request.StartsAt;
        entity.EndsAt = request.EndsAt;
        entity.IsActive = request.IsActive;
        entity.MaxTotalUses = request.MaxTotalUses is > 0 ? request.MaxTotalUses : null;
        entity.MaxUsesPerCustomer = request.MaxUsesPerCustomer is > 0 ? request.MaxUsesPerCustomer : null;
        entity.AppliesTo = request.AppliesTo.Trim().ToLowerInvariant();
        entity.ShowToCustomers = request.ShowToCustomers;

        entity.Products.Clear();
        foreach (var productId in request.ProductIds.Where(x => x != Guid.Empty).Distinct())
        {
            entity.Products.Add(new DiscountCodeProduct
            {
                DiscountCodeId = entity.Id,
                ProductId = productId,
            });
        }

        entity.Categories.Clear();
        foreach (var categoryId in request.CategoryIds.Where(x => x != Guid.Empty).Distinct())
        {
            entity.Categories.Add(new DiscountCodeCategory
            {
                DiscountCodeId = entity.Id,
                CategoryId = categoryId,
            });
        }

        await codes.SaveChangesAsync(cancellationToken);
        var used = await codes.CountActiveUsesAsync(entity.Id, cancellationToken);
        return Result.Success(GetDiscountCodesQueryHandler.ToDto(entity, used));
    }
}

internal sealed record CheckoutDiscountDecision(
    bool Applied,
    string? Message,
    Guid? CodeId,
    string? Code,
    decimal TotalDiscount,
    IReadOnlyList<decimal> LineDiscounts,
    string? PublicCode,
    string? PublicLabel);

internal static class CheckoutDiscountResolver
{
    public static async Task<CheckoutDiscountDecision> ResolveAsync(
        IDiscountCodeRepository codes,
        Guid customerId,
        string? requestedCode,
        IReadOnlyList<DiscountLineInput> lines,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var normalized = DiscountCodeEngine.Normalize(requestedCode);
        DiscountCode? typed = null;
        string? message = null;
        if (!string.IsNullOrWhiteSpace(requestedCode))
        {
            if (normalized is null)
                message = DiscountCodeEngine.InvalidMessage;
            else
                typed = await codes.GetByCodeAsync(normalized, cancellationToken);
            if (normalized is not null && typed is null)
                message = DiscountCodeEngine.InvalidMessage;
        }

        var shown = await codes.ListShownToCustomersAsync(cancellationToken);
        var ids = shown.Select(x => x.Id).ToList();
        if (typed is not null && ids.All(id => id != typed.Id))
            ids.Add(typed.Id);

        var uses = await codes.CountActiveUsesAsync(ids, customerId, cancellationToken);
        DiscountEvaluation? applied = null;
        if (typed is not null && message is null)
        {
            uses.TryGetValue(typed.Id, out var typedUses);
            applied = DiscountCodeEngine.Evaluate(
                ToDefinition(typed),
                lines,
                typedUses.Total,
                typedUses.Customer,
                now);
            if (!applied.Applied)
                message = applied.Message;
        }

        string? publicCode = null;
        string? publicLabel = null;
        if (applied is not { Applied: true })
        {
            var candidates = shown
                .Select(code =>
                {
                    uses.TryGetValue(code.Id, out var use);
                    return (ToDefinition(code), use.Total, use.Customer);
                })
                .ToList();
            var best = DiscountCodeEngine.PickBestPublic(candidates, lines, now);
            if (best is not null)
            {
                publicCode = best.Code;
                publicLabel = DiscountCodeEngine.OfferLabel(best);
            }
        }

        if (applied is { Applied: true })
        {
            return new CheckoutDiscountDecision(
                true,
                null,
                typed!.Id,
                typed.Code,
                applied.TotalDiscount,
                applied.LineDiscounts,
                null,
                null);
        }

        return new CheckoutDiscountDecision(
            false,
            message,
            null,
            null,
            0m,
            Enumerable.Repeat(0m, lines.Count).ToArray(),
            publicCode,
            publicLabel);
    }

    private static DiscountCodeDefinition ToDefinition(DiscountCode code) =>
        new(
            code.Id,
            code.Code,
            code.DiscountType,
            code.DiscountValue,
            code.MaxDiscountAmount,
            code.MinimumItemTotal,
            code.StartsAt,
            code.EndsAt,
            code.IsActive && !code.IsDeleted,
            code.MaxTotalUses,
            code.MaxUsesPerCustomer,
            code.AppliesTo,
            code.ShowToCustomers,
            code.Products.Select(x => x.ProductId).ToHashSet(),
            code.Categories.Select(x => x.CategoryId).ToHashSet());
}
