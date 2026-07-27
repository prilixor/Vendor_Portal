import 'dart:async';

import 'package:flutter/foundation.dart';

/// Delays repeated callbacks (search-as-you-type, geocoding, etc.).
class Debouncer {
  Debouncer({this.duration = const Duration(milliseconds: 350)});

  final Duration duration;
  Timer? _timer;

  void run(VoidCallback action) {
    _timer?.cancel();
    _timer = Timer(duration, action);
  }

  void cancel() {
    _timer?.cancel();
    _timer = null;
  }

  void dispose() => cancel();
}

/// Vendor listing/inventory lists filter locally on each keystroke.
/// Use [catalogSearchDebounce] when a screen calls the API on search text.

/// Address / map place search — avoid hammering geocoders while typing.
const placeSearchDebounce = Duration(milliseconds: 500);
