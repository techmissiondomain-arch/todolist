import 'package:flutter/foundation.dart';

/// Tiny logger so beginners can see what the app is doing in the console
/// without pulling in a heavy logging package. Only prints in debug mode.
class Log {
  Log._();

  static void d(String msg) {
    if (kDebugMode) debugPrint('🟢 [GeoTask] $msg');
  }

  static void e(String msg, [Object? error, StackTrace? st]) {
    if (kDebugMode) {
      debugPrint('🔴 [GeoTask] $msg${error != null ? ' — $error' : ''}');
      if (st != null) debugPrint(st.toString());
    }
  }
}
