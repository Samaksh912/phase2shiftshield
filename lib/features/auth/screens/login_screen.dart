import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/router/app_router.dart';
import '../widgets/animated_network_background.dart';
import '../widgets/demo_credentials_box.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _mobileController = TextEditingController();
  bool _isLoading = false;

  Future<void> _getOtp() async {
    final mobileNumber = _mobileController.text.trim();
    if (mobileNumber.length != 10) return;

    setState(() => _isLoading = true);
    try {
      await AuthService.clearToken();
      await ApiService.sendLoginOtp(mobileNumber);
      await AuthService.savePhone(mobileNumber);
      if (!mounted) return;
      context.push(AppRoutes.verifyOtpPath(mobileNumber), extra: {'isLogin': true});
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not reach server. Is the backend running?'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _mobileController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      resizeToAvoidBottomInset: false,
      body: AnimatedNetworkBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 24.0,
              vertical: 16.0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 8),

                // Back Button (Top Left)
                Align(
                  alignment: Alignment.centerLeft,
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: context.colors.surface.withValues(alpha: 0.05),
                          border: Border.all(
                            color: context.colors.outline.withValues(
                              alpha: 0.2,
                            ),
                            width: 1,
                          ),
                        ),
                        child: IconButton(
                          icon: Icon(
                            Icons.arrow_back,
                            color: context.colors.onSurface,
                            size: 20,
                          ),
                          onPressed: () {
                            if (context.canPop()) {
                              context.pop();
                            } else {
                              context.go(AppRoutes.onboarding);
                            }
                          },
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 32),

                // Headings
                RichText(
                  text: TextSpan(
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 40,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1.0,
                      color: context.colors.onSurface,
                    ),
                    children: [
                      TextSpan(text: 'WELCOME '),
                      TextSpan(
                        text: 'BACK',
                        style: GoogleFonts.spaceGrotesk(
                          color: context.colors.primary,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Enter your mobile number to sign in with instant protection.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: context.colors.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),

                const SizedBox(height: 72),

                // Login Card
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.black.withValues(alpha: 0.5)
                            : Colors.black.withValues(alpha: 0.1),
                        blurRadius: 40,
                        offset: const Offset(0, 20),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(32),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(32),
                          color: context.colors.onSurface.withValues(
                            alpha: 0.02,
                          ),
                          border: Border.all(
                            color: context.colors.onSurface.withValues(
                              alpha: 0.1,
                            ),
                            width: 1,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Subtle Glow Edge at the top
                            Container(
                              height: 2,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.transparent,
                                    context.colors.primary.withValues(alpha: 0.3),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            Text(
                              'MOBILE NUMBER',
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 2.0,
                                color: context.colors.onSurfaceVariant,
                              ),
                            ),
                            SizedBox(height: 12),

                            // Input Field
                            Row(
                              children: [
                                Container(
                                  height: 64,
                                  padding: EdgeInsets.symmetric(horizontal: 16),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: context.colors.onSurface.withValues(
                                      alpha: 0.05,
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: context.colors.onSurface
                                          .withValues(alpha: 0.1),
                                    ),
                                  ),
                                  child: Text(
                                    '+91',
                                    style: GoogleFonts.spaceGrotesk(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                      color: context.colors.primary,
                                    ),
                                  ),
                                ),
                                SizedBox(width: 12),
                                Expanded(
                                  child: Container(
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color: context.colors.onSurface
                                          .withValues(alpha: 0.05),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: TextField(
                                      controller: _mobileController,
                                      autofocus: true,
                                      keyboardType: TextInputType.phone,
                                      maxLength: 10,
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w500,
                                        letterSpacing: 2.0,
                                        color: context.colors.onSurface,
                                      ),
                                      decoration: InputDecoration(
                                        counterText: '',
                                        border: InputBorder.none,
                                        contentPadding: EdgeInsets.symmetric(
                                          horizontal: 24,
                                          vertical: 20,
                                        ),
                                        hintText: '98765 43210',
                                        hintStyle: GoogleFonts.spaceGrotesk(
                                          color: context.colors.onSurface
                                              .withValues(alpha: 0.4),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),

                            // CTA Section
                            SizedBox(
                              width: double.infinity,
                              height: 64,
                              child: ElevatedButton(
                                onPressed: _isLoading ? null : _getOtp,
                                style: ElevatedButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  elevation: 8,
                                  shadowColor: context.colors.primary
                                      .withValues(alpha: 0.2),
                                ),
                                child: Ink(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        context.colors.primary,
                                        context.colors.primaryContainer,
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Container(
                                    alignment: Alignment.center,
                                    child: _isLoading
                                        ? SizedBox(
                                            width: 24,
                                            height: 24,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color:
                                                  context.colors.onPrimaryFixed,
                                            ),
                                          )
                                        : Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                'GET OTP',
                                                style: GoogleFonts.spaceGrotesk(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w900,
                                                  letterSpacing: 2.0,
                                                  color: context
                                                      .colors
                                                      .onPrimaryFixed,
                                                ),
                                              ),
                                              SizedBox(width: 12),
                                              Icon(
                                                Icons.arrow_forward,
                                                color: context
                                                    .colors
                                                    .onPrimaryFixed,
                                              ),
                                            ],
                                          ),
                                  ),
                                ),
                              ),
                            ),

                            SizedBox(height: 24),

                            // Footer inside card
                            Center(
                              child: Column(
                                children: [
                                  GestureDetector(
                                    onTap: () {
                                      context.push(AppRoutes.signup);
                                    },
                                    child: RichText(
                                      textAlign: TextAlign.center,
                                      text: TextSpan(
                                        style: GoogleFonts.manrope(
                                          fontSize: 14,
                                          color:
                                              context.colors.onSurfaceVariant,
                                        ),
                                        children: [
                                          TextSpan(
                                            text: "Don't have an account? ",
                                          ),
                                          TextSpan(
                                            text: "Join the Fleet",
                                            style: GoogleFonts.manrope(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w800,
                                              color: context.colors.primary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  SizedBox(height: 24),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Divider(
                                          color: context.colors.outline
                                              .withValues(alpha: 0.1),
                                        ),
                                      ),
                                      Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 16,
                                        ),
                                        child: Text(
                                          'SHIELD PROTECTION',
                                          style: GoogleFonts.manrope(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 3.0,
                                            color: context.colors.onSurface
                                                .withValues(alpha: 0.3),
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Divider(
                                          color: context.colors.onSurface
                                              .withValues(alpha: 0.1),
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
                    ),
                  ),
                ),

                const SizedBox(height: 16),
                DemoCredentialsBox(
                  label: 'DEMO LOGIN CREDENTIALS',
                  credentials: const [
                    ('9876543210', '9324'),
                    ('9123456780', '2841'),
                    ('9988776655', '6157'),
                    ('9345678123', '4408'),
                    ('9451203344', '7712'),
                  ],
                  onTap: (phone) => _mobileController.text = phone,
                ),
                const SizedBox(height: 24),
                // Footer Decorative
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.verified_user,
                      color: context.colors.primary.withValues(alpha: 0.3),
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'SHIELD SECURE PROTOCOL',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.0,
                        color: context.colors.onSurface.withValues(alpha: 0.3),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
          ),
        ),
      ),
    );
  }
}
