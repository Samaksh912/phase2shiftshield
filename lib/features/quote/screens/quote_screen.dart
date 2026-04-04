import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/api_service.dart';
import 'payments_screen.dart';

class QuoteScreen extends StatefulWidget {
  const QuoteScreen({super.key});

  @override
  State<QuoteScreen> createState() => _QuoteScreenState();
}

class _QuoteScreenState extends State<QuoteScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;

  // Live quote data
  Map<String, dynamic>? _quote;
  bool _isLoading = true;
  String? _errorMsg;
  Timer? _countdownTimer;
  Duration _timeLeft = Duration.zero;

  // ── Promoted to state so _buyPolicy can access them ──────────────────────
  int _premium = 0;
  String _weekStart = '';
  String _weekEnd = '';
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat(reverse: true);
    _fetchQuote();
  }

  String _nextMonday() {
    final now = DateTime.now();
    final daysUntilMonday = (DateTime.monday - now.weekday + 7) % 7;
    final monday = daysUntilMonday == 0
        ? now.add(const Duration(days: 7))
        : now.add(Duration(days: daysUntilMonday));
    return '${monday.year}-${monday.month.toString().padLeft(2, '0')}-${monday.day.toString().padLeft(2, '0')}';
  }

  Future<void> _fetchQuote() async {
    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });
    try {
      final data = await ApiService.generateQuote(_nextMonday());
      final quote = data['quote'] as Map<String, dynamic>;
      setState(() {
        _quote = quote;
        // Cache the fields we need outside build()
        _premium = quote['premium'] as int? ?? 0;
        _weekStart = quote['week_start'] as String? ?? '';
        _weekEnd = quote['week_end'] as String? ?? '';
        _isLoading = false;
      });
      _startCountdown(quote['purchase_deadline'] as String?);
    } on ApiException catch (e) {
      setState(() {
        _errorMsg = e.message;
        _isLoading = false;
      });
    } catch (_) {
      setState(() {
        _errorMsg = 'Could not load quote. Is the backend running?';
        _isLoading = false;
      });
    }
  }

  void _startCountdown(String? deadlineStr) {
    if (deadlineStr == null) return;
    _countdownTimer?.cancel();
    final deadline = DateTime.parse(deadlineStr);
    _updateTimeLeft(deadline);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) _updateTimeLeft(deadline);
    });
  }

  void _updateTimeLeft(DateTime deadline) {
    final diff = deadline.difference(DateTime.now());
    setState(() => _timeLeft = diff.isNegative ? Duration.zero : diff);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _handleBack() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }

    context.go(AppRoutes.dashboard);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // _premium / _weekStart / _weekEnd are state fields — always in scope here.
  // ─────────────────────────────────────────────────────────────────────────

  void _buyPolicy(String quoteId) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PaymentScreen(
          args: PaymentScreenArgs(
            quoteId: quoteId,
            premium: _premium,
            weekStart: _weekStart,
            weekEnd: _weekEnd,
          ),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: context.colors.surface,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: context.colors.primary),
              const SizedBox(height: 16),
              Text(
                'Calculating your risk...',
                style: GoogleFonts.manrope(
                  color: context.colors.onSurfaceVariant,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMsg != null) {
      return Scaffold(
        backgroundColor: context.colors.surface,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.cloud_off,
                  size: 64,
                  color: context.colors.onSurfaceVariant,
                ),
                const SizedBox(height: 16),
                Text(
                  _errorMsg!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    color: context.colors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _fetchQuote,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final quote = _quote!;

    // Local build variables — derived from state fields for convenience.
    final premium = _premium;
    final weekStart = _weekStart;
    final weekEnd = _weekEnd;

    final riskBand = quote['risk_band'] as String? ?? 'medium';
    final canPurchase = quote['can_purchase'] as bool? ?? true;
    final explanation = quote['explanation'] as Map<String, dynamic>? ?? {};
    final topFactors = (explanation['top_factors'] as List<dynamic>?) ?? [];
    final summary = explanation['summary'] as String? ?? '';
    final coverage = quote['coverage_breakdown'] as Map<String, dynamic>? ?? {};
    final lunchMax = quote['lunch_shift_max_payout'] as int? ?? 0;
    final dinnerMax = quote['dinner_shift_max_payout'] as int? ?? 0;
    final hours = _timeLeft.inHours;
    final minutes = (_timeLeft.inMinutes % 60).toString().padLeft(2, '0');
    final secs = (_timeLeft.inSeconds % 60).toString().padLeft(2, '0');

    final riskColor = riskBand == 'low'
        ? Colors.green.shade400
        : riskBand == 'high'
        ? Colors.red.shade400
        : Colors.amber.shade400;

    return Scaffold(
      backgroundColor: context.colors.surface,
      body: Stack(
        children: [
          // ── Scrollable Content ──────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.only(
                top: 80,
                left: 24,
                right: 24,
                bottom: 120,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Hero ──────────────────────────────────────────────
                  Container(
                    margin: const EdgeInsets.only(bottom: 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Risk band pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: riskColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FadeTransition(
                                opacity: _pulseController,
                                child: Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: riskColor,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${riskBand.toUpperCase()} RISK · ₹$premium / WEEK',
                                style: GoogleFonts.manrope(
                                  color: riskColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 2.0,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'YOUR\nSHIELD QUOTE',
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
                          '$weekStart → $weekEnd',
                          style: GoogleFonts.manrope(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: context.colors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Premium card ──────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: context.colors.surfaceContainer,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: context.colors.primary.withOpacity(0.3),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: context.colors.primary.withOpacity(0.08),
                          blurRadius: 32,
                          spreadRadius: -4,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'WEEKLY PREMIUM',
                                  style: GoogleFonts.manrope(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.5,
                                    color: context.colors.onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Text(
                                      '₹$premium',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 48,
                                        fontWeight: FontWeight.bold,
                                        color: context.colors.primary,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      '/week',
                                      style: GoogleFonts.manrope(
                                        fontSize: 14,
                                        color: context.colors.onSurfaceVariant,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: riskColor.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(32),
                              ),
                              child: Text(
                                riskBand.toUpperCase(),
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: riskColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        // Payout range
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: context.colors.surfaceContainerLow,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _statCell(
                                'LUNCH MAX',
                                '₹$lunchMax',
                                Icons.wb_sunny,
                              ),
                              Container(
                                width: 1,
                                height: 40,
                                color: context.colors.outlineVariant
                                    .withOpacity(0.3),
                              ),
                              _statCell(
                                'DINNER MAX',
                                '₹$dinnerMax',
                                Icons.nights_stay,
                              ),
                              Container(
                                width: 1,
                                height: 40,
                                color: context.colors.outlineVariant
                                    .withOpacity(0.3),
                              ),
                              _statCell(
                                'SHIFTS',
                                '${coverage['total_protected_shifts'] ?? 12}',
                                Icons.shield_outlined,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── Risk factors ──────────────────────────────────────
                  if (topFactors.isNotEmpty) ...[
                    Text(
                      'RISK FACTORS',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                        color: context.colors.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainer,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        children: [
                          ...topFactors.map((f) {
                            final factor = f as Map<String, dynamic>;
                            final pct =
                                (factor['contribution_pct'] as num? ?? 0)
                                    .toDouble();
                            final detail = factor['detail'] as String? ?? '';
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        factor['factor'] as String? ?? '',
                                        style: GoogleFonts.manrope(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: context.colors.onSurface,
                                        ),
                                      ),
                                      Text(
                                        '${pct.toInt()}%',
                                        style: GoogleFonts.spaceGrotesk(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: context.colors.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: pct / 100,
                                      minHeight: 6,
                                      backgroundColor: context
                                          .colors
                                          .surfaceContainerHighest,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        context.colors.primary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    detail,
                                    style: GoogleFonts.manrope(
                                      fontSize: 11,
                                      color: context.colors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                          if (summary.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: context.colors.surfaceContainerLow,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                summary,
                                style: GoogleFonts.manrope(
                                  fontSize: 12,
                                  color: context.colors.onSurfaceVariant,
                                  height: 1.5,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // ── Countdown ─────────────────────────────────────────
                  if (_timeLeft > Duration.zero)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: context.colors.outlineVariant.withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.timer_outlined,
                            size: 18,
                            color: context.colors.onSurfaceVariant,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Purchase closes in ',
                            style: GoogleFonts.manrope(
                              fontSize: 13,
                              color: context.colors.onSurfaceVariant,
                            ),
                          ),
                          Text(
                            '${hours}h ${minutes}m ${secs}s',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: context.colors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          // ── Frosted app bar ───────────────────────────────────────────
          Positioned(
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
                  color: context.colors.surface.withOpacity(0.7),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          GestureDetector(
                            onTap: _handleBack,
                            child: Icon(
                              Icons.arrow_back,
                              color: context.colors.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'CHOOSE YOUR PLAN',
                            style: GoogleFonts.spaceGrotesk(
                              color: context.colors.primary,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainer,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.help_outline,
                          color: context.colors.onSurfaceVariant,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Sticky CTA ────────────────────────────────────────────────
          Positioned(
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
                    context.colors.surface.withOpacity(0.0),
                  ],
                ),
              ),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: canPurchase
                      ? () => _buyPolicy(quote['id'] as String)
                      : null,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                    elevation: 0,
                    disabledBackgroundColor:
                        context.colors.surfaceContainerHighest,
                  ),
                  child: Ink(
                    decoration: BoxDecoration(
                      gradient: canPurchase
                          ? LinearGradient(
                              colors: [
                                context.colors.primary,
                                context.colors.primaryContainer,
                              ],
                              begin: Alignment.bottomLeft,
                              end: Alignment.topRight,
                            )
                          : null,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Container(
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            canPurchase
                                ? 'BUY POLICY — ₹$premium'
                                : 'PURCHASE UNAVAILABLE',
                            style: GoogleFonts.manrope(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                              color: canPurchase
                                  ? context.colors.onPrimaryFixed
                                  : context.colors.onSurfaceVariant,
                            ),
                          ),
                          if (canPurchase) ...[
                            const SizedBox(width: 8),
                            Icon(
                              Icons.arrow_forward,
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
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  Widget _statCell(String label, String value, IconData icon) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: context.colors.primary),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: context.colors.onSurface,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            color: context.colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
