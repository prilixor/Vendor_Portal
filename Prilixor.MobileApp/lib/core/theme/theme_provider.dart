import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum ThemePreference { system, light, dark }

class ThemeProvider extends ChangeNotifier {
  static const _storageKey = 'theme_preference';

  ThemePreference _preference = ThemePreference.system;
  bool _hydrated = false;

  ThemePreference get preference => _preference;
  bool get isHydrated => _hydrated;

  ThemeMode get themeMode => switch (_preference) {
        ThemePreference.system => ThemeMode.system,
        ThemePreference.light => ThemeMode.light,
        ThemePreference.dark => ThemeMode.dark,
      };

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_storageKey);
    _preference = ThemePreference.values.firstWhere(
      (p) => p.name == stored,
      orElse: () => ThemePreference.system,
    );
    _hydrated = true;
    notifyListeners();
  }

  Future<void> setPreference(ThemePreference value) async {
    if (_preference == value) return;
    _preference = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, value.name);
  }
}
