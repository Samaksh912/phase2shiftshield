import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';

class ZoneSelectionCard extends StatelessWidget {
  final Map<String, dynamic> rider;
  final List<dynamic> zones;
  final Map<String, String> cityNames;
  final bool isLocked;
  final ValueChanged<String> onZoneChanged;

  const ZoneSelectionCard({
    super.key,
    required this.rider,
    required this.zones,
    required this.cityNames,
    required this.isLocked,
    required this.onZoneChanged,
  });

  List<Widget> _buildGroupedZones(BuildContext sheetContext) {
    // Group zones by city
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final z in zones) {
      final zoneMap = z as Map<String, dynamic>;
      final zoneId = zoneMap['id'] as String? ?? '';
      final city = cityNames[zoneId] ?? (zoneMap['city_id'] as String? ?? 'Other');
      grouped.putIfAbsent(city, () => []).add(zoneMap);
    }

    final items = <Widget>[];
    for (final entry in grouped.entries) {
      items.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 8, top: 4),
          child: Text(
            entry.key.toUpperCase(),
            style: GoogleFonts.manrope(
              color: sheetContext.colors.onSurfaceVariant,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
        ),
      );
      for (final zone in entry.value) {
        final zoneId = zone['id'] as String;
        final zoneName = zone['name'] as String;
        final isSelected = rider['zone_id'] == zoneId;
        items.add(
          InkWell(
            onTap: () {
              onZoneChanged(zoneId);
              Navigator.pop(sheetContext);
            },
            borderRadius: BorderRadius.circular(16),
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isSelected
                    ? sheetContext.colors.primary.withValues(alpha: 0.1)
                    : sheetContext.colors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected
                      ? sheetContext.colors.primary.withValues(alpha: 0.5)
                      : Colors.transparent,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    zoneName,
                    style: GoogleFonts.spaceGrotesk(
                      color: isSelected
                          ? sheetContext.colors.primary
                          : sheetContext.colors.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (isSelected)
                    Icon(Icons.check_circle, color: sheetContext.colors.primary),
                ],
              ),
            ),
          ),
        );
      }
    }
    return items;
  }

  void _showZonePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
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
              child: SafeArea(
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
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Select Work Zone',
                            style: GoogleFonts.spaceGrotesk(
                              color: context.colors.onSurface,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Choose the zone where you will be delivering.',
                            style: GoogleFonts.manrope(
                              color: context.colors.onSurfaceVariant,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 24),
                          ..._buildGroupedZones(context),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final zoneName = rider['zone_name'] as String? ?? 'Select a zone...';

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  color: context.colors.primary,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text(
                  'WORK ZONE',
                  style: GoogleFonts.manrope(
                    color: context.colors.onSurfaceVariant,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            InkWell(
              onTap: isLocked ? null : () => _showZonePicker(context),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: context.colors.surfaceContainer,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: context.colors.onSurface.withValues(alpha: 0.05),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      zoneName,
                      style: GoogleFonts.spaceGrotesk(
                        color: isLocked 
                            ? context.colors.onSurfaceVariant 
                            : context.colors.onSurface,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Icon(
                      isLocked ? Icons.lock : Icons.keyboard_arrow_down,
                      color: context.colors.onSurfaceVariant,
                    ),
                  ],
                ),
              ),
            ),
            if (isLocked)
              Padding(
                padding: const EdgeInsets.only(top: 12, left: 4),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: context.colors.primary,
                      size: 14,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Zone cannot be changed during an active policy period.',
                        style: GoogleFonts.manrope(
                          color: context.colors.onSurfaceVariant,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
