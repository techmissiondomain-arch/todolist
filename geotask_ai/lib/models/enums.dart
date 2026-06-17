// Enums mirror the Postgres enum types defined in supabase/schema.sql.
// We keep the wire value (`value`) identical to the DB string.

enum TaskStatus {
  open('open'),
  done('done'),
  archived('archived');

  final String value;
  const TaskStatus(this.value);

  static TaskStatus from(String? v) =>
      TaskStatus.values.firstWhere((e) => e.value == v, orElse: () => open);
}

enum TaskPriority {
  low('low'),
  medium('medium'),
  high('high');

  final String value;
  const TaskPriority(this.value);

  static TaskPriority from(String? v) =>
      TaskPriority.values.firstWhere((e) => e.value == v, orElse: () => medium);
}

enum TriggerType {
  none('none'),
  arrive('arrive'),
  leave('leave'),
  nearby('nearby');

  final String value;
  const TriggerType(this.value);

  bool get isLocationBased => this != TriggerType.none;

  static TriggerType from(String? v) =>
      TriggerType.values.firstWhere((e) => e.value == v, orElse: () => none);

  String get label => switch (this) {
        TriggerType.none => 'No location',
        TriggerType.arrive => 'When I arrive',
        TriggerType.leave => 'When I leave',
        TriggerType.nearby => 'When I am nearby',
      };
}
