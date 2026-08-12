import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/product_model.dart';
import '../models/product_detail_model.dart';
import '../models/order_quote_model.dart';
import '../models/checkout_session_model.dart';
import '../models/cart_model.dart';
import '../models/medical_model.dart';
import '../utils/user_friendly_error.dart';

class CheckoutProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  ProductDetailModel? _productDetail;
  ProductDetailModel? get productDetail => _productDetail;

  OrderQuoteModel? _quote;
  OrderQuoteModel? get quote => _quote;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _isPlacingOrder = false;
  bool get isPlacingOrder => _isPlacingOrder;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  List<Map<String, dynamic>> _failedLines = [];
  List<Map<String, dynamic>> get failedLines => _failedLines;

  void clearState() {
    _productDetail = null;
    _quote = null;
    _errorMessage = null;
    _failedLines = [];
    notifyListeners();
  }

  Future<List<ProductModel>> fetchRelatedProducts(String listingId, {int limit = 6}) async {
    try {
      final response = await _apiClient.dio.get('/customers/products/$listingId/related', queryParameters: {'limit': limit});
      if (response.statusCode == 200 && response.data is List) {
        return (response.data as List).map((json) => ProductModel.fromJson(json)).toList();
      }
    } catch (_) {
      // Non-blocking: return empty list on failure
    }
    return [];
  }

  Future<ProductDetailModel?> fetchProductDetailModel(String listingId) async {
    try {
      final response = await _apiClient.dio.get('/customers/catalog/listings/$listingId');
      if (response.statusCode == 200) {
        return ProductDetailModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Failed to load product details.',
      );
    } catch (e) {
      _errorMessage = e.toString();
    }
    return null;
  }

  Future<void> fetchProductDetail(String listingId) async {
    _productDetail = null;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/catalog/listings/$listingId');
      if (response.statusCode == 200) {
        _productDetail = ProductDetailModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Unable to load product details. Please try again.',
      );
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Map<String, dynamic> _buildLinePayload(
    CartLineModel line, {
    MedicalRefModel? medicalRef,
  }) {
    final payload = <String, dynamic>{
      'listingId': line.listingId,
      'quantity': line.quantity,
      'rentalDays': line.orderType == 'buy'
          ? 0
          : (line.usesPricingPlan
              ? (line.rentalDurationDays ?? line.rentalDays)
              : line.rentalDays),
      'rentalPeriodUnit': line.orderType == 'buy'
          ? 'day'
          : (line.usesPricingPlan ? 'day' : line.rentalPeriodUnit),
      'orderType': line.orderType,
      if (line.productVariantId != null && line.productVariantId!.isNotEmpty)
        'productVariantId': line.productVariantId,
      if (line.usesPricingPlan) 'rentalPricingPlanId': line.rentalPricingPlanId,
    };

    if (line.prescriptionRequired && medicalRef != null && medicalRef.doctorId.isNotEmpty) {
      payload['doctorId'] = medicalRef.doctorId;
    }

    return payload;
  }

  Future<void> getQuote(
    List<CartLineModel> cartLines, {
    String? addressId,
    String deliveryOption = 'standard',
    Map<String, MedicalRefModel>? medicalRefs,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = {
        if (addressId != null && addressId.isNotEmpty) 'customerAddressId': addressId,
        'deliveryOption': deliveryOption,
        'lines': cartLines
            .map((line) => _buildLinePayload(
                  line,
                  medicalRef: medicalRefs?[line.listingId],
                ))
            .toList(),
      };

      final response = await _apiClient.dio.post('/customers/me/orders/quote', data: data);
      if (response.statusCode == 200) {
        _quote = OrderQuoteModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _quote = null;
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Unable to calculate delivery for this address. Please try another address.',
      );
    } catch (_) {
      _quote = null;
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<CheckoutSessionModel?> createCheckout(
    List<CartLineModel> cartLines, {
    String? addressId,
    String deliveryOption = 'standard',
    Map<String, MedicalRefModel>? medicalRefs,
  }) async {
    _isPlacingOrder = true;
    _errorMessage = null;
    _failedLines = [];
    notifyListeners();

    try {
      final data = {
        if (addressId != null && addressId.isNotEmpty) 'customerAddressId': addressId,
        'deliveryOption': deliveryOption,
        'lines': cartLines
            .map((line) => _buildLinePayload(
                  line,
                  medicalRef: medicalRefs?[line.listingId],
                ))
            .toList(),
      };

      final response = await _apiClient.dio.post('/customers/me/payments/checkout', data: data);
      if (response.statusCode == 200) {
        final session = CheckoutSessionModel.fromJson(Map<String, dynamic>.from(response.data as Map));
        _failedLines = session.failedLines.map((e) {
          final map = Map<String, dynamic>.from(e);
          final raw = map['message']?.toString() ?? map['errorCode']?.toString() ?? '';
          map['message'] = userFriendlyApiError(
            {
              'detail': raw,
              'title': map['errorCode']?.toString() ?? map['code']?.toString(),
              'code': map['errorCode']?.toString() ?? map['code']?.toString(),
            },
            'This item could not be ordered. Please update your cart and try again.',
          );
          return map;
        }).toList();

        if (session.orders.isNotEmpty && session.razorpayOrderId != null && session.razorpayOrderId!.isNotEmpty) {
          return session;
        }

        if (session.orders.isEmpty) {
          _errorMessage = _failedLines.isNotEmpty
              ? _failedLines.map((e) => e['message']).join(' ')
              : 'No orders could be placed for the selected items.';
        } else {
          _errorMessage = 'Payment could not be started. Please try again.';
        }
        return null;
      }
      return null;
    } on DioException catch (e) {
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Unable to start payment. Please try again.',
      );
      return null;
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
      return null;
    } finally {
      _isPlacingOrder = false;
      notifyListeners();
    }
  }

  Future<bool> verifyCheckout({
    required String checkoutSessionId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    _isPlacingOrder = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = {
        'checkoutSessionId': checkoutSessionId,
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      };

      final response = await _apiClient.dio.post('/customers/me/payments/verify', data: data);
      if (response.statusCode == 200) {
        return true;
      }
      _errorMessage = 'Payment verification failed. Please contact support.';
      return false;
    } on DioException catch (e) {
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Unable to verify payment. Please try again.',
      );
      return false;
    } catch (_) {
      _errorMessage = 'An unexpected error occurred during verification.';
      return false;
    } finally {
      _isPlacingOrder = false;
      notifyListeners();
    }
  }

  Future<bool> placeOrder(
    List<CartLineModel> cartLines, {
    String? addressId,
    String deliveryOption = 'standard',
    Map<String, MedicalRefModel>? medicalRefs,
  }) async {
    _isPlacingOrder = true;
    _errorMessage = null;
    _failedLines = [];
    notifyListeners();

    try {
      final data = {
        if (addressId != null && addressId.isNotEmpty) 'customerAddressId': addressId,
        'deliveryOption': deliveryOption,
        'lines': cartLines
            .map((line) => _buildLinePayload(
                  line,
                  medicalRef: medicalRefs?[line.listingId],
                ))
            .toList(),
      };

      final response = await _apiClient.dio.post('/customers/me/orders', data: data);
      if (response.statusCode == 200) {
        final resData = response.data;
        final placedOrders = resData['placedOrders'] as List<dynamic>? ?? [];
        final failed = resData['failedLines'] as List<dynamic>? ?? [];
        _failedLines = failed.map((e) {
          final map = Map<String, dynamic>.from(e as Map);
          final raw = map['message']?.toString() ?? map['errorCode']?.toString() ?? '';
          map['message'] = userFriendlyApiError(
            {
              'detail': raw,
              'title': map['errorCode']?.toString() ?? map['code']?.toString(),
              'code': map['errorCode']?.toString() ?? map['code']?.toString(),
            },
            'This item could not be ordered. Please update your cart and try again.',
          );
          return map;
        }).toList();

        if (placedOrders.isNotEmpty) {
          return true;
        }

        _errorMessage = _failedLines.isNotEmpty
            ? _failedLines.map((e) => e['message']).join(' ')
            : 'Unable to place your order. Please review your cart and try again.';
        return false;
      }
      return false;
    } on DioException catch (e) {
      _errorMessage = userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'Unable to place your order. Please try again.',
      );
      return false;
    } catch (_) {
      _errorMessage = 'An unexpected error occurred.';
      return false;
    } finally {
      _isPlacingOrder = false;
      notifyListeners();
    }
  }
}
