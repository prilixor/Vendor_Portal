import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/product_detail_model.dart';
import '../models/order_quote_model.dart';
import '../models/cart_model.dart';
import '../models/medical_model.dart';

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

  Future<void> fetchProductDetail(String listingId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _apiClient.dio.get('/customers/catalog/listings/$listingId');
      if (response.statusCode == 200) {
        _productDetail = ProductDetailModel.fromJson(response.data);
      }
    } on DioException catch (e) {
      _errorMessage = 'Failed to load details: ${e.message}';
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
      'rentalDays': line.orderType == 'buy' ? 0 : line.rentalDays,
      'orderType': line.orderType,
      if (line.productVariantId != null && line.productVariantId!.isNotEmpty)
        'productVariantId': line.productVariantId,
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
      _errorMessage =
          'Failed to get quote: ${e.response?.data?['detail'] ?? e.message}';
    } catch (_) {
      _quote = null;
      _errorMessage = 'An unexpected error occurred.';
    } finally {
      _isLoading = false;
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
        _failedLines = failed
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();

        if (placedOrders.isNotEmpty) {
          return true;
        }

        _errorMessage = failed.isNotEmpty
            ? failed.map((e) => e['message']).join(', ')
            : 'Failed to place order. No items were placed.';
        return false;
      }
      return false;
    } on DioException catch (e) {
      _errorMessage =
          'Failed to place order: ${e.response?.data?['detail'] ?? e.message}';
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
