import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/dispatch_offer_model.dart';
import '../models/expiring_order_model.dart';
import '../models/vendor_order_model.dart';

class VendorOrderProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _offersLoading = false;
  bool get offersLoading => _offersLoading;

  bool _ordersLoading = false;
  bool get ordersLoading => _ordersLoading;

  bool _detailLoading = false;
  bool get detailLoading => _detailLoading;

  bool _actionLoading = false;
  bool get actionLoading => _actionLoading;

  String? _error;
  String? get error => _error;

  String? _workingOrderId;
  String? get workingOrderId => _workingOrderId;

  List<VendorDispatchOffer> _offers = [];
  List<VendorDispatchOffer> get offers => _offers;

  List<VendorOrder> _orders = [];
  List<VendorOrder> get orders => _orders;

  VendorOrder? _selectedOrder;
  VendorOrder? get selectedOrder => _selectedOrder;

  bool _expirationsLoading = false;
  bool get expirationsLoading => _expirationsLoading;

  List<ExpiringOrder> _expirations = [];
  List<ExpiringOrder> get expirations => _expirations;

  List<VendorDispatchOffer> get pendingOffers {
    return _offers.where((o) {
      final s = o.status.trim().toLowerCase();
      return s == 'pending' || s.contains('awaiting');
    }).toList()
      ..sort((a, b) => b.expiresAt.compareTo(a.expiresAt));
  }

  Future<void> fetchOffers(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (!silent) {
      _offersLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/dispatch/offers');
      final data = response.data;
      final list = data is List ? data : <dynamic>[];
      _offers = list
          .whereType<Map>()
          .map((e) => VendorDispatchOffer.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load order requests.');
    } catch (_) {
      _error = 'Failed to load order requests.';
    } finally {
      _offersLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchOrders(String vendorId, {String? status, bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (!silent) {
      _ordersLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/orders',
        queryParameters: {
          if (status != null && status.isNotEmpty && status != 'all')
            'status': status,
        },
      );
      final data = response.data;
      final list = data is List ? data : <dynamic>[];
      _orders = list
          .whereType<Map>()
          .map((e) => VendorOrder.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load orders.');
    } catch (_) {
      _error = 'Failed to load orders.';
    } finally {
      _ordersLoading = false;
      notifyListeners();
    }
  }

  Future<VendorOrder?> fetchOrderDetail(String vendorId, String orderId) async {
    if (vendorId.isEmpty || orderId.isEmpty) return null;
    _detailLoading = true;
    _error = null;
    notifyListeners();
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/orders/$orderId');
      if (response.data is Map) {
        _selectedOrder = VendorOrder.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
        return _selectedOrder;
      }
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load order.');
    } catch (_) {
      _error = 'Failed to load order.';
    } finally {
      _detailLoading = false;
      notifyListeners();
    }
    return null;
  }

  Future<void> fetchExpirations(
    String vendorId, {
    int withinDays = 7,
    bool silent = false,
  }) async {
    if (vendorId.isEmpty) return;
    if (!silent) {
      _expirationsLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/orders/expirations',
        queryParameters: {'withinDays': withinDays},
      );
      final data = response.data;
      final list = data is List ? data : <dynamic>[];
      _expirations = list
          .whereType<Map>()
          .map((e) => ExpiringOrder.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load expirations.');
    } catch (_) {
      _error = 'Failed to load expirations.';
    } finally {
      _expirationsLoading = false;
      notifyListeners();
    }
  }

  Future<bool> acceptOffer(String vendorId, String orderId) async {
    return _respondOffer(vendorId, orderId, accept: true);
  }

  Future<bool> rejectOffer(String vendorId, String orderId) async {
    return _respondOffer(vendorId, orderId, accept: false);
  }

  Future<bool> _respondOffer(
    String vendorId,
    String orderId, {
    required bool accept,
  }) async {
    _workingOrderId = orderId;
    _actionLoading = true;
    _error = null;
    notifyListeners();
    try {
      final action = accept ? 'accept' : 'reject';
      await _api.dio.patch(
        '/vendors/$vendorId/dispatch/orders/$orderId/$action',
        data: {},
      );
      await fetchOffers(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(
        e,
        accept ? 'Failed to accept request.' : 'Failed to reject request.',
      );
      return false;
    } catch (_) {
      _error = accept ? 'Failed to accept request.' : 'Failed to reject request.';
      return false;
    } finally {
      _workingOrderId = null;
      _actionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateOrderStatus(
    String vendorId,
    String orderId,
    String status, {
    List<String>? assetTags,
  }) async {
    _actionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/orders/$orderId/status',
        data: {
          'status': status,
          'assetTags': ?assetTags,
        },
      );
      await fetchOrderDetail(vendorId, orderId);
      await fetchOrders(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to update order status.');
      return false;
    } catch (_) {
      _error = 'Failed to update order status.';
      return false;
    } finally {
      _actionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelAssignedOrder(String vendorId, String orderId) async {
    _actionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/dispatch/orders/$orderId/cancel',
        data: {},
      );
      await fetchOrderDetail(vendorId, orderId);
      await fetchOrders(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to cancel order.');
      return false;
    } catch (_) {
      _error = 'Failed to cancel order.';
      return false;
    } finally {
      _actionLoading = false;
      notifyListeners();
    }
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
