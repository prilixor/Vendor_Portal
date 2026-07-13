using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class ChemicalProperty : AuditableEntity<Guid>
{
    public Guid ProductId { get; set; }
    public string? CasNumber { get; set; }
    public string? ChemicalFormula { get; set; }
    public decimal? PurityPercentage { get; set; }
    public decimal? MolecularWeight { get; set; }
    public string BaseUnit { get; set; } = "Kg";
    public string? SdsDocumentUrl { get; set; }
    public string? CoaDocumentUrl { get; set; }

    public Product Product { get; set; } = null!;
}
