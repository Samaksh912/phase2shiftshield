import 'package:flutter/foundation.dart';

/// Lightweight global event bus for cross-screen signalling.
/// Use instead of passing callbacks through multiple navigator levels.
class AppEvents {
  AppEvents._();

  static final _policyPurchased = ValueNotifier<int>(0);
  static final _simulationCompleted = ValueNotifier<int>(0);

  /// Fires every time a policy is successfully purchased.
  static ValueListenable<int> get policyPurchased => _policyPurchased;
  static void notifyPolicyPurchased() => _policyPurchased.value++;

  /// Fires after a disruption simulation completes so claims/dashboard refresh.
  static ValueListenable<int> get simulationCompleted => _simulationCompleted;
  static void notifySimulationCompleted() => _simulationCompleted.value++;
}
