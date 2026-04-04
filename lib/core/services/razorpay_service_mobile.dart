import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'razorpay_service.dart';

RazorpayService createRazorpayService() => _MobileRazorpayService();

class _MobileRazorpayService implements RazorpayService {
  late final Razorpay _razorpay;
  RazorpayCallback? _callback;

  _MobileRazorpayService() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternal);
  }

  void _onSuccess(PaymentSuccessResponse response) {
    _callback?.call(RazorpayPaymentResult(
      success: true,
      paymentId: response.paymentId,
    ));
  }

  void _onError(PaymentFailureResponse response) {
    final wasCancelled =
        response.code == Razorpay.NETWORK_ERROR ||
        response.message?.toLowerCase().contains('cancel') == true;
    _callback?.call(RazorpayPaymentResult(
      success: false,
      errorMessage: wasCancelled ? null : (response.message ?? 'Payment failed.'),
    ));
  }

  void _onExternal(ExternalWalletResponse response) {
    _callback?.call(RazorpayPaymentResult(
      success: false,
      errorMessage: null,
    ));
  }

  @override
  void open({
    required String key,
    required int amountInPaise,
    required String currency,
    required String name,
    required String description,
    required Map<String, String> notes,
    required String themeColor,
    required RazorpayCallback onResult,
  }) {
    _callback = onResult;
    _razorpay.open({
      'key': key,
      'amount': amountInPaise,
      'currency': currency,
      'name': name,
      'description': description,
      'notes': notes,
      'theme': {'color': themeColor},
      'modal': {'confirm_close': true, 'animation': true},
    });
  }

  @override
  void dispose() {
    _razorpay.clear();
  }
}
