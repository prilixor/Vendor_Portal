import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/dispatch_offer_model.dart';
import '../models/expiring_order_model.dart';
import '../models/order_continuations_model.dart';
import '../models/order_image_model.dart';
import '../models/prescription_file_model.dart';
import '../models/vendor_order_model.dart';
import '../utils/multipart_file_util.dart';
import '../utils/paged_json.dart';

class VendorOrderProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  static const orderPageSize = 8;
  static const offerPageSize = 8;
  static const expirationPageSize = 8;

  bool _offersLoading = false;
  bool get offersLoading => _offersLoading;

  bool _offersLoadingMore = false;
  bool get offersLoadingMore => _offersLoadingMore;

  bool _ordersLoading = false;
  bool get ordersLoading => _ordersLoading;

  bool _ordersLoadingMore = false;
  bool get ordersLoadingMore => _ordersLoadingMore;

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

  List<VendorOrder> _orderGroup = [];
  List<VendorOrder> get orderGroup => _orderGroup;

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

  List<PrescriptionFileModel> _prescriptionFiles = [];
  List<PrescriptionFileModel> get prescriptionFiles => List.unmodifiable(_prescriptionFiles);
  bool _prescriptionLoading = false;
  bool get prescriptionLoading => _prescriptionLoading;

  /// Open photo requests across an order group: orderId -> photo count.
  final Map<String, int> _groupPhotoCounts = {};
  Map<String, int> get groupPhotoCounts => Map.unmodifiable(_groupPhotoCounts);

  int? groupPhotoCountFor(String orderId) => _groupPhotoCounts[orderId];

  bool _expirationsLoading = false;
  bool get expirationsLoading => _expirationsLoading;

  bool _expirationsLoadingMore = false;
  bool get expirationsLoadingMore => _expirationsLoadingMore;

  List<ExpiringOrder> _expirations = [];
  List<ExpiringOrder> get expirations => _expirations;

  int _pendingOfferCount = 0;
  int get pendingOfferCount =>
      _pendingOfferCount > 0 ? _pendingOfferCount : pendingOffers.length;

  Map<String, int> _offerTypeCounts = {};
  Map<String, int> get offerTypeCounts => _offerTypeCounts;

  Map<String, int> _orderStatusCounts = {};
  Map<String, int> get orderStatusCounts => _orderStatusCounts;

  int _orderPage = 1;
  int _orderTotalCount = 0;
  int get orderTotalCount => _orderTotalCount;
  bool get hasMoreOrders => _orders.length < _orderTotalCount;
  String? _lastOrderSearch;
  String? _lastOrderStatus;

  int _offerPage = 1;
  int _offerTotalCount = 0;
  bool get hasMoreOffers => _offers.length < _offerTotalCount;
  String? _lastOfferSearch;
  String? _lastOfferType;

  int _expirationPage = 1;
  int _expirationGroupsLoaded = 0;
  int _expirationGroupTotal = 0;
  bool get hasMoreExpirations => _expirationGroupsLoaded < _expirationGroupTotal;
  int _lastWithinDays = 7;
  String? _lastExpirationSearch;

  List<VendorDispatchOffer> get pendingOffers {
    final now = DateTime.now();
    return _offers.where((o) {
      final s = o.status.trim().toLowerCase();
      final open = s == 'pending' || s.contains('awaiting');
      return open && o.expiresAt.isAfter(now);
    }).toList()
      ..sort((a, b) => b.expiresAt.compareTo(a.expiresAt));
  }

  Future<void>? _offersInflight;
  Future<void>? _ordersInflight;
  String? _ordersInflightKey;

  Future<void> fetchPendingOfferCount(String vendorId) async {
    if (vendorId.isEmpty) return;
    try {
      final response =
          await _api.dio.get('/vendors/$vendorId/dispatch/offers/pending-count');
      if (response.statusCode == 200) {
        final map = asJsonMap(response.data);
        _pendingOfferCount =
            asJsonInt(map?['pendingCount'] ?? map?['count'] ?? response.data);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchOffers(
    String vendorId, {
    bool silent = false,
    bool reset = true,
    String? search,
    String? orderType,
  }) async {
    if (vendorId.isEmpty) return;
    if (!reset) {
      if (_offersLoading || _offersLoadingMore || !hasMoreOffers) return;
      _offersLoadingMore = true;
      notifyListeners();
      _offerPage += 1;
    } else {
      if (_offersInflight != null) return _offersInflight!;
      _offersInflight = _fetchOffersInternal(
        vendorId,
        silent: silent,
        reset: true,
        search: search,
        orderType: orderType,
      );
      try {
        await _offersInflight;
      } finally {
        _offersInflight = null;
      }
      return;
    }
    await _fetchOffersInternal(
      vendorId,
      silent: true,
      reset: false,
      search: search,
      orderType: orderType,
    );
  }

  Future<void> _fetchOffersInternal(
    String vendorId, {
    required bool silent,
    required bool reset,
    String? search,
    String? orderType,
  }) async {
    if (reset) {
      _offerPage = 1;
      if (search != null) _lastOfferSearch = search;
      if (orderType != null) _lastOfferType = orderType;
      if (!silent) {
        _offersLoading = true;
        _error = null;
        notifyListeners();
      }
    }
    try {
      final query = <String, dynamic>{
        'page': reset ? 1 : _offerPage,
        'pageSize': offerPageSize,
      };
      final q = (reset ? (search ?? _lastOfferSearch) : _lastOfferSearch)?.trim();
      if (q != null && q.isNotEmpty) query['search'] = q;
      final type = reset ? (orderType ?? _lastOfferType) : _lastOfferType;
      if (type != null && type.isNotEmpty && type != 'all') {
        query['orderType'] = type;
      }
      final response = await _api.dio.get(
        '/vendors/$vendorId/dispatch/offers/summaries',
        queryParameters: query,
      );
      if (response.statusCode == 200) {
        final body = asJsonMap(response.data);
        final rows = asJsonList(body?['items'] ?? response.data)
            .whereType<Map>()
            .map((e) =>
                VendorDispatchOffer.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        _offerTotalCount = asJsonInt(body?['totalCount'], rows.length);
        _pendingOfferCount =
            asJsonInt(body?['pendingCount'], _pendingOfferCount);
        _offerTypeCounts = asJsonIntMap(body?['typeCounts']);
        _offers = reset ? rows : [..._offers, ...rows];
      }
    } on DioException catch (e) {
      if (!reset) _offerPage = (_offerPage - 1).clamp(1, 1 << 20);
      _error = _dioMessage(e, 'Failed to load order requests.');
    } catch (_) {
      if (!reset) _offerPage = (_offerPage - 1).clamp(1, 1 << 20);
      _error = 'Failed to load order requests.';
    } finally {
      _offersLoading = false;
      _offersLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> fetchOrders(
    String vendorId, {
    String? status,
    String? search,
    bool silent = false,
    bool reset = true,
  }) async {
    if (vendorId.isEmpty) return;
    if (!reset) {
      if (_ordersLoading || _ordersLoadingMore || !hasMoreOrders) return;
      _ordersLoadingMore = true;
      notifyListeners();
      _orderPage += 1;
      await _fetchOrdersInternal(
        vendorId,
        status: status,
        search: search,
        silent: true,
        reset: false,
      );
      return;
    }
    final key = '$vendorId|${status ?? 'all'}|${search ?? ''}';
    if (_ordersInflight != null && _ordersInflightKey == key) {
      return _ordersInflight!;
    }
    _ordersInflightKey = key;
    _ordersInflight = _fetchOrdersInternal(
      vendorId,
      status: status,
      search: search,
      silent: silent,
      reset: true,
    );
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
    String? search,
    required bool silent,
    required bool reset,
  }) async {
    if (reset) {
      _orderPage = 1;
      if (search != null) _lastOrderSearch = search;
      if (status != null) _lastOrderStatus = status;
      if (!silent) {
        _ordersLoading = true;
        _error = null;
        notifyListeners();
      }
    }
    try {
      final query = <String, dynamic>{
        'page': reset ? 1 : _orderPage,
        'pageSize': orderPageSize,
      };
      final q = (reset ? (search ?? _lastOrderSearch) : _lastOrderSearch)?.trim();
      if (q != null && q.isNotEmpty) query['search'] = q;
      final st = reset ? (status ?? _lastOrderStatus) : _lastOrderStatus;
      if (st != null && st.isNotEmpty && st != 'all') query['status'] = st;

      final response = await _api.dio.get(
        '/vendors/$vendorId/orders/summaries',
        queryParameters: query,
      );
      if (response.statusCode == 200) {
        final body = asJsonMap(response.data);
        final rows = asJsonList(body?['items'] ?? response.data)
            .whereType<Map>()
            .map((e) => VendorOrder.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        _orderTotalCount = asJsonInt(body?['totalCount'], rows.length);
        _orderStatusCounts = asJsonIntMap(body?['statusCounts']);
        _orders = reset ? rows : [..._orders, ...rows];
      }
    } on DioException catch (e) {
      if (!reset) _orderPage = (_orderPage - 1).clamp(1, 1 << 20);
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
      if (!reset) _orderPage = (_orderPage - 1).clamp(1, 1 << 20);
      if (!silent || _orders.isEmpty) {
        _error = 'Failed to load orders.';
      }
    } finally {
      _ordersLoading = false;
      _ordersLoadingMore = false;
      notifyListeners();
    }
  }

  Future<List<VendorOrder>> fetchOrderGroup(
    String vendorId,
    String orderId,
  ) async {
    if (vendorId.isEmpty || orderId.isEmpty) return const [];
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/orders/${Uri.encodeComponent(orderId)}/group',
      );
      if (response.statusCode == 200) {
        _orderGroup = asJsonList(response.data)
            .whereType<Map>()
            .map((e) => VendorOrder.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        notifyListeners();
        return _orderGroup;
      }
    } catch (e) {
      debugPrint('vendor order group failed: $e');
    }
    return const [];
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
          fetchOrderPrescriptions(vendorId, orderId, silent: true),
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

  Future<void> fetchOrderPrescriptions(
    String vendorId,
    String orderId, {
    bool silent = false,
  }) async {
    if (vendorId.isEmpty || orderId.isEmpty) return;
    if (!silent) {
      _prescriptionLoading = true;
      notifyListeners();
    }
    try {
      final response = await _api.dio.get(
        '/vendors/$vendorId/orders/$orderId/prescriptions',
      );
      final data = response.data;
      final list = data is List
          ? data
          : (data is Map && data['items'] is List ? data['items'] as List : const []);
      _prescriptionFiles = list
          .whereType<Map>()
          .map((e) => PrescriptionFileModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      if (!silent) _prescriptionFiles = [];
    } finally {
      _prescriptionLoading = false;
      notifyListeners();
    }
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
        final parsed =
            OrderImageRequest.fromJson(Map<String, dynamic>.from(data));
        final previous = _imageRequest;
        _imageRequest = previous == null ? parsed : reuseOrderImageUrls(previous, parsed);
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
    required String optionId,
    required PlatformFile file,
    int? slotIndex,
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
      final query = StringBuffer('optionId=${Uri.encodeComponent(optionId)}');
      if (slotIndex != null) query.write('&slotIndex=$slotIndex');
      final formData = FormData.fromMap({
        'file': multipart,
        'optionId': optionId,
        if (slotIndex != null) 'slotIndex': slotIndex,
      });
      await _api.dio.post(
        '/vendors/$vendorId/orders/$orderId/images?$query',
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

  Future<bool> updateOrderImageOptionDescription({
    required String vendorId,
    required String orderId,
    required String optionId,
    required String description,
  }) async {
    _error = null;
    try {
      final data = await _api.dio.patch(
        '/vendors/$vendorId/orders/$orderId/image-options/$optionId',
        data: {'description': description},
      );
      if (data.data is Map) {
        _imageRequest =
            OrderImageRequest.fromJson(Map<String, dynamic>.from(data.data as Map));
      } else {
        await fetchOrderImageRequest(vendorId, orderId, silent: true);
      }
      notifyListeners();
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to save description.');
      notifyListeners();
      return false;
    } catch (_) {
      _error = 'Failed to save description.';
      notifyListeners();
      return false;
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
    String? search,
    bool silent = false,
    bool reset = true,
  }) async {
    if (vendorId.isEmpty) return;
    if (!reset) {
      if (_expirationsLoading || _expirationsLoadingMore || !hasMoreExpirations) {
        return;
      }
      _expirationsLoadingMore = true;
      notifyListeners();
      _expirationPage += 1;
    } else {
      _expirationPage = 1;
      _lastWithinDays = withinDays;
      if (search != null) _lastExpirationSearch = search;
      if (!silent) {
        _expirationsLoading = true;
        _error = null;
        notifyListeners();
      }
    }
    try {
      final query = <String, dynamic>{
        'withinDays': reset ? withinDays : _lastWithinDays,
        'page': reset ? 1 : _expirationPage,
        'pageSize': expirationPageSize,
      };
      final q =
          (reset ? (search ?? _lastExpirationSearch) : _lastExpirationSearch)
              ?.trim();
      if (q != null && q.isNotEmpty) query['search'] = q;
      final response = await _api.dio.get(
        '/vendors/$vendorId/orders/expirations/summaries',
        queryParameters: query,
      );
      if (response.statusCode == 200) {
        final body = asJsonMap(response.data);
        final groups = asJsonList(body?['items'] ?? response.data);
        final rows = <ExpiringOrder>[];
        for (final group in groups.whereType<Map>()) {
          final map = Map<String, dynamic>.from(group);
          for (final item in asJsonList(map['items']).whereType<Map>()) {
            rows.add(ExpiringOrder.fromJson(Map<String, dynamic>.from(item)));
          }
        }
        final groupCount = groups.length;
        _expirationGroupTotal = asJsonInt(body?['totalCount'], groupCount);
        _expirationGroupsLoaded =
            reset ? groupCount : _expirationGroupsLoaded + groupCount;
        _expirations = reset ? rows : [..._expirations, ...rows];
      }
    } on DioException catch (e) {
      if (!reset) _expirationPage = (_expirationPage - 1).clamp(1, 1 << 20);
      _error = _dioMessage(e, 'Failed to load expirations.');
    } catch (_) {
      if (!reset) _expirationPage = (_expirationPage - 1).clamp(1, 1 << 20);
      _error = 'Failed to load expirations.';
    } finally {
      _expirationsLoading = false;
      _expirationsLoadingMore = false;
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
