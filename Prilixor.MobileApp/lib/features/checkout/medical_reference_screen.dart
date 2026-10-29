import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/medical_model.dart';
import '../../core/providers/medical_provider.dart';
import '../../core/theme.dart';

/// Teal linked-doctor card — matches Customer Web `CustomerMedicalReference`.
class _DoctorLinkPalette {
  const _DoctorLinkPalette(this.dark);
  final bool dark;

  AppPalette get _p => dark ? AppPalette.dark : AppPalette.light;

  Color get cardBg => _p.successSoft;
  Color get cardBorder => _p.successBorder;
  Color get iconBg => _p.success;
  Color get label => _p.success;
  Color get title => _p.textPrimary;
  Color get subtitle => _p.textSecondary;
  Color get codeFg => _p.textPrimary;
  Color get codeBg => dark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.90);
  Color get codeBorder => _p.successBorder;
  Color get close => _p.success;
  Color get hospitalsBg => dark ? const Color(0xFF0F172A).withValues(alpha: 0.35) : Colors.white.withValues(alpha: 0.55);
  Color get hospitalsBorder => _p.successBorder;
  Color get countBg => _p.successSoft;
  Color get countFg => _p.success;
  Color get pin => _p.success;
  Color get emptyText => _p.textSecondary;
  Color get action => _p.success;
  Color get findBg => _p.success;
  Color get errorBg => _p.dangerSoft;
  Color get errorBorder => _p.dangerBorder;
  Color get errorFg => _p.danger;
  Color get errorIcon => _p.danger;
}

/// Doctor Unique ID lookup — mirrors React CustomerMedicalReference (with hospitals).
class MedicalReferenceScreen extends StatefulWidget {
  final String title;
  final MedicalRefModel initial;

  const MedicalReferenceScreen({
    super.key,
    required this.title,
    required this.initial,
  });

  @override
  State<MedicalReferenceScreen> createState() => _MedicalReferenceScreenState();
}

class _MedicalReferenceScreenState extends State<MedicalReferenceScreen> {
  late MedicalRefModel _ref;
  late final TextEditingController _codeController;
  String? _localError;

  @override
  void initState() {
    super.initState();
    _ref = widget.initial;
    _codeController = TextEditingController(text: _ref.uniqueCode);
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final medical = Provider.of<MedicalProvider>(context, listen: false);
    medical.clearError();
    setState(() => _localError = null);

    try {
      final doctor = await medical.getDoctorByCode(_codeController.text);
      if (!mounted) return;

      if (doctor == null) {
        setState(() {
          _ref = const MedicalRefModel();
          _localError = medical.errorMessage ??
              'No doctor found for this Unique ID. Please check the ID and try again.';
        });
        return;
      }

      setState(() {
        _ref = MedicalRefModel(
          doctorId: doctor.id,
          uniqueCode: doctor.uniqueCode,
          doctorName: doctor.fullName,
          specialization: doctor.specialization,
          hospitals: doctor.hospitals,
        );
        _codeController.text = doctor.uniqueCode;
        _localError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _ref = const MedicalRefModel();
        _localError = medical.errorMessage ??
            'No doctor found for this Unique ID. Please check the ID and try again.';
      });
    }
  }

  void _clear() {
    setState(() {
      _ref = const MedicalRefModel();
      _codeController.clear();
      _localError = null;
    });
    Provider.of<MedicalProvider>(context, listen: false).clearError();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final medical = context.watch<MedicalProvider>();
    final linked = _ref.hasDoctor;
    final hospitals = _ref.hospitals;
    final error = _localError ?? medical.errorMessage;
    final teal = _DoctorLinkPalette(context.isDarkMode);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(widget.title, style: TextStyle(color: colors.textPrimary, fontSize: 18)),
        backgroundColor: colors.background,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context, _ref),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, _ref),
            child: Text(
              'Done',
              style: TextStyle(color: teal.action, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(
            widget.title,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: colors.textPrimary),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter the Unique ID from your doctor (or from their QR / share page). This is optional.',
            style: TextStyle(fontSize: 13, height: 1.45, color: colors.textMuted),
          ),
          const SizedBox(height: 20),
          if (linked) ...[
            Container(
              decoration: BoxDecoration(
                color: teal.cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: teal.cardBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 8, 14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: teal.iconBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.medical_services_outlined, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'DOCTOR LINKED',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                  color: teal.label,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _ref.doctorName ?? '',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: teal.title,
                                ),
                              ),
                              if ((_ref.specialization ?? '').isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  _ref.specialization!,
                                  style: TextStyle(fontSize: 12, color: teal.subtitle),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: teal.codeBg,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: teal.codeBorder),
                                ),
                                child: Text(
                                  _ref.uniqueCode,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    fontFamily: 'monospace',
                                    color: teal.codeFg,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: _clear,
                          icon: Icon(Icons.close, size: 18, color: teal.close),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                    decoration: BoxDecoration(
                      color: teal.hospitalsBg,
                      border: Border(top: BorderSide(color: teal.hospitalsBorder)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.local_hospital_outlined, size: 14, color: teal.label),
                            const SizedBox(width: 6),
                            Text(
                              'HOSPITALS',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8,
                                color: teal.label,
                              ),
                            ),
                            const Spacer(),
                            if (hospitals.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: teal.countBg,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  '${hospitals.length}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: teal.countFg,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (hospitals.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              'No hospitals listed for this doctor yet.',
                              style: TextStyle(fontSize: 13, color: teal.emptyText),
                            ),
                          )
                        else
                          ...hospitals.map((h) {
                            final detail = _hospitalDetail(h);
                            return Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: colors.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: colors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    h.name,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: colors.textPrimary,
                                    ),
                                  ),
                                  if (detail.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Padding(
                                          padding: const EdgeInsets.only(top: 1),
                                          child: Icon(Icons.location_on_outlined, size: 14, color: teal.pin),
                                        ),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            detail,
                                            style: TextStyle(fontSize: 12, height: 1.35, color: colors.textSecondary),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, _ref),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Use this doctor', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ] else ...[
            TextField(
              controller: _codeController,
              textCapitalization: TextCapitalization.characters,
              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, letterSpacing: 0.5),
              decoration: InputDecoration(
                hintText: 'e.g. DRAB12345',
                hintStyle: TextStyle(color: colors.textMuted, letterSpacing: 0),
                filled: true,
                fillColor: colors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                suffixIcon: medical.isLookingUp
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                      )
                    : TextButton(
                        onPressed: medical.isLookingUp ? null : _lookup,
                        child: Text('Find', style: TextStyle(color: teal.action, fontWeight: FontWeight.w700)),
                      ),
              ),
              onSubmitted: (_) => _lookup(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: medical.isLookingUp ? null : _lookup,
                style: ElevatedButton.styleFrom(
                  backgroundColor: teal.findBg,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: medical.isLookingUp
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Find doctor', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: teal.errorBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: teal.errorBorder),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: teal.errorIcon, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(error, style: TextStyle(fontSize: 13, color: teal.errorFg)),
                    ),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: 16),
          Text(
            'Ask your doctor for their Unique ID, or scan the QR on their share page.',
            style: TextStyle(fontSize: 12, color: colors.textMuted),
          ),
        ],
      ),
    );
  }

  String _hospitalDetail(HospitalModel h) => h.detailLabel ?? '';
}
