import 'package:flutter/material.dart';
import 'package:skeletonizer/skeletonizer.dart';
import 'package:flutter_animate/flutter_animate.dart' hide ShimmerEffect;
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/app_events.dart';
import '../data/claims_mock_data.dart';
import '../widgets/claims_app_bar.dart';
import '../widgets/claims_summary_section.dart';
import '../widgets/claims_list_box.dart';

class ClaimsScreen extends StatefulWidget {
  const ClaimsScreen({super.key});

  @override
  State<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends State<ClaimsScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _summary = {};
  List<dynamic> _claims = [];

  @override
  void initState() {
    super.initState();
    _fetchClaimsData();
    AppEvents.simulationCompleted.addListener(_fetchClaimsData);
  }

  @override
  void dispose() {
    AppEvents.simulationCompleted.removeListener(_fetchClaimsData);
    super.dispose();
  }

  Future<void> _fetchClaimsData() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getClaims();
      
      setState(() {
        _summary = res['summary'] as Map<String, dynamic>? ?? {};
        _claims = res['claims'] as List<dynamic>? ?? [];
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('>>> CLAIMS FETCH ERROR: $e');
      setState(() {
        _summary = mockClaimsData['summary'];
        _claims = mockClaimsData['claims'];
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: Skeletonizer(
        enabled: _isLoading,
        effect: ShimmerEffect(
          baseColor: context.colors.surfaceContainerHigh,
          highlightColor: context.colors.surfaceContainerHighest.withValues(alpha: 0.5),
          duration: const Duration(milliseconds: 1200),
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        // Layout must not scroll as a whole.
        child: Column(
          children: [
            const ClaimsAppBar(),
            
            if (_summary.isNotEmpty || _isLoading)
              ClaimsSummarySection(summary: _summary)
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.05, curve: Curves.easeOutQuad),
            
            // This takes the remaining screen height. Internal list view scrolls.
            Expanded(
              child: ClaimsListBox(claims: _claims)
                  .animate(delay: 100.ms)
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.05, curve: Curves.easeOutQuad),
            ),
          ],
        ),
      ),
    );
  }
}
