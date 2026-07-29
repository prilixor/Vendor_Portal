import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/medical_model.dart';
import '../../core/providers/medical_provider.dart';

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
    final medical = Provider.of<MedicalProvider>(context);
    final error = _localError ?? medical.errorMessage;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Doctor Unique ID',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, _ref),
            child: const Text('Done', style: TextStyle(color: Color(0xFF2DD4BF), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            widget.title,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            'Enter the Unique ID from your doctor (or from their QR / share page). This is optional.',
            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 24),
          if (_ref.hasDoctor)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF134E4A).withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF2DD4BF).withValues(alpha: 0.35)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F766E),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.medical_services_outlined, color: Colors.white, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'DOCTOR LINKED',
                                style: TextStyle(
                                  color: Color(0xFF5EEAD4),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _ref.doctorName ?? 'Doctor',
                                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                              ),
                              if (_ref.specialization != null && _ref.specialization!.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(_ref.specialization!, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                              ],
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF2DD4BF).withValues(alpha: 0.35)),
                                ),
                                child: Text(
                                  _ref.uniqueCode,
                                  style: const TextStyle(
                                    color: Color(0xFF99F6E4),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 1.2,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: _clear,
                          icon: const Icon(Icons.close, color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.35),
                      border: Border(
                        top: BorderSide(color: const Color(0xFF2DD4BF).withValues(alpha: 0.25)),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.local_hospital_outlined, size: 16, color: Color(0xFF5EEAD4)),
                            const SizedBox(width: 6),
                            const Text(
                              'HOSPITALS',
                              style: TextStyle(
                                color: Color(0xFF5EEAD4),
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8,
                              ),
                            ),
                            if (_ref.hospitals.isNotEmpty) ...[
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F766E).withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  '${_ref.hospitals.length}',
                                  style: const TextStyle(
                                    color: Color(0xFF99F6E4),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (_ref.hospitals.isEmpty)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0xFF2DD4BF).withValues(alpha: 0.25),
                                style: BorderStyle.solid,
                              ),
                            ),
                            child: const Text(
                              'No affiliated hospitals on file for this doctor.',
                              style: TextStyle(color: Colors.white60, fontSize: 12, height: 1.35),
                            ),
                          )
                        else
                          ..._ref.hospitals.map((h) {
                            final detail = h.detailLabel;
                            return Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    h.name,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  if (detail != null) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Padding(
                                          padding: EdgeInsets.only(top: 1),
                                          child: Icon(Icons.place_outlined, size: 14, color: Color(0xFF2DD4BF)),
                                        ),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            detail,
                                            style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.35),
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
            )
          else ...[
            const Text(
              'Doctor Unique ID',
              style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _codeController,
                    textCapitalization: TextCapitalization.characters,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                      fontFamily: 'monospace',
                    ),
                    decoration: InputDecoration(
                      hintText: 'e.g. DRDS26001',
                      hintStyle: const TextStyle(color: Colors.white38, letterSpacing: 0.5),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    ),
                    onChanged: (_) {
                      if (_localError != null) setState(() => _localError = null);
                    },
                    onSubmitted: (_) => _lookup(),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: medical.isLookingUp ? null : _lookup,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: medical.isLookingUp
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Find'),
                  ),
                ),
              ],
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF7F1D1D).withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFF87171).withValues(alpha: 0.45)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, size: 18, color: Color(0xFFFCA5A5)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        error,
                        style: const TextStyle(color: Color(0xFFFECACA), fontSize: 13, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            const Text(
              'Ask your doctor for their BlinksMed Unique ID, or scan their QR code to open the share page and copy it.',
              style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.4),
            ),
          ],
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, _ref),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(_ref.hasDoctor ? 'Use this doctor' : 'Continue without doctor'),
            ),
          ),
        ],
      ),
    );
  }
}
