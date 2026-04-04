import 'razorpay_service_stub.dart'
    if (dart.library.js_interop) 'razorpay_service_web.dart'
    if (dart.library.io) 'razorpay_service_mobile.dart';

class RazorpayPaymentResult {
  final bool success;
  final String? paymentId;
  final String? errorMessage;

  RazorpayPaymentResult({
    required this.success,
    this.paymentId,
    this.errorMessage,
  });
}

typedef RazorpayCallback = void Function(RazorpayPaymentResult result);

abstract class RazorpayService {
  factory RazorpayService() => createRazorpayService();

  void open({
    required String key,
    required int amountInPaise,
    required String currency,
    required String name,
    required String description,
    required Map<String, String> notes,
    required String themeColor,
    required RazorpayCallback onResult,
  });

  void dispose();
}
