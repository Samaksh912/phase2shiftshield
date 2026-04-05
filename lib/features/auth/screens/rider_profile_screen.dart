import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_colors.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/router/app_router.dart';

class RiderProfileScreen extends StatefulWidget {
  final String phone;
  final String verificationToken;

  const RiderProfileScreen({
    super.key,
    required this.phone,
    required this.verificationToken,
  });

  @override
  State<RiderProfileScreen> createState() => _RiderProfileScreenState();
}

enum PlatformAlignment { swiggy, zomato, none }
enum PayoutMode { upi, wallet }

class _RiderProfileScreenState extends State<RiderProfileScreen> {
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _lunchBaselineController = TextEditingController(text: '420');
  final TextEditingController _dinnerBaselineController = TextEditingController(text: '680');
  final TextEditingController _upiController = TextEditingController();

  PlatformAlignment _selectedPlatform = PlatformAlignment.swiggy;
  // Shifts: 'lunch' | 'dinner' | 'both'
  bool _lunchSelected = true;
  bool _dinnerSelected = true;
  PayoutMode _payoutMode = PayoutMode.wallet;
  bool _isCompliant = false;
  final bool _isLoading = false;
  bool _isSubmitting = false;

  // Cities & zones from API
  List<Map<String, dynamic>> _cities = [];
  List<Map<String, dynamic>> _zones = [];
  String? _selectedCityId;
  String? _selectedZoneId;
  bool _zonesLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCitiesAndZones();
  }

  Future<void> _loadCitiesAndZones() async {
    try {
      final data = await ApiService.getCities();
      final cities = (data['cities'] as List<dynamic>).cast<Map<String, dynamic>>();
      setState(() {
        _cities = cities;
        if (_cities.isNotEmpty) {
          _selectedCityId = _cities.first['id'] as String;
          _zones = (_cities.first['zones'] as List<dynamic>).cast<Map<String, dynamic>>();
          if (_zones.isNotEmpty) _selectedZoneId = _zones.first['id'] as String;
        }
        _zonesLoading = false;
      });
      _applyZoneAverages();
    } catch (_) {
      setState(() => _zonesLoading = false);
    }
  }

  void _onCityChanged(String? cityId) {
    if (cityId == null) return;
    final city = _cities.firstWhere((c) => c['id'] == cityId, orElse: () => _cities.first);
    setState(() {
      _selectedCityId = cityId;
      _zones = (city['zones'] as List<dynamic>).cast<Map<String, dynamic>>();
      _selectedZoneId = _zones.isNotEmpty ? _zones.first['id'] as String : null;
    });
    _applyZoneAverages();
  }

  void _applyZoneAverages() {
    if (_selectedZoneId == null || _zones.isEmpty) return;
    final zone = _zones.firstWhere(
      (z) => z['id'] == _selectedZoneId,
      orElse: () => _zones.first,
    );
    _lunchBaselineController.text = (zone['avg_lunch_earnings'] ?? 420).toString();
    _dinnerBaselineController.text = (zone['avg_dinner_earnings'] ?? 680).toString();
  }

  String get _shiftsValue {
    if (_lunchSelected && _dinnerSelected) return 'both';
    if (_lunchSelected) return 'lunch';
    if (_dinnerSelected) return 'dinner';
    return 'both';
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _lunchBaselineController.dispose();
    _dinnerBaselineController.dispose();
    _upiController.dispose();
    super.dispose();
  }

  void _toggleLunch() {
    setState(() {
      if (_lunchSelected && !_dinnerSelected) return; // keep at least one
      _lunchSelected = !_lunchSelected;
    });
  }

  void _toggleDinner() {
    setState(() {
      if (_dinnerSelected && !_lunchSelected) return;
      _dinnerSelected = !_dinnerSelected;
    });
  }

  void _handleBack() {
    if (context.canPop()) {
      context.pop();
      return;
    }

    context.go(AppRoutes.signup);
  }

  Future<void> _completeSetup() async {
    if (!_isCompliant) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept the declaration to continue')),
      );
      return;
    }
    if (_selectedZoneId == null || _selectedCityId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select your city and operational zone')),
      );
      return;
    }
    final name = _fullNameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your full name')),
      );
      return;
    }
    if (_payoutMode == PayoutMode.upi && _upiController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your UPI ID to continue')),
      );
      return;
    }
    if (widget.verificationToken.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification expired. Please request OTP again.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final data = await ApiService.signup({
        'name': name,
        'phone': widget.phone,
        'platform': _selectedPlatform == PlatformAlignment.swiggy ? 'swiggy' : 'zomato',
        'city_id': _selectedCityId,
        'zone_id': _selectedZoneId,
        'shifts_covered': _shiftsValue,
        'payout_preference': _payoutMode == PayoutMode.wallet ? 'wallet' : 'upi',
        'upi_id': _upiController.text.trim().isEmpty ? null : _upiController.text.trim(),
        'verification_token': widget.verificationToken,
      });
      // Save the JWT token from signup response
      final token = data['token'] as String;
      await AuthService.saveToken(token);
      await AuthService.savePhone(widget.phone);
      await AuthService.markOpenQuoteAfterSignup();
      if (!mounted) return;
      context.go(AppRoutes.dashboard);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red.shade700),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not reach server. Is the backend running?'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.surface,
      body: Stack(
        children: [
          // Main Scrollable Content
          SafeArea(
            bottom: false,
            child: ScrollConfiguration(
              behavior: ScrollConfiguration.of(context).copyWith(overscroll: false),
              child: SingleChildScrollView(
                physics: BouncingScrollPhysics(),
                padding: EdgeInsets.only(top: 80, left: 24, right: 24, bottom: 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header Section
                    Text(
                      'Complete Your Profile',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -1.0,
                        color: context.colors.onSurface,
                        height: 1.1,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Finalize your details to unlock active coverage.',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                    SizedBox(height: 40),

                    // Full Name Slab Input
                    _buildSectionLabel('Identity Anchor'),
                    Container(
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: TextField(
                        controller: _fullNameController,
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          color: context.colors.onSurface,
                        ),
                        decoration: InputDecoration(
                          border: InputBorder.none,
                          hintText: 'Your Legal Full Name',
                          hintStyle: GoogleFonts.spaceGrotesk(
                            color: context.colors.onSurfaceVariant.withValues(alpha: 0.4),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: 24),

                    // Platform Alignment
                    _buildSectionLabel('Platform Alignment'),
                    Row(
                      children: [
                        Expanded(
                          child: _buildPlatformCard(
                            platform: PlatformAlignment.swiggy,
                            title: 'Swiggy',
                            icon: Icons.delivery_dining,
                          ),
                        ),
                        SizedBox(width: 16),
                        Expanded(
                          child: _buildPlatformCard(
                            platform: PlatformAlignment.zomato,
                            title: 'Zomato',
                            icon: Icons.restaurant,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),

                    // City & Zone Dropdowns (live from API)
                    if (_zonesLoading)
                      const Center(child: CircularProgressIndicator())
                    else
                    Column(
                      children: [
                        // City Dropdown
                        Container(
                          decoration: BoxDecoration(
                            color: context.colors.surfaceContainer,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildSectionLabel('City'),
                              DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedCityId,
                                  isExpanded: true,
                                  dropdownColor: context.colors.surfaceContainer,
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: context.colors.onSurface,
                                  ),
                                  icon: Icon(Icons.expand_more, color: context.colors.primary),
                                  items: _cities.map((c) {
                                    return DropdownMenuItem<String>(
                                      value: c['id'] as String,
                                      child: Text('${c['name']}'),
                                    );
                                  }).toList(),
                                  onChanged: _onCityChanged,
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 16),
                        // Zone Dropdown
                        Container(
                          decoration: BoxDecoration(
                            color: context.colors.surfaceContainer,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildSectionLabel('Operational Zone'),
                              DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedZoneId,
                                  isExpanded: true,
                                  dropdownColor: context.colors.surfaceContainer,
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: context.colors.onSurface,
                                  ),
                                  icon: Icon(Icons.expand_more, color: context.colors.primary),
                                  items: _zones.map((z) {
                                    return DropdownMenuItem<String>(
                                      value: z['id'] as String,
                                      child: Text('${z['name']}'),
                                    );
                                  }).toList(),
                                  onChanged: (val) {
                                    setState(() => _selectedZoneId = val);
                                    _applyZoneAverages();
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),

                    // Earnings Baselines (Lunch + Dinner)
                    if (_isLoading)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                            const SizedBox(width: 12),
                            Text('Fetching your earnings data...', style: GoogleFonts.manrope(color: context.colors.onSurfaceVariant, fontSize: 13)),
                          ],
                        ),
                      )
                    else
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: context.colors.surfaceContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: _buildSectionLabel('Lunch Baseline')),
                                    GestureDetector(
                                      onTap: () => _showBaselineInfo(context, 'lunch'),
                                      child: Icon(Icons.info_outline, size: 16, color: context.colors.primary),
                                    ),
                                  ],
                                ),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Text('₹', style: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w900, color: context.colors.onSurface)),
                                    SizedBox(width: 4),
                                    Expanded(
                                      child: TextField(
                                        controller: _lunchBaselineController,
                                        keyboardType: TextInputType.number,
                                        style: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w900, color: context.colors.onSurface),
                                        decoration: InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                                      ),
                                    ),
                                  ],
                                ),
                                Text('PER SHIFT', style: GoogleFonts.manrope(fontSize: 9, fontWeight: FontWeight.bold, color: context.colors.onSurfaceVariant)),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            decoration: BoxDecoration(
                              color: context.colors.surfaceContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: _buildSectionLabel('Dinner Baseline')),
                                    GestureDetector(
                                      onTap: () => _showBaselineInfo(context, 'dinner'),
                                      child: Icon(Icons.info_outline, size: 16, color: context.colors.primary),
                                    ),
                                  ],
                                ),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Text('₹', style: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w900, color: context.colors.onSurface)),
                                    SizedBox(width: 4),
                                    Expanded(
                                      child: TextField(
                                        controller: _dinnerBaselineController,
                                        keyboardType: TextInputType.number,
                                        style: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w900, color: context.colors.onSurface),
                                        decoration: InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                                      ),
                                    ),
                                  ],
                                ),
                                Text('PER SHIFT', style: GoogleFonts.manrope(fontSize: 9, fontWeight: FontWeight.bold, color: context.colors.onSurfaceVariant)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),

                    // Shift Selector Chips (Lunch / Dinner)
                    _buildSectionLabel('Velocity Window'),
                    Row(
                      children: [
                        _buildShiftChip('LUNCH', Icons.wb_sunny, _lunchSelected, _toggleLunch),
                        SizedBox(width: 12),
                        _buildShiftChip('DINNER', Icons.nights_stay, _dinnerSelected, _toggleDinner),
                      ],
                    ),
                    SizedBox(height: 32),

                    // Payout Preference & Image
                    Container(
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: EdgeInsets.all(8),
                      child: Column(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: context.colors.surfaceContainerHighest.withValues(alpha: 0.5),
                              border: Border.all(color: context.colors.primary.withValues(alpha: 0.2)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: EdgeInsets.all(20),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    _buildSectionLabel('Payout Mode'),
                                    Row(
                                      children: [
                                        GestureDetector(
                                          onTap: () => setState(() => _payoutMode = PayoutMode.upi),
                                          child: Container(
                                            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: _payoutMode == PayoutMode.upi ? context.colors.primary : context.colors.surfaceContainerHigh,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              'UPI',
                                              style: GoogleFonts.manrope(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w900,
                                                color: _payoutMode == PayoutMode.upi ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant,
                                              ),
                                            ),
                                          ),
                                        ),
                                        SizedBox(width: 8),
                                        GestureDetector(
                                          onTap: () => setState(() => _payoutMode = PayoutMode.wallet),
                                          child: Container(
                                            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: _payoutMode == PayoutMode.wallet ? context.colors.primary : context.colors.surfaceContainerHigh,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              'WALLET',
                                              style: GoogleFonts.manrope(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w900,
                                                color: _payoutMode == PayoutMode.wallet ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                if (_payoutMode == PayoutMode.upi) ...[
                                SizedBox(height: 16),
                                Text(
                                  'UPI IDENTITY',
                                  style: GoogleFonts.manrope(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: context.colors.onSurfaceVariant,
                                  ),
                                ),
                                SizedBox(height: 8),
                                Container(
                                  decoration: BoxDecoration(
                                    color: context.colors.surfaceContainer,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  child: Row(
                                    children: [
                                      Icon(Icons.alternate_email, color: context.colors.primary, size: 20),
                                      SizedBox(width: 12),
                                      Expanded(
                                        child: TextField(
                                          controller: _upiController,
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: context.colors.onSurface,
                                          ),
                                          decoration: InputDecoration(
                                            border: InputBorder.none,
                                            hintText: 'rider@okaxis',
                                            hintStyle: GoogleFonts.spaceGrotesk(
                                              color: context.colors.onSurfaceVariant.withValues(alpha: 0.5),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                ],
                              ],
                            ),
                          ),
                          SizedBox(height: 8),
                          // Secure Settlement Image
                          Container(
                            height: 140,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              color: context.colors.surfaceContainer,
                            ),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Opacity(
                                    opacity: 0.4,
                                    child: Image.network(
                                      'https://lh3.googleusercontent.com/aida-public/AB6AXuBSrKO708MLv3tFxcdpNTu3BvhMJe9P1pJVXLeOBYaCFs33pLm0fIdHQ1hhRHyQn4HoZoUBMeHOetU6wkxB6TYO4hEUfU0wAnRTqjGakpxuY7BKkxF3tYnyzUdkYSf9t_BMEh0Z6sLDn6_gOMSQX56zCxm9JkjqczTS1Y1HSJdV7aYjsRr4Ys0whuxyrgtDYqXi2OdUqIlApviXtAeyWd3a8DfnKskQGlFZOLA6NHfwAFm-9iCbkdwZbnStiVRW2J4SNcpUcvvVw18',
                                      width: double.infinity,
                                      height: 140,
                                      fit: BoxFit.cover,
                                      colorBlendMode: BlendMode.overlay,
                                    ),
                                  ),
                                ),
                                Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.verified_user, color: context.colors.primary, size: 36),
                                    SizedBox(height: 8),
                                    Text(
                                      'SECURE SETTLEMENT',
                                      style: GoogleFonts.spaceGrotesk(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 2.0,
                                        color: context.colors.onSurface,
                                      ),
                                    ),
                                    SizedBox(height: 4),
                                    Text(
                                      'Direct to bank account enabled',
                                      style: GoogleFonts.manrope(
                                        fontSize: 10,
                                        color: context.colors.onSurfaceVariant,
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
                    SizedBox(height: 24),

                    // Compliance Check
                    GestureDetector(
                      onTap: () => setState(() => _isCompliant = !_isCompliant),
                      child: Container(
                        padding: EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: context.colors.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              _isCompliant ? Icons.check_box : Icons.check_box_outline_blank,
                              color: _isCompliant ? context.colors.primary : context.colors.onSurfaceVariant,
                            ),
                            SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                'I confirm that the details provided are accurate. I understand that misrepresentation of shift times or platform earnings may affect insurance claim eligibility.',
                                style: GoogleFonts.manrope(
                                  fontSize: 12,
                                  color: context.colors.onSurfaceVariant,
                                  height: 1.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          // TopAppBar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  height: 64 + MediaQuery.of(context).padding.top,
                  padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top, left: 24, right: 24),
                  color: context.colors.surface.withValues(alpha: 0.7),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          GestureDetector(
                            onTap: _handleBack,
                            child: Icon(
                              Icons.arrow_back,
                              color: context.colors.primary,
                            ),
                          ),
                          SizedBox(width: 12),
                          Text(
                            'RIDER PROFILE',
                            style: GoogleFonts.spaceGrotesk(
                              color: context.colors.onSurface,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'KIN-VELOCITY',
                        style: GoogleFonts.spaceGrotesk(
                          color: context.colors.primary,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          
          // BottomNavBar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: 16,
                left: 24,
                right: 24,
                bottom: MediaQuery.of(context).padding.bottom > 0 ? MediaQuery.of(context).padding.bottom : 24,
              ),
              decoration: BoxDecoration(
                color: context.colors.surfaceContainerLow,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: context.colors.primary.withValues(alpha: 0.12),
                    blurRadius: 32,
                    offset: Offset(0, -16),
                  ),
                ],
              ),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _completeSetup,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                    disabledBackgroundColor: context.colors.surfaceContainerHighest,
                  ),
                  child: Ink(
                    decoration: BoxDecoration(
                      gradient: _isCompliant
                          ? LinearGradient(
                              colors: [context.colors.primary, context.colors.primaryContainer],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: _isCompliant ? null : context.colors.surfaceContainerHighest.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Container(
                      alignment: Alignment.center,
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  color: _isCompliant ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant.withValues(alpha: 0.5),
                                  size: 20,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'COMPLETE SETUP',
                                  style: GoogleFonts.manrope(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.5,
                                    color: _isCompliant ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant.withValues(alpha: 0.5),
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showBaselineInfo(BuildContext context, String shift) {
    final isLunch = shift == 'lunch';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.colors.surfaceContainer,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.trending_up, color: context.colors.primary, size: 20),
            SizedBox(width: 8),
            Text(
              '${isLunch ? 'Lunch' : 'Dinner'} Baseline',
              style: GoogleFonts.spaceGrotesk(
                color: context.colors.onSurface,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your guaranteed minimum payout per protected ${isLunch ? 'lunch' : 'dinner'} shift.',
              style: GoogleFonts.manrope(color: context.colors.onSurface, fontSize: 14, height: 1.5),
            ),
            SizedBox(height: 12),
            Text('How it affects your coverage:', style: GoogleFonts.manrope(color: context.colors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            _infoPoint(context, 'Sets the floor for insurance payouts on triggered claims'),
            _infoPoint(context, 'Pre-filled from your zone\'s average — adjust if your actual earnings differ'),
            _infoPoint(context, 'Higher baseline = higher potential claim payout'),
            _infoPoint(context, 'Misrepresenting this may affect claim eligibility'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Got it', style: GoogleFonts.manrope(color: context.colors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _infoPoint(BuildContext context, String text) {
    return Padding(
      padding: EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.circle, size: 5, color: context.colors.primary),
          SizedBox(width: 8),
          Expanded(
            child: Text(text, style: GoogleFonts.manrope(color: context.colors.onSurfaceVariant, fontSize: 12, height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8.0, left: 4.0),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.spaceGrotesk(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
          color: context.colors.primary,
        ),
      ),
    );
  }

  Widget _buildPlatformCard({
    required PlatformAlignment platform,
    required String title,
    required IconData icon,
  }) {
    final bool isSelected = _selectedPlatform == platform;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedPlatform = platform);
      },
      child: Container(
        padding: EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: context.colors.surfaceContainer,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? context.colors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -32,
              top: -32,
              child: Icon(
                icon,
                size: 96,
                color: context.colors.onSurface.withValues(alpha: 0.05),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: isSelected ? context.colors.primary : context.colors.onSurfaceVariant,
                  size: 24,
                ),
                SizedBox(height: 16),
                Text(
                  title,
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? context.colors.onSurface : context.colors.onSurfaceVariant,
                  ),
                ),
                Text(
                  'FLEET PARTNER',
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? context.colors.onSurfaceVariant : context.colors.onSurfaceVariant.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShiftChip(String title, IconData icon, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? context.colors.primary : context.colors.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(32),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: context.colors.primary.withValues(alpha: 0.2),
                    blurRadius: 16,
                    offset: Offset(0, 8),
                  )
                ]
              : [],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant,
            ),
            SizedBox(width: 8),
            Text(
              title,
              style: GoogleFonts.spaceGrotesk(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5,
                color: isSelected ? context.colors.onPrimaryFixed : context.colors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
