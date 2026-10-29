typedef WebPaymentSuccessCallback = void Function(
  String paymentId,
  String orderId,
  String signature,
);
typedef WebPaymentErrorCallback = void Function(String message);

Future<void> openRazorpayWeb({
  required String key,
  required int amountPaise,
  required String currency,
  required String orderId,
  required String name,
  required String description,
  required String email,
  required String contact,
  required WebPaymentSuccessCallback onSuccess,
  required WebPaymentErrorCallback onError,
}) async {
  onError('Razorpay Web is not supported on this platform.');
}
