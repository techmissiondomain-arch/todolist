/// App-wide constant values. Keeping them in one place makes tuning easy.
class AppConstants {
  AppConstants._();

  // Geofencing
  static const int defaultRadiusMeters = 200;
  static const int minRadiusMeters = 50;
  static const int maxRadiusMeters = 2000;

  /// How long we wait before allowing the SAME task to fire again.
  /// This is the core duplicate-notification guard (see GeofencingService).
  static const Duration retriggerCooldown = Duration(hours: 2);

  /// How far the user must move (meters) before we re-evaluate geofences.
  static const int locationDistanceFilter = 30;

  // Notification channel
  static const String notifChannelId = 'geotask_reminders';
  static const String notifChannelName = 'Location reminders';
  static const String notifChannelDesc =
      'Reminders that fire when you arrive at, leave, or are near a place.';

  // Notification actions
  static const String actionMarkDone = 'MARK_DONE';

  // SharedPreferences keys
  static const String prefsOnboarded = 'onboarded';
  /// Set by the background notification isolate when the user taps "Mark done"
  /// while the app is closed; consumed on next launch (see TaskProvider.load).
  static const String prefsPendingDone = 'pending_done_task_id';
}
