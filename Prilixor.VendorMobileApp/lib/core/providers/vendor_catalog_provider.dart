import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../utils/multipart_file_util.dart';
import '../models/vendor_catalog_model.dart';

class VendorCatalogProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  bool get loading => _loading;

  bool _saving = false;
  bool get saving => _saving;

  String? _error;
  String? get error => _error;

  List<VendorCategory> _categories = [];
  List<CatalogProduct> _products = [];
  List<VendorProductListing> _listings = [];
  List<VendorListingRow> _listingRows = [];
  List<InventoryRecord> _inventoryRecords = [];
  List<InventoryMovement> _movements = [];

  List<VendorCategory> get categories => _categories;
  List<CatalogProduct> get products => _products;
  List<VendorProductListing> get listings => _listings;
  List<VendorListingRow> get listingRows => _listingRows;
  List<InventoryRecord> get inventoryRecords => _inventoryRecords;
  List<InventoryMovement> get movements => _movements;

  Map<String, VendorInventorySnapshot> _inventoryByListing = {};
  Map<String, List<VariantInventoryRow>> _variantInventoryByListing = {};

  InventoryTotals get inventoryTotals {
    var total = 0;
    var available = 0;
    var reserved = 0;
    var rented = 0;
    var blocked = 0;
    for (final row in _inventoryRecords) {
      total += row.total;
      available += row.available;
      reserved += row.reserved;
      rented += row.rented;
      blocked += row.blocked;
    }
    return InventoryTotals(
      total: total,
      available: available,
      reserved: reserved,
      rented: rented,
      blocked: blocked,
    );
  }

  Future<void> fetchCatalog(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final results = await Future.wait([
        _api.dio.get('/vendors/catalog/categories'),
        _api.dio.get('/vendors/catalog/products'),
        _api.dio.get('/vendors/$vendorId/listings'),
      ]);

      _categories = _parseList(results[0].data)
          .map((e) => VendorCategory.fromJson(e))
          .toList();
      _products = _parseList(results[1].data)
          .map((e) => CatalogProduct.fromJson(e))
          .toList();
      _listings = _parseList(results[2].data)
          .map((e) => VendorProductListing.fromJson(e))
          .toList();

      final productById = {for (final p in _products) p.id: p};
      final categoryById = {for (final c in _categories) c.id: c};

      _inventoryByListing = {};
      _variantInventoryByListing = {};

      await Future.wait(_listings.map((listing) async {
        final isChemical = _isChemicalListing(
          listing,
          productById[listing.productId],
          categoryById[productById[listing.productId]?.categoryId],
        );
        if (isChemical) {
          try {
            final response = await _api.dio.get(
              '/vendors/$vendorId/listings/${listing.id}/variant-inventory',
            );
            final rows = _parseList(response.data)
                .map((e) => VariantInventoryRow.fromJson(e))
                .toList();
            _variantInventoryByListing[listing.id] = rows;
          } catch (_) {}
        }
        try {
          final response = await _api.dio.get(
            '/vendors/$vendorId/listings/${listing.id}/inventory',
          );
          if (response.data is Map) {
            final map = Map<String, dynamic>.from(response.data as Map);
            _inventoryByListing[listing.id] = VendorInventorySnapshot(
              listingId: listing.id,
              total: _toInt(map['totalQuantity']),
              available: _toInt(map['availableQuantity']),
              reserved: _toInt(map['reservedQuantity']),
              rented: _toInt(map['rentedQuantity']),
              blocked: _toInt(map['blockedQuantity']),
            );
          }
        } catch (_) {}
      }));

      _listingRows = _listings.map((listing) {
        final product = productById[listing.productId];
        final category = product == null
            ? null
            : categoryById[product.categoryId];
        final isChemical = _isChemicalListing(listing, product, category);
        final variantRows = _variantInventoryByListing[listing.id];
        final inventory = _inventoryByListing[listing.id];
        final quantity = isChemical && variantRows != null && variantRows.isNotEmpty
            ? variantRows.fold<int>(0, (sum, r) => sum + r.totalQuantity)
            : (inventory?.total ?? listing.availableQuantity);

        double? buyMin;
        double? buyMax;
        if (isChemical && product != null && product.variants.isNotEmpty) {
          final prices = product.variants
              .where((v) => v.isActive)
              .map((v) => v.buyPrice)
              .where((p) => p > 0)
              .toList();
          if (prices.isNotEmpty) {
            buyMin = prices.reduce((a, b) => a < b ? a : b);
            buyMax = prices.reduce((a, b) => a > b ? a : b);
          }
        }

        return VendorListingRow(
          listing: listing,
          categoryName: category?.name ?? 'Unknown',
          productName: product?.productName ?? 'Unknown',
          categoryId: product?.categoryId ?? '',
          isChemical: isChemical,
          quantity: quantity,
          status: normalizeListingStatus(listing.listingStatus),
          buyPriceMin: buyMin ?? product?.buyPrice,
          buyPriceMax: buyMax ?? product?.buyPrice,
        );
      }).toList();

      _inventoryRecords = await _buildInventoryRecords(
        vendorId: vendorId,
        productById: productById,
      );

      _movements = await _loadAllMovements(vendorId, productById);
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load catalog.');
    } catch (_) {
      _error = 'Failed to load catalog.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  VendorListingRow? rowForListing(String listingId) {
    for (final row in _listingRows) {
      if (row.listing.id == listingId) return row;
    }
    return null;
  }

  InventoryRecord? inventoryForListing(String listingId) {
    for (final row in _inventoryRecords) {
      if (row.listingId == listingId) return row;
    }
    return null;
  }

  List<VariantInventoryRow> variantInventoryFor(String listingId) {
    return _variantInventoryByListing[listingId] ?? const [];
  }

  Future<List<VendorProductImage>> fetchListingImages(
    String vendorId,
    String listingId,
  ) async {
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/listings/$listingId/images',
      );
      return _parseList(response.data)
          .map((e) => VendorProductImage.fromJson(e))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<List<InventoryMovement>> fetchMovementsForListing(
    String vendorId,
    String listingId,
    String productName,
  ) async {
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/listings/$listingId/inventory/movements',
      );
      return _parseList(response.data)
          .map(
            (e) => InventoryMovement.fromJson(
              json: e,
              listingId: listingId,
              productName: productName,
            ),
          )
          .toList()
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    } catch (_) {
      return const [];
    }
  }

  Future<List<VariantInventoryRow>> fetchVariantInventory(
    String vendorId,
    String listingId,
  ) async {
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/listings/$listingId/variant-inventory',
      );
      final rows = _parseList(response.data)
          .map((e) => VariantInventoryRow.fromJson(e))
          .toList();
      _variantInventoryByListing[listingId] = rows;
      return rows;
    } catch (_) {
      return const [];
    }
  }

  bool isChemicalProduct(CatalogProduct product, {VendorCategory? category}) {
    return category?.isChemical == true || product.isChemicalProduct;
  }

  List<VendorCategory> categoriesForTab(bool chemicals) {
    final result = <VendorCategory>[];
    for (final category in _categories) {
      final hasProduct = _products.any((product) {
        if (product.categoryId != category.id) return false;
        return isChemicalProduct(product, category: category) == chemicals;
      });
      if (hasProduct) result.add(category);
    }
    return result;
  }

  List<CatalogProduct> productsForCategory(String categoryId, bool chemicals) {
    final category = _categories.where((c) => c.id == categoryId).firstOrNull;
    return _products.where((product) {
      if (product.categoryId != categoryId) return false;
      return isChemicalProduct(product, category: category) == chemicals;
    }).toList();
  }

  /// Creates a listing. For new chemical listings with variants, seeds variant stock.
  Future<String?> createListing({
    required String vendorId,
    required String productId,
    required String listingTitle,
    required int availableQuantity,
    required String listingStatus,
    Map<String, int>? variantStocks,
    List<ProductVariant>? variants,
    bool seedVariantInventory = false,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.dio.post(
        '/vendors/$vendorId/listings',
        data: {
          'vendorId': vendorId,
          'productId': productId,
          'listingTitle': listingTitle.trim(),
          'availableQuantity': availableQuantity,
          'listingStatus': listingStatus,
        },
      );
      if (response.data is! Map) {
        _error = 'Unexpected response while creating listing.';
        return null;
      }
      final created = Map<String, dynamic>.from(response.data as Map);
      final listingId = created['id']?.toString() ?? '';
      if (listingId.isEmpty) {
        _error = 'Listing created but id was missing.';
        return null;
      }

      if (seedVariantInventory &&
          variants != null &&
          variants.isNotEmpty &&
          variantStocks != null) {
        await _api.dio.put(
          '/vendors/$vendorId/listings/$listingId/variant-inventory',
          data: {
            'items': variants
                .where((v) => (v.id ?? '').isNotEmpty)
                .map(
                  (v) => {
                    'productVariantId': v.id,
                    'totalQuantity': variantStocks[v.id] ?? 0,
                  },
                )
                .toList(),
          },
        );
      }

      await fetchCatalog(vendorId, silent: true);
      return listingId;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to create listing.');
      return null;
    } catch (_) {
      _error = 'Failed to create listing.';
      return null;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  /// Edit chemical stock per packaging size (Inventory web parity).
  Future<bool> updateChemicalVariantStock({
    required String vendorId,
    required String listingId,
    required int previousTotal,
    required List<ChemicalVariantStockRow> rows,
  }) async {
    if (rows.isEmpty) {
      _error =
          'No packaging sizes found. Ask Admin to add sizes (e.g. 1L, 5L) for this chemical.';
      notifyListeners();
      return false;
    }

    for (final row in rows) {
      if (row.reserved > row.total) {
        _error = 'Reserved cannot exceed total for ${row.sizeLabel}.';
        notifyListeners();
        return false;
      }
    }

    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.put(
        '/vendors/$vendorId/listings/$listingId/variant-inventory',
        data: {
          'items': rows
              .map(
                (row) => {
                  'productVariantId': row.productVariantId,
                  'totalQuantity': row.total,
                },
              )
              .toList(),
        },
      );

      final nextTotal = rows.fold<int>(0, (sum, row) => sum + row.total);
      final totalDiff = nextTotal - previousTotal;
      if (totalDiff != 0) {
        await _api.dio.post(
          '/vendors/$vendorId/listings/$listingId/inventory/movements',
          data: {
            'vendorId': vendorId,
            'listingId': listingId,
            'movementType': totalDiff > 0 ? 'stock_added' : 'stock_removed',
            'quantity': totalDiff.abs(),
            'referenceType': 'manual_correction',
            'notes': 'Chemical packaging stock updated via Inventory',
          },
        );
      }

      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update chemical stock.');
      return false;
    } catch (_) {
      _error = 'Failed to update chemical stock.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> updateListing({
    required String vendorId,
    required VendorListingRow row,
    required String listingTitle,
    required ListingUiStatus status,
    required int availableQuantity,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.put(
        '/vendors/$vendorId/listings/${row.listing.id}',
        data: {
          'vendorId': vendorId,
          'listingId': row.listing.id,
          'productId': row.listing.productId,
          'listingTitle': listingTitle.trim(),
          'availableQuantity': availableQuantity,
          'listingStatus': listingStatusToApi(status),
        },
      );
      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update listing.');
      return false;
    } catch (_) {
      _error = 'Failed to update listing.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteListing({
    required String vendorId,
    required String listingId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete('/vendors/$vendorId/listings/$listingId');
      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to delete listing.');
      return false;
    } catch (_) {
      _error = 'Failed to delete listing.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<({String imageUrl, String? thumbnailUrl})?> uploadProductImageFile({
    required String vendorId,
    required PlatformFile file,
  }) async {
    _error = null;
    try {
      final multipart = await multipartFromPlatformFile(file);
      if (multipart == null) {
        _error = kIsWeb
            ? 'Could not read the selected image in the browser. Try again or use a smaller photo.'
            : 'Could not read the selected image.';
        notifyListeners();
        return null;
      }

      final formData = FormData.fromMap({
        'vendorId': vendorId,
        'folderType': 'ProductImages',
        'file': multipart,
      });
      final response = await _api.dio.post(
        '/files/upload',
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      if (response.data is! Map) {
        _error = 'Upload failed.';
        notifyListeners();
        return null;
      }
      final map = Map<String, dynamic>.from(response.data as Map);
      final imageUrl =
          (map['storageKey']?.toString().trim().isNotEmpty == true
                  ? map['storageKey']?.toString()
                  : null) ??
              map['fileUrl']?.toString();
      if (imageUrl == null || imageUrl.trim().isEmpty) {
        _error = 'Upload failed — no file URL returned.';
        notifyListeners();
        return null;
      }
      final thumb =
          (map['thumbnailStorageKey']?.toString().trim().isNotEmpty == true
                  ? map['thumbnailStorageKey']?.toString()
                  : null) ??
              map['thumbnailUrl']?.toString();
      return (
        imageUrl: imageUrl.trim(),
        thumbnailUrl: (thumb != null && thumb.trim().isNotEmpty) ? thumb.trim() : null,
      );
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to upload image.');
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Failed to upload image.';
      notifyListeners();
      return null;
    }
  }

  Future<bool> addListingImage({
    required String vendorId,
    required String listingId,
    required String imageUrl,
    required int displayOrder,
    required bool isPrimary,
    String? thumbnailUrl,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(
        '/vendors/$vendorId/listings/$listingId/images',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'imageUrl': imageUrl,
          'displayOrder': displayOrder,
          'isPrimary': isPrimary,
          if (thumbnailUrl != null && thumbnailUrl.isNotEmpty) 'thumbnailUrl': thumbnailUrl,
        },
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to add image.');
      return false;
    } catch (_) {
      _error = 'Failed to add image.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteListingImage({
    required String vendorId,
    required String listingId,
    required String imageId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete(
        '/vendors/$vendorId/listings/$listingId/images/$imageId',
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to delete image.');
      return false;
    } catch (_) {
      _error = 'Failed to delete image.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<List<VendorListingDocument>> fetchListingDocuments(
    String vendorId,
    String listingId,
  ) async {
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/listings/$listingId/documents',
      );
      final data = response.data;
      final list = data is List ? data : <dynamic>[];
      return list
          .whereType<Map>()
          .map((e) => VendorListingDocument.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load documents.');
      return const [];
    } catch (_) {
      _error = 'Failed to load documents.';
      return const [];
    }
  }

  Future<({String fileUrl})?> uploadListingDocumentFile({
    required String vendorId,
    required PlatformFile file,
  }) async {
    _error = null;
    try {
      final multipart = await multipartFromPlatformFile(file);
      if (multipart == null) {
        _error = kIsWeb
            ? 'Could not read the selected file in the browser. Try again or use a smaller file.'
            : 'Could not read the selected file.';
        notifyListeners();
        return null;
      }
      final formData = FormData.fromMap({
        'vendorId': vendorId,
        'folderType': 'ProductDocuments',
        'file': multipart,
      });
      final response = await _api.dio.post(
        '/files/upload',
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      if (response.data is! Map) {
        _error = 'Upload failed.';
        notifyListeners();
        return null;
      }
      final map = Map<String, dynamic>.from(response.data as Map);
      final fileUrl =
          (map['storageKey']?.toString().trim().isNotEmpty == true
                  ? map['storageKey']?.toString()
                  : null) ??
              map['fileUrl']?.toString();
      if (fileUrl == null || fileUrl.trim().isEmpty) {
        _error = 'Upload failed — no file URL returned.';
        notifyListeners();
        return null;
      }
      return (fileUrl: fileUrl.trim());
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to upload document.');
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Failed to upload document.';
      notifyListeners();
      return null;
    }
  }

  Future<bool> addListingDocument({
    required String vendorId,
    required String listingId,
    required String documentType,
    required String fileUrl,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(
        '/vendors/$vendorId/listings/$listingId/documents',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'documentType': documentType,
          'fileUrl': fileUrl,
        },
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to add document.');
      return false;
    } catch (_) {
      _error = 'Failed to add document.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteListingDocument({
    required String vendorId,
    required String listingId,
    required String documentId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete(
        '/vendors/$vendorId/listings/$listingId/documents/$documentId',
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to delete document.');
      return false;
    } catch (_) {
      _error = 'Failed to delete document.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> setListingImagePrimary({
    required String vendorId,
    required String listingId,
    required String imageId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final images = await fetchListingImages(vendorId, listingId);
      if (images.isEmpty) return false;

      final target = images.where((i) => i.id == imageId).firstOrNull;
      if (target == null) return false;
      final targetUrl = target.imageUrl;

      final sorted = [...images]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      for (final img in sorted) {
        await _api.dio.delete(
          '/vendors/$vendorId/listings/$listingId/images/${img.id}',
        );
      }

      for (var i = 0; i < sorted.length; i++) {
        final img = sorted[i];
        await _api.dio.post(
          '/vendors/$vendorId/listings/$listingId/images',
          data: {
            'vendorId': vendorId,
            'listingId': listingId,
            'imageUrl': img.imageUrl,
            'displayOrder': i + 1,
            'isPrimary': img.imageUrl == targetUrl,
          },
        );
      }
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update primary image.');
      return false;
    } catch (_) {
      _error = 'Failed to update primary image.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> upsertEquipmentInventory({
    required String vendorId,
    required String listingId,
    required InventoryRecord previous,
    required int total,
    required int reserved,
    required int rented,
    required int blocked,
  }) async {
    if (reserved > total) {
      _error = 'Reserved cannot exceed total stock.';
      notifyListeners();
      return false;
    }
    if (rented > total - reserved) {
      _error = 'Not enough stock available for rented items.';
      notifyListeners();
      return false;
    }
    if (blocked > total - reserved - rented) {
      _error = 'Not enough stock available for blocked items.';
      notifyListeners();
      return false;
    }

    final cappedReserved = reserved.clamp(0, total);
    final cappedRented = rented.clamp(0, total - cappedReserved);
    final cappedBlocked = blocked.clamp(0, total - cappedReserved - cappedRented);
    final available = (total - cappedReserved - cappedRented - cappedBlocked).clamp(0, 1 << 30);

    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.put(
        '/vendors/$vendorId/listings/$listingId/inventory',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'totalQuantity': total,
          'availableQuantity': available,
          'reservedQuantity': cappedReserved,
          'rentedQuantity': cappedRented,
          'blockedQuantity': cappedBlocked,
        },
      );

      final movements = <Future<void>>[];
      final totalDiff = total - previous.total;
      if (totalDiff != 0) {
        movements.add(_postMovement(
          vendorId: vendorId,
          listingId: listingId,
          movementType: totalDiff > 0 ? 'stock_added' : 'stock_removed',
          quantity: totalDiff.abs(),
          notes: totalDiff > 0
              ? 'Total quantity increased via edit'
              : 'Total quantity decreased via edit',
        ));
      }

      final reservedDiff = cappedReserved - previous.reserved;
      if (reservedDiff != 0) {
        movements.add(_postMovement(
          vendorId: vendorId,
          listingId: listingId,
          movementType: reservedDiff > 0 ? 'reserved' : 'reservation_released',
          quantity: reservedDiff.abs(),
          notes: reservedDiff > 0
              ? 'Reserved quantity increased via edit'
              : 'Reserved quantity decreased via edit',
        ));
      }

      final rentedDiff = cappedRented - previous.rented;
      if (rentedDiff != 0) {
        movements.add(_postMovement(
          vendorId: vendorId,
          listingId: listingId,
          movementType: rentedDiff > 0 ? 'rented' : 'returned',
          quantity: rentedDiff.abs(),
          notes: rentedDiff > 0
              ? 'Rented quantity increased via edit'
              : 'Rented quantity decreased via edit',
        ));
      }

      final blockedDiff = cappedBlocked - previous.blocked;
      if (blockedDiff != 0) {
        movements.add(_postMovement(
          vendorId: vendorId,
          listingId: listingId,
          movementType: blockedDiff > 0 ? 'blocked' : 'unblocked',
          quantity: blockedDiff.abs(),
          notes: blockedDiff > 0
              ? 'Blocked quantity increased via edit'
              : 'Blocked quantity decreased via edit',
        ));
      }

      await Future.wait(movements);
      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update inventory.');
      return false;
    } catch (_) {
      _error = 'Failed to update inventory.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<void> _postMovement({
    required String vendorId,
    required String listingId,
    required String movementType,
    required int quantity,
    required String notes,
  }) async {
    await _api.dio.post(
      '/vendors/$vendorId/listings/$listingId/inventory/movements',
      data: {
        'vendorId': vendorId,
        'listingId': listingId,
        'movementType': movementType,
        'quantity': quantity,
        'referenceType': 'manual_correction',
        'notes': notes,
      },
    );
  }

  Future<List<VendorProductAsset>> fetchListingAssets(
    String vendorId,
    String listingId,
  ) async {
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/listings/$listingId/assets',
      );
      return _parseList(response.data)
          .map((e) => VendorProductAsset.fromJson(e))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<bool> addListingAsset({
    required String vendorId,
    required String listingId,
    required String assetTag,
    String? condition,
    String? productVariantId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(
        '/vendors/$vendorId/listings/$listingId/assets',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'assetTag': assetTag.trim(),
          'status': 'Available',
          if (condition != null && condition.trim().isNotEmpty)
            'condition': condition.trim(),
          if (productVariantId != null && productVariantId.isNotEmpty)
            'productVariantId': productVariantId,
        },
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to add serial number.');
      return false;
    } catch (_) {
      _error = 'Failed to add serial number.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteListingAsset({
    required String vendorId,
    required String listingId,
    required String assetId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete(
        '/vendors/$vendorId/listings/$listingId/assets/$assetId',
      );
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to remove serial number.');
      return false;
    } catch (_) {
      _error = 'Failed to remove serial number.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<TrackedAsset?> trackAsset({
    required String vendorId,
    required String assetTag,
  }) async {
    _error = null;
    notifyListeners();
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/inventory/assets/track',
        queryParameters: {'tag': assetTag.trim()},
      );
      if (response.data is! Map) return null;
      return TrackedAsset.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        _error = 'Serial number not found.';
      } else {
        _error = _dioMessage(e, 'Failed to track serial number.');
      }
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Failed to track serial number.';
      notifyListeners();
      return null;
    }
  }

  Future<bool> updateListingStatus({
    required String vendorId,
    required VendorListingRow row,
    required ListingUiStatus newStatus,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.put(
        '/vendors/$vendorId/listings/${row.listing.id}',
        data: {
          'vendorId': vendorId,
          'listingId': row.listing.id,
          'productId': row.listing.productId,
          'listingTitle': row.listing.listingTitle,
          'availableQuantity': row.listing.availableQuantity,
          'listingStatus': listingStatusToApi(newStatus),
        },
      );
      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update listing status.');
      return false;
    } catch (_) {
      _error = 'Failed to update listing status.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> adjustEquipmentStock({
    required String vendorId,
    required String listingId,
    required bool stockIn,
    required int quantity,
  }) async {
    if (quantity <= 0) {
      _error = 'Enter a quantity greater than zero.';
      notifyListeners();
      return false;
    }

    _saving = true;
    _error = null;
    notifyListeners();
    try {
      VendorInventorySnapshot current = _inventoryByListing[listingId] ??
          const VendorInventorySnapshot(listingId: '');

      if (current.listingId.isEmpty) {
        final listing = _listings.firstWhere((l) => l.id == listingId);
        final response = await _api.dio.put(
          '/vendors/$vendorId/listings/$listingId/inventory',
          data: {
            'vendorId': vendorId,
            'listingId': listingId,
            'totalQuantity': listing.availableQuantity,
            'availableQuantity': listing.availableQuantity,
            'reservedQuantity': 0,
            'rentedQuantity': 0,
            'blockedQuantity': 0,
          },
        );
        if (response.data is Map) {
          final map = Map<String, dynamic>.from(response.data as Map);
          current = VendorInventorySnapshot(
            listingId: listingId,
            total: _toInt(map['totalQuantity']),
            available: _toInt(map['availableQuantity']),
            reserved: _toInt(map['reservedQuantity']),
            rented: _toInt(map['rentedQuantity']),
            blocked: _toInt(map['blockedQuantity']),
          );
        }
      }

      final delta = stockIn ? quantity : -quantity;
      final newTotal = (current.total + delta).clamp(0, 1 << 30);
      final newAvailable = (current.available + delta).clamp(0, 1 << 30);

      await _api.dio.put(
        '/vendors/$vendorId/listings/$listingId/inventory',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'totalQuantity': newTotal,
          'availableQuantity': newAvailable,
          'reservedQuantity': current.reserved,
          'rentedQuantity': current.rented,
          'blockedQuantity': current.blocked,
        },
      );

      await _api.dio.post(
        '/vendors/$vendorId/listings/$listingId/inventory/movements',
        data: {
          'vendorId': vendorId,
          'listingId': listingId,
          'movementType': stockIn ? 'stock_added' : 'stock_removed',
          'quantity': quantity,
          'referenceType': 'manual_adjustment',
          'notes': stockIn ? 'Stock added via mobile' : 'Stock removed via mobile',
        },
      );

      await fetchCatalog(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update stock.');
      return false;
    } catch (_) {
      _error = 'Failed to update stock.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<List<InventoryRecord>> _buildInventoryRecords({
    required String vendorId,
    required Map<String, CatalogProduct> productById,
  }) async {
    final rows = <InventoryRecord>[];
    for (final listing in _listings) {
      final product = productById[listing.productId];
      final baseName =
          '${listing.listingTitle}${product != null ? ' (${product.productName})' : ''}';
      final isChemical = _listingRows
          .where((r) => r.listing.id == listing.id)
          .map((r) => r.isChemical)
          .firstOrNull ?? false;

      if (isChemical) {
        final variantRows = _variantInventoryByListing[listing.id] ?? const [];
        if (variantRows.isNotEmpty) {
          rows.add(
            InventoryRecord(
              listingId: listing.id,
              catalogProductId: listing.productId,
              isChemical: true,
              productName: baseName,
              total: variantRows.fold(0, (s, r) => s + r.totalQuantity),
              available:
                  variantRows.fold(0, (s, r) => s + r.availableQuantity),
              reserved: variantRows.fold(0, (s, r) => s + r.reservedQuantity),
              rented: 0,
              blocked: _inventoryByListing[listing.id]?.blocked ?? 0,
            ),
          );
          continue;
        }
      }

      final inv = _inventoryByListing[listing.id];
      if (inv != null) {
        rows.add(
          InventoryRecord(
            listingId: listing.id,
            catalogProductId: listing.productId,
            isChemical: isChemical,
            productName: baseName,
            total: inv.total,
            available: inv.available,
            reserved: inv.reserved,
            rented: inv.rented,
            blocked: inv.blocked,
          ),
        );
        continue;
      }

      try {
        final response = await _api.dio.put(
          '/vendors/$vendorId/listings/${listing.id}/inventory',
          data: {
            'vendorId': vendorId,
            'listingId': listing.id,
            'totalQuantity': listing.availableQuantity,
            'availableQuantity': listing.availableQuantity,
            'reservedQuantity': 0,
            'rentedQuantity': 0,
            'blockedQuantity': 0,
          },
        );
        if (response.data is Map) {
          final map = Map<String, dynamic>.from(response.data as Map);
          rows.add(
            InventoryRecord(
              listingId: listing.id,
              catalogProductId: listing.productId,
              isChemical: isChemical,
              productName: baseName,
              total: _toInt(map['totalQuantity']),
              available: _toInt(map['availableQuantity']),
              reserved: _toInt(map['reservedQuantity']),
              rented: _toInt(map['rentedQuantity']),
              blocked: _toInt(map['blockedQuantity']),
            ),
          );
        }
      } catch (_) {
        rows.add(
          InventoryRecord(
            listingId: listing.id,
            catalogProductId: listing.productId,
            isChemical: isChemical,
            productName: baseName,
            total: listing.availableQuantity,
            available: listing.availableQuantity,
          ),
        );
      }
    }
    return rows;
  }

  Future<List<InventoryMovement>> _loadAllMovements(
    String vendorId,
    Map<String, CatalogProduct> productById,
  ) async {
    final all = <InventoryMovement>[];
    for (final listing in _listings) {
      final product = productById[listing.productId];
      final productName =
          '${listing.listingTitle}${product != null ? ' (${product.productName})' : ''}';
      final rows = await fetchMovementsForListing(
        vendorId,
        listing.id,
        productName,
      );
      all.addAll(rows);
    }
    all.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return all;
  }

  bool _isChemicalListing(
    VendorProductListing listing,
    CatalogProduct? product,
    VendorCategory? category,
  ) {
    return listing.isChemical ||
        category?.isChemical == true ||
        product?.isChemicalProduct == true;
  }

  List<Map<String, dynamic>> _parseList(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  String _dioMessage(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['title'];
      if (detail != null && detail.toString().trim().isNotEmpty) {
        return detail.toString();
      }
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return 'Cannot reach API. Check network / base URL.';
    }
    return fallback;
  }
}

class InventoryTotals {
  final int total;
  final int available;
  final int reserved;
  final int rented;
  final int blocked;

  const InventoryTotals({
    required this.total,
    required this.available,
    required this.reserved,
    required this.rented,
    required this.blocked,
  });
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
