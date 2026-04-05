/// Holds pending signup data while user is in the signup → quote → payment flow.
/// Data is NOT sent to the server until payment succeeds.
class SignupSession {
  static Map<String, dynamic>? _payload;

  static bool get isActive => _payload != null;
  static Map<String, dynamic>? get payload => _payload;

  static void store({
    required String phone,
    required String verificationToken,
    required String name,
    required String platform,
    required String cityId,
    required String zoneId,
    required String shiftsCovered,
    required String payoutPreference,
    String? upiId,
  }) {
    _payload = {
      'name': name,
      'phone': phone,
      'platform': platform,
      'city_id': cityId,
      'zone_id': zoneId,
      'shifts_covered': shiftsCovered,
      'payout_preference': payoutPreference,
      if (upiId != null) 'upi_id': upiId,
      'verification_token': verificationToken,
    };
  }

  static void clear() {
    _payload = null;
  }
}
