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

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final TextEditingController _mobileController = TextEditingController();
  bool _isLoading = false;

  // Real-time duplicate check state
  bool _isChecking = false;
  bool _isDuplicate = false;
  bool _otpAlreadySent = false;
  String? _checkedPhone;

  @override
  void initState() {
    super.initState();
    _mobileController.addListener(_onPhoneChanged);
  }

  void _onPhoneChanged() {
    final phone = _mobileController.text.trim();
    if (phone.length != 10) {
      if (_isDuplicate || _otpAlreadySent || _checkedPhone != null) {
        setState(() {
          _isDuplicate = false;
          _otpAlreadySent = false;
          _checkedPhone = null;
        });
      }
      return;
    }
    // Already checked or currently checking this exact number
    if (phone == _checkedPhone || _isChecking) return;
    _checkPhoneOnType(phone);
  }

  Future<void> _checkPhoneOnType(String phone) async {
    setState(() {
      _isChecking = true;
      _isDuplicate = false;
      _otpAlreadySent = false;
    });
    _checkedPhone = phone;
    try {
      await AuthService.clearToken();
      await ApiService.sendSignupOtp(phone);
      // OTP sent successfully — remember so _getOtp can skip the second call
      if (mounted) setState(() => _otpAlreadySent = true);
    } on ApiException catch (e) {
      if (e.errorCode == 'duplicate_registration') {
        if (mounted) {
          setState(() => _isDuplicate = true);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text(
                'This number already has an account.',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              backgroundColor: Colors.orange.shade700,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 5),
              action: SnackBarAction(
                label: 'LOG IN',
                textColor: Colors.white,
                onPressed: () => context.go(AppRoutes.login),
              ),
            ),
          );
        }
      }
      // Other errors: silently ignore — will surface on button press if needed
    } catch (_) {
      // Network error on background check: ignore silently
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _getOtp() async {
    final mobileNumber = _mobileController.text.trim();
    if (mobileNumber.length != 10) return;

    // Already confirmed as duplicate — show error and stop
    if (_isDuplicate) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'This number already has an account.',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          backgroundColor: Colors.orange.shade700,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'LOG IN',
            textColor: Colors.white,
            onPressed: () => context.go(AppRoutes.login),
          ),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      // OTP was already sent by the background check — skip the API call
      if (_otpAlreadySent && _checkedPhone == mobileNumber) {
        await AuthService.savePhone(mobileNumber);
        if (!mounted) return;
        context.push(AppRoutes.verifyOtpPath(mobileNumber), extra: {'isLogin': false});
        return;
      }

      debugPrint('[SignupScreen] Calling sendSignupOtp for phone=$mobileNumber');
      await AuthService.clearToken();
      await ApiService.sendSignupOtp(mobileNumber);
      await AuthService.savePhone(mobileNumber);
      if (!mounted) return;
      context.push(AppRoutes.verifyOtpPath(mobileNumber), extra: {'isLogin': false});
    } on ApiException catch (e) {
      debugPrint('[SignupScreen] ApiException code=${e.errorCode} message=${e.message}');
      if (!mounted) return;
      if (e.errorCode == 'duplicate_registration') {
        setState(() => _isDuplicate = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'This number already has an account.',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            backgroundColor: Colors.orange.shade700,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'LOG IN',
              textColor: Colors.white,
              onPressed: () => context.go(AppRoutes.login),
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red.shade700),
        );
      }
    } catch (error, stackTrace) {
      debugPrint('[SignupScreen] Unexpected error: $error\n$stackTrace');
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
    _mobileController.removeListener(_onPhoneChanged);
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

                // Glassmorphic Back Button (Top Left)
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
                      const TextSpan(text: 'JOIN THE '),
                      TextSpan(
                        text: 'FLEET',
                        style: GoogleFonts.spaceGrotesk(
                          color: context.colors.primary,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your mobile number to get started with instant protection.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: context.colors.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),

                const SizedBox(height: 72),

                // Glassmorphic Signup Card
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
                            const SizedBox(height: 12),

                            // Input Field
                            Row(
                              children: [
                                Container(
                                  height: 64,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                  ),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: context.colors.onSurface.withValues(
                                      alpha: 0.05,
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: _isDuplicate
                                          ? Colors.orange.shade700
                                          : context.colors.onSurface
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
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Container(
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color: _isDuplicate
                                          ? Colors.orange.withValues(alpha: 0.08)
                                          : context.colors.onSurface
                                              .withValues(alpha: 0.05),
                                      borderRadius: BorderRadius.circular(12),
                                      border: _isDuplicate
                                          ? Border.all(
                                              color: Colors.orange.shade700,
                                              width: 1.5,
                                            )
                                          : null,
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
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 24,
                                              vertical: 20,
                                            ),
                                        hintText: '98765 43210',
                                        hintStyle: GoogleFonts.spaceGrotesk(
                                          color: context.colors.onSurface
                                              .withValues(alpha: 0.4),
                                        ),
                                        suffixIcon: _isChecking
                                            ? Padding(
                                                padding: const EdgeInsets.all(20),
                                                child: SizedBox(
                                                  width: 16,
                                                  height: 16,
                                                  child: CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    color: context.colors.primary.withValues(alpha: 0.6),
                                                  ),
                                                ),
                                              )
                                            : _isDuplicate
                                                ? Icon(Icons.error_outline,
                                                    color: Colors.orange.shade700,
                                                    size: 20)
                                                : null,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (_isDuplicate) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(Icons.info_outline,
                                      size: 13,
                                      color: Colors.orange.shade700),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Already registered — tap LOG IN',
                                    style: GoogleFonts.manrope(
                                      fontSize: 12,
                                      color: Colors.orange.shade700,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 16),

                            // CTA Section
                            SizedBox(
                              width: double.infinity,
                              height: 64,
                              child: ElevatedButton(
                                onPressed: (_isLoading || _isDuplicate || _isChecking) ? null : _getOtp,
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
                                              const SizedBox(width: 12),
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

                            const SizedBox(height: 24),

                            // Footer inside card
                            Center(
                              child: Column(
                                children: [
                                  GestureDetector(
                                    onTap: () {
                                      if (context.canPop()) {
                                        context.pop();
                                      } else {
                                        context.push(AppRoutes.login);
                                      }
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
                                          const TextSpan(
                                            text: "Already have an account? ",
                                          ),
                                          TextSpan(
                                            text: "Log In",
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
                                  const SizedBox(height: 24),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Divider(
                                          color: context.colors.outline
                                              .withValues(alpha: 0.1),
                                        ),
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
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
                DemoCredentialsBox(onTap: (phone) {
                  _mobileController.text = phone;
                }),
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
                    const SizedBox(width: 8),
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
