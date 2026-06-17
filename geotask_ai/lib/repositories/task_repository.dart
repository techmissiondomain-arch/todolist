import '../core/errors/failures.dart';
import '../core/utils/logger.dart';
import '../models/enums.dart';
import '../models/task.dart';
import '../services/supabase_service.dart';

/// All database reads/writes for tasks. Returns domain models, not raw maps.
class TaskRepository {
  final _sb = SupabaseService.instance;

  String get _uid {
    final id = _sb.userId;
    if (id == null) throw const AuthFailure('Not signed in.');
    return id;
  }

  Future<List<Task>> fetchAll() async {
    try {
      final rows = await _sb.client
          .from('tasks')
          .select()
          .eq('user_id', _uid)
          .order('created_at', ascending: false);
      return (rows as List)
          .map((r) => Task.fromMap(r as Map<String, dynamic>))
          .toList();
    } catch (e) {
      Log.e('fetchAll tasks failed', e);
      throw const NetworkFailure('Could not load your tasks.');
    }
  }

  /// Only open, location-based tasks — what the geofencing engine needs.
  Future<List<Task>> fetchActiveGeofenced() async {
    final rows = await _sb.client
        .from('tasks')
        .select()
        .eq('user_id', _uid)
        .eq('status', TaskStatus.open.value)
        .neq('trigger_type', TriggerType.none.value);
    return (rows as List)
        .map((r) => Task.fromMap(r as Map<String, dynamic>))
        .toList();
  }

  Future<Task> create(Task task) async {
    try {
      final row = await _sb.client
          .from('tasks')
          .insert(task.toInsertMap())
          .select()
          .single();
      return Task.fromMap(row);
    } catch (e) {
      Log.e('create task failed', e);
      throw const NetworkFailure('Could not save the task.');
    }
  }

  Future<Task> update(Task task) async {
    try {
      final row = await _sb.client
          .from('tasks')
          .update(task.toInsertMap())
          .eq('id', task.id)
          .select()
          .single();
      return Task.fromMap(row);
    } catch (e) {
      Log.e('update task failed', e);
      throw const NetworkFailure('Could not update the task.');
    }
  }

  Future<void> setStatus(String taskId, TaskStatus status) async {
    await _sb.client.from('tasks').update({
      'status': status.value,
      'completed_at':
          status == TaskStatus.done ? DateTime.now().toUtc().toIso8601String() : null,
    }).eq('id', taskId);
  }

  /// Records that a geofence fired — powers the duplicate guard.
  Future<void> markTriggered(String taskId) async {
    await _sb.client.from('tasks').update({
      'last_triggered_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('id', taskId);
  }

  Future<void> delete(String taskId) async {
    await _sb.client.from('tasks').delete().eq('id', taskId);
  }
}
