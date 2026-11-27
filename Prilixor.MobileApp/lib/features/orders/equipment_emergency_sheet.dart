import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

const _reasons = <(String, String)>[
  ('will_not_start', 'Will not start'),
  ('alarm', 'Alarm'),
  ('leak_or_pressure', 'Leak or pressure'),
  ('power', 'Power'),
  ('setup_help', 'Need help with setup'),
  ('patient_unsafe', 'Patient is unsafe'),
];

class EquipmentEmergencySection extends StatefulWidget {
  const EquipmentEmergencySection({super.key, required this.orderId, required this.status});

  final String orderId;
  final String status;

  @override
  State<EquipmentEmergencySection> createState() => _EquipmentEmergencySectionState();
}

class _EquipmentEmergencySectionState extends State<EquipmentEmergencySection> {
  bool _loading = true;
  bool _eligible = false;
  String? _openLabel;
  String? _liveStatus; // open or acknowledged
  Timer? _poll;
  String? _error;

  bool get _delivered {
    final compact = widget.status.trim().toLowerCase().replaceAll(' ', '_');
    return compact == 'active' || compact == 'delivered';
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant EquipmentEmergencySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.orderId != widget.orderId || oldWidget.status != widget.status) {
      _load();
    }
  }

  Future<void> _load() async {
    if (!_delivered) {
      setState(() {
        _loading = false;
        _eligible = false;
      });
      return;
    }
    try {
      final response = await ApiClient().dio.get('/customers/me/orders/${widget.orderId}/emergency');
      final data = response.data;
      final emergency = data is Map ? data['emergency'] : null;
      final status = emergency is Map ? emergency['status']?.toString() : null;
      final label = emergency is Map ? emergency['reasonLabel']?.toString() : null;
      if (!mounted) return;
      setState(() {
        _eligible = data is Map && data['eligible'] == true;
        final live = status == 'open' || status == 'acknowledged';
        _liveStatus = live ? status : null;
        _openLabel = live ? (label ?? 'Emergency') : null;
        _loading = false;
        _error = null;
      });
      _syncPolling();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _eligible = false;
      });
    }
  }

  // While an emergency is live, check every 10 seconds so the customer sees when BlinksMed picks it up.
  void _syncPolling() {
    if (_liveStatus == null) {
      _poll?.cancel();
      _poll = null;
      return;
    }
    _poll ??= Timer.periodic(const Duration(seconds: 10), (_) => _load());
  }

  Future<void> _openSheet() async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _EmergencySheet(orderId: widget.orderId),
    );
    if (sent == true) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Emergency sent to BlinksMed.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || !_eligible) return const SizedBox.shrink();
    if (_liveStatus == 'acknowledged') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.amber.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.amber.shade300),
        ),
        child: Text(
          'BlinksMed received your emergency. $_openLabel. Our team is working on it. If the patient is in danger, call 108 or 112.',
          style: TextStyle(color: Colors.amber.shade900, fontWeight: FontWeight.w600),
        ),
      );
    }
    if (_openLabel != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red.shade200),
        ),
        child: Text(
          'Emergency sent to BlinksMed. $_openLabel. If the patient is in danger, call 108 or 112.',
          style: TextStyle(color: Colors.red.shade900, fontWeight: FontWeight.w600),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
          onPressed: _openSheet,
          icon: const Icon(Icons.emergency_outlined),
          label: const Text('Emergency'),
        ),
      ],
    );
  }
}

class _EmergencySheet extends StatefulWidget {
  const _EmergencySheet({required this.orderId});
  final String orderId;

  @override
  State<_EmergencySheet> createState() => _EmergencySheetState();
}

class _EmergencySheetState extends State<_EmergencySheet> {
  String _reason = _reasons.first.$1;
  final _note = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ApiClient().dio.post(
        '/customers/me/orders/${widget.orderId}/emergency',
        data: {
          'reason': _reason,
          if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
        },
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on DioException catch (e) {
      final data = e.response?.data;
      final message = data is Map ? (data['detail'] ?? data['title'] ?? 'Could not send the emergency.').toString() : 'Could not send the emergency.';
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = 'Could not send the emergency.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Equipment emergency', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('If the patient is in danger, call 108 or 112 first. This tells BlinksMed the equipment has a problem. It does not send an ambulance.'),
          const SizedBox(height: 12),
          ..._reasons.map((item) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                value: item.$1,
                groupValue: _reason,
                title: Text(item.$2),
                onChanged: _sending ? null : (value) => setState(() => _reason = value ?? _reason),
              )),
          TextField(
            controller: _note,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Note (optional)', border: OutlineInputBorder()),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 8),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
            onPressed: _sending ? null : _send,
            child: Text(_sending ? 'Sending…' : 'Send emergency'),
          ),
        ],
      ),
    );
  }
}
