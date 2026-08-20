import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/dispatch_offer_model.dart';
import '../models/expiring_order_model.dart';
import '../models/order_continuations_model.dart';
import '../models/order_image_model.dart';
import '../models/vendor_order_model.dart';
import '../utils/multipart_file_util.dart';

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

  OrderContinuations _continuations = OrderContinuations.empty;
  OrderContinuations get continuations => _continuations;
  bool get hasPendingContinuations => _continuations.hasPending;

  bool _orderImagesLoading = false;
  bool get orderImagesLoading => _orderImagesLoading;

  OrderImageRequest? _imageRequest;
  OrderImageRequest? get imageRequest => _imageRequest;

  List<OrderImage> get orderImages => _imageRequest?.images ?? const [];

  /// Open photo requests across an order group: orderId -> photo count.
  final Map<String, int> _groupPhotoCounts = {};
  Map<String, int> get groupPhotoCounts => Map.unmodifiable(_groupPhotoCounts);

  int? groupPhotoCountFor(String orderId) => _groupPhotoCounts[orderId];

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

  Future<void>? _offersInflight;
  Future<void>? _ordersInflight;
  String? _ordersInflightKey;

  Future<void> fetchOffers(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (_offersInflight != null) return _offersInflight!;
    _offersInflight = _fetchOffersInternal(vendorId, silent: silent);
    try {
      await _offersInflight;
    } finally {
      _offersInflight = null;
    }
  }

  Future<void> _fetchOffersInternal(String vendorId, {bool silent = false}) async {
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
    final key = '$vendorId|${status ?? 'all'}';
    if (_ordersInflight != null && _ordersInflightKey == key) {
      return _ordersInflight!;
    }
    _ordersInflightKey = key;
    _ordersInflight = _fetchOrdersInternal(vendorId, status: status, silent: silent);
    try {
      await _ordersInflight;
    } finally {
      _ordersInflight = null;
      _ordersInflightKey = null;
    }
  }

  Future<void> _fetchOrdersInternal(
    String vendorId, {
    String? status,
    bool silent = false,
  }) async {
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
      if (e.type == DioExceptionType.cancel ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return;
      }
      if (!silent || _orders.isEmpty) {
        _error = _dioMessage(e, 'Failed to load orders.');
      }
    } catch (_) {
      if (!silent || _orders.isEmpty) {
        _error = 'Failed to load orders.';
      }
    } finally {
      if (!silent) {
        _ordersLoading = false;
      }
      notifyListeners();
    }
  }

  Future<VendorOrder?> fetchOrderDetail(
    String vendorId,
    String orderId, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty || orderId.isEmpty) return null;
    final showLoading = !silent || _selectedOrder == null;
    if (showLoading) {
      _detailLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/orders/$orderId');
      if (response.data is Map) {
        _selectedOrder = VendorOrder.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
        await Future.wait([
          fetchContinuations(orderId, silent: true),
          fetchOrderImageRequest(vendorId, orderId, silent: true),
        ]);
        return _selectedOrder;
      }
      if (!silent) {
        _continuations = OrderContinuations.empty;
        _imageRequest = null;
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return _selectedOrder;
      }
      if (!silent || _selectedOrder == null) {
        _error = _dioMessage(e, 'Failed to load order.');
        _continuations = OrderContinuations.empty;
        _imageRequest = null;
      }
    } catch (_) {
      if (!silent || _selectedOrder == null) {
        _error = 'Failed to load order.';
        _continuations = OrderContinuations.empty;
        _imageRequest = null;
      }
    } finally {
      if (showLoading) {
        _detailLoading = false;
      }
      notifyListeners();
    }
    return null;
  }

  Future<OrderImageRequest?> fetchOrderImageRequest(
    String vendorId,
    String orderId, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty || orderId.isEmpty) {
      _imageRequest = null;
      if (!silent) notifyListeners();
      return null;
    }
    if (!silent) {
      _orderImagesLoading = true;
      notifyListeners();
    }
    try {
      final response = await _api.dio
          .get('/vendors/$vendorId/orders/$orderId/image-request');
      final data = response.data;
      if (data is Map) {
        _imageRequest =
            OrderImageRequest.fromJson(Map<String, dynamic>.from(data));
        _groupPhotoCounts[orderId] = _imageRequest!.images.length;
      } else {
        _imageRequest = null;
        _groupPhotoCounts.remove(orderId);
      }
    } on DioException catch (_) {
      _imageRequest = null;
      _groupPhotoCounts.remove(orderId);
    } catch (_) {
      _imageRequest = null;
      _groupPhotoCounts.remove(orderId);
    } finally {
      _orderImagesLoading = false;
      if (!silent) notifyListeners();
    }
    return _imageRequest;
  }

  /// Loads open photo-request counts for all items in an order group (item-list badges).
  Future<void> fetchGroupPhotoRequestMeta(
    String vendorId,
    List<String> orderIds, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty || orderIds.isEmpty) {
      if (!silent) {
        _groupPhotoCounts.clear();
        notifyListeners();
      }
      return;
    }
    final ids = orderIds.toSet().toList();
    _groupPhotoCounts.removeWhere((key, _) => !ids.contains(key));
    await Future.wait(ids.map((id) async {
      try {
        final response =
            await _api.dio.get('/vendors/$vendorId/orders/$id/image-request');
        final data = response.data;
        if (data is Map) {
          final req =
              OrderImageRequest.fromJson(Map<String, dynamic>.from(data));
          _groupPhotoCounts[id] = req.images.length;
        } else {
          _groupPhotoCounts.remove(id);
        }
      } catch (_) {
        // Keep previous meta for this id if a single lookup fails.
      }
    }));
    notifyListeners();
  }

  Future<bool> uploadOrderImage({
    required String vendorId,
    required String orderId,
    required PlatformFile file,
  }) async {
    _error = null;
    _actionLoading = true;
    notifyListeners();
    try {
      final multipart = await multipartFromPlatformFile(file);
      if (multipart == null) {
        _error = 'Could not read the selected image.';
        return false;
      }
      final formData = FormData.fromMap({'file': multipart});
      await _api.dio.post(
        '/vendors/$vendorId/orders/$orderId/images',
        data: formData,
        options: Options(
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      await fetchOrderImageRequest(vendorId, orderId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to upload photo.');
      return false;
    } catch (_) {
      _error = 'Failed to upload photo.';
      return false;
    } finally {
      _actionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteOrderImage({
    required String vendorId,
    required String orderId,
    required String imageId,
  }) async {
    _error = null;
    _actionLoading = true;
    notifyListeners();
    try {
      await _api.dio.delete('/vendors/$vendorId/orders/$orderId/images/$imageId');
      await fetchOrderImageRequest(vendorId, orderId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to remove photo.');
      return false;
    } catch (_) {
      _error = 'Failed to remove photo.';
      return false;
    } finally {
      _actionLoading = false;
      notifyListeners();
    }
  }

  Future<OrderContinuations> fetchContinuations(
    String orderId, {
    bool silent = false,
  }) async {
    if (orderId.isEmpty) return OrderContinuations.empty;
    try {
      final response =
          await _api.dio.get('/vendors/me/orders/$orderId/continuations');
      if (response.data is Map) {
        _continuations = OrderContinuations.fromJson(
          Map<String, dynamic>.from(response.data as Map),
        );
      } else {
        _continuations = OrderContinuations.empty;
      }
    } on DioException catch (e) {
      if (!silent) {
        _error = _dioMessage(e, 'Failed to load customer requests.');
      }
      _continuations = OrderContinuations.empty;
    } catch (_) {
      if (!silent) _error = 'Failed to load customer requests.';
      _continuations = OrderContinuations.empty;
    }
    if (!silent) notifyListeners();
    return _continuations;
  }

  Future<bool> approveExtension(
    String vendorId,
    String orderId,
    String extensionId,
  ) async {
    return _continuationAction(
      vendorId,
      orderId,
      '/vendors/me/orders/$orderId/extensions/$extensionId/approve',
      'Failed to approve extension.',
    );
  }

  Future<bool> rejectExtension(
    String vendorId,
    String orderId,
    String extensionId,
  ) async {
    return _continuationAction(
      vendorId,
      orderId,
      '/vendors/me/orders/$orderId/extensions/$extensionId/cancel',
      'Failed to reject extension.',
    );
  }

  Future<bool> approveBuyout(
    String vendorId,
    String orderId,
    String buyoutId,
  ) async {
    return _continuationAction(
      vendorId,
      orderId,
      '/vendors/me/orders/$orderId/buyouts/$buyoutId/approve',
      'Failed to approve buyout.',
    );
  }

  Future<bool> rejectBuyout(
    String vendorId,
    String orderId,
    String buyoutId,
  ) async {
    return _continuationAction(
      vendorId,
      orderId,
      '/vendors/me/orders/$orderId/buyouts/$buyoutId/cancel',
      'Failed to reject buyout.',
    );
  }

  Future<bool> _continuationAction(
    String vendorId,
    String orderId,
    String path,
    String fallbackError,
  ) async {
    _workingOrderId = orderId;
    _actionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(path, data: {});
      await fetchOrderDetail(vendorId, orderId);
      await fetchOrders(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, fallbackError);
      return false;
    } catch (_) {
      _error = fallbackError;
      return false;
    } finally {
      _workingOrderId = null;
      _actionLoading = false;
      notifyListeners();
    }
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

  Future<bool> assignOrderAssets(
    String vendorId,
    String orderId,
    List<String> assetTags,
  ) async {
    _actionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.patch(
        '/vendors/$vendorId/orders/$orderId/assets',
        data: {'assetTags': assetTags},
      );
      await fetchOrderDetail(vendorId, orderId);
      await fetchOrders(vendorId, silent: true);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to save serial number.');
      return false;
    } catch (_) {
      _error = 'Failed to save serial number.';
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
