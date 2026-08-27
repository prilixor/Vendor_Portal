using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Tests;

public class CatalogExcelScopeTests
{
    [Fact]
    public void Equipment_export_does_not_include_a_variants_sheet()
    {
        Assert.False(CatalogExcelScope.IncludeVariantsSheet(isChemicalTemplate: false));
    }

    [Fact]
    public void Chemical_export_includes_a_variants_sheet()
    {
        Assert.True(CatalogExcelScope.IncludeVariantsSheet(isChemicalTemplate: true));
    }

    [Fact]
    public void Equipment_scope_excludes_chemical_products_and_their_variants()
    {
        var equipmentCat = new ProductCategory
        {
            Id = Guid.NewGuid(),
            CategoryName = "Bedroom Care",
            IsChemical = false,
        };
        var chemicalCat = new ProductCategory
        {
            Id = Guid.NewGuid(),
            CategoryName = "Solvents",
            IsChemical = true,
        };

        var bed = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = equipmentCat.Id,
            ProductName = "Hospital Bed",
        };
        var acetone = new Product
        {
            Id = Guid.NewGuid(),
            CategoryId = chemicalCat.Id,
            ProductName = "Acetone",
            ChemicalProperty = new ChemicalProperty { CasNumber = "67-64-1", BaseUnit = "Ltr" },
            Variants =
            [
                new ProductVariant { Sku = "ACE-VAR-1", SizeValue = 0.5m, SizeUnit = "Ltr", BuyPrice = 75m },
            ],
        };

        var equipmentOnly = CatalogExcelScope.ProductsInCategories(
            [bed, acetone],
            [equipmentCat]);

        Assert.Single(equipmentOnly);
        Assert.Equal("Hospital Bed", equipmentOnly[0].ProductName);
        Assert.DoesNotContain(equipmentOnly, p => p.Variants.Count > 0);
    }

    [Fact]
    public void Chemical_scope_includes_only_chemical_products()
    {
        var equipmentCat = new ProductCategory { Id = Guid.NewGuid(), CategoryName = "Beds", IsChemical = false };
        var chemicalCat = new ProductCategory { Id = Guid.NewGuid(), CategoryName = "Acids", IsChemical = true };
        var products = new[]
        {
            new Product { CategoryId = equipmentCat.Id, ProductName = "Wheelchair" },
            new Product { CategoryId = chemicalCat.Id, ProductName = "Hydrochloric Acid 37%" },
        };

        var chemicalsOnly = CatalogExcelScope.ProductsInCategories(products, [chemicalCat]);

        Assert.Single(chemicalsOnly);
        Assert.Equal("Hydrochloric Acid 37%", chemicalsOnly[0].ProductName);
    }
}
