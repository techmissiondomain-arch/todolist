import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import '../core/constants/app_constants.dart';
import '../core/utils/logger.dart';

/// Background notification taps run in a separate isolate, so the plugin
/// requires a TOP-LEVEL (or static) handler annotated for the VM. We can't
/// touch app state here, so we stash the "mark done" request in
/// SharedPreferences; the app reconciles it on next launch
/// (see NotificationService.consumePendingDoneTaskId + TaskProvider.load).
@pragma('vm:entry-point')
void notificationTapBackground(NotificationResponse response) {
  if (response.actionId == AppConstants.actionMarkDone &&
      response.payload != null) {
    SharedPreferences.getInstance().then(
      (p) => p.setString(AppConstants.prefsPendingDone, response.payload!),
    );
  }
}

/// Local push notifications. No server push — these fire entirely on-device,
/// triggered by geofence events (location reminders) or schedule (time
/// reminders). Includes a "Mark done" action button.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  /// Called when the user taps a notification or its "Mark done" action.
  /// The app wires this to mark the matching task complete.
  void Function(String? taskId, bool markDone)? onAction;

  Future<void> init() async {
    tz.initializeTimeZones();

    const androidInit =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false, // we ask explicitly later
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await _plugin.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onResponse,
      onDidReceiveBackgroundNotificationResponse: notificationTapBackground,
    );

    // Android 8+ needs an explicit channel.
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(const AndroidNotificationChannel(
          AppConstants.notifChannelId,
          AppConstants.notifChannelName,
          description: AppConstants.notifChannelDesc,
          importance: Importance.high,
        ));
  }

  /// Ask the OS for permission to show notifications.
  Future<bool> requestPermission() async {
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    final ios = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();

    final a = await android?.requestNotificationsPermission();
    final i = await ios?.requestPermissions(alert: true, badge: true, sound: true);
    return (a ?? i ?? false);
  }

  NotificationDetails get _details => const NotificationDetails(
        android: AndroidNotificationDetails(
          AppConstants.notifChannelId,
          AppConstants.notifChannelName,
          channelDescription: AppConstants.notifChannelDesc,
          importance: Importance.high,
          priority: Priority.high,
          actions: [
            AndroidNotificationAction(
              AppConstants.actionMarkDone,
              'Mark done',
              showsUserInterface: true,
            ),
          ],
        ),
        iOS: DarwinNotificationDetails(
          categoryIdentifier: AppConstants.notifChannelId,
        ),
      );

  /// Fire a reminder NOW (used by geofence events).
  /// We pass the taskId as the payload so the action handler knows what to do.
  Future<void> showNow({
    required int id,
    required String title,
    required String body,
    required String taskId,
  }) async {
    await _plugin.show(id, title, body, _details, payload: taskId);
    Log.d('Notification shown: $title');
  }

  /// Schedule a time-based reminder ("tomorrow at 10").
  Future<void> scheduleAt({
    required int id,
    required String title,
    required String body,
    required DateTime when,
    required String taskId,
  }) async {
    await _plugin.zonedSchedule(
      id,
      title,
      body,
      tz.TZDateTime.from(when, tz.local),
      _details,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      payload: taskId,
    );
    Log.d('Notification scheduled for $when: $title');
  }

  Future<void> cancel(int id) => _plugin.cancel(id);
  Future<void> cancelAll() => _plugin.cancelAll();

  /// Returns (and clears) a task id that the user marked done from a
  /// notification while the app was closed — either via the background isolate
  /// (SharedPreferences) or by cold-launching the app from the action.
  Future<String?> consumePendingDoneTaskId() async {
    final prefs = await SharedPreferences.getInstance();
    String? id = prefs.getString(AppConstants.prefsPendingDone);
    if (id != null) await prefs.remove(AppConstants.prefsPendingDone);

    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp ?? false) {
      final r = launch!.notificationResponse;
      if (r?.actionId == AppConstants.actionMarkDone && r?.payload != null) {
        id = r!.payload;
      }
    }
    return id;
  }

  void _onResponse(NotificationResponse r) {
    final markDone = r.actionId == AppConstants.actionMarkDone;
    onAction?.call(r.payload, markDone);
  }
}
