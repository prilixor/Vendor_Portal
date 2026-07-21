import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Shared secure storage for JWT / session keys.
///
/// Avoid EncryptedSharedPreferences — deprecated and known to crash/hang on
/// some Android devices after the app is backgrounded / process-killed.
const FlutterSecureStorage appSecureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(
    resetOnError: true,
  ),
);
