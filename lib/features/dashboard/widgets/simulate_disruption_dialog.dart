import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/app_events.dart';

void showSimulateDisruptionSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _SimulateSheet(),
  );
}

class _SimulateSheet extends StatefulWidget {
  const _SimulateSheet();
  @override
  State<_SimulateSheet> createState() => _SimulateSheetState();
}

enum _Step { config, loading, success, error }

class _SimulateSheetState extends State<_SimulateSheet> {
  _Step _step = _Step.config;

  String _triggerType = 'rain';
  String _shiftType = 'lunch';
  int _severity = 2;

  String? _zoneId;
  String? _errorMsg;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _loadZone();
  }

  Future<void> _loadZone() async {
    try {
      final me = await ApiService.getMe();
      final rider = me['rider'] as Map<String, dynamic>? ?? me;
      setState(() => _zoneId = rider['zone_id'] as String?);
    } catch (_) {}
  }

  Future<void> _run() async {
    if (_zoneId == null) {
      setState(() {
        _step = _Step.error;
        _errorMsg = 'Could not determine your zone. Try again.';
      });
      return;
    }
    setState(() => _step = _Step.loading);
    try {
      final res = await ApiService.simulateTrigger(
        zoneId: _zoneId!,
        triggerType: _triggerType,
        shiftType: _shiftType,
        severityLevel: _severity,
      );
      setState(() {
        _result = res;
        _step = _Step.success;
      });
      AppEvents.notifySimulationCompleted();
    } on ApiException catch (e) {
      setState(() {
        _step = _Step.error;
        _errorMsg = e.message;
      });
    } catch (_) {
      setState(() {
        _step = _Step.error;
        _errorMsg = 'Could not reach server.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: context.colors.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          if (_step == _Step.config) _buildConfig(),
          if (_step == _Step.loading) _buildLoading(),
          if (_step == _Step.success) _buildSuccess(),
          if (_step == _Step.error) _buildError(),
        ],
      ),
    );
  }

  Widget _buildConfig() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.bolt, color: context.colors.primary, size: 22),
            const SizedBox(width: 8),
            Text('SIMULATE DISRUPTION',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 16, fontWeight: FontWeight.w900,
                  letterSpacing: 1.5, color: context.colors.onSurface,
                )),
          ],
        ),
        const SizedBox(height: 4),
        Text('Trigger a weather event and see payouts processed in real time.',
            style: GoogleFonts.manrope(
              fontSize: 13, color: context.colors.onSurfaceVariant,
            )),
        const SizedBox(height: 24),

        // Trigger type
        _label('TRIGGER TYPE'),
        const SizedBox(height: 10),
        Row(children: [
          _typeChip('rain',  '🌧', 'Rain'),
          const SizedBox(width: 10),
          _typeChip('heat',  '🌡', 'Heat'),
          const SizedBox(width: 10),
          _typeChip('aqi',   '💨', 'AQI'),
        ]),
        const SizedBox(height: 20),

        // Shift
        _label('SHIFT'),
        const SizedBox(height: 10),
        Row(children: [
          _shiftChip('lunch',  '☀️', 'Lunch'),
          const SizedBox(width: 10),
          _shiftChip('dinner', '🌙', 'Dinner'),
        ]),
        const SizedBox(height: 20),

        // Severity
        _label('SEVERITY LEVEL'),
        const SizedBox(height: 10),
        Row(children: List.generate(4, (i) {
          final s = i + 1;
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: _severityChip(s),
          );
        })),
        const SizedBox(height: 8),
        Text(_severityLabel(_severity),
            style: GoogleFonts.manrope(
              fontSize: 12, color: context.colors.onSurfaceVariant,
            )),
        const SizedBox(height: 28),

        SizedBox(
          width: double.infinity, height: 56,
          child: ElevatedButton(
            onPressed: _zoneId == null ? null : _run,
            style: ElevatedButton.styleFrom(
              padding: EdgeInsets.zero,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 6,
              shadowColor: context.colors.primary.withValues(alpha: 0.3),
            ),
            child: Ink(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [context.colors.primary, context.colors.primaryContainer],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Container(
                alignment: Alignment.center,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.play_arrow_rounded,
                      color: context.colors.onPrimaryFixed, size: 22),
                  const SizedBox(width: 8),
                  Text('RUN SIMULATION',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 15, fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                        color: context.colors.onPrimaryFixed,
                      )),
                ]),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoading() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(children: [
        CircularProgressIndicator(color: context.colors.primary),
        const SizedBox(height: 20),
        Text('Processing trigger event…',
            style: GoogleFonts.manrope(
              fontSize: 15, color: context.colors.onSurfaceVariant,
            )),
      ]),
    );
  }

  Widget _buildSuccess() {
    final paid = _result?['claims_paid_count'] as int? ?? 0;
    final review = _result?['claims_under_review_count'] as int? ?? 0;
    final credited = (_result?['total_wallet_credited'] as num?)?.toInt() ?? 0;
    final triggerLabel = {'rain': 'Heavy Rain', 'heat': 'Extreme Heat', 'aqi': 'Poor AQI'}[_triggerType] ?? _triggerType;

    return Column(children: [
      Container(
        width: 64, height: 64,
        decoration: BoxDecoration(
          color: Colors.green.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check_circle_rounded, color: Colors.green, size: 36),
      ),
      const SizedBox(height: 16),
      Text('SIMULATION COMPLETE',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 16, fontWeight: FontWeight.w900,
            letterSpacing: 1.5, color: context.colors.onSurface,
          )),
      const SizedBox(height: 4),
      Text('$triggerLabel triggered for ${_shiftType[0].toUpperCase()}${_shiftType.substring(1)} shift',
          style: GoogleFonts.manrope(fontSize: 13, color: context.colors.onSurfaceVariant)),
      const SizedBox(height: 24),
      Row(children: [
        _statCard('Claims Paid', '$paid', Colors.green),
        const SizedBox(width: 12),
        _statCard('Under Review', '$review', Colors.orange),
        const SizedBox(width: 12),
        _statCard('Wallet Credit', '₹$credited', context.colors.primary),
      ]),
      const SizedBox(height: 24),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: () => Navigator.pop(context),
          style: OutlinedButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            side: BorderSide(color: context.colors.outline.withValues(alpha: 0.3)),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: Text('CLOSE',
              style: GoogleFonts.spaceGrotesk(
                fontSize: 14, fontWeight: FontWeight.w700,
                letterSpacing: 1.5, color: context.colors.onSurfaceVariant,
              )),
        ),
      ),
    ]);
  }

  Widget _buildError() {
    return Column(children: [
      const Icon(Icons.error_outline, color: Colors.red, size: 48),
      const SizedBox(height: 12),
      Text(_errorMsg ?? 'Something went wrong.',
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(fontSize: 14, color: context.colors.onSurface)),
      const SizedBox(height: 20),
      Row(children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () => Navigator.pop(context),
            style: OutlinedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('CLOSE', style: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton(
            onPressed: () => setState(() { _step = _Step.config; _errorMsg = null; }),
            style: ElevatedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              backgroundColor: context.colors.primary,
            ),
            child: Text('RETRY', style: GoogleFonts.spaceGrotesk(
              fontWeight: FontWeight.w700, color: context.colors.onPrimaryFixed,
            )),
          ),
        ),
      ]),
    ]);
  }

  Widget _label(String text) => Text(text,
      style: GoogleFonts.manrope(
        fontSize: 10, fontWeight: FontWeight.w900,
        letterSpacing: 2.0, color: context.colors.onSurfaceVariant,
      ));

  Widget _typeChip(String value, String emoji, String label) {
    final selected = _triggerType == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _triggerType = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? context.colors.primary.withValues(alpha: 0.12)
                : context.colors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? context.colors.primary
                  : context.colors.outline.withValues(alpha: 0.2),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(label, style: GoogleFonts.spaceGrotesk(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: selected ? context.colors.primary : context.colors.onSurfaceVariant,
            )),
          ]),
        ),
      ),
    );
  }

  Widget _shiftChip(String value, String emoji, String label) {
    final selected = _shiftType == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _shiftType = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? context.colors.primary.withValues(alpha: 0.12)
                : context.colors.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? context.colors.primary
                  : context.colors.outline.withValues(alpha: 0.2),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(emoji, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 6),
            Text(label, style: GoogleFonts.spaceGrotesk(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: selected ? context.colors.primary : context.colors.onSurfaceVariant,
            )),
          ]),
        ),
      ),
    );
  }

  Widget _severityChip(int s) {
    final selected = _severity == s;
    final color = [Colors.green, Colors.orange, Colors.deepOrange, Colors.red][s - 1];
    return GestureDetector(
      onTap: () => setState(() => _severity = s),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 52, height: 44,
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.15) : context.colors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? color : context.colors.outline.withValues(alpha: 0.2),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('$s', style: GoogleFonts.spaceGrotesk(
            fontSize: 16, fontWeight: FontWeight.w900,
            color: selected ? color : context.colors.onSurfaceVariant,
          )),
        ]),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(children: [
          Text(value, style: GoogleFonts.spaceGrotesk(
            fontSize: 20, fontWeight: FontWeight.w900, color: color,
          )),
          const SizedBox(height: 2),
          Text(label, textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 10, color: context.colors.onSurfaceVariant,
              )),
        ]),
      ),
    );
  }

  String _severityLabel(int s) => {
    1: 'Mild — 28% payout',
    2: 'Moderate — 45% payout',
    3: 'Severe — 63% payout',
    4: 'Extreme — 76% payout',
  }[s]!;
}
