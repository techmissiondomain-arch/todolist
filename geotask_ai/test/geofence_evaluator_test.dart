import 'package:flutter_test/flutter_test.dart';
import 'package:geotask_ai/models/enums.dart';
import 'package:geotask_ai/models/task.dart';
import 'package:geotask_ai/services/geofence_evaluator.dart';

void main() {
  // A geofence centered here with a 200 m radius.
  const cLat = 25.2048;
  const cLng = 55.2708;

  // "inside" == the exact center (distance 0). "outside" == ~2.2 km north.
  const inLat = cLat;
  const inLng = cLng;
  const outLat = cLat + 0.02;
  const outLng = cLng;

  Task task(TriggerType type) {
    final now = DateTime(2026, 6, 17, 12);
    return Task(
      id: 't1',
      userId: 'u1',
      title: 'x',
      triggerType: type,
      latitude: cLat,
      longitude: cLng,
      radiusMeters: 200,
      createdAt: now,
      updatedAt: now,
    );
  }

  group('arrive', () {
    test('fires on outside -> inside', () {
      final ev = GeofenceEvaluator();
      final t = task(TriggerType.arrive);
      expect(ev.evaluate(t, outLat, outLng), isFalse); // first reading: silent
      expect(ev.evaluate(t, inLat, inLng), isTrue); // entered the radius
    });

    test('does NOT fire if already inside when watching starts', () {
      final ev = GeofenceEvaluator();
      final t = task(TriggerType.arrive);
      expect(ev.evaluate(t, inLat, inLng), isFalse); // init while inside
      expect(ev.evaluate(t, inLat, inLng), isFalse); // staying inside != arrive
    });
  });

  group('leave', () {
    test('fires on inside -> outside', () {
      final ev = GeofenceEvaluator();
      final t = task(TriggerType.leave);
      expect(ev.evaluate(t, inLat, inLng), isFalse); // init inside
      expect(ev.evaluate(t, outLat, outLng), isTrue); // exited the radius
    });
  });

  group('nearby (dwell)', () {
    test('fires only after lingering for the dwell duration', () {
      var clock = DateTime(2026, 6, 17, 12);
      final ev = GeofenceEvaluator(
        dwell: const Duration(seconds: 30),
        now: () => clock,
      );
      final t = task(TriggerType.nearby);

      expect(ev.evaluate(t, inLat, inLng), isFalse); // init inside @ t0
      clock = clock.add(const Duration(seconds: 10));
      expect(ev.evaluate(t, inLat, inLng), isFalse); // 10s — not yet
      clock = clock.add(const Duration(seconds: 21));
      expect(ev.evaluate(t, inLat, inLng), isTrue); // 31s — dwell met
      clock = clock.add(const Duration(seconds: 10));
      expect(ev.evaluate(t, inLat, inLng), isFalse); // already fired this visit
    });

    test('re-arms after leaving and can fire again', () {
      var clock = DateTime(2026, 6, 17, 12);
      final ev = GeofenceEvaluator(
        dwell: const Duration(seconds: 30),
        now: () => clock,
      );
      final t = task(TriggerType.nearby);

      ev.evaluate(t, inLat, inLng); // init inside
      clock = clock.add(const Duration(seconds: 31));
      expect(ev.evaluate(t, inLat, inLng), isTrue); // first dwell fire
      expect(ev.evaluate(t, outLat, outLng), isFalse); // leaves -> resets
      expect(ev.evaluate(t, inLat, inLng), isFalse); // re-enters @ same clock
      clock = clock.add(const Duration(seconds: 31));
      expect(ev.evaluate(t, inLat, inLng), isTrue); // dwell again -> fires
    });
  });

  group('edge cases', () {
    test('none trigger never fires', () {
      final ev = GeofenceEvaluator();
      final t = task(TriggerType.none);
      expect(ev.evaluate(t, inLat, inLng), isFalse);
      expect(ev.evaluate(t, outLat, outLng), isFalse);
    });

    test('task without coordinates is ignored', () {
      final ev = GeofenceEvaluator();
      final now = DateTime(2026, 6, 17, 12);
      final t = Task(
        id: 't2',
        userId: 'u1',
        title: 'x',
        triggerType: TriggerType.arrive,
        createdAt: now,
        updatedAt: now,
      );
      expect(ev.evaluate(t, inLat, inLng), isFalse);
    });

    test('retain() forgets state for tasks no longer watched', () {
      final ev = GeofenceEvaluator();
      final t = task(TriggerType.arrive);
      ev.evaluate(t, outLat, outLng); // records "outside" state for t1
      ev.retain(const ['someOtherId']); // t1 dropped
      // Because state was forgotten, the next reading is treated as the first
      // (silent) reading again — so entering does NOT immediately fire.
      expect(ev.evaluate(t, inLat, inLng), isFalse);
    });
  });
}
