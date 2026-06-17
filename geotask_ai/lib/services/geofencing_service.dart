import 'dart:async';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';

import '../core/constants/app_constants.dart';
import '../core/utils/logger.dart';
import '../models/task.dart';
import 'geofence_evaluator.dart';

/// THE PHONE DOES THE GEOFENCING. Claude only parses text.
///
/// This service owns the device-facing parts: it listens to the location
/// stream (a foreground service on Android / background updates on iOS), feeds
/// each position into a pure [GeofenceEvaluator] state machine, and — when a
/// transition fires and passes the duplicate guard — calls [onTrigger].
class GeofencingService {
  GeofencingService._();
  static final GeofencingService instance = GeofencingService._();

  /// How long the user must stay inside a radius for a "nearby" task to fire.
  static const Duration _dwell = Duration(seconds: 30);

  final GeofenceEvaluator _evaluator = GeofenceEvaluator(dwell: _dwell);

  StreamSubscription<Position>? _sub;

  /// Tasks currently being watched, keyed by task id (for cooldown checks).
  final Map<String, Task> _watched = {};

  /// Called when a geofence fires AND passes the duplicate guard.
  Future<void> Function(Task task)? onTrigger;

  bool get isRunning => _sub != null;

  /// (Re)build the watch list from the user's tasks and start the stream.
  Future<void> syncTasks(List<Task> tasks) async {
    _watched
      ..clear()
      ..addEntries(
        tasks
            .where((t) => !t.isDone && t.isGeofenceReady)
            .map((t) => MapEntry(t.id, t)),
      );
    _evaluator.retain(_watched.keys);

    if (_watched.isEmpty) {
      await stop();
      Log.d('No location tasks to watch.');
      return;
    }

    if (!isRunning) await _startStream();
    Log.d('Geofencing watching ${_watched.length} task(s).');
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    Log.d('Geofencing stopped.');
  }

  // --- internals ------------------------------------------------------------

  Future<void> _startStream() async {
    _sub = Geolocator.getPositionStream(locationSettings: _platformSettings())
        .listen(
      _onPosition,
      onError: (Object e) => Log.e('Position stream error', e),
    );
    Log.d('Position stream started.');
  }

  /// Platform-specific settings.
  ///   • Android: a foreground-service notification keeps location flowing when
  ///     the app is in the pocket.
  ///   • iOS: background updates require `allowBackgroundLocationUpdates` plus
  ///     the `location` UIBackgroundMode (see platform/ios files).
  LocationSettings _platformSettings() {
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        activityType: ActivityType.other,
        distanceFilter: AppConstants.locationDistanceFilter,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    }
    return AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: AppConstants.locationDistanceFilter,
      intervalDuration: const Duration(seconds: 10),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Location reminders active',
        notificationText: 'GeoTask will alert you at the right place.',
        enableWakeLock: true,
        setOngoing: false,
      ),
    );
  }

  void _onPosition(Position pos) {
    for (final task in _watched.values.toList()) {
      if (_evaluator.evaluate(task, pos.latitude, pos.longitude)) {
        _fire(task);
      }
    }
  }

  void _fire(Task task) {
    // Duplicate-notification guard (survives restart via last_triggered_at).
    final last = task.lastTriggeredAt;
    if (last != null &&
        DateTime.now().difference(last) < AppConstants.retriggerCooldown) {
      Log.d('Skipping "${task.title}" — within cooldown window.');
      return;
    }

    // Bump cooldown locally so rapid repeats are ignored before the DB write.
    _watched[task.id] = task.copyWith(lastTriggeredAt: DateTime.now());
    Log.d('Geofence matched "${task.title}" (${task.triggerType.value}).');
    onTrigger?.call(task);
  }
}
