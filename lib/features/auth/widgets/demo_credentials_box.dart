import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';

class DemoCredentialsBox extends StatefulWidget {
  final ValueChanged<String> onTap;
  final List<(String, String)> credentials;
  final String label;

  const DemoCredentialsBox({
    super.key,
    required this.onTap,
    required this.credentials,
    this.label = 'DEMO CREDENTIALS',
  });

  @override
  State<DemoCredentialsBox> createState() => _DemoCredentialsBoxState();
}

class _DemoCredentialsBoxState extends State<DemoCredentialsBox> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: context.colors.surfaceContainerLow.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: context.colors.outline.withValues(alpha: 0.12),
          ),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.science_outlined,
                    size: 14,
                    color: context.colors.primary.withValues(alpha: 0.7)),
                const SizedBox(width: 6),
                Text(
                  widget.label,
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                    color: context.colors.onSurfaceVariant
                        .withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(width: 6),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  size: 14,
                  color: context.colors.onSurfaceVariant.withValues(alpha: 0.5),
                ),
              ],
            ),
            if (_expanded) ...[
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 160),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    children: [
                      ...widget.credentials.map((d) => GestureDetector(
                            onTap: () {
                              widget.onTap(d.$1);
                              setState(() => _expanded = false);
                            },
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 3),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    d.$1,
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: context.colors.primary,
                                    ),
                                  ),
                                  Text(
                                    'OTP: ${d.$2}',
                                    style: GoogleFonts.manrope(
                                      fontSize: 12,
                                      color: context.colors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )),
                      const SizedBox(height: 4),
                      Text(
                        'Tap a number to autofill',
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          color: context.colors.onSurfaceVariant
                              .withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
