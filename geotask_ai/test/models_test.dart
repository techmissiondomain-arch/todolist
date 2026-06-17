import 'package:flutter_test/flutter_test.dart';
import 'package:geotask_ai/models/enums.dart';
import 'package:geotask_ai/models/parsed_task.dart';
import 'package:geotask_ai/models/task.dart';

void main() {
  group('ParsedTask.fromJson', () {
    test('parses an arrive reminder (the Carrefour example)', () {
      final p = ParsedTask.fromJson({
        'title': 'Buy milk',
        'description': null,
        'trigger_type': 'arrive',
        'location_name': 'Carrefour',
        'radius_meters': 200,
        'due_date': null,
        'priority': 'medium',
        'needs_location_confirmation': true,
      });

      expect(p.title, 'Buy milk');
      expect(p.triggerType, TriggerType.arrive);
      expect(p.locationName, 'Carrefour');
      expect(p.radiusMeters, 200);
      expect(p.dueDate, isNull);
      expect(p.priority, TaskPriority.medium);
      expect(p.needsLocationConfirmation, isTrue);
    });

    test('parses a pure time reminder', () {
      final p = ParsedTask.fromJson({
        'title': 'Call Sarah',
        'trigger_type': 'none',
        'location_name': null,
        'radius_meters': 200,
        'due_date': '2026-06-18T10:00:00.000Z',
        'priority': 'medium',
        'needs_location_confirmation': false,
      });

      expect(p.triggerType, TriggerType.none);
      expect(p.locationName, isNull);
      expect(p.dueDate, isNotNull);
    });

    test('falls back gracefully on missing/garbage fields', () {
      final p = ParsedTask.fromJson({'title': ''});
      expect(p.title, 'Untitled task');
      expect(p.triggerType, TriggerType.none);
      expect(p.priority, TaskPriority.medium);
      expect(p.radiusMeters, 200);
    });
  });

  group('TriggerType', () {
    test('isLocationBased is true for arrive/leave/nearby only', () {
      expect(TriggerType.arrive.isLocationBased, isTrue);
      expect(TriggerType.leave.isLocationBased, isTrue);
      expect(TriggerType.nearby.isLocationBased, isTrue);
      expect(TriggerType.none.isLocationBased, isFalse);
    });

    test('from() is safe on unknown strings', () {
      expect(TriggerType.from('wat'), TriggerType.none);
      expect(TaskPriority.from(null), TaskPriority.medium);
      expect(TaskStatus.from('done'), TaskStatus.done);
    });
  });

  group('Task', () {
    final now = DateTime.parse('2026-06-17T12:00:00Z');

    test('isGeofenceReady requires location trigger + coordinates', () {
      final base = Task(
        id: '1',
        userId: 'u',
        title: 'x',
        triggerType: TriggerType.arrive,
        createdAt: now,
        updatedAt: now,
      );
      expect(base.isGeofenceReady, isFalse, reason: 'no coordinates yet');

      final ready = base.copyWith(latitude: 25.2, longitude: 55.2);
      expect(ready.isGeofenceReady, isTrue);

      final timeOnly = ready.copyWith(triggerType: TriggerType.none);
      expect(timeOnly.isGeofenceReady, isFalse);
    });

    test('round-trips through fromMap/toInsertMap', () {
      final t = Task(
        id: 'abc',
        userId: 'user-1',
        title: 'Buy milk',
        priority: TaskPriority.high,
        triggerType: TriggerType.arrive,
        locationName: 'Carrefour',
        latitude: 25.1,
        longitude: 55.2,
        radiusMeters: 150,
        createdAt: now,
        updatedAt: now,
      );

      final map = t.toInsertMap();
      expect(map['title'], 'Buy milk');
      expect(map['priority'], 'high');
      expect(map['trigger_type'], 'arrive');
      expect(map['radius_meters'], 150);

      // fromMap needs the server-managed fields too.
      final rebuilt = Task.fromMap({
        ...map,
        'id': 'abc',
        'created_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
      });
      expect(rebuilt.title, 'Buy milk');
      expect(rebuilt.priority, TaskPriority.high);
      expect(rebuilt.triggerType, TriggerType.arrive);
      expect(rebuilt.latitude, 25.1);
    });
  });
}
