import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart' hide ShimmerEffect;
import 'package:skeletonizer/skeletonizer.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../data/dashboard_mock_data.dart';
import '../widgets/dashboard_app_bar.dart';
import '../widgets/offline_banner.dart';
import '../widgets/active_policy_card.dart';
import '../widgets/no_policy_card.dart';
import '../widgets/recent_payouts_list.dart';
import '../widgets/no_claims_card.dart';
import '../widgets/floating_cta_button.dart';
import '../../quote/screens/quote_screen.dart';
import '../../../core/app_events.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isLoading = true;
  bool _usedFallback = false;
  Map<String, dynamic> _data = Map<String, dynamic>.from(dummyDashboard);
  bool _checkedPostSignupQuote = false;

  @override
  void initState() {
    super.initState();
    _fetchDashboard();
    AppEvents.policyPurchased.addListener(_onPolicyPurchased);
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeOpenQuoteAfterSignup());
  }

  void _onPolicyPurchased() {
    if (!mounted) return;
    _fetchDashboard();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'Policy activated! Your coverage starts next week.',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  void dispose() {
    AppEvents.policyPurchased.removeListener(_onPolicyPurchased);
    super.dispose();
  }

  Future<void> _maybeOpenQuoteAfterSignup() async {
    if (_checkedPostSignupQuote || !mounted) return;
    _checkedPostSignupQuote = true;
    final shouldOpenQuote = await AuthService.consumeOpenQuoteAfterSignup();
    if (!shouldOpenQuote || !mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const QuoteScreen()),
    );
  }

  Future<void> _fetchDashboard() async {
    setState(() => _isLoading = true);
    try {
      final data = await ApiService.getDashboard();
      setState(() {
        _data = data;
        _usedFallback = false;
        _isLoading = false;
      });
      HapticFeedback.lightImpact();
    } catch (e, stack) {
      debugPrint('>>> DASHBOARD FETCH ERROR: $e');
      debugPrint('>>> STACK: $stack');
      setState(() {
        _data = Map<String, dynamic>.from(dummyDashboard);
        _usedFallback = true;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic> dataToUse = _isLoading ? Map<String, dynamic>.from(dummyDashboard) : _data;

    final rider = (dataToUse['rider'] as Map<String, dynamic>?) ?? {};
    final wallet = (dataToUse['wallet'] as Map<String, dynamic>?) ?? {};
    final currentPolicy = dataToUse['current_policy'] as Map<String, dynamic>?;
    final recentClaims = (dataToUse['recent_claims'] as List<dynamic>?) ?? [];

    return Scaffold(
      backgroundColor: context.colors.surface,
      body: Stack(
        children: [
          RefreshIndicator(
            color: context.colors.primary,
            onRefresh: _fetchDashboard,
            child: Skeletonizer(
              enabled: _isLoading,
              effect: ShimmerEffect(
                baseColor: context.colors.surfaceContainerHigh,
                highlightColor: context.colors.surfaceContainerHighest.withValues(alpha: 0.5),
                duration: const Duration(milliseconds: 1200),
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  DashboardAppBar(rider: rider, wallet: wallet),
                  SliverPadding(
                    padding: const EdgeInsets.only(
                      left: 16,
                      right: 16,
                      top: 8,
                      bottom: 140, // Make sure we can scroll content above the button and nav bar
                    ),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        // Offline banner
                        if (_usedFallback) ...[
                          const OfflineBanner(),
                          const SizedBox(height: 12),
                        ],
                        // Active policy OR no-policy card
                        currentPolicy != null
                            ? ActivePolicyCard(policy: currentPolicy)
                                .animate()
                                .fadeIn(duration: 400.ms)
                                .slideY(begin: 0.05, curve: Curves.easeOutQuad)
                            : const NoPolicyCard()
                                .animate()
                                .fadeIn(duration: 400.ms)
                                .slideY(begin: 0.05, curve: Curves.easeOutQuad),
                        const SizedBox(height: 12),
                        // Recent payouts or no claims card
                        recentClaims.isNotEmpty
                            ? RecentPayoutsList(claims: recentClaims)
                                .animate(delay: 100.ms)
                                .fadeIn(duration: 400.ms)
                                .slideY(begin: 0.05, curve: Curves.easeOutQuad)
                            : const NoClaimsCard()
                                .animate(delay: 100.ms)
                                .fadeIn(duration: 400.ms)
                                .slideY(begin: 0.05, curve: Curves.easeOutQuad),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            bottom: 110, // Places it cleanly above your custom global bottom nav bar
            left: 16,
            right: 16,
            child: FloatingCtaButton(
              isLoading: _isLoading,
              nextWeekAvailable: _data['next_week_quote_available'] as bool? ?? true,
            ),
          ),
        ],
      ),
    );
  }
}
