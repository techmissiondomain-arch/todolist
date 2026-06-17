import 'enums.dart';

/// The structured object Claude returns from a natural-language sentence.
/// This is NOT yet a saved Task — it is the draft shown on the confirmation
/// screen, where the user verifies the place and tweaks details.
class ParsedTask {
  final String title;
  final String? description;
  final TriggerType triggerType;
  final String? locationName;
  final int radiusMeters;
  final DateTime? dueDate;
  final TaskPriority priority;
  final bool needsLocationConfirmation;

  const ParsedTask({
    required this.title,
    this.description,
    this.triggerType = TriggerType.none,
    this.locationName,
    this.radiusMeters = 200,
    this.dueDate,
    this.priority = TaskPriority.medium,
    this.needsLocationConfirmation = false,
  });

  factory ParsedTask.fromJson(Map<String, dynamic> j) => ParsedTask(
        title: (j['title'] as String?)?.trim().isNotEmpty == true
            ? j['title'] as String
            : 'Untitled task',
        description: j['description'] as String?,
        triggerType: TriggerType.from(j['trigger_type'] as String?),
        locationName: j['location_name'] as String?,
        radiusMeters: (j['radius_meters'] as num?)?.toInt() ?? 200,
        dueDate: j['due_date'] == null
            ? null
            : DateTime.tryParse('${j['due_date']}')?.toLocal(),
        priority: TaskPriority.from(j['priority'] as String?),
        needsLocationConfirmation:
            j['needs_location_confirmation'] as bool? ?? false,
      );
}
