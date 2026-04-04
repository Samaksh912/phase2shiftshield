class AppConfig {
  static const bool useLocalAppData = false;
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://shiftshield-backend-5x53.onrender.com',
  );
  static const bool devBypassAuth = false;

  // Demo login credentials: phone → OTP
  static const Map<String, String> demoLoginOtps = {
    '9876543210': '9324',
    '9123456780': '2841',
    '9988776655': '6157',
    '9345678123': '4408',
    '9451203344': '7712',
  };

  // Demo signup credentials: phone → OTP
  static const Map<String, String> demoSignupOtps = {
    '9012345678': '1201',
    '9012345679': '1202',
    '9012345680': '1203',
    '9012345681': '1204',
    '9012345682': '1205',
  };

  static bool isDemoLoginPhone(String phone) => demoLoginOtps.containsKey(phone);
  static String? demoLoginOtpFor(String phone) => demoLoginOtps[phone];

  static bool isDemoSignupPhone(String phone) => demoSignupOtps.containsKey(phone);
  static String? demoSignupOtpFor(String phone) => demoSignupOtps[phone];

  static bool isDemoPhone(String phone) =>
      demoLoginOtps.containsKey(phone) || demoSignupOtps.containsKey(phone);
}
