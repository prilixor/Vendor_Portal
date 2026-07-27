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

/// Customer shop catalog search — matches web CustomerBrowse (350ms).
const catalogSearchDebounce = Duration(milliseconds: 350);

/// Address / map place search — avoid hammering geocoders while typing.
const placeSearchDebounce = Duration(milliseconds: 500);
