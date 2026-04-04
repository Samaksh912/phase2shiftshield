import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/router/app_router.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String mobileNumber;
  final bool isLogin;

  const VerifyOtpScreen({
    super.key,
    required this.mobileNumber,
    this.isLogin = true,
  });

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final List<TextEditingController> _controllers = List.generate(
    4,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());
  bool _isLoading = false;

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _onDefaultChange(String value, int index) {
    if (value.length == 1 && index < 3) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
    // Auto-submit when all 4 digits are entered
    if (_controllers.every((c) => c.text.length == 1)) {
      _verifyOtp();
    }
  }

  void _handleBack() {
    if (context.canPop()) {
      context.pop();
      return;
    }

    context.go(widget.isLogin ? AppRoutes.login : AppRoutes.signup);
  }

  Future<void> _verifyOtp() async {
    final otp = _controllers.map((c) => c.text).join();
    if (otp.length < 4) return;

    setState(() => _isLoading = true);
    try {
      await AuthService.clearToken();
      if (widget.isLogin) {
        // Login flow: verify-login-otp → login → get JWT
        final verifyData = await ApiService.verifyLoginOtp(widget.mobileNumber, otp);
        final verificationToken = verifyData['verification_token'] as String;

        final loginData = await ApiService.login(widget.mobileNumber, verificationToken);
        final token = loginData['token'] as String;

        await AuthService.saveToken(token);
        await AuthService.savePhone(widget.mobileNumber);
        if (!mounted) return;
        context.go(AppRoutes.dashboard);
      } else {
        // Signup flow: verify-otp → get verification_token → rider profile
        final verifyData = await ApiService.verifySignupOtp(widget.mobileNumber, otp);
        final verificationToken = verifyData['verification_token'] as String;

        if (!mounted) return;
        context.go(
          AppRoutes.riderProfile,
          extra: {
            'phone': widget.mobileNumber,
            'verification_token': verificationToken,
          },
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: Colors.red.shade700,
        ),
      );
      for (var c in _controllers) {
        c.clear();
      }
      _focusNodes[0].requestFocus();
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
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // TopAppBar
                Container(
                  height: 64,
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  decoration: BoxDecoration(
                    color: context.colors.surface.withValues(alpha: 0.7),
                  ),
                  child: ClipRRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: _handleBack,
                            child: Icon(
                              Icons.arrow_back,
                              color: context.colors.primary,
                            ),
                          ),
                          SizedBox(width: 16),
                          Text(
                            'VERIFY OTP',
                            style: GoogleFonts.spaceGrotesk(
                              color: context.colors.onSurface,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                Expanded(
                  child: ScrollConfiguration(
                    behavior: ScrollConfiguration.of(
                      context,
                    ).copyWith(overscroll: false),
                    child: SingleChildScrollView(
                      physics: BouncingScrollPhysics(),
                      padding: EdgeInsets.symmetric(
                        horizontal: 24.0,
                        vertical: 32.0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Hero Identity Section
                          Text(
                            'VERIFY MOBILE',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -1.0,
                              color: context.colors.onSurface,
                            ),
                          ),
                          SizedBox(height: 12),
                          RichText(
                            text: TextSpan(
                              style: GoogleFonts.manrope(
                                fontSize: 16,
                                color: context.colors.onSurfaceVariant,
                                height: 1.5,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Enter the 4-digit code sent to\n',
                                ),
                                TextSpan(
                                  text: '+91 ${widget.mobileNumber}',
                                  style: GoogleFonts.manrope(
                                    fontWeight: FontWeight.bold,
                                    color: context.colors.onSurface,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 32),

                          // Asymmetric Information Card (Decorative Background Elements)
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(
                                top: -48,
                                right: -32,
                                child: Container(
                                  width: 128,
                                  height: 128,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: context.colors.primary.withValues(
                                      alpha:
                                      0.1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: context.colors.primary
                                            .withValues(alpha: 0.1),
                                        blurRadius: 64,
                                        spreadRadius: 32,
                                      ),
                                    ],
                                  ),
                                ),
                              ),

                              Column(
                                children: [
                                  // OTP Input Cluster
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: List.generate(4, (index) {
                                      return Container(
                                        width: 72,
                                        height: 80,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: context
                                              .colors
                                              .surfaceContainerLow,
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          border: Border.all(
                                            color:
                                                _focusNodes[index].hasFocus ||
                                                    _controllers[index]
                                                        .text
                                                        .isNotEmpty
                                                ? context
                                                      .colors
                                                      .primaryContainer
                                                : context.colors.outlineVariant
                                                      .withValues(alpha: 0.3),
                                            width: 2,
                                          ),
                                          boxShadow:
                                              _focusNodes[index].hasFocus ||
                                                  _controllers[index]
                                                      .text
                                                      .isNotEmpty
                                              ? [
                                                  BoxShadow(
                                                    color: context
                                                        .colors
                                                        .primary
                                                        .withValues(alpha: 0.1),
                                                    blurRadius: 20,
                                                    spreadRadius: 0,
                                                  ),
                                                ]
                                              : [],
                                        ),
                                        child: TextField(
                                          controller: _controllers[index],
                                          focusNode: _focusNodes[index],
                                          keyboardType: TextInputType.number,
                                          textAlign: TextAlign.center,
                                          maxLength: 1,
                                          onChanged: (value) =>
                                              _onDefaultChange(value, index),
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 32,
                                            fontWeight: FontWeight.bold,
                                            color: context.colors.onSurface,
                                          ),
                                          decoration: InputDecoration(
                                            counterText: '',
                                            border: InputBorder.none,
                                            contentPadding: EdgeInsets.zero,
                                          ),
                                        ),
                                      );
                                    }),
                                  ),
                                  SizedBox(height: 32),

                                  // Timer & Action Meta
                                  Column(
                                    children: [
                                      RichText(
                                        text: TextSpan(
                                          style: GoogleFonts.manrope(
                                            fontSize: 14,
                                            color:
                                                context.colors.onSurfaceVariant,
                                            letterSpacing: 0.5,
                                          ),
                                          children: [
                                            TextSpan(text: 'Resend code in '),
                                            TextSpan(
                                              text: '00:55',
                                              style: GoogleFonts.spaceGrotesk(
                                                // using spaceGrotesk for mono feeling
                                                color: context.colors.onSurface,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      SizedBox(height: 16),
                                      TextButton(
                                        onPressed: null, // Disabled
                                        style: TextButton.styleFrom(
                                          foregroundColor:
                                              context.colors.outline,
                                          disabledForegroundColor: context
                                              .colors
                                              .outline
                                              .withValues(alpha: 0.5),
                                        ),
                                        child: Text(
                                          'RESEND CODE',
                                          style: GoogleFonts.manrope(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.0,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),

                          SizedBox(height: 48),

                          // High-Impact Verification Section
                          // Glass-Morphic Context Container
                          Container(
                            padding: EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: context.colors.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Positioned(
                                  top: -10,
                                  right: -10,
                                  child: Icon(
                                    Icons.verified_user,
                                    size: 64,
                                    color: context.colors.onSurface.withValues(
                                      alpha:
                                      0.05,
                                    ),
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.lock,
                                          color: context.colors.primary,
                                          size: 20,
                                        ),
                                        SizedBox(width: 12),
                                        Text(
                                          'SECURE CHANNEL',
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 2.0,
                                            color: context.colors.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                    SizedBox(height: 8),
                                    Text(
                                      'Verification is handled via end-to-end encrypted protocol to ensure your delivery account remains secure.',
                                      style: GoogleFonts.manrope(
                                        fontSize: 12,
                                        color: context.colors.onSurfaceVariant,
                                        height: 1.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 32),

                          // Primary Action
                          SizedBox(
                            width: double.infinity,
                            height: 64,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _verifyOtp,
                              style: ElevatedButton.styleFrom(
                                padding: EdgeInsets.zero,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                elevation: 8,
                                shadowColor: context.colors.primary.withValues(
                                  alpha:
                                  0.25,
                                ),
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
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Container(
                                  alignment: Alignment.center,
                                  child: _isLoading
                                      ? const SizedBox(
                                          width: 24,
                                          height: 24,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Colors.white,
                                          ),
                                        )
                                      : Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              'VERIFY & CONTINUE',
                                              style: GoogleFonts.spaceGrotesk(
                                                fontSize: 18,
                                                fontWeight: FontWeight.w900,
                                                letterSpacing: 1.5,
                                                color: context
                                                    .colors
                                                    .onPrimaryFixed,
                                              ),
                                            ),
                                            SizedBox(width: 8),
                                            Icon(
                                              Icons.chevron_right,
                                              color:
                                                  context.colors.onPrimaryFixed,
                                            ),
                                          ],
                                        ),
                                ),
                              ),
                            ),
                          ),

                          SizedBox(height: 48),
                        ],
                      ),
                    ),
                  ),
                ),

                // Trust Badge Footer
                Padding(
                  padding: EdgeInsets.only(bottom: 24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(32),
                          border: Border.all(
                            color: context.colors.outlineVariant.withValues(
                              alpha:
                              0.1,
                            ),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons
                                  .security, // Using security as shield_with_heart proxy
                              color: context.colors.primary,
                              size: 16,
                            ),
                            SizedBox(width: 8),
                            Text(
                              'SHIELD SECURE PROTOCOL',
                              style: GoogleFonts.manrope(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2.0,
                                color: context.colors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'CERTIFIED FOR LOGISTICS OPERATIONS • V4.2.0',
                        style: GoogleFonts.manrope(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          color: context.colors.outline,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
