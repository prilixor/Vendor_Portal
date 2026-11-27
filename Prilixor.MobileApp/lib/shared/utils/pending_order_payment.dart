import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../core/providers/checkout_provider.dart';
import '../../core/theme.dart';
import 'razorpay_web_checkout.dart';

/// "Pay now" for an order whose payment window was closed (status: Payment pending).
/// Reopens Razorpay for the same order, then verifies the payment. Unpaid orders expire
/// on their own, so this only works until then.
///
/// Create one per screen, call [dispose] from the screen's dispose.
class PendingOrderPayment {
  PendingOrderPayment({required this.onPaid});

  /// Called after the payment was verified, so the screen can refresh its orders.
  final VoidCallback onPaid;

  Razorpay? _razorpay;
  BuildContext? _context;
  String? _sessionId;
  bool _busy = false;

  bool get isBusy => _busy;

  void _ensureRazorpay() {
    if (kIsWeb || _razorpay != null) return;
    final r = Razorpay();
    r.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess);
    r.on(Razorpay.EVENT_PAYMENT_ERROR, _onError);
    r.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse _) => _finish());
    _razorpay = r;
  }

  Future<void> start(BuildContext context, String orderId) async {
    if (_busy) return;
    _busy = true;
    _context = context;
    final provider = Provider.of<CheckoutProvider>(context, listen: false);
    final session = await provider.resumeCheckout(orderId);
    if (!context.mounted) {
      _busy = false;
      return;
    }
    if (session == null || (session.razorpayOrderId ?? '').isEmpty) {
      _busy = false;
      _toast(
        provider.errorMessage ?? 'Payment is no longer available. Please place the order again.',
        Colors.redAccent,
      );
      return;
    }

    _sessionId = session.checkoutSessionId;
    final amountPaise = (session.amount * 100).round();
    if (kIsWeb) {
      await openRazorpayWeb(
        key: session.razorpayKeyId,
        amountPaise: amountPaise,
        currency: session.currency,
        orderId: session.razorpayOrderId ?? '',
        name: 'BlinksMed',
        description: 'Pay for ${session.orders.length} order(s)',
        email: '',
        contact: '',
        onSuccess: (paymentId, orderId, signature) => _verify(paymentId, orderId, signature),
        onError: (_) => _notCompleted(),
      );
      return;
    }

    _ensureRazorpay();
    try {
      _razorpay!.open({
        'key': session.razorpayKeyId,
        'amount': amountPaise,
        'currency': session.currency,
        'order_id': session.razorpayOrderId,
        'name': 'BlinksMed',
        'description': 'Pay for ${session.orders.length} order(s)',
        'theme': {'color': AppTheme.razorpayThemeColor},
      });
    } catch (_) {
      _notCompleted();
    }
  }

  void _onSuccess(PaymentSuccessResponse r) =>
      _verify(r.paymentId ?? '', r.orderId ?? '', r.signature ?? '');

  void _onError(PaymentFailureResponse _) => _notCompleted();

  void _notCompleted() {
    _finish();
    _toast('Payment was not completed. You can tap Pay now again.', Colors.orangeAccent);
  }

  Future<void> _verify(String paymentId, String razorpayOrderId, String signature) async {
    final ctx = _context;
    final sessionId = _sessionId;
    if (ctx == null || !ctx.mounted || sessionId == null) {
      _finish();
      return;
    }
    final provider = Provider.of<CheckoutProvider>(ctx, listen: false);
    final ok = await provider.verifyCheckout(
      checkoutSessionId: sessionId,
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    );
    _finish();
    if (ok) {
      _toast('Payment successful! Your order has been submitted.', Colors.green);
      onPaid();
    } else {
      _toast(provider.errorMessage ?? 'Payment verification failed. Please contact support.', Colors.redAccent);
    }
  }

  void _finish() {
    _busy = false;
  }

  void _toast(String message, Color color) {
    final ctx = _context;
    if (ctx == null || !ctx.mounted) return;
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: color),
    );
  }

  void dispose() {
    _razorpay?.clear();
    _razorpay = null;
    _context = null;
  }
}
