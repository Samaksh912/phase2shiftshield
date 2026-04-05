import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../quote/screens/quote_screen.dart';

class FloatingCtaButton extends StatelessWidget {
  final bool isLoading;
  final bool nextWeekAvailable;

  const FloatingCtaButton({
    super.key,
    required this.isLoading,
    this.nextWeekAvailable = true,
  });

  @override
  Widget build(BuildContext context) {
    final alreadyCovered = !nextWeekAvailable;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          if (isLoading) return;
          // Always push QuoteScreen — it will show "already covered" if applicable
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const QuoteScreen()),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: alreadyCovered
                  ? [Colors.green.shade600, Colors.green.shade400]
                  : [context.colors.primary, context.colors.primaryContainer],
            ),
            boxShadow: [
              BoxShadow(
                color: (alreadyCovered ? Colors.green : context.colors.primary)
                    .withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                alreadyCovered ? Icons.check_circle_outline : Icons.bolt,
                color: context.colors.onPrimaryFixed,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                alreadyCovered ? "NEXT WEEK COVERED" : "GET NEXT WEEK'S QUOTE",
                style: GoogleFonts.spaceGrotesk(
                  color: context.colors.onPrimaryFixed,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
