import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/theme.dart';

const _doctorNotFoundMessage =
    'No doctor found for this Unique ID. Please check the ID and try again.';

/// Lightweight Unique ID lookup for vendors (view-only, no listing page).
Future<void> showVendorDoctorLookupSheet(
  BuildContext context, {
  String? initialCode,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppTheme.card(context),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _VendorDoctorLookupSheet(initialCode: initialCode),
  );
}

class _VendorDoctorLookupSheet extends StatefulWidget {
  final String? initialCode;
  const _VendorDoctorLookupSheet({this.initialCode});

  @override
  State<_VendorDoctorLookupSheet> createState() => _VendorDoctorLookupSheetState();
}

class _VendorDoctorLookupSheetState extends State<_VendorDoctorLookupSheet> {
  late final TextEditingController _code;
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _doctor;

  @override
  void initState() {
    super.initState();
    _code = TextEditingController(text: (widget.initialCode ?? '').trim().toUpperCase());
    if (_code.text.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  /// API 404 body is often a list of `{ code, description }` (FluentResults), not ProblemDetails.
  String _messageFromResponse(dynamic data, {required int? status}) {
    try {
      if (status == 404) return _doctorNotFoundMessage;

      if (data is List && data.isNotEmpty) {
        final first = data.first;
        if (first is Map) {
          final code = first['code']?.toString();
          final description =
              first['description']?.toString() ?? first['message']?.toString();
          if (code == 'directory.doctor_not_found' ||
              (description != null && description.toLowerCase().contains('not found'))) {
            return _doctorNotFoundMessage;
          }
          if (code == 'directory.doctor_code_required') {
            return 'Enter a doctor Unique ID';
          }
          if (description != null && description.trim().isNotEmpty) {
            return description.trim();
          }
        }
      }
      if (data is Map) {
        final code = data['code']?.toString() ?? data['title']?.toString();
        final detail =
            data['detail']?.toString() ??
            data['description']?.toString() ??
            data['message']?.toString();
        if (code == 'directory.doctor_not_found' ||
            (detail != null && detail.toLowerCase().contains('not found'))) {
          return _doctorNotFoundMessage;
        }
        if (detail != null &&
            detail.trim().isNotEmpty &&
            detail.trim().toLowerCase() != 'an error occurred') {
          return detail.trim();
        }
      }
    } catch (_) {
      // Never let response parsing break the lookup flow.
    }
    return _doctorNotFoundMessage;
  }

  Future<void> _lookup() async {
    final trimmed = _code.text.trim().toUpperCase();
    if (trimmed.isEmpty) {
      setState(() {
        _error = 'Enter a doctor Unique ID';
        _doctor = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _doctor = null;
      _code.text = trimmed;
    });
    try {
      final res = await ApiClient().dio.get(
        '/medical-directory/doctors/by-code/${Uri.encodeComponent(trimmed)}',
      );
      if (!mounted) return;
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        final doctor = res.data as Map<String, dynamic>;
        if (doctor['isActive'] == false) {
          setState(() {
            _doctor = null;
            _error = 'This doctor profile is inactive. Please use another Unique ID.';
          });
        } else {
          setState(() {
            _doctor = doctor;
            _error = null;
          });
        }
      } else {
        setState(() {
          _doctor = null;
          _error = _doctorNotFoundMessage;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final status = e.response?.statusCode;
      String message;
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        message =
            'Unable to look up this doctor right now. Please check your connection and try again.';
      } else {
        message = _messageFromResponse(e.response?.data, status: status);
      }
      setState(() {
        _doctor = null;
        _error = message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _doctor = null;
        _error = _doctorNotFoundMessage;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openSharePage(String? url) async {
    if (url == null || url.trim().isEmpty) return;
    final uri = Uri.tryParse(url.trim());
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final hospitals = (_doctor?['hospitals'] as List?) ?? const [];

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.appColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.medical_services_outlined, color: Color(0xFF2DD4BF)),
                const SizedBox(width: 8),
                Text(
                  'Find doctor by Unique ID',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Enter the Unique ID from an order or QR share page. View only.',
              style: TextStyle(color: context.appColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _code,
                    textCapitalization: TextCapitalization.characters,
                    style: TextStyle(
                      color: context.appColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                      fontFamily: 'monospace',
                    ),
                    decoration: InputDecoration(
                      hintText: 'e.g. DRKP26001',
                      hintStyle: TextStyle(color: context.appColors.textMuted),
                      filled: true,
                      fillColor: AppTheme.bg(context),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: context.appColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: context.appColors.border),
                      ),
                    ),
                    onChanged: (_) {
                      if (_error != null) setState(() => _error = null);
                    },
                    onSubmitted: (_) => _lookup(),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _lookup,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                    ),
                    child: _loading
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
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: context.isDarkMode
                      ? const Color(0xFF7F1D1D).withValues(alpha: 0.35)
                      : const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: context.isDarkMode
                        ? const Color(0xFFF87171).withValues(alpha: 0.45)
                        : const Color(0xFFFCA5A5),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 18,
                      color: context.isDarkMode
                          ? const Color(0xFFFCA5A5)
                          : const Color(0xFFDC2626),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: context.isDarkMode
                              ? const Color(0xFFFECACA)
                              : const Color(0xFF991B1B),
                          fontSize: 13,
                          height: 1.35,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_doctor != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F766E), Color(0xFF134E4A)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _doctor!['fullName']?.toString() ?? 'Doctor',
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                    if ((_doctor!['specialization']?.toString() ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _doctor!['specialization'].toString(),
                          style: const TextStyle(color: Color(0xFFCCFBF1), fontSize: 13),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Text(
                      (_doctor!['uniqueCode'] ?? '').toString(),
                      style: const TextStyle(
                        color: Color(0xFF99F6E4),
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        fontFamily: 'monospace',
                      ),
                    ),
                    if ((_doctor!['contactNumber']?.toString() ?? '').trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Contact: ${_doctor!['contactNumber'].toString().trim()}',
                          style: const TextStyle(
                            color: Color(0xFFCCFBF1),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (hospitals.isNotEmpty) ...[
                const SizedBox(height: 12),
                ...hospitals.map((raw) {
                  final h = raw as Map<String, dynamic>;
                  final addr = [
                    h['addressLine1'],
                    h['city'],
                    h['state'],
                  ].where((e) => (e?.toString().trim().isNotEmpty ?? false)).join(', ');
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.bg(context),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.appColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          h['name']?.toString() ?? 'Hospital',
                          style: TextStyle(
                            color: context.appColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (addr.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              addr,
                              style: TextStyle(color: context.appColors.textMuted, fontSize: 12),
                            ),
                          ),
                      ],
                    ),
                  );
                }),
              ],
              if ((_doctor!['publicPageUrl']?.toString() ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => _openSharePage(_doctor!['publicPageUrl']?.toString()),
                  icon: const Icon(Icons.open_in_new, size: 16),
                  label: const Text('Open share page'),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF2DD4BF)),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
