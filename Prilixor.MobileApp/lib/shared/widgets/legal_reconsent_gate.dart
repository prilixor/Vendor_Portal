import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme.dart';
import 'legal_policy_links.dart';

class LegalReconsentGate extends StatefulWidget {
  const LegalReconsentGate({super.key});

  @override
  State<LegalReconsentGate> createState() => _LegalReconsentGateState();
}

class _LegalReconsentGateState extends State<LegalReconsentGate> {
  List<Map<String, dynamic>> _pending = [];
  bool _agreed = false;
  bool _saving = false;
  bool _loaded = false;
  String? _sessionKey;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = Provider.of<AuthProvider>(context);
    final key = auth.isAuthenticated ? 'in' : 'out';
    if (key == _sessionKey) return;
    _sessionKey = key;
    _pending = [];
    _agreed = false;
    _error = null;
    if (auth.isAuthenticated) {
      _loaded = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    } else {
      _loaded = true;
    }
  }

  Future<void> _load() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) return;
    try {
      final res = await ApiClient().dio.get('/customers/me/legal-reconsent');
      final list = _asDocList(res.data);
      if (!mounted) return;
      setState(() {
        _pending = list;
        _loaded = true;
        _agreed = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  Future<void> _accept() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient().dio.post('/customers/me/legal-acceptances', data: {
        'screen': 'reconsent',
        'acceptedLegal': true,
        'sourceSurface': 'customer_mobile',
      });
      if (!mounted) return;
      setState(() {
        _pending = [];
        _saving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Could not save acceptance. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _pending.isEmpty) return const SizedBox.shrink();
    final colors = context.appColors;
    return SizedBox.expand(
      child: Material(
        color: Colors.black54,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: AlertDialog(
              backgroundColor: colors.surface,
              title: Text('Updated policies', style: TextStyle(color: colors.textPrimary)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Please review and accept the current version to continue.',
                    style: TextStyle(color: colors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 10),
                  ..._pending.map(
                    (doc) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '• ${doc['title'] ?? doc['slug']} · v${doc['versionNumber'] ?? ''}',
                        style: TextStyle(color: colors.textPrimary, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  LegalAgreeCheckbox(
                    screen: 'reconsent',
                    value: _agreed,
                    onChanged: (value) => setState(() => _agreed = value),
                    prefix: 'I have read and re-accept',
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: !_agreed || _saving ? null : _accept,
                  child: Text(_saving ? 'Saving…' : 'Accept and continue'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

List<Map<String, dynamic>> _asDocList(dynamic data) {
  if (data is List) {
    return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
  if (data is Map && data['items'] is List) {
    return (data['items'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
  return [];
}
