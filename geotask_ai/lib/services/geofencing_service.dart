import 'dart:async';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';

import '../core/constants/app_constants.dart';
import '../core/utils/logger.dart';
import '../models/enums.dart';
import '../models/task.dart';

/// THE PHONE DOES THE GEOFENCING. Claude only parses text.
///
/// Implementation: we listen to the device's position stream (which keeps a
/// foreground service alive on Android and uses background updates on iOS) and
/// run a small state machine per task to detect:
///
///   arrive  -> outside -> inside        (geofence ENTER)
///   leave   -> inside  -> outside       (geofence EXIT)
///   nearby  -> inside AND lingered N sec (geofence DWELL)
///
/// Duplicate notifications are prevented with a cooldown that survives restarts
/// via the task's `last_triggered_at` column.
class GeofencingService {
  GeofencingService._();
  static final GeofencingService instance = GeofencingService._();

  /// How long the user must stay inside a radius for a "nearby" task to fire.
  static const Duration _dwell = Duration(seconds: 30);

  StreamSubscription<Position>? _sub;

  /// Tasks currently being watched, keyed by task id.
  final Map<String, Task> _watched = {};

  /// Per-task geofence state for transition detection.
  final Map<String, bool> _inside = {}; // last known inside/outside
  final Map<String, DateTime> _enteredAt = {}; // when they entered (for dwell)
  final Set<String> _dwellFired = {}; // dwell already fired for this visit

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

    // Drop state for tasks no longer watched.
    _inside.removeWhere((id, _) => !_watched.containsKey(id));
    _enteredAt.removeWhere((id, _) => !_watched.containsKey(id));
    _dwellFired.removeWhere((id) => !_watched.containsKey(id));

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
    final settings = _platformSettings();
    _sub = Geolocator.getPositionStream(locationSettings: settings).listen(
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
    for (final task in _watched.values) {
      _evaluate(task, pos);
    }
  }

  void _evaluate(Task task, Position pos) {
    final distance = Geolocator.distanceBetween(
      pos.latitude,
      pos.longitude,
      task.latitude!,
      task.longitude!,
    );
    final isInside = distance <= task.radiusMeters;
    final was = _inside[task.id];

    // First reading: record state silently so we don't fire on app start.
    if (was == null) {
      _inside[task.id] = isInside;
      if (isInside) _enteredAt[task.id] = DateTime.now();
      return;
    }

    switch (task.triggerType) {
      case TriggerType.arrive:
        if (!was && isInside) _fire(task);
        break;
      case TriggerType.leave:
        if (was && !isInside) _fire(task);
        break;
      case TriggerType.nearby:
        if (isInside) {
          _enteredAt[task.id] ??= DateTime.now();
          final lingered =
              DateTime.now().difference(_enteredAt[task.id]!) >= _dwell;
          if (lingered && !_dwellFired.contains(task.id)) {
            _dwellFired.add(task.id);
            _fire(task);
          }
        }
        break;
      case TriggerType.none:
        break;
    }

    // Update state + reset dwell tracking when leaving.
    if (!isInside) {
      _enteredAt.remove(task.id);
      _dwellFired.remove(task.id);
    } else {
      _enteredAt[task.id] ??= DateTime.now();
    }
    _inside[task.id] = isInside;
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
