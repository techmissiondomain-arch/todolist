import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/utils/logger.dart';
import '../models/enums.dart';
import '../models/task.dart';
import '../repositories/notification_log_repository.dart';
import '../repositories/task_repository.dart';
import '../services/geofencing_service.dart';
import '../services/notification_service.dart';
import '../services/supabase_service.dart';

/// Owns the task list and keeps the geofencing engine in sync with it.
/// This is the bridge between data (Supabase) and the device (geofence +
/// notifications).
class TaskProvider extends ChangeNotifier {
  final TaskRepository _repo = TaskRepository();
  final NotificationLogRepository _logs = NotificationLogRepository();
  final _geo = GeofencingService.instance;
  final _notif = NotificationService.instance;

  List<Task> _tasks = [];
  List<Task> get tasks => _tasks;
  List<Task> get openTasks =>
      _tasks.where((t) => t.status == TaskStatus.open).toList();
  List<Task> get doneTasks =>
      _tasks.where((t) => t.status == TaskStatus.done).toList();
  List<Task> get locationTasks =>
      _tasks.where((t) => t.triggerType.isLocationBased).toList();

  bool _loading = false;
  bool get loading => _loading;
  String? error;

  RealtimeChannel? _channel;

  /// Wire the geofence + notification callbacks once.
  void bindDeviceCallbacks() {
    _geo.onTrigger = _handleGeofenceTrigger;
    _notif.onAction = (taskId, markDone) {
      if (taskId != null && markDone) {
        complete(taskId);
      }
    };
  }

  Future<void> load() async {
    _loading = true;
    error = null;
    notifyListeners();
    try {
      _tasks = await _repo.fetchAll();

      // Reconcile a "Mark done" tapped while the app was closed.
      final pendingDone = await _notif.consumePendingDoneTaskId();
      if (pendingDone != null && _find(pendingDone) != null) {
        await complete(pendingDone);
      }

      await _resyncGeofences();
      _subscribeRealtime();
    } catch (e) {
      error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Live cloud sync: when tasks change on another device, refresh quietly.
  void _subscribeRealtime() {
    if (_channel != null) return;
    final uid = SupabaseService.instance.userId;
    if (uid == null) return;

    _channel = SupabaseService.instance.client
        .channel('tasks-$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'tasks',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: uid,
          ),
          callback: (_) => _refreshQuietly(),
        )
        .subscribe();
    Log.d('Subscribed to realtime task changes.');
  }

  Future<void> _refreshQuietly() async {
    try {
      _tasks = await _repo.fetchAll();
      await _resyncGeofences();
      notifyListeners();
    } catch (e) {
      Log.e('Realtime refresh failed', e);
    }
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<Task?> add(Task draft) async {
    try {
      final created = await _repo.create(draft);
      _tasks = [created, ..._tasks];
      notifyListeners();
      await _scheduleTimeReminder(created);
      await _resyncGeofences();
      return created;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> save(Task task) async {
    final updated = await _repo.update(task);
    _replace(updated);
    await _scheduleTimeReminder(updated);
    await _resyncGeofences();
  }

  Future<void> complete(String taskId) async {
    await _repo.setStatus(taskId, TaskStatus.done);
    final t = _find(taskId);
    if (t != null) {
      _replace(t.copyWith(status: TaskStatus.done, completedAt: DateTime.now()));
    }
    await _resyncGeofences();
  }

  Future<void> reopen(String taskId) async {
    await _repo.setStatus(taskId, TaskStatus.open);
    final t = _find(taskId);
    if (t != null) _replace(t.copyWith(status: TaskStatus.open));
    await _resyncGeofences();
  }

  Future<void> remove(String taskId) async {
    await _repo.delete(taskId);
    _tasks = _tasks.where((t) => t.id != taskId).toList();
    notifyListeners();
    await _resyncGeofences();
  }

  // --- device integration ---------------------------------------------------

  /// Called by GeofencingService when a fence fires (already past cooldown).
  Future<void> _handleGeofenceTrigger(Task task) async {
    final body = switch (task.triggerType) {
      TriggerType.arrive => 'You arrived at ${task.locationName ?? 'the place'}.',
      TriggerType.leave => 'You left ${task.locationName ?? 'the place'}.',
      TriggerType.nearby => 'You are near ${task.locationName ?? 'the place'}.',
      TriggerType.none => '',
    };

    await _notif.showNow(
      id: task.id.hashCode & 0x7fffffff,
      title: task.title,
      body: body,
      taskId: task.id,
    );

    // Persist the trigger time (duplicate guard) + log it.
    await _repo.markTriggered(task.id);
    await _logs.add(
      taskId: task.id,
      triggerType: task.triggerType,
      title: task.title,
      body: body,
    );

    final t = _find(task.id);
    if (t != null) {
      _replace(t.copyWith(lastTriggeredAt: DateTime.now()));
    }
    Log.d('Handled geofence trigger for "${task.title}".');
  }

  Future<void> _scheduleTimeReminder(Task task) async {
    if (task.dueDate == null || task.dueDate!.isBefore(DateTime.now())) return;
    await _notif.scheduleAt(
      id: task.id.hashCode & 0x7fffffff,
      title: task.title,
      body: 'Reminder',
      when: task.dueDate!,
      taskId: task.id,
    );
  }

  Future<void> _resyncGeofences() async {
    await _geo.syncTasks(openTasks);
  }

  // --- helpers --------------------------------------------------------------

  Task? _find(String id) {
    for (final t in _tasks) {
      if (t.id == id) return t;
    }
    return null;
  }

  void _replace(Task updated) {
    _tasks = _tasks.map((t) => t.id == updated.id ? updated : t).toList();
    notifyListeners();
  }
}
