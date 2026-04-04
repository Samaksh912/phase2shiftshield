import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../../core/router/app_router.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT ARGUMENTS
// ─────────────────────────────────────────────────────────────────────────────

class PaymentScreenArgs {
  final String quoteId;
  final int premium;
  final String weekStart;
  final String weekEnd;

  const PaymentScreenArgs({
    required this.quoteId,
    required this.premium,
    required this.weekStart,
    required this.weekEnd,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT SCREEN
// ─────────────────────────────────────────────────────────────────────────────

class PaymentScreen extends StatefulWidget {
  final PaymentScreenArgs args;

  const PaymentScreen({super.key, required this.args});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW STATE
// ─────────────────────────────────────────────────────────────────────────────

enum _FlowState {
  idle, // Waiting for user to tap Pay
  razorpayOpen, // Razorpay sheet is showing
  creatingPolicy, // Payment succeeded; calling POST /api/policies/create
  refreshing, // Policy created; fetching fresh state
  success, // All done — navigate away
  paymentFailed, // Razorpay returned failure
  policyFailed, // Payment OK but policy creation failed
}

class _PaymentScreenState extends State<PaymentScreen> {
  late final Razorpay _razorpay;
  _FlowState _state = _FlowState.idle;
  String? _errorMessage;

  // Captured from Razorpay success callback
  String? _razorpayPaymentId;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  // ───────────────────────────────────────────
  // RAZORPAY CALLBACKS
  // ───────────────────────────────────────────

  void _onPaymentSuccess(PaymentSuccessResponse response) {
    _razorpayPaymentId = response.paymentId;
    _createPolicy();
  }

  void _onPaymentError(PaymentFailureResponse response) {
    // Code 0 = user cancelled the sheet
    final wasCancelled =
        response.code == Razorpay.NETWORK_ERROR ||
        response.message?.toLowerCase().contains('cancel') == true;
    setState(() {
      _state = wasCancelled ? _FlowState.idle : _FlowState.paymentFailed;
      _errorMessage = wasCancelled
          ? null
          : (response.message ?? 'Payment failed. Please try again.');
    });
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    // Not supported in this flow; treat as cancellation
    setState(() => _state = _FlowState.idle);
  }

  // ───────────────────────────────────────────
  // PAYMENT INITIATION
  // ───────────────────────────────────────────

  void _openRazorpay() {
    setState(() {
      _state = _FlowState.razorpayOpen;
      _errorMessage = null;
    });

    final options = {
      'key':
          'rzp_test_SZWH7PbKYjmFpA', // 🔑 Replace with your Razorpay test key
      'amount': widget.args.premium * 100, // Razorpay expects paise
      'currency': 'INR',
      'name': 'RiderShield Insurance',
      'description':
          'Weekly policy · ${widget.args.weekStart} → ${widget.args.weekEnd}',
      'prefill': {
        // Optional: pre-fill if you have rider contact details
        // 'contact': riderPhone,
        // 'email': riderEmail,
      },
      'notes': {'quote_id': widget.args.quoteId},
      'theme': {
        'color': '#6366F1', // Match your app's primary — update if needed
      },
      // Test mode: no actual charge
      'modal': {
        'confirm_close': true, // Ask before closing
        'animation': true,
      },
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      setState(() {
        _state = _FlowState.idle;
        _errorMessage = 'Could not open payment. Please try again.';
      });
    }
  }

  // ───────────────────────────────────────────
  // POLICY CREATION  (called after payment success)
  // ───────────────────────────────────────────

  Future<void> _createPolicy() async {
    setState(() {
      _state = _FlowState.creatingPolicy;
      _errorMessage = null;
    });

    try {
      await ApiService.createPolicy(
        widget.args.quoteId,
        'razorpay',
        paymentReferenceId: _razorpayPaymentId,
        paymentStatus: 'success',
      );
      // Policy created ✓ — now refresh all state
      await _refreshAppState();
    } on ApiException catch (e) {
      setState(() {
        _state = _FlowState.policyFailed;
        _errorMessage = _friendlyPolicyError(e.errorCode, e.message);
      });
    } catch (_) {
      setState(() {
        _state = _FlowState.policyFailed;
        _errorMessage =
            'Could not reach server. Your payment was received — tap retry.';
      });
    }
  }

  // ───────────────────────────────────────────
  // POST-SUCCESS DATA REFRESH
  // ───────────────────────────────────────────

  Future<void> _refreshAppState() async {
    setState(() => _state = _FlowState.refreshing);

    // Fire all four calls concurrently; individual failures are swallowed —
    // the dashboard itself will retry. Coverage is already confirmed above.
    await Future.wait([
      ApiService.getCurrentPolicy().catchError((_) => <String, dynamic>{}),
      ApiService.getDashboard().catchError((_) => <String, dynamic>{}),
      ApiService.getWallet().catchError((_) => <String, dynamic>{}),
      ApiService.getNotifications().catchError((_) => <String, dynamic>{}),
    ]);

    // Store results in your state management layer here if applicable
    // e.g. context.read<AppState>().updateFrom(policy, dashboard, wallet, notifs)

    setState(() => _state = _FlowState.success);

    if (!mounted) return;
    context.go(AppRoutes.dashboard);
  }

  // ───────────────────────────────────────────
  // ERROR HELPERS
  // ───────────────────────────────────────────

  String _friendlyPolicyError(String code, String fallback) {
    switch (code) {
      case 'insufficient_balance':
        return 'Wallet balance too low to complete the policy.';
      case 'policy_exists':
        return 'You already have an active policy for this week.';
      case 'quote_expired':
        return 'This quote has expired. Please go back and generate a new one.';
      case 'disruption_active':
        return 'Policy purchase is paused during an active disruption.';
      default:
        return fallback;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: Stack(
        children: [
          // ── Scrollable body ──────────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.only(
                top: 80,
                left: 24,
                right: 24,
                bottom: 140,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHero(),
                  const SizedBox(height: 24),
                  _buildPlanSummary(),
                  const SizedBox(height: 24),
                  _buildPaymentMethod(),
                  if (_state == _FlowState.paymentFailed ||
                      _state == _FlowState.policyFailed) ...[
                    const SizedBox(height: 20),
                    _buildErrorBanner(),
                  ],
                ],
              ),
            ),
          ),

          // ── Frosted app bar ───────────────────────────────────────────────
          _buildAppBar(),

          // ── Full-screen loading overlay ───────────────────────────────────
          if (_state == _FlowState.creatingPolicy ||
              _state == _FlowState.refreshing ||
              _state == _FlowState.success)
            _buildLoadingOverlay(),

          // ── Sticky bottom CTA ─────────────────────────────────────────────
          _buildBottomCta(),
        ],
      ),
    );
  }

  // ───────────────────────────────────────────
  // SECTIONS
  // ───────────────────────────────────────────

  Widget _buildHero() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CONFIRM &\nPAY',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 36,
            fontWeight: FontWeight.bold,
            height: 1.1,
            letterSpacing: -1.0,
            color: context.colors.onSurface,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Review your plan and complete payment.',
          style: GoogleFonts.manrope(
            fontSize: 14,
            color: context.colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildPlanSummary() {
    final a = widget.args;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainer,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: context.colors.primary.withValues(alpha: 0.25),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: context.colors.primary.withValues(alpha: 0.07),
            blurRadius: 28,
            spreadRadius: -4,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label
          Text(
            'PLAN SUMMARY',
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),

          // Week range
          _summaryRow(
            icon: Icons.calendar_month_outlined,
            label: 'Coverage period',
            value: '${a.weekStart} → ${a.weekEnd}',
          ),
          const SizedBox(height: 12),

          // Coverage type
          _summaryRow(
            icon: Icons.shield_outlined,
            label: 'Plan type',
            value: 'Weekly rider insurance',
          ),
          const SizedBox(height: 20),

          // Divider
          Divider(color: context.colors.outlineVariant.withValues(alpha: 0.3)),
          const SizedBox(height: 16),

          // Premium row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total payable',
                style: GoogleFonts.manrope(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: context.colors.onSurface,
                ),
              ),
              Text(
                '₹${a.premium}',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: context.colors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethod() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'PAYMENT METHOD',
          style: GoogleFonts.manrope(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: context.colors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: context.colors.surfaceContainer,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: context.colors.primary.withValues(alpha: 0.4),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF072654).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    'R',
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF072654),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Razorpay',
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: context.colors.onSurface,
                      ),
                    ),
                    Text(
                      'UPI · Cards · Netbanking · Wallets',
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.check_circle_rounded,
                color: context.colors.primary,
                size: 22,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.lock_outline,
              size: 14,
              color: context.colors.onSurfaceVariant,
            ),
            const SizedBox(width: 6),
            Text(
              'Secured by Razorpay · 256-bit SSL',
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: context.colors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildErrorBanner() {
    final isPolicyError = _state == _FlowState.policyFailed;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.error_outline_rounded,
            color: Colors.red.shade700,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isPolicyError ? 'Policy activation failed' : 'Payment failed',
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.red.shade800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _errorMessage ?? 'Something went wrong.',
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    color: Colors.red.shade700,
                    height: 1.4,
                  ),
                ),
                if (isPolicyError) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Your payment was received. Tap "Retry activation" to confirm coverage.',
                    style: GoogleFonts.manrope(
                      fontSize: 11,
                      color: Colors.red.shade600,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    final label = switch (_state) {
      _FlowState.creatingPolicy => 'Activating your policy…',
      _FlowState.refreshing => 'Syncing your coverage…',
      _FlowState.success => 'All set! Taking you home…',
      _ => 'Please wait…',
    };

    return Positioned.fill(
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            color: context.colors.surface.withValues(alpha: 0.85),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _state == _FlowState.success
                    ? Icon(
                        Icons.check_circle_rounded,
                        size: 64,
                        color: Colors.green.shade500,
                      )
                    : CircularProgressIndicator(color: context.colors.primary),
                const SizedBox(height: 20),
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: context.colors.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            height: 64 + MediaQuery.of(context).padding.top,
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top,
              left: 24,
              right: 24,
            ),
            color: context.colors.surface.withValues(alpha: 0.7),
            child: Row(
              children: [
                GestureDetector(
                  onTap: _canNavigateBack ? _handleBack : null,
                  child: Icon(
                    Icons.arrow_back,
                    color: _canNavigateBack
                        ? context.colors.primary
                        : context.colors.onSurfaceVariant.withValues(alpha: 0.4),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'COMPLETE PAYMENT',
                  style: GoogleFonts.spaceGrotesk(
                    color: context.colors.primary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomCta() {
    final isPolicyRetry = _state == _FlowState.policyFailed;
    final isBlocked =
        _state == _FlowState.creatingPolicy ||
        _state == _FlowState.refreshing ||
        _state == _FlowState.success ||
        _state == _FlowState.razorpayOpen;

    final label = isPolicyRetry
        ? 'RETRY ACTIVATION'
        : 'PAY ₹${widget.args.premium}';

    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          top: 16,
          left: 24,
          right: 24,
          bottom: MediaQuery.of(context).padding.bottom > 0
              ? MediaQuery.of(context).padding.bottom
              : 24,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              context.colors.surface,
              context.colors.surface.withValues(alpha: 0.0),
            ],
          ),
        ),
        child: SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: isBlocked
                ? null
                : isPolicyRetry
                ? _createPolicy // Retry without re-paying
                : _openRazorpay,
            style: ElevatedButton.styleFrom(
              padding: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              elevation: 0,
              disabledBackgroundColor: context.colors.surfaceContainerHighest,
            ),
            child: Ink(
              decoration: BoxDecoration(
                gradient: isBlocked
                    ? null
                    : LinearGradient(
                        colors: [
                          context.colors.primary,
                          context.colors.primaryContainer,
                        ],
                        begin: Alignment.bottomLeft,
                        end: Alignment.topRight,
                      ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Container(
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                        color: isBlocked
                            ? context.colors.onSurfaceVariant
                            : context.colors.onPrimaryFixed,
                      ),
                    ),
                    if (!isBlocked) ...[
                      const SizedBox(width: 8),
                      Icon(
                        isPolicyRetry ? Icons.refresh : Icons.arrow_forward,
                        color: context.colors.onPrimaryFixed,
                        size: 20,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ───────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────

  bool get _canNavigateBack =>
      _state == _FlowState.idle ||
      _state == _FlowState.paymentFailed ||
      _state == _FlowState.policyFailed;

  void _handleBack() {
    if (!_canNavigateBack) {
      return;
    }

    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }

    context.go(AppRoutes.dashboard);
  }

  Widget _summaryRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: context.colors.primary),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: context.colors.onSurfaceVariant,
              ),
            ),
            Text(
              value,
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: context.colors.onSurface,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
