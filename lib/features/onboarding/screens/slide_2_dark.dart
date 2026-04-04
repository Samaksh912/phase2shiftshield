import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';

class Slide2Dark extends StatelessWidget {
  const Slide2Dark({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(flex: 1),

              // Hero Visual Section: Centered Phone Mockup
              Expanded(
                flex: 10,
                child: Center(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Container(
                      width: 280,
                      height: 575, // Aspect ratio 9/18.5 approximate
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(48),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.5),
                            blurRadius: 50,
                            offset: const Offset(0, 20),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.topCenter,
                        children: [
                          // Notch
                          Container(
                            width: 112,
                            height: 24,
                            decoration: const BoxDecoration(
                              color: Colors.black,
                              borderRadius: BorderRadius.only(
                                bottomLeft: Radius.circular(16),
                                bottomRight: Radius.circular(16),
                              ),
                            ),
                          ),

                          // Internal UI
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const SizedBox(height: 32),
                                // Active Status Badge
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: context.colors.primary.withValues(
                                      alpha:
                                      0.1,
                                    ),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: context.colors.primary.withValues(
                                        alpha:
                                        0.2,
                                      ),
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: context.colors.primary
                                            .withValues(alpha: 0.15),
                                        blurRadius: 20,
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    children: [
                                      // Pulse dot
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: BoxDecoration(
                                          color: context.colors.primary,
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: context.colors.primary,
                                              blurRadius: 8,
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Text(
                                        "SHIELD ACTIVE",
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelSmall
                                            ?.copyWith(
                                              color: context.colors.primary,
                                              letterSpacing: 1.5,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                                // Auto-Processing Card
                                Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color:
                                        context.colors.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.05),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                "CLAIM ID #8812",
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .labelSmall
                                                    ?.copyWith(
                                                      color: context
                                                          .colors
                                                          .onSurfaceVariant,
                                                      fontSize: 8,
                                                      letterSpacing: 1.0,
                                                    ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                "Heavy Rain",
                                                style: Theme.of(
                                                  context,
                                                ).textTheme.titleMedium,
                                              ),
                                            ],
                                          ),
                                          Icon(
                                            Icons.auto_awesome,
                                            color: context.colors.primary,
                                            size: 18,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 16),
                                      // Progress Logic
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            "Analyzing Impact",
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelSmall
                                                ?.copyWith(
                                                  fontSize: 9,
                                                  color: context
                                                      .colors
                                                      .onSurfaceVariant,
                                                ),
                                          ),
                                          Text(
                                            "82%",
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelSmall
                                                ?.copyWith(
                                                  fontSize: 9,
                                                  color: context.colors.primary,
                                                ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Container(
                                        height: 6,
                                        width: double.infinity,
                                        decoration: BoxDecoration(
                                          color: Colors.black.withValues(alpha: 0.4),
                                          borderRadius: BorderRadius.circular(
                                            3,
                                          ),
                                        ),
                                        alignment: Alignment.centerLeft,
                                        child: Container(
                                          width: 180, // roughly 82% of 220
                                          height: 6,
                                          decoration: BoxDecoration(
                                            color: context.colors.primary,
                                            borderRadius: BorderRadius.circular(
                                              3,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      // Data Points
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Container(
                                              padding: const EdgeInsets.all(10),
                                              decoration: BoxDecoration(
                                                color: context
                                                    .colors
                                                    .surfaceContainerLow,
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                                border: Border.all(
                                                  color: Colors.white
                                                      .withValues(alpha: 0.05),
                                                ),
                                              ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    "TIME",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .labelSmall
                                                        ?.copyWith(
                                                          fontSize: 7,
                                                          letterSpacing: 1.0,
                                                        ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    "14:02:11",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleSmall
                                                        ?.copyWith(
                                                          fontSize: 10,
                                                        ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Container(
                                              padding: const EdgeInsets.all(10),
                                              decoration: BoxDecoration(
                                                color: context
                                                    .colors
                                                    .surfaceContainerLow,
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                                border: Border.all(
                                                  color: Colors.white
                                                      .withValues(alpha: 0.05),
                                                ),
                                              ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    "PAYOUT",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .labelSmall
                                                        ?.copyWith(
                                                          fontSize: 7,
                                                          letterSpacing: 1.0,
                                                        ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    "Instant",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleSmall
                                                        ?.copyWith(
                                                          fontSize: 10,
                                                          color: context
                                                              .colors
                                                              .primary,
                                                        ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const Spacer(),
                                // Visual Confirmation Overlay
                                Center(
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      Container(
                                        width: 80,
                                        height: 80,
                                        decoration: BoxDecoration(
                                          color: context.colors.primary
                                              .withValues(alpha: 0.2),
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: context.colors.primary
                                                  .withValues(alpha: 0.4),
                                              blurRadius: 30,
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(
                                        Icons.verified_user,
                                        color: context.colors.primary,
                                        size: 60,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 40),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              const Spacer(flex: 1),

              // Content Section
              Text(
                "Automatic Claims,\nZero Hassle.",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  height: 1.1,
                  shadows: [
                    Shadow(
                      color: context.colors.primary.withValues(alpha: 0.4),
                      blurRadius: 15,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  "Our AI detects incidents in real-time. No paperwork, no phone calls—just instant coverage when it matters most.",
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: context.colors.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
              ),

              // Safely clears the bottom gradient, progress dots, and button
              const SizedBox(height: 180),
            ],
          ),
        ),
      ),
    );
  }
}
