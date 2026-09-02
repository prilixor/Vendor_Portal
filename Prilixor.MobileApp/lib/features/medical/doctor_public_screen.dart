import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/providers/medical_provider.dart';
import '../../core/providers/product_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/brand_page_loader.dart';
import '../dashboard/customer_dashboard.dart';

class DoctorPublicScreen extends StatefulWidget {
  final String code;

  const DoctorPublicScreen({super.key, required this.code});

  @override
  State<DoctorPublicScreen> createState() => _DoctorPublicScreenState();
}

class _DoctorPublicScreenState extends State<DoctorPublicScreen> {
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final doctor = await Provider.of<MedicalProvider>(context, listen: false)
        .getDoctorByCode(widget.code.trim());
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (doctor == null) {
        _error = 'Doctor not found for this Unique ID.';
      }
    });
  }

  Future<void> _copyCode(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Unique ID copied'), backgroundColor: Colors.green),
    );
  }

  void _goShop() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => CustomerDashboard(key: CustomerDashboard.navigationKey),
      ),
      (_) => false,
    );
    // Ensure catalog is ready for Discover tab.
    Provider.of<ProductProvider>(context, listen: false);
  }

  @override
  Widget build(BuildContext context) {
    final doctor = Provider.of<MedicalProvider>(context).lastLookup;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text('Doctor reference', style: TextStyle(color: colors.textPrimary)),
        backgroundColor: colors.background,
        iconTheme: IconThemeData(color: colors.textPrimary),
      ),
      body: _loading
          ? const BrandPageLoader()
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
                    ),
                    child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  )
                else if (doctor != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          doctor.fullName,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if ((doctor.specialization ?? '').isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            doctor.specialization!,
                            style: TextStyle(color: colors.textSecondary),
                          ),
                        ],
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Unique ID: ${doctor.uniqueCode}',
                                style: const TextStyle(
                                  color: Color(0xFFA5B4FC),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () => _copyCode(doctor.uniqueCode),
                              icon: Icon(Icons.copy, color: colors.textSecondary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Use this Unique ID at checkout as an optional doctor reference.',
                          style: TextStyle(color: colors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  if (doctor.hospitals.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      'Affiliated hospitals',
                      style: TextStyle(color: colors.textSecondary, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    ...doctor.hospitals.map(
                      (h) => Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: colors.border),
                        ),
                        child: Text(
                          [
                            h.name,
                            if ((h.city ?? '').isNotEmpty) h.city!,
                            if ((h.state ?? '').isNotEmpty) h.state!,
                          ].where((s) => s.trim().isNotEmpty).join(' · '),
                          style: TextStyle(color: colors.textPrimary),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: _goShop,
                    child: const Text('Continue to BlinksMed shop'),
                  ),
                ],
              ],
            ),
    );
  }
}
