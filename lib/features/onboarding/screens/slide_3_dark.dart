import 'package:flutter/material.dart';
import '../../../theme/app_colors.dart';

class Slide3Dark extends StatelessWidget {
  const Slide3Dark({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Background Imagery Decorative
          Positioned.fill(
            child: Opacity(
              opacity: 0.2,
              child: Image.asset(
                'assets/images/onboarding_bg.jpg',
                fit: BoxFit.cover,
                colorBlendMode: BlendMode.saturation,
                color: Colors.black, // grayscale equivalent
              ),
            ),
          ),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(flex: 1),

                  // Visual Component: The "Active Shield" Kinetic Illustration
                  Expanded(
                    flex: 10,
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: SizedBox(
                          width: 320,
                          height:
                              384, // aspect-square approx matching design proportions
                          child: Stack(
                            alignment: Alignment.center,
                            clipBehavior: Clip.none,
                            children: [
                              // Kinetic Background Glow
                              Container(
                                width: 280,
                                height: 280,
                                decoration: BoxDecoration(
                                  color: context.colors.primary.withValues(
                                    alpha:
                                    0.15,
                                  ),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: context.colors.primary.withValues(
                                        alpha:
                                        0.1,
                                      ),
                                      blurRadius: 100,
                                    ),
                                  ],
                                ),
                              ),

                              // The Digital Wallet Layout
                              Container(
                                width: 288,
                                height: 384, // h-96
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  color: context.colors.surfaceContainerLow,
                                  borderRadius: BorderRadius.circular(24),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.4),
                                      blurRadius: 40,
                                      offset: const Offset(0, 20),
                                    ),
                                  ],
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    // Top Section
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 40,
                                          height: 40,
                                          decoration: BoxDecoration(
                                            color: context.colors.primary
                                                .withValues(alpha: 0.2),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            Icons.account_balance_wallet,
                                            color: context.colors.primary,
                                            size: 20,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 4,
                                          ),
                                          decoration: BoxDecoration(
                                            color: context
                                                .colors
                                                .surfaceContainerHighest,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: Text(
                                            "WALLET ACTIVE",
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelSmall
                                                ?.copyWith(
                                                  fontSize: 10,
                                                  color: context
                                                      .colors
                                                      .onSurfaceVariant,
                                                  letterSpacing: -0.5,
                                                ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 24),

                                    // Payout Visualization
                                    Text(
                                      "AVAILABLE BALANCE",
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            fontSize: 12,
                                            color:
                                                context.colors.onSurfaceVariant,
                                            letterSpacing: 2.0,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.baseline,
                                      textBaseline: TextBaseline.alphabetic,
                                      children: [
                                        Text(
                                          "\$",
                                          style: Theme.of(context)
                                              .textTheme
                                              .displaySmall
                                              ?.copyWith(
                                                color: context.colors.primary,
                                                fontSize: 24,
                                              ),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          "428.50",
                                          style: Theme.of(context)
                                              .textTheme
                                              .displayLarge
                                              ?.copyWith(
                                                fontSize: 48,
                                                letterSpacing: -1.0,
                                              ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 24),

                                    // Bento Grid Info Snippets
                                    Expanded(
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Container(
                                              padding: const EdgeInsets.all(12),
                                              decoration: BoxDecoration(
                                                color: context
                                                    .colors
                                                    .surfaceContainer,
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                              ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Text(
                                                    "RECENT",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .labelSmall
                                                        ?.copyWith(
                                                          color: context
                                                              .colors
                                                              .primary,
                                                          fontSize: 10,
                                                        ),
                                                  ),
                                                  Text(
                                                    "+\$124",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleLarge
                                                        ?.copyWith(
                                                          fontSize: 18,
                                                        ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Container(
                                              padding: const EdgeInsets.all(12),
                                              decoration: BoxDecoration(
                                                color: context
                                                    .colors
                                                    .surfaceContainer,
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                              ),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Text(
                                                    "DELIVERIES",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .labelSmall
                                                        ?.copyWith(
                                                          color: context
                                                              .colors
                                                              .onSurfaceVariant,
                                                          fontSize: 10,
                                                        ),
                                                  ),
                                                  Text(
                                                    "12",
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleLarge
                                                        ?.copyWith(
                                                          fontSize: 18,
                                                        ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 16),

                                    // Transfer Action Overlay
                                    Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [
                                            context.colors.primary,
                                            context.colors.primaryContainer,
                                          ],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        ),
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                width: 32,
                                                height: 32,
                                                decoration: BoxDecoration(
                                                  color: context
                                                      .colors
                                                      .onPrimaryFixed
                                                      .withValues(alpha: 0.2),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: Icon(
                                                  Icons.bolt,
                                                  color: context
                                                      .colors
                                                      .onPrimaryFixed,
                                                  size: 16,
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Text(
                                                "Payout Sent",
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .labelLarge
                                                    ?.copyWith(
                                                      color: context
                                                          .colors
                                                          .onPrimaryFixed,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                              ),
                                            ],
                                          ),
                                          Icon(
                                            Icons.check_circle,
                                            color:
                                                context.colors.onPrimaryFixed,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Floating Kinetic Elements
                              Positioned(
                                top: -16,
                                right: -16,
                                child: Transform.rotate(
                                  angle: 0.2, // ~12 degrees
                                  child: Container(
                                    width: 80,
                                    height: 80,
                                    decoration: BoxDecoration(
                                      color: context
                                          .colors
                                          .surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(20),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.3),
                                          blurRadius: 20,
                                          offset: const Offset(4, 10),
                                        ),
                                      ],
                                    ),
                                    child: Icon(
                                      Icons.payments,
                                      color: context.colors.primary,
                                      size: 32,
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 40,
                                left: -24,
                                child: Transform.rotate(
                                  angle: -0.2, // ~ -12 degrees
                                  child: Container(
                                    width: 64,
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color:
                                          context.colors.surfaceContainerHigh,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.05),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.3),
                                          blurRadius: 20,
                                          offset: const Offset(-4, 10),
                                        ),
                                      ],
                                    ),
                                    child: Icon(
                                      Icons.credit_card,
                                      color: context.colors.secondary,
                                      size: 24,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                  const Spacer(flex: 1),

                  // Typography & Content
                  RichText(
                    text: TextSpan(
                      style: Theme.of(context).textTheme.displayMedium
                          ?.copyWith(
                            height: 1.0,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.5,
                          ),
                      children: [
                        const TextSpan(text: "Instant\n"),
                        TextSpan(
                          text: "Payouts.",
                          style: TextStyle(color: context.colors.primary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    "Finish a shift and get paid before you've even taken off your helmet. Real-time earnings for real-time hustle.",
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: context.colors.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),

                  // INCREASED: Safely clears the bottom gradient, progress dots, and button
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
