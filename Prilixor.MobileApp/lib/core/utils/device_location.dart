import 'package:geolocator/geolocator.dart';

class DeviceLocationResult {
  final double? latitude;
  final double? longitude;
  final String? errorMessage;
  final bool shouldOpenSettings;

  const DeviceLocationResult({
    this.latitude,
    this.longitude,
    this.errorMessage,
    this.shouldOpenSettings = false,
  });

  bool get ok => latitude != null && longitude != null;
}

/// GPS helper for the customer delivery map picker.
Future<DeviceLocationResult> resolveDeviceLocation({
  Duration timeout = const Duration(seconds: 15),
}) async {
  final serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    return const DeviceLocationResult(
      errorMessage: 'Turn on location services on your device.',
    );
  }

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied) {
    return const DeviceLocationResult(
      errorMessage: 'Location permission is required.',
    );
  }
  if (permission == LocationPermission.deniedForever) {
    return const DeviceLocationResult(
      errorMessage:
          'Location permission is blocked. Open app settings to enable it.',
      shouldOpenSettings: true,
    );
  }

  try {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: timeout,
      ),
    );
    return DeviceLocationResult(
      latitude: position.latitude,
      longitude: position.longitude,
    );
  } catch (_) {
    final last = await Geolocator.getLastKnownPosition();
    if (last != null) {
      return DeviceLocationResult(
        latitude: last.latitude,
        longitude: last.longitude,
      );
    }
    return const DeviceLocationResult(
      errorMessage:
          'Could not get GPS location. Search or move the map instead.',
    );
  }
}
