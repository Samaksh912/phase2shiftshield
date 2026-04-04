import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'auth_service.dart';
import 'local_app_data_service.dart';

/// A centralized API client that:
/// - Attaches JWT to every authenticated request
/// - Parses standard error shapes { "error": "code", "message": "..." }
/// - Throws [ApiException] on non-2xx responses
class ApiService {
  static final String _base = AppConfig.baseUrl;
  static String get debugBaseUrl => _base;

  static void _log(String message) {
    if (kDebugMode) {
      debugPrint('[ApiService] $message');
    }
  }

  static Future<T> _withLocalFallback<T>(
    Future<T> Function() localCall,
  ) async {
    try {
      return await localCall();
    } on LocalServiceError catch (error) {
      throw ApiException(
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        message: error.message,
        rawBody: error.rawBody,
      );
    }
  }

  // ─────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────

  static Future<Map<String, String>> _authHeaders() async {
    final token = await AuthService.getToken();
    _log('Resolved base URL: $_base');
    _log('Auth token present: ${token != null && token.isNotEmpty}');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    final contentType = response.headers['content-type'] ?? '';
    _log(
      'Response ${response.request?.method ?? 'UNKNOWN'} ${response.request?.url} '
      'status=${response.statusCode} contentType=$contentType body=${response.body}',
    );
    if (!contentType.contains('application/json')) {
      throw ApiException(
        statusCode: response.statusCode,
        errorCode: 'unexpected_response',
        message: response.statusCode == 404
            ? 'Endpoint not found. Check backend URL and route path.'
            : 'Server returned a non-JSON response.',
        rawBody: {
          'body': response.body,
          'content_type': contentType,
        },
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw ApiException(
        statusCode: response.statusCode,
        errorCode: 'unexpected_response',
        message: 'Server returned an unexpected response shape.',
        rawBody: {'body': response.body},
      );
    }

    final body = decoded;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    throw ApiException(
      statusCode: response.statusCode,
      errorCode: body['error'] as String? ?? body['code'] as String? ?? 'unknown_error',
      message: body['message'] as String? ?? 'Something went wrong.',
      rawBody: body,
    );
  }

  static Future<Map<String, dynamic>> _get(String path) async {
    final headers = await _authHeaders();
    final uri = Uri.parse('$_base$path');
    _log('GET $uri headers=${headers.keys.toList()}');
    final response = await http.get(uri, headers: headers);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final headers = await _authHeaders();
    final uri = Uri.parse('$_base$path');
    final encodedBody = jsonEncode(body);
    _log('POST $uri headers=${headers.keys.toList()} body=$encodedBody');
    final response = await http.post(
      uri,
      headers: headers,
      body: encodedBody,
    );
    return _handleResponse(response);
  }

  // ─────────────────────────────────────────────
  // AUTH — SIGNUP FLOW
  // ─────────────────────────────────────────────

  /// POST /api/auth/request-otp  (signup OTP)
  static Future<Map<String, dynamic>> sendSignupOtp(String phone) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.sendSignupOtp(phone));
    }
    return _post('/api/auth/request-otp', {'phone': phone});
  }

  /// POST /api/auth/verify-otp  (signup OTP verification)
  /// Returns { verified, verification_token, ... }
  static Future<Map<String, dynamic>> verifySignupOtp(String phone, String otp) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.verifySignupOtp(phone, otp));
    }
    return _post('/api/auth/verify-otp', {'phone': phone, 'otp': otp});
  }

  /// POST /api/auth/signup  (complete signup with profile)
  static Future<Map<String, dynamic>> signup(Map<String, dynamic> body) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.signup(body));
    }
    return _post('/api/auth/signup', body);
  }

  // ─────────────────────────────────────────────
  // AUTH — LOGIN FLOW
  // ─────────────────────────────────────────────

  /// POST /api/auth/request-login-otp
  static Future<Map<String, dynamic>> sendLoginOtp(String phone) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.sendLoginOtp(phone));
    }
    return _post('/api/auth/request-login-otp', {'phone': phone});
  }

  /// POST /api/auth/verify-login-otp
  /// Returns { verified, verification_token, ... }
  static Future<Map<String, dynamic>> verifyLoginOtp(String phone, String otp) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.verifyLoginOtp(phone, otp));
    }
    return _post('/api/auth/verify-login-otp', {'phone': phone, 'otp': otp});
  }

  /// POST /api/auth/login
  static Future<Map<String, dynamic>> login(
    String phone,
    String verificationToken,
  ) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() => LocalAppDataService.login(phone, verificationToken));
    }
    return _post('/api/auth/login', {
      'phone': phone,
      'verification_token': verificationToken,
    });
  }

  // ─────────────────────────────────────────────
  // AUTH — SESSION
  // ─────────────────────────────────────────────

  /// GET /api/auth/me
  static Future<Map<String, dynamic>> getMe() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getMe(phone);
      });
    }
    return _get('/api/auth/me');
  }

  // Note: PUT /api/auth/me is not supported by the backend.
  // Profile edits are session-local only.

  // ─────────────────────────────────────────────
  // CITIES & ZONES
  // ─────────────────────────────────────────────

  /// GET /api/cities
  /// Returns { cities: [ { id, name, zones: [...] }, ... ] }
  static Future<Map<String, dynamic>> getCities() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(LocalAppDataService.getCities);
    }
    return _get('/api/cities');
  }

  // ─────────────────────────────────────────────
  // QUOTES
  // ─────────────────────────────────────────────

  /// POST /api/quotes/generate
  static Future<Map<String, dynamic>> generateQuote(String weekStart) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.generateQuote(phone, weekStart);
      });
    }
    return _post('/api/quotes/generate', {'week_start': weekStart});
  }

  // ─────────────────────────────────────────────
  // POLICIES
  // ─────────────────────────────────────────────

  /// POST /api/policies/create
  static Future<Map<String, dynamic>> createPolicy(
    String quoteId,
    String paymentMethod, {
    String? paymentReferenceId,
    String? paymentStatus,
  }) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.createPolicy(phone, quoteId, paymentMethod);
      });
    }
    final body = <String, dynamic>{
      'quote_id': quoteId,
      'payment_method': paymentMethod,
    };
    if (paymentReferenceId != null) {
      body['payment_reference_id'] = paymentReferenceId;
    }
    if (paymentStatus != null) {
      body['payment_status'] = paymentStatus;
    }
    return _post('/api/policies/create', body);
  }

  /// GET /api/policies/current
  static Future<Map<String, dynamic>> getCurrentPolicy() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getCurrentPolicy(phone);
      });
    }
    return _get('/api/policies/current');
  }

  /// GET /api/policies/history
  static Future<Map<String, dynamic>> getPolicyHistory({
    int limit = 20,
    int offset = 0,
  }) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getPolicyHistory(phone);
      });
    }
    return _get('/api/policies/history?limit=$limit&offset=$offset');
  }

  /// GET /api/policies/:id
  static Future<Map<String, dynamic>> getPolicyById(String policyId) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getPolicyById(phone, policyId);
      });
    }
    return _get('/api/policies/$policyId');
  }

  // ─────────────────────────────────────────────
  // DASHBOARD
  // ─────────────────────────────────────────────

  /// GET /api/dashboard
  static Future<Map<String, dynamic>> getDashboard() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getDashboard(phone);
      });
    }
    return _get('/api/dashboard');
  }

  // ─────────────────────────────────────────────
  // WALLET
  // ─────────────────────────────────────────────

  /// GET /api/wallet
  static Future<Map<String, dynamic>> getWallet() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getWallet(phone);
      });
    }
    return _get('/api/wallet');
  }

  /// POST /api/wallet/topup
  static Future<Map<String, dynamic>> topUp(int amount) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.topUp(phone, amount);
      });
    }
    return _post('/api/wallet/topup', {'amount': amount});
  }

  /// POST /api/wallet/withdraw
  static Future<Map<String, dynamic>> withdraw(int amount) {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.withdraw(phone, amount);
      });
    }
    return _post('/api/wallet/withdraw', {'amount': amount});
  }

  // ─────────────────────────────────────────────
  // CLAIMS
  // ─────────────────────────────────────────────

  /// GET /api/claims
  static Future<Map<String, dynamic>> getClaims() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getClaims(phone);
      });
    }
    return _get('/api/claims');
  }

  // ─────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────

  /// GET /api/notifications
  static Future<Map<String, dynamic>> getNotifications() {
    if (AppConfig.useLocalAppData) {
      return _withLocalFallback(() async {
        final phone = await AuthService.getPhone();
        return LocalAppDataService.getNotifications(phone);
      });
    }
    return _get('/api/notifications');
  }
}

// ─────────────────────────────────────────────
// EXCEPTION TYPE
// ─────────────────────────────────────────────

class ApiException implements Exception {
  final int statusCode;
  final String errorCode;
  final String message;
  final Map<String, dynamic> rawBody;

  ApiException({
    required this.statusCode,
    required this.errorCode,
    required this.message,
    required this.rawBody,
  });

  @override
  String toString() => 'ApiException($statusCode, $errorCode): $message';
}
