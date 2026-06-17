# Claude AI parsing — system prompt

> The live prompt is in `supabase/functions/parse-task/index.ts`.
> This file documents it and explains the design so you can tune it.

## Job boundary (important)

**Claude only parses and understands tasks.** It turns one English/Arabic/etc.
sentence into a structured JSON object. It does **not** do geofencing, maps, or
notifications — the **phone** does all of that (see `geofencing_service.dart`,
`notification_service.dart`, `location_service.dart`).

## Output contract

Claude must return **only** this JSON (no prose, no markdown fences):

```json
{
  "title": "Buy milk",
  "description": null,
  "trigger_type": "arrive",
  "location_name": "Carrefour",
  "radius_meters": 200,
  "due_date": null,
  "priority": "medium",
  "needs_location_confirmation": true
}
```

| Field | Meaning |
|---|---|
| `title` | short imperative task name |
| `description` | extra detail, or `null` |
| `trigger_type` | `none` \| `arrive` \| `leave` \| `nearby` |
| `location_name` | place mentioned (`"home"`, `"Carrefour"`) or `null` |
| `radius_meters` | suggested geofence radius (default 200) |
| `due_date` | ISO-8601 datetime if a time was given, else `null` |
| `priority` | `low` \| `medium` \| `high` |
| `needs_location_confirmation` | `true` when a place is named but not an exact address — the app must map it to coordinates |

## Mapping rules

- "arrive at / get to / at X" → `arrive`
- "leave / before I leave X" → `leave`
- "near / around / close to X" → `nearby`
- pure time ("tomorrow at 10") → `none` + `due_date`
- place **and** time → prefer the place trigger, still set `due_date`
- never invent coordinates; the phone resolves them

## Why a server-side Edge Function?

The Claude API key must **never** ship inside the mobile app (anyone could
extract it). Instead the app calls our Supabase Edge Function `parse-task`,
which holds the key as a secret and forwards the request to Claude. The app
authenticates to the function with the user's Supabase access token.

```
App  --(Supabase JWT)-->  Edge Function  --(CLAUDE_API_KEY)-->  Claude API
```

## Model

Default `claude-sonnet-4-6` (fast + cheap, great at structured extraction).
Override with the `CLAUDE_MODEL` secret. `temperature: 0` for deterministic JSON.
```
