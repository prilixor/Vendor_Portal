import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/order_model.dart';
import '../models/order_action_model.dart';
import '../models/order_image_request_model.dart';

class OrderDetailProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  OrderModel? _currentOrder;
  OrderModel? get currentOrder => _currentOrder;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  // Quotes
  ExtensionQuoteModel? _extensionQuote;
  ExtensionQuoteModel? get extensionQuote => _extensionQuote;

  BuyoutQuoteModel? _buyoutQuote;
  BuyoutQuoteModel? get buyoutQuote => _buyoutQuote;

  bool _isActionLoading = false;
  bool get isActionLoading => _isActionLoading;

  bool _imageRequestLoading = false;
  bool get imageRequestLoading => _imageRequestLoading;

  /// Open photo requests keyed by order line item id.
  final Map<String, OrderImageRequestModel> _imageRequestsByOrderId = {};
  Map<String, OrderImageRequestModel> get imageRequestsByOrderId =>
      Map.unmodifiable(_imageRequestsByOrderId);

  OrderImageRequestModel? imageRequestFor(String orderId) =>
      _imageRequestsByOrderId[orderId];

  /// Legacy single-item accessor (selected line).
  OrderImageRequestModel? get imageRequest =>
      _currentOrder == null ? null : _imageRequestsByOrderId[_currentOrder!.id];

  List<OrderImageModel> get orderImages => imageRequest?.images ?? const [];

  Future<void> fetchOrderDetail(String orderId, {bool silent = false}) async {
    final showLoading = !silent || _currentOrder == null;
    if (showLoading) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await _apiClient.dio.get(
        '/customers/me/orders/$orderId',
        queryParameters: {'_': DateTime.now().millisecondsSinceEpoch},
        options: Options(
          headers: const {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        ),
      );
      if (response.statusCode == 200) {
        _currentOrder = OrderModel.fromJson(response.data);
        await fetchImageRequest(orderId, silent: true);
      }
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return;
      }
      if (!silent || _currentOrder == null) {
        _errorMessage = 'Failed to load order: ${e.message}';
      }
    } catch (e) {
      if (!silent || _currentOrder == null) {
        _errorMessage = 'An unexpected error occurred.';
      }
    } finally {
      if (showLoading) {
        _isLoading = false;
      }
      notifyListeners();
    }
  }

  Future<void> fetchGroupImageRequests(
    List<String> orderIds, {
    bool silent = false,
  }) async {
    final ids = orderIds.where((id) => id.isNotEmpty).toSet().toList();
    if (ids.isEmpty) {
      _imageRequestsByOrderId.clear();
      notifyListeners();
      return;
    }
    if (!silent) {
      _imageRequestLoading = true;
      notifyListeners();
    }
    try {
      await Future.wait(ids.map((id) => fetchImageRequest(id, silent: true)));
      _imageRequestsByOrderId.removeWhere((key, _) => !ids.contains(key));
    } finally {
      if (!silent) {
        _imageRequestLoading = false;
      }
      notifyListeners();
    }
  }

  Future<OrderImageRequestModel?> fetchImageRequest(
    String orderId, {
    bool silent = false,
  }) async {
    if (orderId.isEmpty) return null;
    if (!silent) {
      _imageRequestLoading = true;
      notifyListeners();
    }
    try {
      final response =
          await _apiClient.dio.get('/customers/me/orders/$orderId/image-request');
      final data = response.data;
      if (data is Map) {
        _imageRequestsByOrderId[orderId] =
            OrderImageRequestModel.fromJson(Map<String, dynamic>.from(data));
      } else {
        _imageRequestsByOrderId.remove(orderId);
      }
    } on DioException catch (_) {
      _imageRequestsByOrderId.remove(orderId);
    } catch (_) {
      _imageRequestsByOrderId.remove(orderId);
    } finally {
      if (!silent) {
        _imageRequestLoading = false;
        notifyListeners();
      }
    }
    return _imageRequestsByOrderId[orderId];
  }

  Future<bool> createImageRequest(String orderId) async {
    final result = await createImageRequests([orderId]);
    return result.succeeded > 0;
  }

  Future<({int succeeded, int failed})> createImageRequests(
    List<String> orderIds,
  ) async {
    _isActionLoading = true;
    _errorMessage = null;
    notifyListeners();
    var succeeded = 0;
    var failed = 0;
    try {
      for (final orderId in orderIds) {
        try {
          final response = await _apiClient.dio.post(
            '/customers/me/orders/$orderId/image-request',
            data: <String, dynamic>{},
            options: Options(contentType: Headers.jsonContentType),
          );
          if (response.statusCode == 200 && response.data is Map) {
            _imageRequestsByOrderId[orderId] = OrderImageRequestModel.fromJson(
              Map<String, dynamic>.from(response.data as Map),
            );
            succeeded++;
          } else {
            failed++;
          }
        } catch (_) {
          failed++;
        }
      }
      if (succeeded == 0 && failed > 0) {
        _errorMessage = 'Failed to request photos.';
      }
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
    return (succeeded: succeeded, failed: failed);
  }

  Future<bool> cancelOrder(String orderId) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.patch(
        '/customers/me/orders/$orderId/cancel',
        data: <String, dynamic>{},
        options: Options(contentType: Headers.jsonContentType),
      );
      if (response.statusCode == 200) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to cancel order.';
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
    return success;
  }

  Future<void> quoteExtension(String orderId, int days) async {
    _isActionLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post(
        '/customers/me/orders/$orderId/extensions/quote',
        data: {'additionalDays': days},
      );
      if (response.statusCode == 200) {
        _extensionQuote = ExtensionQuoteModel.fromJson(response.data);
      }
    } catch (e) {
      _errorMessage = 'Failed to quote extension.';
      _extensionQuote = null;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> processExtension(String orderId, int days) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.post(
        '/customers/me/orders/$orderId/extensions',
        data: {'additionalDays': days},
      );
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to process extension.';
    } finally {
      _isActionLoading = false;
      _extensionQuote = null; // Clear quote
      notifyListeners();
    }
    return success;
  }

  Future<void> quoteBuyout(String orderId) async {
    _isActionLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.post('/customers/me/orders/$orderId/buyouts/quote', data: {});
      if (response.statusCode == 200) {
        _buyoutQuote = BuyoutQuoteModel.fromJson(response.data);
      }
    } catch (e) {
      _errorMessage = 'Failed to quote buyout.';
      _buyoutQuote = null;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  Future<bool> processBuyout(String orderId) async {
    _isActionLoading = true;
    notifyListeners();
    bool success = false;
    try {
      final response = await _apiClient.dio.post('/customers/me/orders/$orderId/buyouts', data: {});
      if (response.statusCode == 200 || response.statusCode == 204) {
        success = true;
        await fetchOrderDetail(orderId);
      }
    } catch (e) {
      _errorMessage = 'Failed to process buyout.';
    } finally {
      _isActionLoading = false;
      _buyoutQuote = null; // Clear quote
      notifyListeners();
    }
    return success;
  }

  void clearQuotes() {
    _extensionQuote = null;
    _buyoutQuote = null;
    notifyListeners();
  }
}
