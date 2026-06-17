import 'enums.dart';

/// Mirrors the `tasks` table. Immutable; use [copyWith] to make changes.
class Task {
  final String id;
  final String userId;

  final String title;
  final String? description;
  final TaskStatus status;
  final TaskPriority priority;

  // Location trigger
  final TriggerType triggerType;
  final String? savedLocationId;
  final String? locationName;
  final double? latitude;
  final double? longitude;
  final int radiusMeters;

  // Time trigger
  final DateTime? dueDate;

  final bool needsLocationConfirmation;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? completedAt;
  final DateTime? lastTriggeredAt;

  const Task({
    required this.id,
    required this.userId,
    required this.title,
    this.description,
    this.status = TaskStatus.open,
    this.priority = TaskPriority.medium,
    this.triggerType = TriggerType.none,
    this.savedLocationId,
    this.locationName,
    this.latitude,
    this.longitude,
    this.radiusMeters = 200,
    this.dueDate,
    this.needsLocationConfirmation = false,
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    this.lastTriggeredAt,
  });

  bool get isDone => status == TaskStatus.done;

  bool get hasCoordinates => latitude != null && longitude != null;

  /// A geofence can only be registered once we have real coordinates.
  bool get isGeofenceReady => triggerType.isLocationBased && hasCoordinates;

  factory Task.fromMap(Map<String, dynamic> m) => Task(
        id: m['id'] as String,
        userId: m['user_id'] as String,
        title: m['title'] as String? ?? '',
        description: m['description'] as String?,
        status: TaskStatus.from(m['status'] as String?),
        priority: TaskPriority.from(m['priority'] as String?),
        triggerType: TriggerType.from(m['trigger_type'] as String?),
        savedLocationId: m['saved_location_id'] as String?,
        locationName: m['location_name'] as String?,
        latitude: (m['latitude'] as num?)?.toDouble(),
        longitude: (m['longitude'] as num?)?.toDouble(),
        radiusMeters: (m['radius_meters'] as num?)?.toInt() ?? 200,
        dueDate: _date(m['due_date']),
        needsLocationConfirmation:
            m['needs_location_confirmation'] as bool? ?? false,
        createdAt: _date(m['created_at']) ?? DateTime.now(),
        updatedAt: _date(m['updated_at']) ?? DateTime.now(),
        completedAt: _date(m['completed_at']),
        lastTriggeredAt: _date(m['last_triggered_at']),
      );

  /// Map for INSERT/UPDATE. We omit server-managed timestamps.
  Map<String, dynamic> toInsertMap() => {
        'user_id': userId,
        'title': title,
        'description': description,
        'status': status.value,
        'priority': priority.value,
        'trigger_type': triggerType.value,
        'saved_location_id': savedLocationId,
        'location_name': locationName,
        'latitude': latitude,
        'longitude': longitude,
        'radius_meters': radiusMeters,
        'due_date': dueDate?.toUtc().toIso8601String(),
        'needs_location_confirmation': needsLocationConfirmation,
        'completed_at': completedAt?.toUtc().toIso8601String(),
        'last_triggered_at': lastTriggeredAt?.toUtc().toIso8601String(),
      };

  Task copyWith({
    String? title,
    String? description,
    TaskStatus? status,
    TaskPriority? priority,
    TriggerType? triggerType,
    String? savedLocationId,
    String? locationName,
    double? latitude,
    double? longitude,
    int? radiusMeters,
    DateTime? dueDate,
    bool? needsLocationConfirmation,
    DateTime? completedAt,
    DateTime? lastTriggeredAt,
  }) =>
      Task(
        id: id,
        userId: userId,
        title: title ?? this.title,
        description: description ?? this.description,
        status: status ?? this.status,
        priority: priority ?? this.priority,
        triggerType: triggerType ?? this.triggerType,
        savedLocationId: savedLocationId ?? this.savedLocationId,
        locationName: locationName ?? this.locationName,
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
        radiusMeters: radiusMeters ?? this.radiusMeters,
        dueDate: dueDate ?? this.dueDate,
        needsLocationConfirmation:
            needsLocationConfirmation ?? this.needsLocationConfirmation,
        createdAt: createdAt,
        updatedAt: updatedAt,
        completedAt: completedAt ?? this.completedAt,
        lastTriggeredAt: lastTriggeredAt ?? this.lastTriggeredAt,
      );

  static DateTime? _date(dynamic v) =>
      v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
}
