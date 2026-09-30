import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_notification_model.dart';
import '../utils/paged_json.dart';

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
      final response = await _api.dio.get('/vendors/$vendorId/dashboard/summary');
      if (response.statusCode == 200) {
        final body = asJsonMap(response.data) ?? {};
        final fromApi = body['businessName']?.toString().trim() ?? '';
        if (fromApi.isNotEmpty) _businessName = fromApi;
        _isVerified = body['isVerified'] == true;
        final verification = body['verificationMessage']?.toString().trim() ?? '';
        if (verification.isNotEmpty) _verificationMessage = verification;
        totalListings = asJsonInt(body['totalListings']);
        activeListings = asJsonInt(body['activeListings']);
        inventoryUnits = asJsonInt(body['inventoryUnits']);
        unreadNotifications = asJsonInt(body['unreadNotifications']);
        pendingRequests = asJsonInt(body['pendingRequestsCount']);
        confirmedOrders = asJsonInt(body['confirmedOrdersCount']);
        inTransitOrders = asJsonInt(body['inTransitOrdersCount']);
        dueReturns = asJsonInt(body['dueReturnsCount']);
        _recentActivity = asJsonList(body['recentActivity'])
            .whereType<Map>()
            .map((raw) {
              final json = Map<String, dynamic>.from(raw);
              final read = json['read'] == true;
              return VendorNotification(
                id: json['id']?.toString() ?? '',
                vendorId: vendorId,
                notificationType: json['notificationType']?.toString() ?? '',
                title: json['title']?.toString() ?? '',
                message: json['message']?.toString() ?? '',
                channel: 'in_app',
                status: read ? 'read' : 'unread',
                sentAt: DateTime.tryParse(json['timestamp']?.toString() ?? ''),
                readAt: read
                    ? DateTime.tryParse(json['timestamp']?.toString() ?? '')
                    : null,
              );
            })
            .toList();
        _topListings = asJsonList(body['topListings']).whereType<Map>().map((raw) {
          final json = Map<String, dynamic>.from(raw);
          return DashboardTopListing(
            id: json['id']?.toString() ?? '',
            title: json['title']?.toString() ?? '',
            category: json['category']?.toString() ?? 'Listing',
            dailyRent: asJsonDouble(json['dailyRent']),
            stock: asJsonInt(json['stock']),
          );
        }).toList();
      }
      _loading = false;
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
