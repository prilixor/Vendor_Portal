// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:async';
import 'dart:html' as html;
import 'dart:js' as js;

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
  try {
    const scriptId = 'razorpay_checkout_js';
    if (html.document.getElementById(scriptId) == null) {
      final script = html.ScriptElement()
        ..id = scriptId
        ..src = 'https://checkout.razorpay.com/v1/checkout.js'
        ..async = true;
      html.document.body?.children.add(script);
      await script.onLoad.first;
    }

    final successCallbackName = '__rzp_success_${DateTime.now().millisecondsSinceEpoch}';
    final errorCallbackName = '__rzp_error_${DateTime.now().millisecondsSinceEpoch}';

    js.context[successCallbackName] = (dynamic paymentId, dynamic rzpOrderId, dynamic signature) {
      onSuccess(paymentId.toString(), rzpOrderId.toString(), signature.toString());
    };
    js.context[errorCallbackName] = (dynamic message) {
      onError(message.toString());
    };

    final jsCode = '''
      (function() {
        var options = {
          "key": "$key",
          "amount": $amountPaise,
          "currency": "$currency",
          "order_id": "$orderId",
          "name": "$name",
          "description": "$description",
          "prefill": { "email": "$email", "contact": "$contact" },
          "handler": function(response) {
            window["$successCallbackName"](response.razorpay_payment_id || "", response.razorpay_order_id || "", response.razorpay_signature || "");
          },
          "modal": {
            "ondismiss": function() {
              window["$errorCallbackName"]("Payment cancelled.");
            }
          }
        };
        var rzp = new window.Razorpay(options);
        rzp.open();
      })();
    ''';

    js.context.callMethod('eval', [jsCode]);
  } catch (e) {
    onError('Razorpay checkout failed: $e');
  }
}
