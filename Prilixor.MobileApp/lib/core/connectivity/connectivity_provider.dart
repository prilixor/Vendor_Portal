import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Watches device network link status (Wi‑Fi / cellular / none).
class ConnectivityProvider extends ChangeNotifier {
  ConnectivityProvider() {
    _init();
  }

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _sub;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  bool _checking = false;
  bool get isChecking => _checking;

  static bool _hasLink(List<ConnectivityResult> results) {
    if (results.isEmpty) return false;
    return results.any((r) => r != ConnectivityResult.none);
  }

  Future<void> _init() async {
    try {
      await refresh();
      _sub = _connectivity.onConnectivityChanged.listen(_applyResults);
    } catch (e, st) {
      debugPrint('Connectivity init failed: $e\n$st');
      // Fail open so a plugin issue never blocks the app.
      _isOnline = true;
      notifyListeners();
    }
  }

  void _applyResults(List<ConnectivityResult> results) {
    final online = _hasLink(results);
    debugPrint('Connectivity: $results → isOnline=$online');
    if (online == _isOnline) return;
    _isOnline = online;
    notifyListeners();
  }

  /// Re-check connectivity (used by Retry).
  Future<bool> refresh() async {
    _checking = true;
    notifyListeners();
    try {
      final results = await _connectivity.checkConnectivity();
      final online = _hasLink(results);
      debugPrint('Connectivity refresh: $results → isOnline=$online');
      _isOnline = online;
    } catch (e) {
      debugPrint('Connectivity refresh failed: $e');
    } finally {
      _checking = false;
      notifyListeners();
    }
    return _isOnline;
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
