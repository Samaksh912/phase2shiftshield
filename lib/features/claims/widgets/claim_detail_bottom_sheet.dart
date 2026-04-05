import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/utils/formatters.dart';

class ClaimDetailBottomSheet extends StatelessWidget {
  final Map<String, dynamic> claim;

  const ClaimDetailBottomSheet({super.key, required this.claim});

  /// Format the trigger_detail map into a human-readable string.
  String _formatTriggerDetail(dynamic raw, String triggerType) {
    if (raw == null) return 'N/A';
    if (raw is String) return raw;
    if (raw is! Map) return raw.toString();

    final detail = raw as Map<String, dynamic>;
    final zone = detail['zone_name'] as String? ?? '';
    final duration = detail['duration_minutes'] as int?;
    final threshold = detail['threshold'];
    final durationStr = duration != null ? ' for $duration min' : '';

    switch (triggerType) {
      case 'rain':
        return 'Rainfall ≥ ${threshold}mm$durationStr in $zone';
      case 'heat':
        final apparent = detail['apparent_temp'];
        return 'Apparent temp $apparent°C (threshold ${threshold}°C)$durationStr in $zone';
      case 'aqi':
        return 'AQI $threshold$durationStr in $zone';
      default:
        return detail.entries
            .where((e) => e.key != 'zone_name')
            .map((e) => '${e.key}: ${e.value}')
            .join(', ');
    }
  }

  String _formatConditionB(dynamic raw) {
    if (raw == null) return 'N/A';
    if (raw is String) return raw;
    if (raw is! Map) return raw.toString();
    final map = raw as Map<String, dynamic>;
    final drop = map['earnings_drop_pct'];
    if (drop != null) return 'Earnings drop: $drop%';
    return map.toString();
  }

  @override
  Widget build(BuildContext context) {
    final claimDate = Formatters.formatDate(claim['claim_date'] as String?);
    final triggerType = claim['trigger_type'] as String? ?? '';
    final triggerDetailStr = _formatTriggerDetail(claim['trigger_detail'], triggerType);
    final severityLevel = claim['severity_level']; // int in API
    final conditionB = _formatConditionB(claim['condition_b']);
    final payoutPercent = claim['payout_percent'] ?? claim['payout_percentage'] ?? 0;
    final payoutAmount = claim['payout_amount'] ?? 0;
    final status = claim['status'] as String? ?? 'under_review';

    final isPaid = status == 'paid';
    final isRejected = status == 'rejected';

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border(
          top: BorderSide(
            color: context.colors.primary.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 48,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.colors.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 48),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Claim Details',
                            style: GoogleFonts.spaceGrotesk(
                              color: context.colors.onSurface,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: isPaid
                                  ? context.colors.primary.withValues(alpha: 0.15)
                                  : isRejected
                                      ? context.colors.error.withValues(alpha: 0.15)
                                      : context.colors.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              status.replaceAll('_', ' ').toUpperCase(),
                              style: GoogleFonts.manrope(
                                color: isPaid
                                    ? context.colors.primary
                                    : isRejected
                                        ? context.colors.error
                                        : context.colors.onSurfaceVariant,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Filed on $claimDate',
                        style: GoogleFonts.manrope(
                          color: context.colors.onSurfaceVariant,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Trigger block
                      Text(
                        'TRIGGER METRICS',
                        style: GoogleFonts.manrope(
                          color: context.colors.onSurfaceVariant,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Trigger Type', style: _labelStyle(context)),
                                Text(
                                  triggerType.toUpperCase(),
                                  style: _valueStyle(context),
                                ),
                              ],
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Divider(color: Colors.white10),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Recorded Value', style: _labelStyle(context)),
                                const SizedBox(width: 24),
                                Expanded(
                                  child: Text(
                                    triggerDetailStr,
                                    style: _valueStyle(context),
                                    textAlign: TextAlign.right,
                                  ),
                                ),
                              ],
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Divider(color: Colors.white10),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Severity Level', style: _labelStyle(context)),
                                Text(
                                  severityLevel != null ? 'Level $severityLevel' : 'N/A',
                                  style: _valueStyle(context),
                                ),
                              ],
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Divider(color: Colors.white10),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Earnings Impact', style: _labelStyle(context)),
                                const SizedBox(width: 24),
                                Expanded(
                                  child: Text(
                                    conditionB,
                                    style: _valueStyle(context),
                                    textAlign: TextAlign.right,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 32),

                      // Calculation breakdown
                      Text(
                        'PAYOUT CALCULATION',
                        style: GoogleFonts.manrope(
                          color: context.colors.onSurfaceVariant,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Trigger Payout %', style: _labelStyle(context)),
                                Text('$payoutPercent%', style: _valueStyle(context)),
                              ],
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: Divider(color: Colors.white10),
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Final Payout Amount', style: _labelStyle(context)),
                                Text(
                                  '₹$payoutAmount',
                                  style: GoogleFonts.spaceGrotesk(
                                    color: isRejected
                                        ? context.colors.onSurfaceVariant
                                        : context.colors.primary,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                    decoration: isRejected ? TextDecoration.lineThrough : null,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  TextStyle _labelStyle(BuildContext context) {
    return GoogleFonts.manrope(
      color: context.colors.onSurfaceVariant,
      fontSize: 12,
    );
  }

  TextStyle _valueStyle(BuildContext context) {
    return GoogleFonts.spaceGrotesk(
      color: context.colors.onSurface,
      fontSize: 14,
      fontWeight: FontWeight.w600,
    );
  }
}
