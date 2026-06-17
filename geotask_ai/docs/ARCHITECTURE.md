# GeoTask AI — Architecture

## High-level

```
┌──────────────────────────────────────────────────────────────┐
│                          FLUTTER APP                           │
│                                                                │
│  Screens (UI)                                                  │
│     │  (read/watch)                                            │
│  Providers  ── AuthProvider · TaskProvider · LocationProvider  │
│     │  (call)                                                  │
│  Repositories ── Task · Location · Profile · NotificationLog   │
│     │  (use)                                                   │
│  Services ── Supabase · Auth · AI · Location · Geofencing ·    │
│              Notification                                      │
└───────┬───────────────────────┬───────────────────┬──────────┘
        │                       │                   │
        ▼                       ▼                   ▼
  Supabase (Auth + Postgres)  Claude (via Edge Fn)  Device OS
   - profiles                  parse-task            - GPS / geofence
   - tasks                     (server key)          - local notifications
   - saved_locations
   - location_triggers
   - notification_logs
```

## Layers (clean architecture)

- **Models** (`lib/models`) — plain Dart data classes mirroring DB tables.
  Immutable, with `fromMap` / `toInsertMap` / `copyWith`.
- **Services** (`lib/services`) — talk to the outside world (Supabase, Claude,
  GPS, notifications). No UI, no app state.
- **Repositories** (`lib/repositories`) — CRUD over the database, returning
  models. The only layer that knows table/column names.
- **Providers** (`lib/providers`) — app state with `ChangeNotifier`. Orchestrate
  repositories + device services (e.g. `TaskProvider` keeps geofences in sync).
- **Screens** (`lib/screens`) — pure UI. Read providers, render, dispatch.

## Who does what (the key design rule)

| Concern | Owner |
|---|---|
| Understand "buy milk at Carrefour" | **Claude** (parse only) |
| Resolve "Carrefour" → lat/lng | **App** (saved places + map picker) |
| Stream location in background | **Phone OS** via `geolocator` (Android foreground service / iOS background updates) |
| Decide arrive/leave/nearby fired | **GeofencingService** state machine |
| Avoid duplicate alerts | **GeofencingService** + `last_triggered_at` |
| Show the reminder | **NotificationService** (local) |
| Sync everything to the cloud | **Supabase** |

> **Why a position-stream state machine instead of OS geofence APIs?** The
> popular `geofence_service` plugin is discontinued and its successor needs
> fragile, version-specific foreground-service wiring. `geolocator` gives us a
> stable, well-documented position stream **with** a built-in Android foreground
> service, so we compute ENTER/EXIT/DWELL ourselves. Battery-optimised native
> geofence registration is a clean v2 upgrade behind the same `GeofencingService`
> interface.

## The geofence trigger flow

```
TaskProvider.load()
   └─ GeofencingService.syncTasks(openTasks)
         └─ starts a location stream (foreground service) + watches each task
               │ (user moves — every ~30m / 10s)
               ▼
   Geolocator position update
         └─ GeofencingService._evaluate(task, position)
               ├─ inside = distance(pos, task) <= radius
               ├─ arrive: outside→inside · leave: inside→outside · nearby: dwell 30s
               ├─ cooldown check (last_triggered_at + retriggerCooldown)
               └─ onTrigger(task)  ──►  TaskProvider._handleGeofenceTrigger
                                            ├─ NotificationService.showNow()
                                            ├─ TaskRepository.markTriggered()
                                            └─ NotificationLogRepository.add()
```

## Duplicate-notification guard

Two layers:
1. **In-memory cooldown** — after firing, the watched task's `lastTriggeredAt`
   is bumped immediately so rapid repeat OS events are ignored.
2. **Persistent `last_triggered_at`** — written to Postgres, so the cooldown
   survives an app restart.

`AppConstants.retriggerCooldown` (default 2h) controls the window.
```
