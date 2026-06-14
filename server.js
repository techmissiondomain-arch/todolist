// A tiny web server that does three jobs:
//   1. Serves the to-do app (index.html, styles.css, app.js)
//   2. /api/generate  — turn a goal into a checklist of tasks
//   3. /api/prioritize — reorder existing tasks, most important first
//
// Both AI endpoints use Google Gemini's free API. Your key lives here on the
// server (loaded from .env), never in the browser.

import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve the front-end files

const GEMINI_MODEL = "gemini-2.5-flash";

// Shared helper: ask Gemini a question and get back JSON matching `schema`.
// `thinkingBudget: 0` turns off the model's slow "thinking" step — for these
// small tasks it's not needed, and skipping it makes replies much faster.
async function askGemini({ system, prompt, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("missing key");
    err.code = "NO_KEY";
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const aiResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!aiResponse.ok) {
    const err = new Error("gemini error");
    err.status = aiResponse.status;
    err.detail = await aiResponse.text();
    throw err;
  }

  const data = await aiResponse.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text);
}

// Turn any AI failure into a friendly message for the browser.
function handleAiError(err, res) {
  if (err.code === "NO_KEY") {
    return res.status(500).json({
      error: "AI isn't configured yet. Add your GEMINI_API_KEY to the .env file and restart.",
    });
  }
  if (err.status === 429) {
    return res.status(503).json({
      error: "The free AI is busy right now — wait a few seconds and try again.",
    });
  }
  if (err.status === 400 || err.status === 403) {
    return res.status(500).json({
      error: "AI couldn't run — your GEMINI_API_KEY may be invalid. Double-check it in .env.",
    });
  }
  console.error("AI error:", err.status || "", err.detail || err.message);
  return res.status(500).json({ error: "Sorry — something went wrong. Please try again." });
}

// --- Generate tasks from a goal -------------------------------------------
app.post("/api/generate", async (req, res) => {
  const goal = (req.body?.goal || "").trim();
  if (!goal) {
    return res.status(400).json({ error: "Please describe a goal first." });
  }

  try {
    const result = await askGemini({
      system:
        "You are a planning assistant. Turn the user's goal into a short, ordered " +
        "checklist of concrete, actionable to-do items. Use 3 to 7 tasks, ordered so " +
        "earlier tasks set up later ones. Each task is a brief imperative phrase that " +
        "starts with a verb (e.g. 'Book the venue'). No numbering, no sub-points, no " +
        "extra commentary.",
      prompt: `Goal: ${goal}`,
      schema: {
        type: "object",
        properties: { tasks: { type: "array", items: { type: "string" } } },
        required: ["tasks"],
      },
    });
    res.json({ tasks: Array.isArray(result.tasks) ? result.tasks : [] });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Prioritize existing tasks --------------------------------------------
app.post("/api/prioritize", async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (tasks.length < 2) {
    return res.status(400).json({ error: "Add at least two tasks to prioritize." });
  }

  const numbered = tasks.map((t, i) => `${i}: ${t}`).join("\n");

  try {
    const result = await askGemini({
      system:
        "You prioritize a to-do list. Given numbered tasks, decide the best order to do " +
        "them: most important and time-sensitive first, and respect natural dependencies " +
        "(do prerequisite tasks earlier). Return the task numbers in the new recommended " +
        "order. Include every number exactly once — never invent or drop a task.",
      prompt: `Tasks:\n${numbered}`,
      schema: {
        type: "object",
        properties: { order: { type: "array", items: { type: "integer" } } },
        required: ["order"],
      },
    });

    // Make sure the AI returned each original position exactly once.
    const order = Array.isArray(result.order) ? result.order : [];
    const isPermutation =
      order.length === tasks.length &&
      [...order].sort((a, b) => a - b).every((value, i) => value === i);

    if (!isPermutation) {
      return res.status(500).json({ error: "The AI returned an unexpected order — please try again." });
    }
    res.json({ order });
  } catch (err) {
    handleAiError(err, res);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✅ To-do app running!  Open this in your browser:\n`);
  console.log(`     http://localhost:${PORT}\n`);
});
