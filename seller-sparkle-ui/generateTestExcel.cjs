const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.utils.book_new();

// Categories sheet
const categoriesData = [
  ["category_name", "prescription_required", "deposit_required", "installation_required", "is_active"],
  ["Industrial Chemicals", "FALSE", "FALSE", "FALSE", "TRUE"],
  ["Lab Reagents", "TRUE", "FALSE", "FALSE", "TRUE"]
];
const categoriesWs = XLSX.utils.aoa_to_sheet(categoriesData);
XLSX.utils.book_append_sheet(wb, categoriesWs, "Categories");

// Chemicals sheet
const chemicalsData = [
  ["category_name", "product_name", "brand_name", "short_description", "long_description", "buy_price", "gst_percent", "cas_number", "chemical_formula", "purity_percentage", "molecular_weight", "base_unit", "sds_document_url", "coa_document_url", "is_active"],
  ["Industrial Chemicals", "Sodium Hydroxide", "ChemCorp", "Caustic Soda", "High purity Sodium Hydroxide pellets for industrial use", 1500.00, 18, "1310-73-2", "NaOH", 99.5, 40.00, "Kg", "http://example.com/sds1", "http://example.com/coa1", "TRUE"],
  ["Lab Reagents", "Ethanol", "LabGrade", "Absolute Ethanol", "99.9% pure Ethanol for laboratory use", 2500.00, 18, "64-17-5", "C2H6O", 99.9, 46.07, "Litre", "http://example.com/sds2", "http://example.com/coa2", "TRUE"]
];
const chemicalsWs = XLSX.utils.aoa_to_sheet(chemicalsData);
XLSX.utils.book_append_sheet(wb, chemicalsWs, "Chemicals");

XLSX.writeFile(wb, 'test_chemical_upload.xlsx');
console.log('Successfully created test_chemical_upload.xlsx');
