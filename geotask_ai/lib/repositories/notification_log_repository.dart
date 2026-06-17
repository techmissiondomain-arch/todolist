import '../core/utils/logger.dart';
import '../models/enums.dart';
import '../services/supabase_service.dart';

/// Writes an audit row each time a reminder fires. Useful for debugging
/// duplicate notifications and for a future "history" screen.
class NotificationLogRepository {
  final _sb = SupabaseService.instance;

  Future<void> add({
    required String taskId,
    required TriggerType triggerType,
    required String title,
    required String body,
    double? latitude,
    double? longitude,
  }) async {
    final uid = _sb.userId;
    if (uid == null) return;
    try {
      await _sb.client.from('notification_logs').insert({
        'user_id': uid,
        'task_id': taskId,
        'trigger_type': triggerType.value,
        'title': title,
        'body': body,
        'latitude': latitude,
        'longitude': longitude,
      });
    } catch (e) {
      // Logging must never crash the app.
      Log.e('notification_log insert failed', e);
    }
  }
}
