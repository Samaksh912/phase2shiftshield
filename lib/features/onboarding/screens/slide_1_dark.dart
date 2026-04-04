import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';

class Slide1Dark extends StatelessWidget {
  const Slide1Dark({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Graphic Placeholder / Future Image
          Positioned.fill(
            child: Opacity(
              opacity: 0.5,
              child: Image.asset(
                'assets/images/slide_1_bg.png',
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
              ),
            ),
          ),

          // Content Layer
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // This spacer pushes all the content to the bottom responsively
                  const Spacer(),

                  // VITAL STATUS chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: context.colors.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      "VITAL STATUS",
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: context.colors.onPrimaryFixed,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                        fontSize: 10,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Headline
                  Text(
                    "Earn Protection",
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: context.colors.onSurface,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                      letterSpacing: -1.0,
                    ),
                  ),
                  Text(
                    "While You Ride",
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: context.colors.primary,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                      letterSpacing: -1.0,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Subtitle
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          "Dynamic coverage that activates\nthe second you log on to your\ndelivery app.",
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: context.colors.onSurfaceVariant,
                                height: 1.5,
                              ),
                        ),
                      ),

                      // Floating Theme Toggle Button Mockup
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainerLow,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.5),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.brightness_medium,
                          color: context.colors.primary,
                          size: 20,
                        ),
                      ),
                    ],
                  ),

                  // Safely clears the bottom gradient, progress dots, and button
                  const SizedBox(height: 180),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
