import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/medical_model.dart';
import '../../core/providers/medical_provider.dart';
import '../../shared/widgets/required_field_ux.dart';

/// Doctor/hospital prescription picker — mirrors React CustomerMedicalReference.
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

enum _MedicalView { main, selectHospital, addHospital, selectDoctor, addDoctor }

class _MedicalReferenceScreenState extends State<MedicalReferenceScreen> {
  late MedicalRefModel _ref;
  _MedicalView _view = _MedicalView.main;

  final _hospitalSearch = TextEditingController();
  final _doctorSearch = TextEditingController();
  final _newHospitalName = TextEditingController();
  final _newHospitalCity = TextEditingController();
  final _newDoctorName = TextEditingController();
  final _newDoctorSpec = TextEditingController();
  late final TextEditingController _referenceNumber;
  String? _hospitalError;
  String? _doctorError;
  String? _newHospitalNameError;
  String? _newDoctorNameError;

  @override
  void initState() {
    super.initState();
    _ref = widget.initial;
    _referenceNumber = TextEditingController(text: _ref.referenceNumber);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final medical = Provider.of<MedicalProvider>(context, listen: false);
      medical.searchHospitals();
      if (_ref.hospitalId.isNotEmpty) {
        medical.searchDoctors(hospitalId: _ref.hospitalId);
      }
    });
  }

  @override
  void dispose() {
    _hospitalSearch.dispose();
    _doctorSearch.dispose();
    _newHospitalName.dispose();
    _newHospitalCity.dispose();
    _newDoctorName.dispose();
    _newDoctorSpec.dispose();
    _referenceNumber.dispose();
    super.dispose();
  }

  void _popWithResult() {
    Navigator.pop(context, _ref);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          _view == _MedicalView.main ? 'Prescription' : _viewTitle(),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_view == _MedicalView.main) {
              Navigator.pop(context);
            } else if (_view == _MedicalView.addHospital) {
              setState(() => _view = _MedicalView.selectHospital);
            } else if (_view == _MedicalView.addDoctor) {
              setState(() => _view = _MedicalView.selectDoctor);
            } else {
              setState(() => _view = _MedicalView.main);
            }
          },
        ),
        actions: [
          if (_view == _MedicalView.main)
            TextButton(
              onPressed: () {
                final hospitalMissing = _ref.hospitalId.isEmpty;
                final doctorMissing = _ref.doctorId.isEmpty;
                if (hospitalMissing || doctorMissing) {
                  setState(() {
                    _hospitalError = hospitalMissing ? 'Hospital is required' : null;
                    _doctorError = doctorMissing ? 'Doctor is required' : null;
                  });
                  showRequiredFieldsBlocked(context);
                  return;
                }
                _popWithResult();
              },
              child: const Text(
                'Save',
                style: TextStyle(
                  color: Color(0xFF6C63FF),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
      body: switch (_view) {
        _MedicalView.main => _buildMain(),
        _MedicalView.selectHospital => _buildSelectHospital(),
        _MedicalView.addHospital => _buildAddHospital(),
        _MedicalView.selectDoctor => _buildSelectDoctor(),
        _MedicalView.addDoctor => _buildAddDoctor(),
      },
    );
  }

  String _viewTitle() {
    switch (_view) {
      case _MedicalView.selectHospital:
        return 'Select Hospital';
      case _MedicalView.addHospital:
        return 'Add Hospital';
      case _MedicalView.selectDoctor:
        return 'Select Doctor';
      case _MedicalView.addDoctor:
        return 'Add Doctor';
      case _MedicalView.main:
        return 'Prescription';
    }
  }

  Widget _buildMain() {
    final medical = Provider.of<MedicalProvider>(context);
    HospitalModel? hospital;
    DoctorModel? doctor;
    for (final h in medical.hospitals) {
      if (h.id == _ref.hospitalId) hospital = h;
    }
    for (final d in medical.doctors) {
      if (d.id == _ref.doctorId) doctor = d;
    }
    final hospitalName = hospital?.name ?? _ref.hospitalName;
    final doctorName = doctor?.fullName ?? _ref.doctorName;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(widget.title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text(
          'Select or add the hospital and doctor details for your prescription.',
          style: TextStyle(color: Colors.white54, fontSize: 14),
        ),
        const SizedBox(height: 16),
        const RequiredFieldsNote(),
        const RequiredLabel('1. Hospital / Clinic', required: true),
        const SizedBox(height: 8),
        _selectionCard(
          icon: Icons.local_hospital_outlined,
          title: hospitalName?.isNotEmpty == true ? hospitalName! : 'Select a Hospital',
          subtitle: hospital?.city ??
              (hospitalName?.isNotEmpty == true ? 'Tap to change' : 'Tap to search or add new'),
          accent: const Color(0xFF3B82F6),
          filled: hospitalName?.isNotEmpty == true,
          hasError: _hospitalError != null,
          onTap: () {
            setState(() {
              _view = _MedicalView.selectHospital;
              _hospitalError = null;
            });
            _hospitalSearch.clear();
            Provider.of<MedicalProvider>(context, listen: false).searchHospitals();
          },
        ),
        FieldErrorText(_hospitalError),
        const SizedBox(height: 20),
        const RequiredLabel('2. Doctor', required: true),
        const SizedBox(height: 8),
        _selectionCard(
          icon: Icons.person_outline,
          title: doctorName?.isNotEmpty == true ? doctorName! : 'Select a Doctor',
          subtitle: doctor?.specialization ??
              (_ref.hospitalId.isEmpty
                  ? 'Select hospital first'
                  : (doctorName?.isNotEmpty == true ? 'Tap to change' : 'Tap to search or add new')),
          accent: const Color(0xFF10B981),
          filled: doctorName?.isNotEmpty == true,
          enabled: _ref.hospitalId.isNotEmpty,
          hasError: _doctorError != null,
          onTap: () {
            if (_ref.hospitalId.isEmpty) {
              setState(() => _hospitalError = 'Hospital is required');
              showRequiredFieldsBlocked(context, message: 'Please select a hospital first.');
              return;
            }
            setState(() {
              _view = _MedicalView.selectDoctor;
              _doctorError = null;
            });
            _doctorSearch.clear();
            Provider.of<MedicalProvider>(context, listen: false)
                .searchDoctors(hospitalId: _ref.hospitalId);
          },
        ),
        FieldErrorText(_doctorError),
        const SizedBox(height: 20),
        const RequiredLabel('3. Reference Number (Optional)'),
        const SizedBox(height: 8),
        TextField(
          style: const TextStyle(color: Colors.white),
          decoration: _inputDecoration('e.g. REF-12345'),
          controller: _referenceNumber,
          onChanged: (v) => setState(() => _ref = _ref.copyWith(referenceNumber: v)),
        ),
        const SizedBox(height: 32),
        SizedBox(
          height: 52,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6C63FF),
              disabledBackgroundColor: Colors.white12,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _ref.isComplete ? _popWithResult : null,
            child: const Text('Save & Close', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildSelectHospital() {
    final medical = Provider.of<MedicalProvider>(context);
    final term = _hospitalSearch.text.trim().toLowerCase();
    final filtered = term.isEmpty
        ? medical.hospitals
        : medical.hospitals
            .where((h) =>
                h.name.toLowerCase().contains(term) ||
                (h.city?.toLowerCase().contains(term) ?? false))
            .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: TextField(
            controller: _hospitalSearch,
            style: const TextStyle(color: Colors.white),
            decoration: _inputDecoration('Search hospitals by name or city...').copyWith(
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        Expanded(
          child: medical.isLoadingHospitals
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
              : filtered.isEmpty
                  ? const Center(child: Text('No hospitals found', style: TextStyle(color: Colors.white54)))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final h = filtered[index];
                        final selected = h.id == _ref.hospitalId;
                        return ListTile(
                          onTap: () {
                            setState(() {
                              _ref = _ref.copyWith(
                                hospitalId: h.id,
                                hospitalName: h.name,
                                doctorId: '',
                                doctorName: '',
                              );
                              _hospitalError = null;
                              _doctorError = null;
                              _view = _MedicalView.main;
                            });
                            Provider.of<MedicalProvider>(context, listen: false).clearDoctors();
                          },
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFF3B82F6).withValues(alpha: 0.2),
                            child: const Icon(Icons.local_hospital_outlined, color: Color(0xFF3B82F6)),
                          ),
                          title: Text(h.name, style: const TextStyle(color: Colors.white)),
                          subtitle: h.city != null
                              ? Text(h.city!, style: const TextStyle(color: Colors.white54))
                              : null,
                          trailing: selected
                              ? const Icon(Icons.check, color: Color(0xFF3B82F6))
                              : null,
                        );
                      },
                    ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton.icon(
              onPressed: () {
                _newHospitalName.text = _hospitalSearch.text;
                setState(() => _view = _MedicalView.addHospital);
              },
              icon: const Icon(Icons.add, color: Color(0xFF3B82F6)),
              label: const Text('Add a New Hospital', style: TextStyle(color: Color(0xFF3B82F6))),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                side: const BorderSide(color: Color(0xFF3B82F6), style: BorderStyle.solid),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAddHospital() {
    final medical = Provider.of<MedicalProvider>(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const RequiredFieldsNote(),
        TextField(
          controller: _newHospitalName,
          style: const TextStyle(color: Colors.white),
          decoration: requiredInputDecoration(
            context,
            label: 'Hospital Name',
            required: true,
            errorText: _newHospitalNameError,
          ),
          autofocus: true,
          onChanged: (_) {
            if (_newHospitalNameError != null) setState(() => _newHospitalNameError = null);
          },
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _newHospitalCity,
          style: const TextStyle(color: Colors.white),
          decoration: requiredInputDecoration(
            context,
            label: 'City (Optional)'),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 52,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3B82F6),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: medical.isSaving
                ? null
                : () async {
                    final err = requiredMessage(_newHospitalName.text, message: 'Hospital name is required');
                    if (err != null) {
                      setState(() => _newHospitalNameError = err);
                      showRequiredFieldsBlocked(context);
                      return;
                    }
                    final created = await medical.createHospital(
                      name: _newHospitalName.text,
                      city: _newHospitalCity.text,
                    );
                    if (created != null && mounted) {
                      setState(() {
                        _ref = _ref.copyWith(
                          hospitalId: created.id,
                          hospitalName: created.name,
                          doctorId: '',
                          doctorName: '',
                        );
                        _hospitalError = null;
                        _view = _MedicalView.main;
                      });
                    } else if (medical.errorMessage != null && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(medical.errorMessage!)),
                      );
                    }
                  },
            child: medical.isSaving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Save & Select Hospital', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildSelectDoctor() {
    final medical = Provider.of<MedicalProvider>(context);
    final term = _doctorSearch.text.trim().toLowerCase();
    final filtered = term.isEmpty
        ? medical.doctors
        : medical.doctors
            .where((d) =>
                d.fullName.toLowerCase().contains(term) ||
                (d.specialization?.toLowerCase().contains(term) ?? false))
            .toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: TextField(
            controller: _doctorSearch,
            style: const TextStyle(color: Colors.white),
            decoration: _inputDecoration('Search doctors by name or specialization...').copyWith(
              prefixIcon: const Icon(Icons.search, color: Colors.white54),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        Expanded(
          child: medical.isLoadingDoctors
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C63FF)))
              : filtered.isEmpty
                  ? const Center(child: Text('No doctors found', style: TextStyle(color: Colors.white54)))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final d = filtered[index];
                        final selected = d.id == _ref.doctorId;
                        return ListTile(
                          onTap: () {
                            setState(() {
                              _ref = _ref.copyWith(
                                doctorId: d.id,
                                doctorName: d.fullName,
                                contactNumber: d.contactNumber ?? _ref.contactNumber,
                              );
                              _doctorError = null;
                              _view = _MedicalView.main;
                            });
                          },
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFF10B981).withValues(alpha: 0.2),
                            child: const Icon(Icons.person_outline, color: Color(0xFF10B981)),
                          ),
                          title: Text(d.fullName, style: const TextStyle(color: Colors.white)),
                          subtitle: d.specialization != null
                              ? Text(d.specialization!, style: const TextStyle(color: Colors.white54))
                              : null,
                          trailing: selected
                              ? const Icon(Icons.check, color: Color(0xFF10B981))
                              : null,
                        );
                      },
                    ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton.icon(
              onPressed: () {
                _newDoctorName.text = _doctorSearch.text;
                setState(() => _view = _MedicalView.addDoctor);
              },
              icon: const Icon(Icons.add, color: Color(0xFF10B981)),
              label: const Text('Add a New Doctor', style: TextStyle(color: Color(0xFF10B981))),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                side: const BorderSide(color: Color(0xFF10B981)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAddDoctor() {
    final medical = Provider.of<MedicalProvider>(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const RequiredFieldsNote(),
        TextField(
          controller: _newDoctorName,
          style: const TextStyle(color: Colors.white),
          decoration: requiredInputDecoration(
            context,
            label: 'Doctor Full Name',
            required: true,
            errorText: _newDoctorNameError,
          ),
          autofocus: true,
          onChanged: (_) {
            if (_newDoctorNameError != null) setState(() => _newDoctorNameError = null);
          },
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _newDoctorSpec,
          style: const TextStyle(color: Colors.white),
          decoration: requiredInputDecoration(
            context,label: 'Specialization (Optional)'),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 52,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: medical.isSaving
                ? null
                : () async {
                    final err = requiredMessage(_newDoctorName.text, message: 'Doctor name is required');
                    if (err != null) {
                      setState(() => _newDoctorNameError = err);
                      showRequiredFieldsBlocked(context);
                      return;
                    }
                    final created = await medical.createDoctor(
                      hospitalId: _ref.hospitalId,
                      fullName: _newDoctorName.text,
                      specialization: _newDoctorSpec.text,
                    );
                    if (created != null && mounted) {
                      setState(() {
                        _ref = _ref.copyWith(
                          doctorId: created.id,
                          doctorName: created.fullName,
                          contactNumber: created.contactNumber ?? _ref.contactNumber,
                        );
                        _doctorError = null;
                        _view = _MedicalView.main;
                      });
                    } else if (medical.errorMessage != null && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(medical.errorMessage!)),
                      );
                    }
                  },
            child: medical.isSaving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Save & Select Doctor', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _selectionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color accent,
    required VoidCallback onTap,
    bool filled = false,
    bool enabled = true,
    bool hasError = false,
  }) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: hasError
                  ? kFieldErrorColor
                  : (filled ? accent.withValues(alpha: 0.55) : Colors.white12),
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: accent.withValues(alpha: 0.2),
                child: Icon(icon, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
              Icon(filled ? Icons.check_circle : Icons.chevron_right, color: filled ? accent : Colors.white38),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white38),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
    );
  }
}
