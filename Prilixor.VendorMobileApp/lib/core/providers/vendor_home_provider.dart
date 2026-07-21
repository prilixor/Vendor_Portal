import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_notification_model.dart';

class DashboardTopListing {
  final String id;
  final String title;
  final String category;
  final double dailyRent;
  final int stock;

  const DashboardTopListing({
    required this.id,
    required this.title,
    required this.category,
    required this.dailyRent,
    required this.stock,
  });
}

class VendorHomeProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  bool get loading => _loading;

  String? _error;
  String? get error => _error;

  String _businessName = '';
  String get businessName => _businessName;

  bool _isVerified = false;
  bool get isVerified => _isVerified;

  String _verificationMessage = 'Complete your onboarding verifications.';
  String get verificationMessage => _verificationMessage;

  int totalListings = 0;
  int activeListings = 0;
  int inventoryUnits = 0;
  int unreadNotifications = 0;
  int pendingRequests = 0;
  int confirmedOrders = 0;
  int inTransitOrders = 0;
  int dueReturns = 0;

  List<VendorNotification> _recentActivity = [];
  List<VendorNotification> get recentActivity => _recentActivity;

  List<DashboardTopListing> _topListings = [];
  List<DashboardTopListing> get topListings => _topListings;

  Future<void> loadDashboard(String vendorId) async {
    if (vendorId.isEmpty) return;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.dio.get('/vendors/$vendorId/profile'),
        _api.dio.get('/vendors/$vendorId/documents'),
        _api.dio.get('/vendors/$vendorId/bank-accounts'),
        _api.dio.get('/vendors/$vendorId/listings'),
        _api.dio.get('/vendors/$vendorId/notifications'),
        _api.dio.get('/vendors/catalog/products'),
        _api.dio.get('/vendors/catalog/categories'),
        _api.dio.get('/vendors/$vendorId/dispatch/offers'),
        _api.dio.get('/vendors/$vendorId/orders', queryParameters: {'status': 'confirmed'}),
        _api.dio.get('/vendors/$vendorId/orders', queryParameters: {'status': 'in_transit'}),
        _api.dio.get('/vendors/$vendorId/orders/expirations', queryParameters: {'withinDays': 7}),
      ]);

      if (results[0].data is Map) {
        final profile = Map<String, dynamic>.from(results[0].data as Map);
        _businessName = profile['businessName']?.toString() ?? '';
      }

      final docs = _parseList(results[1].data);
      final banks = _parseList(results[2].data);
      final docsOk = docs.isNotEmpty &&
          docs.every((d) => (d['verificationStatus']?.toString() ?? '').toLowerCase() == 'approved');
      final bankOk = banks.any(
        (b) => (b['verificationStatus']?.toString() ?? '').toLowerCase() == 'approved',
      );
      _isVerified = docsOk && bankOk;
      _verificationMessage = _isVerified
          ? 'Your verification documents and bank details are approved.'
          : 'Complete document and bank verification in Onboarding.';

      final listings = _parseList(results[3].data);
      totalListings = listings.length;
      activeListings = listings.where((l) {
        final s = (l['listingStatus']?.toString() ?? '').toLowerCase();
        return s == 'active' || s == 'approved';
      }).length;

      final notifications = _parseList(results[4].data);
      _recentActivity = notifications
          .map((e) => VendorNotification.fromJson(e))
          .toList()
        ..sort((a, b) {
          final at = a.sentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bt = b.sentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return bt.compareTo(at);
        });
      unreadNotifications =
          _recentActivity.where((n) => n.isUnread).length;
      if (_recentActivity.length > 5) {
        _recentActivity = _recentActivity.sublist(0, 5);
      }

      final products = _parseList(results[5].data);
      final categories = _parseList(results[6].data);
      final productById = {for (final p in products) p['id']?.toString(): p};
      final categoryById = {for (final c in categories) c['id']?.toString(): c};

      // Show dashboard immediately using listing quantities — avoid N+1 inventory waits.
      inventoryUnits = listings.fold<int>(
        0,
        (sum, l) => sum + _toInt(l['availableQuantity']),
      );

      pendingRequests = _parseList(results[7].data).length;
      confirmedOrders = _parseList(results[8].data).length;
      inTransitOrders = _parseList(results[9].data).length;
      dueReturns = _parseList(results[10].data).length;

      final sortedListings = List<Map<String, dynamic>>.from(listings)
        ..sort((a, b) =>
            _toInt(b['availableQuantity']).compareTo(_toInt(a['availableQuantity'])));
      _topListings = sortedListings.take(4).map((l) {
        final product = productById[l['productId']?.toString()];
        final category = product == null
            ? null
            : categoryById[product['categoryId']?.toString()];
        return DashboardTopListing(
          id: l['id']?.toString() ?? '',
          title: l['listingTitle']?.toString() ?? '',
          category: category?['categoryName']?.toString() ?? 'Unknown',
          dailyRent: _toDouble(l['dailyRent']),
          stock: _toInt(l['availableQuantity']),
        );
      }).toList();

      _loading = false;
      notifyListeners();

      // Refine inventory totals in the background (capped) without blocking the UI.
      unawaited(_refineInventoryUnits(vendorId, listings));
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load dashboard.');
      _loading = false;
      notifyListeners();
    } catch (_) {
      _error = 'Failed to load dashboard.';
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _refineInventoryUnits(
    String vendorId,
    List<Map<String, dynamic>> listings,
  ) async {
    var inventorySum = 0;
    final sample = listings.take(12);
    for (final listing in sample) {
      final listingId = listing['id']?.toString() ?? '';
      if (listingId.isEmpty) {
        inventorySum += _toInt(listing['availableQuantity']);
        continue;
      }
      try {
        final invRes =
            await _api.dio.get('/vendors/$vendorId/listings/$listingId/inventory');
        if (invRes.data is Map) {
          final inv = Map<String, dynamic>.from(invRes.data as Map);
          inventorySum += _toInt(inv['totalQuantity']);
          continue;
        }
      } catch (_) {}
      inventorySum += _toInt(listing['availableQuantity']);
    }
    // Include remaining listings by availableQuantity only.
    for (final listing in listings.skip(12)) {
      inventorySum += _toInt(listing['availableQuantity']);
    }
    if (inventorySum == inventoryUnits) return;
    inventoryUnits = inventorySum;
    notifyListeners();
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

  double _toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }

  String _dioMessage(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['title'];
      if (detail != null && detail.toString().trim().isNotEmpty) {
        return detail.toString();
      }
    }
    return fallback;
  }
}
