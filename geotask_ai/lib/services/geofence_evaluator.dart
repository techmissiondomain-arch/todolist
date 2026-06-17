import 'package:geolocator/geolocator.dart';

import '../models/enums.dart';
import '../models/task.dart';

/// Pure, plugin-free state machine that turns a stream of positions into
/// geofence transitions:
///
///   arrive  -> outside -> inside
///   leave   -> inside  -> outside
///   nearby  -> inside AND lingered for [dwell]
///
/// It holds no I/O, so it is fully unit-testable (see
/// test/geofence_evaluator_test.dart). A clock is injectable for deterministic
/// dwell tests. [GeofencingService] wraps this with the location stream,
/// cooldown guard, notifications and persistence.
class GeofenceEvaluator {
  final Duration dwell;
  final DateTime Function() _now;

  final Map<String, bool> _inside = {}; // last known inside/outside per task
  final Map<String, DateTime> _enteredAt = {}; // when they entered (for dwell)
  final Set<String> _dwellFired = {}; // dwell already fired this visit

  GeofenceEvaluator({
    this.dwell = const Duration(seconds: 30),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  /// Returns true when [task]'s trigger should fire for the given position.
  /// The first reading for a task is recorded silently (no fire) so we don't
  /// alert just because the app launched while already inside/outside.
  bool evaluate(Task task, double latitude, double longitude) {
    if (!task.isGeofenceReady) return false;

    final distance = Geolocator.distanceBetween(
      latitude,
      longitude,
      task.latitude!,
      task.longitude!,
    );
    final isInside = distance <= task.radiusMeters;
    final was = _inside[task.id];

    if (was == null) {
      _inside[task.id] = isInside;
      if (isInside) _enteredAt[task.id] = _now();
      return false;
    }

    var fire = false;
    switch (task.triggerType) {
      case TriggerType.arrive:
        if (!was && isInside) fire = true;
        break;
      case TriggerType.leave:
        if (was && !isInside) fire = true;
        break;
      case TriggerType.nearby:
        if (isInside) {
          _enteredAt[task.id] ??= _now();
          final lingered = _now().difference(_enteredAt[task.id]!) >= dwell;
          if (lingered && !_dwellFired.contains(task.id)) {
            _dwellFired.add(task.id);
            fire = true;
          }
        }
        break;
      case TriggerType.none:
        break;
    }

    if (!isInside) {
      _enteredAt.remove(task.id);
      _dwellFired.remove(task.id);
    } else {
      _enteredAt[task.id] ??= _now();
    }
    _inside[task.id] = isInside;
    return fire;
  }

  /// Drop all state for tasks no longer being watched.
  void retain(Iterable<String> activeIds) {
    final keep = activeIds.toSet();
    _inside.removeWhere((id, _) => !keep.contains(id));
    _enteredAt.removeWhere((id, _) => !keep.contains(id));
    _dwellFired.removeWhere((id) => !keep.contains(id));
  }

  void clear() {
    _inside.clear();
    _enteredAt.clear();
    _dwellFired.clear();
  }
}
