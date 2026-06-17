# GeoTask AI — Testing checklist

Manual QA script for the MVP. Tick each item on a real device (geofencing does
not work reliably on emulators without mock locations).

## Auth
- [ ] Register a new account → receives confirm email, profile row auto-created
- [ ] Sign in with correct credentials → lands on Home
- [ ] Sign in with wrong password → friendly error shown
- [ ] Sign out → returns to Login, geofencing stops

## Onboarding
- [ ] First launch shows 3 onboarding slides
- [ ] "Skip" and "Get started" both set `onboarded` and don't show again

## AI parsing (Add task)
- [ ] "Buy milk when I arrive at Carrefour" → `arrive`, location "Carrefour"
- [ ] "Mail package when I leave home" → `leave`, location "home"
- [ ] "Pick up medicine when I'm near the pharmacy" → `nearby`
- [ ] "Call Sarah tomorrow at 10" → `none`, `due_date` set to tomorrow 10:00
- [ ] Gibberish input → still returns a sensible title, no crash
- [ ] No internet → friendly "could not reach AI" error

## Confirmation
- [ ] Place name matches a saved place → auto-filled, no map needed
- [ ] Unknown place → prompts to pick on map (Location picker)
- [ ] Can change trigger type, radius, priority, time
- [ ] Saving a location task requests background permission with clear reason

## Location picker
- [ ] Map centers on geocoded place name OR current location
- [ ] Moving the map updates the radius circle + reverse-geocoded address
- [ ] Saving returns to confirmation with the chosen place

## Geofencing (real-world)
- [ ] Arrive: walk/drive into radius → notification fires once
- [ ] Leave: exit radius → notification fires once
- [ ] Nearby: linger inside radius ~30s → notification fires
- [ ] Re-entering within cooldown (2h) → NO duplicate notification
- [ ] After cooldown → fires again
- [ ] Works with app backgrounded / closed (Always permission granted)

## Notifications
- [ ] Notification shows title + correct arrive/leave/nearby body
- [ ] "Mark done" action completes the task and syncs (app open)
- [ ] "Mark done" while app is CLOSED → task is done after next app launch
- [ ] Tapping notification opens the app
- [ ] Time reminder fires at the scheduled minute

## Tasks
- [ ] Complete / reopen toggles status and updates list sections
- [ ] Edit title/notes/priority in detail → persists after reload
- [ ] Delete task → removed from list + geofence unregistered
- [ ] Pull-to-refresh reloads from cloud

## Saved places
- [ ] Add place via map → appears in list
- [ ] Delete place → confirm dialog → removed
- [ ] Saved place is reusable by name in a new AI task

## Settings / privacy
- [ ] Toggle "Location reminders" off → geofencing stops immediately
- [ ] Toggle background location → triggers OS permission flow
- [ ] Toggle notifications off → persists
- [ ] "Open system location settings" launches OS settings

## Sync / multi-device
- [ ] Create task on device A → appears on device B **live** (realtime, no manual refresh)
- [ ] Complete task on device A → updates on device B automatically
- [ ] RLS: a second user cannot see the first user's tasks (verify in Supabase)
```
