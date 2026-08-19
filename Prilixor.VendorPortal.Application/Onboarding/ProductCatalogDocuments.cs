using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public static class ProductCatalogDocuments
{
    private static readonly string[] PreferredOrder =
    [
        "spec_sheet",
        "sds",
        "coa",
        "warranty",
        "compliance"
    ];

    public static List<ProductDocumentDto> ToDtos(Product product, IVendorFileUrlResolver fileUrlResolver)
    {
        var productId = product.Id.ToString();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var docs = new List<ProductDocumentDto>();

        foreach (var row in (product.ProductDocuments ?? Enumerable.Empty<ProductDocument>())
                     .Where(x => !x.IsDeleted && !string.IsNullOrWhiteSpace(x.FileUrl))
                     .OrderBy(x => SortKey(x.DocumentType))
                     .ThenBy(x => x.DocumentType))
        {
            TryAdd(docs, seenUrls, row.Id.ToString(), productId, row.DocumentType, row.FileUrl, fileUrlResolver);
        }

        TryAdd(
            docs,
            seenUrls,
            $"legacy-sds-{productId}",
            productId,
            "sds",
            product.ChemicalProperty?.SdsDocumentUrl,
            fileUrlResolver);
        TryAdd(
            docs,
            seenUrls,
            $"legacy-coa-{productId}",
            productId,
            "coa",
            product.ChemicalProperty?.CoaDocumentUrl,
            fileUrlResolver);

        return docs
            .OrderBy(d => SortKey(d.DocumentType))
            .ThenBy(d => d.DocumentType)
            .ToList();
    }

    private static int SortKey(string documentType)
    {
        var idx = Array.IndexOf(PreferredOrder, documentType.Trim().ToLowerInvariant());
        return idx >= 0 ? idx : 99;
    }

    private static void TryAdd(
        List<ProductDocumentDto> docs,
        HashSet<string> seenUrls,
        string id,
        string productId,
        string documentType,
        string? rawUrl,
        IVendorFileUrlResolver fileUrlResolver)
    {
        if (string.IsNullOrWhiteSpace(rawUrl))
            return;

        var resolved = fileUrlResolver.Resolve(rawUrl.Trim());
        if (string.IsNullOrWhiteSpace(resolved) || !seenUrls.Add(resolved.Trim()))
            return;

        docs.Add(new ProductDocumentDto(
            id,
            productId,
            string.IsNullOrWhiteSpace(documentType) ? "document" : documentType.Trim(),
            resolved));
    }
}
