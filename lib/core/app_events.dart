import 'package:flutter/foundation.dart';

/// Lightweight global event bus for cross-screen signalling.
/// Use instead of passing callbacks through multiple navigator levels.
class AppEvents {
  AppEvents._();

  static final _policyPurchased = ValueNotifier<int>(0);

  /// Fires every time a policy is successfully purchased.
  /// Listeners (e.g. DashboardScreen) should refresh their data.
  static ValueListenable<int> get policyPurchased => _policyPurchased;

  static void notifyPolicyPurchased() => _policyPurchased.value++;
}
