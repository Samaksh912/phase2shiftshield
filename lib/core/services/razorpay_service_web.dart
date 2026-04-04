import 'dart:js_interop';
import 'package:web/web.dart' as web;
import 'razorpay_service.dart';

RazorpayService createRazorpayService() => _WebRazorpayService();

@JS('Razorpay')
extension type _RazorpayJS._(JSObject _) implements JSObject {
  external factory _RazorpayJS(JSObject options);
  external void open();
}

class _WebRazorpayService implements RazorpayService {
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
    final notesObj = notes.jsify();

    final options = {
      'key': key,
      'amount': amountInPaise,
      'currency': currency,
      'name': name,
      'description': description,
      'notes': notesObj,
      'theme': {'color': themeColor},
      'modal': {'confirm_close': true, 'animation': true},
      'handler': ((JSObject response) {
        final paymentId = (response as JSAny).dartify();
        String? pid;
        if (paymentId is Map) {
          pid = paymentId['razorpay_payment_id']?.toString();
        }
        onResult(RazorpayPaymentResult(success: true, paymentId: pid));
      }).toJS,
    }.jsify() as JSObject;

    try {
      final rzp = _RazorpayJS(options);
      rzp.open();
    } catch (e) {
      onResult(RazorpayPaymentResult(
        success: false,
        errorMessage: 'Could not open Razorpay: $e',
      ));
    }
  }

  @override
  void dispose() {}
}
