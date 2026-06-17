# GeoTask AI 📍🧠

[![GeoTask AI CI](https://github.com/techmissiondomain-arch/todolist/actions/workflows/geotask-ci.yml/badge.svg)](https://github.com/techmissiondomain-arch/todolist/actions/workflows/geotask-ci.yml)

A smart to-do list that reminds you **at the right place**, not just the right
time. Type a reminder in plain language — *“Remind me to buy milk when I arrive
at Carrefour”* — and the app turns it into a location-aware reminder that fires
when you get there.

- **Frontend:** Flutter (iOS + Android)
- **Backend:** Supabase (Auth + PostgreSQL + Edge Functions)
- **AI:** Claude (parses your sentence into a structured task)
- **On-device:** background location + geofence detection + local notifications

---

## 1) Product overview

Most to-do apps only remind you by time. GeoTask adds **place**:

- **Arrive** — fires when you enter a place (buy milk *at* the supermarket)
- **Leave** — fires when you exit a place (mail a package *when you leave home*)
- **Nearby** — fires when you linger near a place (pick up medicine *near* the pharmacy)

You describe the reminder naturally; Claude structures it; **your phone** does
the geofencing and notifications; **Supabase** keeps it synced across devices.

> **Division of labour:** Claude only *understands* tasks. The phone handles
> location, geofencing and notifications. The cloud handles auth + storage.

---

## 2) Feature list (MVP)

1. ✅ Normal to-do tasks (create, complete, edit, delete)
2. ✅ AI task creation from natural language
3. ✅ Arrive-location reminders
4. ✅ Leave-location reminders
5. ✅ Nearby (dwell) task detection
6. ✅ Saved locations (Home, Work, Supermarket, Pharmacy…)
7. ✅ Local push notifications (with **Mark done** action)
8. ✅ Clean mobile UI (Material 3)
9. ✅ Email/password authentication
10. ✅ Cloud database sync with per-user security (RLS) + **live realtime sync**
11. ✅ Time reminders ("tomorrow at 10")
12. ✅ Privacy controls (disable location, delete places)
13. ✅ "Mark done" from a notification — even when the app is closed
14. ✅ Forgot-password (email reset link)

---

## 3) User flow

```
Onboarding ─► Login / Register ─► Home (task list)
                                     │
                                     ├─► Add task (type naturally)
                                     │       └─► AI parses ─► Confirm screen
                                     │             ├─ verify place on map (Location picker)
                                     │             ├─ tweak trigger / radius / priority / time
                                     │             └─ Save ─► geofence registered
                                     │
                                     ├─► Tap task ─► Task detail (edit / complete / delete)
                                     ├─► Saved places (add / delete)
                                     └─► Settings (privacy toggles / sign out)

(Later, in the real world)
  You walk into Carrefour ─► OS geofence ENTER ─► notification "Buy milk"
       └─ tap "Mark done" ─► task completed + synced
```

---

## 4) Database schema

Full SQL in [`supabase/schema.sql`](supabase/schema.sql). Tables:

- **profiles** — one row per user + privacy/feature toggles
- **tasks** — the to-dos, including trigger type + coordinates + timestamps
- **saved_locations** — reusable places (Home, Work, Carrefour…)
- **location_triggers** — multi-place triggers per task (reserved for v2)
- **notification_logs** — audit + duplicate-suppression history

Every table has **Row Level Security** so each user only sees their own rows.
A trigger auto-creates a `profiles` row on sign-up.

---

## 5) Flutter folder structure

```
geotask_ai/
├── pubspec.yaml
├── .env.example
├── analysis_options.yaml
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AI_PROMPT.md
│   └── TESTING.md
├── platform/                              # permission snippets (manual merge)
├── native_templates/                      # full drop-in native config
│   ├── android/AndroidManifest.xml
│   └── ios/{AppDelegate.swift, Info_additions.plist}
├── tool/
│   ├── bootstrap.ps1                       # one-command setup (Windows)
│   └── bootstrap.sh                        # one-command setup (mac/Linux)
├── test/
│   └── models_test.dart
├── supabase/
│   ├── schema.sql
│   └── functions/parse-task/index.ts      # Claude lives here (server-side)
└── lib/
    ├── main.dart                          # init + provider wiring
    ├── app.dart                           # onboarding / auth gate + routing
    ├── core/
    │   ├── config/app_config.dart
    │   ├── constants/app_constants.dart
    │   ├── theme/app_theme.dart
    │   ├── errors/failures.dart
    │   └── utils/logger.dart
    ├── models/
    │   ├── enums.dart
    │   ├── task.dart
    │   ├── parsed_task.dart
    │   ├── saved_location.dart
    │   └── profile.dart
    ├── services/
    │   ├── supabase_service.dart
    │   ├── auth_service.dart
    │   ├── ai_service.dart
    │   ├── location_service.dart
    │   ├── geofencing_service.dart
    │   └── notification_service.dart
    ├── repositories/
    │   ├── task_repository.dart
    │   ├── location_repository.dart
    │   ├── profile_repository.dart
    │   └── notification_log_repository.dart
    ├── providers/
    │   ├── auth_provider.dart
    │   ├── task_provider.dart
    │   └── location_provider.dart
    └── screens/
        ├── onboarding/onboarding_screen.dart
        ├── auth/login_screen.dart
        ├── home/home_screen.dart
        ├── add_task/add_task_screen.dart
        ├── confirm/task_confirmation_screen.dart
        ├── location_picker/location_picker_screen.dart
        ├── saved_locations/saved_locations_screen.dart
        ├── task_detail/task_detail_screen.dart
        ├── settings/settings_screen.dart
        └── widgets/task_tile.dart
```

---

## 6) Setup — step by step (beginner friendly)

You'll need: **Flutter** installed (`flutter doctor` all green), a free
**Supabase** account, a **Claude API key**, and a **Google Maps** API key.

### Step A — Create the Flutter project shell (one command)
This repo contains the source files but not the generated native folders. The
bootstrap script generates them, fetches packages, drops in the native config
(permissions + maps key + background modes), and bumps Android `minSdk` to 23.

**Windows (PowerShell):**
```powershell
cd geotask_ai
cp .env.example .env   # then edit .env (Step E) — or the script copies it for you
./tool/bootstrap.ps1
```

**macOS / Linux:**
```bash
cd geotask_ai
bash tool/bootstrap.sh
```

> Prefer to do it by hand? Run `flutter create .` + `flutter pub get`, then merge
> the snippets from `platform/` (Step F). The bootstrap script just automates that.

### Step B — Set up Supabase
1. Go to https://supabase.com → **New project**. Pick a name + DB password.
2. Open **SQL Editor → New query**, paste all of
   [`supabase/schema.sql`](supabase/schema.sql), click **Run**.
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key**.

### Step C — Deploy the AI Edge Function (keeps the Claude key secret)
Install the Supabase CLI (https://supabase.com/docs/guides/cli), then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set CLAUDE_API_KEY=sk-ant-xxxxxxxx
supabase functions deploy parse-task
```

Your function URL becomes:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/parse-task`

### Step D — Google Maps key
1. https://console.cloud.google.com → create a project.
2. Enable **Maps SDK for Android** and **Maps SDK for iOS**.
3. Create an API key.
4. Put it in `android/app/src/main/AndroidManifest.xml` and
   `ios/Runner/AppDelegate.swift` — see the `platform/` files.

### Step E — Fill in `.env`
```bash
cp .env.example .env
```
Then edit `.env`:
```
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_MAPS_API_KEY=your-maps-key
AI_PARSE_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/parse-task
```

### Step F — Native permissions
**If you ran the bootstrap script in Step A, this is already done** (it wrote the
manifest, `Info.plist` keys, `AppDelegate.swift`, injected your Maps key, and set
`minSdk = 23`). If you set up by hand, merge the snippets in `platform/` and set
`minSdkVersion 23` in `android/app/build.gradle`.

> Re-running bootstrap after editing `.env`? It re-injects the Maps key safely.

### Step G — Run it
```bash
flutter pub get   # if you changed pubspec
flutter test      # optional: runs the model/parsing tests
flutter run
```
Create an account, then add a task like
*“Remind me to buy milk when I arrive at Carrefour.”*

---

## 7) Privacy promises (built into the app)

- We **never sell** location data.
- We store **only** the places you add for reminders.
- You can **delete** any saved place anytime (Saved places screen).
- You can **disable** location features entirely (Settings).
- Permission prompts explain **why** we need location, in plain words.
- Background tracking is **minimized** (event-based geofencing, not constant
  GPS polling).

---

## 8) Testing checklist

See [`docs/TESTING.md`](docs/TESTING.md) for the full manual QA script.

---

## 9) Future / premium features (v2+)

- **Route-based reminders** ("remind me on my way home")
- **Recurring location reminders** (every time you arrive at the gym)
- **Shared lists & family geofences** (notify when a family member arrives)
- **Smart suggestions** (AI proposes places/times from your habits)
- **Voice input** ("Hey GeoTask…")
- **Apple/Google Calendar sync**
- **Wear OS / Apple Watch notifications**
- **Premium: unlimited geofences, priority AI, history & analytics**
- **Offline-first sync with conflict resolution**

---

## Android build note — enable core-library desugaring

`flutter_local_notifications` requires it. In **`android/app/build.gradle`**
(Groovy) add inside `android { }`:

```gradle
compileOptions {
    coreLibraryDesugaringEnabled true
    sourceCompatibility JavaVersion.VERSION_1_8
    targetCompatibility JavaVersion.VERSION_1_8
}
```
and add to `dependencies { }`:
```gradle
coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'
```

If your project uses **`build.gradle.kts`** (Kotlin DSL):
```kotlin
compileOptions {
    isCoreLibraryDesugaringEnabled = true
    sourceCompatibility = JavaVersion.VERSION_1_8
    targetCompatibility = JavaVersion.VERSION_1_8
}
dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing "SUPABASE_URL" in .env` | You forgot to copy `.env.example` → `.env`. |
| AI returns an error | Check the function deployed and `CLAUDE_API_KEY` secret is set. |
| Map is blank/grey | Google Maps key missing or SDK not enabled for that platform. |
| Geofence never fires | Grant **Always** location; on Android test outdoors / with mock locations. |
| No notification | Grant notification permission (Android 13+ asks at runtime). |
| Android build fails on `desugar`/`NotificationManager` | Enable core-library desugaring (see section above). |
```
