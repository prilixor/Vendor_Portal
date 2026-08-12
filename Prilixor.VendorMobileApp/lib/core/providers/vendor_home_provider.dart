import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_notification_model.dart';

class DashboardTopListing {
  final String id;
  final String title;
  final String category;
  final double dailyRent;
  final double weeklyRent;
  final double monthlyRent;
  final int stock;

  const DashboardTopListing({
    required this.id,
    required this.title,
    required this.category,
    required this.dailyRent,
    this.weeklyRent = 0,
    this.monthlyRent = 0,
    required this.stock,
  });
}

class VendorHomeProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  /// Start true so the first Home frame is a skeleton (avoids empty→skeleton flash).
  bool _loading = true;
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

  Future<void>? _inflightLoad;

  bool get hasSeedData =>
      _businessName.isNotEmpty ||
      totalListings > 0 ||
      _topListings.isNotEmpty ||
      confirmedOrders > 0 ||
      inTransitOrders > 0;

  /// True until the first load attempt finishes (success or failure).
  bool get showInitialSkeleton => _loading && !hasSeedData;

  /// Seed display name from auth so hero isn't blank while profile loads.
  void seedBusinessName(String? name) {
    final trimmed = name?.trim() ?? '';
    if (trimmed.isEmpty || _businessName.isNotEmpty) return;
    _businessName = trimmed;
    notifyListeners();
  }

  Future<void> loadDashboard(String vendorId) async {
    if (vendorId.isEmpty) return;
    if (_inflightLoad != null) return _inflightLoad!;
    _inflightLoad = _loadDashboardInternal(vendorId);
    try {
      await _inflightLoad;
    } finally {
      _inflightLoad = null;
    }
  }

  Future<void> _loadDashboardInternal(String vendorId) async {
    final showSkeleton = !hasSeedData;
    if (showSkeleton) {
      _loading = true;
      _error = null;
      notifyListeners();
    } else {
      _error = null;
    }

    try {
      // Wave 1 — hero + catalog stats (paint ASAP).
      final wave1 = await Future.wait([
        _safeGet('/vendors/$vendorId/profile'),
        _safeGet('/vendors/$vendorId/listings'),
      ]);

      final profileRes = wave1[0];
      if (profileRes?.data is Map) {
        final profile = Map<String, dynamic>.from(profileRes!.data as Map);
        final fromApi = profile['businessName']?.toString().trim() ?? '';
        if (fromApi.isNotEmpty) _businessName = fromApi;
      }

      final listings = _parseList(wave1[1]?.data);
      totalListings = listings.length;
      activeListings = listings.where((l) {
        final s = (l['listingStatus']?.toString() ?? '').toLowerCase();
        return s == 'active' || s == 'approved';
      }).length;
      inventoryUnits = listings.fold<int>(
        0,
        (sum, l) => sum + _toInt(l['availableQuantity']),
      );

      final sortedListings = List<Map<String, dynamic>>.from(listings)
        ..sort((a, b) =>
            _toInt(b['availableQuantity']).compareTo(_toInt(a['availableQuantity'])));
      _topListings = sortedListings.take(4).map((l) {
        final category = l['categoryName']?.toString() ??
            l['productCategory']?.toString() ??
            l['category']?.toString() ??
            'Listing';
        return DashboardTopListing(
          id: l['id']?.toString() ?? '',
          title: l['listingTitle']?.toString() ?? '',
          category: category,
          dailyRent: _toDouble(l['dailyRent']),
          weeklyRent: _toDouble(l['weeklyRent']),
          monthlyRent: _toDouble(l['monthlyRent']),
          stock: _toInt(l['availableQuantity']),
        );
      }).toList();

      // Unblock UI after catalog wave — order counts fill in next.
      _loading = false;
      notifyListeners();

      // Wave 2 — order operation tiles (non-blocking for first paint).
      final wave2 = await Future.wait([
        _safeGet(
          '/vendors/$vendorId/orders',
          query: {'status': 'confirmed'},
        ),
        _safeGet(
          '/vendors/$vendorId/orders',
          query: {'status': 'in_transit'},
        ),
        _safeGet(
          '/vendors/$vendorId/orders/expirations',
          query: {'withinDays': 7},
        ),
      ]);

      confirmedOrders = _parseList(wave2[0]?.data).length;
      inTransitOrders = _parseList(wave2[1]?.data).length;
      dueReturns = _parseList(wave2[2]?.data).length;
      notifyListeners();
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

  void applyVerification({
    required bool isVerified,
    required String message,
  }) {
    if (_isVerified == isVerified && _verificationMessage == message) return;
    _isVerified = isVerified;
    _verificationMessage = message;
    notifyListeners();
  }

  Future<Response?> _safeGet(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      return await _api.dio.get(path, queryParameters: query);
    } catch (_) {
      return null;
    }
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
