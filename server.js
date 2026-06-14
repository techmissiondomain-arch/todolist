// A tiny web server that does two jobs:
//   1. Serves the to-do app (index.html, styles.css, app.js)
//   2. Provides an /api/generate endpoint that asks Google Gemini (free) to
//      turn a plain-language goal into a short checklist of tasks.
//
// Your Gemini API key lives here on the server (loaded from .env), never in
// the browser — that keeps it secret.

import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve the front-end files

const GEMINI_MODEL = "gemini-2.5-flash";

app.post("/api/generate", async (req, res) => {
  const goal = (req.body?.goal || "").trim();
  if (!goal) {
    return res.status(400).json({ error: "Please describe a goal first." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "AI isn't configured yet. Copy .env.example to .env, add your GEMINI_API_KEY, and restart.",
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const aiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You turn a user's goal into a short, ordered checklist of concrete, " +
                "actionable to-do items. Return between 3 and 7 tasks. Each task is a " +
                "brief imperative phrase (e.g. 'Book the venue'). No numbering, no extra text.",
            },
          ],
        },
        contents: [{ parts: [{ text: `Goal: ${goal}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              tasks: { type: "array", items: { type: "string" } },
            },
            required: ["tasks"],
          },
        },
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("Gemini error:", aiResponse.status, detail);
      if (aiResponse.status === 400 || aiResponse.status === 403) {
        return res.status(500).json({
          error:
            "AI couldn't run — your GEMINI_API_KEY may be missing or invalid. Double-check it in .env.",
        });
      }
      return res.status(500).json({ error: "Sorry — something went wrong generating tasks." });
    }

    const data = await aiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"tasks":[]}';
    const { tasks } = JSON.parse(text);
    res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sorry — something went wrong generating tasks." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✅ To-do app running!  Open this in your browser:\n`);
  console.log(`     http://localhost:${PORT}\n`);
});
