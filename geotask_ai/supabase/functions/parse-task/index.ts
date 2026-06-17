// ======================================================================
// Supabase Edge Function: parse-task
// ----------------------------------------------------------------------
// Turns a natural-language sentence into a structured GeoTask JSON object
// by calling the Claude API. The Claude API key lives HERE (server-side),
// never inside the mobile app.
//
// Deploy:
//   supabase functions deploy parse-task
//   supabase secrets set CLAUDE_API_KEY=sk-ant-...
//
// The app calls this with the user's Supabase access token in the
// Authorization header, so only logged-in users can use it.
// ======================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY")!;
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `
You are the task-parsing engine for "GeoTask AI", a location-aware to-do app.
Your ONLY job is to convert ONE natural-language sentence into a single JSON
object describing the task. You do NOT do geofencing, notifications, or maps —
the phone handles those. You only understand and structure the request.

Return ONLY valid minified JSON. No prose, no markdown, no code fences.

JSON shape (all keys required):
{
  "title": string,                       // short imperative, e.g. "Buy milk"
  "description": string|null,            // extra detail if any, else null
  "trigger_type": "none"|"arrive"|"leave"|"nearby",
  "location_name": string|null,          // e.g. "Carrefour", "home", "the pharmacy"
  "radius_meters": number,               // default 200; use 100 for "at", 500 for "near/around"
  "due_date": string|null,               // ISO 8601 if a time is given, else null
  "priority": "low"|"medium"|"high",
  "needs_location_confirmation": boolean // true when location_name is set but not an exact address
}

Rules:
- "when I arrive at X" / "when I get to X" / "at X"      -> trigger_type "arrive"
- "when I leave X" / "before I leave X" / "as I leave"   -> trigger_type "leave"
- "when I'm near X" / "around X" / "close to X"          -> trigger_type "nearby"
- A pure time reminder ("tomorrow at 10", "in 2 hours")  -> trigger_type "none", set due_date
- If both a place AND time are present, prefer the place trigger and still set due_date.
- If no place is named, location_name = null and needs_location_confirmation = false.
- If a place IS named (even vague like "home"), needs_location_confirmation = true,
  because the app must map the name to real coordinates.
- Resolve relative dates using the provided "now" timestamp and timezone.
- Never invent coordinates. Never add keys. Never output anything but the JSON.

Examples:
Input: "Remind me to buy milk when I arrive at Carrefour."
Output: {"title":"Buy milk","description":null,"trigger_type":"arrive","location_name":"Carrefour","radius_meters":200,"due_date":null,"priority":"medium","needs_location_confirmation":true}

Input: "Remind me to mail this package when I leave home."
Output: {"title":"Mail package","description":null,"trigger_type":"leave","location_name":"home","radius_meters":150,"due_date":null,"priority":"medium","needs_location_confirmation":true}

Input: "Remind me to call Sarah tomorrow at 10."
Output: {"title":"Call Sarah","description":null,"trigger_type":"none","location_name":null,"radius_meters":200,"due_date":"<tomorrow 10:00 ISO>","priority":"medium","needs_location_confirmation":false}
`.trim();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { text, now, timezone } = await req.json();
    if (!text || typeof text !== "string") {
      return json({ error: "Missing 'text'." }, 400);
    }

    const userContext =
      `now=${now ?? new Date().toISOString()}; timezone=${timezone ?? "UTC"}\n` +
      `Sentence: ${text}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContext }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Claude API error", detail }, 502);
    }

    const data = await res.json();
    const raw = (data?.content?.[0]?.text ?? "").trim();

    // Be defensive: strip any accidental code fences, then parse.
    const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ error: "Model did not return valid JSON", raw }, 502);
    }

    return json({ task: parsed }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
