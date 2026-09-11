import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/product_model.dart';
import '../models/product_detail_model.dart';
import '../models/order_quote_model.dart';
import '../models/cart_model.dart';
import '../models/medical_model.dart';
import '../utils/platform_file_payload.dart';
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

  Future<bool> uploadPrescription({
    required String orderId,
    required PendingPrescriptionFile file,
    bool acceptedPrescriptionLegal = false,
    String uploadSource = 'checkout',
  }) async {
    try {
      final multipart = await multipartFromPickedFile(
        fileName: file.name,
        path: file.path,
        bytes: file.bytes,
      );
      if (multipart == null) return false;
      final form = FormData.fromMap({
        'file': multipart,
        'acceptedPrescriptionLegal': acceptedPrescriptionLegal ? 'true' : 'false',
        'uploadSource': uploadSource,
        'sourceSurface': 'customer_mobile',
      });
      final response = await _apiClient.dio.post(
        '/customers/me/orders/$orderId/prescriptions',
        data: form,
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// PDP pincode check. Does not overwrite the checkout quote.
  Future<String?> checkServiceArea({
    required String addressId,
    required Map<String, dynamic> line,
  }) async {
    try {
      await _apiClient.dio.post('/customers/me/orders/quote', data: {
        'customerAddressId': addressId,
        'deliveryOption': 'standard',
        'lines': [line],
      });
      return null;
    } on DioException catch (e) {
      return userFriendlyDioMessage(
        e.response?.data,
        e.message,
        'This pincode is outside the vendor service area.',
      );
    } catch (_) {
      return 'This pincode is outside the vendor service area.';
    }
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

  List<Map<String, dynamic>> _lastPlacedOrders = [];
  List<Map<String, dynamic>> get lastPlacedOrders => _lastPlacedOrders;

  Future<bool> placeOrder(
    List<CartLineModel> cartLines, {
    String? addressId,
    String deliveryOption = 'standard',
    Map<String, MedicalRefModel>? medicalRefs,
    Map<String, List<PendingPrescriptionFile>>? prescriptionFiles,
    bool acceptedLegal = false,
    bool acceptedPrescriptionLegal = false,
  }) async {
    _isPlacingOrder = true;
    _errorMessage = null;
    _failedLines = [];
    notifyListeners();

    try {
      final data = {
        if (addressId != null && addressId.isNotEmpty) 'customerAddressId': addressId,
        'deliveryOption': deliveryOption,
        'acceptedLegal': acceptedLegal,
        'acceptedPrescriptionLegal': acceptedPrescriptionLegal,
        'sourceSurface': 'customer_mobile',
        'lines': cartLines.map((line) {
          final payload = _buildLinePayload(
            line,
            medicalRef: medicalRefs?[line.listingId],
          );
          if (line.prescriptionRequired &&
              (prescriptionFiles?[line.listingId]?.isNotEmpty ?? false)) {
            payload['hasPrescriptionFile'] = true;
          }
          return payload;
        }).toList(),
      };

      final response = await _apiClient.dio.post('/customers/me/orders', data: data);
      if (response.statusCode == 200) {
        final resData = response.data;
        final placedOrders = resData['placedOrders'] as List<dynamic>? ?? [];
        _lastPlacedOrders = placedOrders
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
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
          for (final order in _lastPlacedOrders) {
            final listingId = order['listingId']?.toString() ?? '';
            final orderId = order['id']?.toString() ?? '';
            if (listingId.isEmpty || orderId.isEmpty) continue;
            final files = prescriptionFiles?[listingId] ?? const <PendingPrescriptionFile>[];
            for (final file in files) {
              await uploadPrescription(
                orderId: orderId,
                file: file,
                acceptedPrescriptionLegal: acceptedPrescriptionLegal,
                uploadSource: 'checkout',
              );
            }
          }
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
