// A tiny web server that serves the to-do app and provides AI endpoints:
//   /api/generate   — turn a goal into a checklist of tasks
//   /api/prioritize — reorder existing tasks, most important first
//   /api/score      — score each task's priority 0–100
//   /api/schedule   — sort tasks into Today / This week / Later
//   /api/ask        — answer a question about the task list
//   /api/organize   — assign a project, score, and due date to each task
//   /api/projectcheck — AI project-manager risk + on-track summary
//   /api/meeting    — extract action items from meeting notes
//   /api/notes-summary — summarize the knowledge-base notes
//   /api/chat       — conversational assistant that can also create tasks
//
// All AI endpoints use Google Gemini's free API. Your key lives here on the
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
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // Free tier can briefly rate-limit (429). Retry a couple of times with a
  // short backoff so a transient spike doesn't surface as an error.
  for (let attempt = 0; attempt < 3; attempt++) {
    const aiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });

    if (aiResponse.ok) {
      const data = await aiResponse.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      return JSON.parse(text);
    }

    if (aiResponse.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      continue;
    }

    const err = new Error("gemini error");
    err.status = aiResponse.status;
    err.detail = await aiResponse.text();
    throw err;
  }
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

// --- Score each task's priority (0–100) -----------------------------------
app.post("/api/score", async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (tasks.length < 1) {
    return res.status(400).json({ error: "Add a task first." });
  }

  const numbered = tasks.map((t, i) => `${i}: ${t}`).join("\n");

  try {
    const result = await askGemini({
      system:
        "You score the priority of each to-do item from 0 to 100, where 100 is the most " +
        "important and urgent and 0 is trivial. Weigh urgency, impact, and whether other " +
        "tasks depend on it. Return one integer score per task, in the SAME order as given. " +
        "Return exactly one score per task — no more, no fewer.",
      prompt: `Tasks:\n${numbered}`,
      schema: {
        type: "object",
        properties: { scores: { type: "array", items: { type: "integer" } } },
        required: ["scores"],
      },
    });

    const raw = Array.isArray(result.scores) ? result.scores : [];
    if (raw.length !== tasks.length) {
      return res.status(500).json({ error: "The AI returned the wrong number of scores — please try again." });
    }
    // Clamp every score into 0–100 to be safe.
    const scores = raw.map((n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0))));
    res.json({ scores });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Schedule tasks into Today / This week / Later ------------------------
app.post("/api/schedule", async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (tasks.length < 1) {
    return res.status(400).json({ error: "Add a task first." });
  }

  const numbered = tasks.map((t, i) => `${i}: ${t}`).join("\n");

  try {
    const result = await askGemini({
      system:
        "You plan when to do each to-do item. Put the most urgent and foundational tasks in " +
        "'today', near-term tasks in 'this_week', and the rest in 'later'. Return one bucket " +
        "per task, in the SAME order as given. Each value must be exactly one of: " +
        "\"today\", \"this_week\", \"later\". Return exactly one bucket per task.",
      prompt: `Tasks:\n${numbered}`,
      schema: {
        type: "object",
        properties: {
          buckets: {
            type: "array",
            items: { type: "string", enum: ["today", "this_week", "later"] },
          },
        },
        required: ["buckets"],
      },
    });

    const buckets = Array.isArray(result.buckets) ? result.buckets : [];
    const allowed = new Set(["today", "this_week", "later"]);
    if (buckets.length !== tasks.length || !buckets.every((b) => allowed.has(b))) {
      return res.status(500).json({ error: "The AI returned an unexpected schedule — please try again." });
    }
    res.json({ buckets });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Ask a question about the task list -----------------------------------
app.post("/api/ask", async (req, res) => {
  const question = (req.body?.question || "").trim();
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (!question) {
    return res.status(400).json({ error: "Type a question first." });
  }

  const list = tasks.length
    ? tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(the list is empty)";

  try {
    const result = await askGemini({
      system:
        "You are a helpful productivity assistant. Answer the user's question about their " +
        "to-do list briefly and practically — at most 3 short sentences. Base your answer " +
        "only on the tasks provided. If the list is empty, say so.",
      prompt: `My tasks:\n${list}\n\nQuestion: ${question}`,
      schema: {
        type: "object",
        properties: { answer: { type: "string" } },
        required: ["answer"],
      },
    });
    res.json({ answer: typeof result.answer === "string" ? result.answer : "" });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Organize the inbox: project + score + due for each task ---------------
app.post("/api/organize", async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (tasks.length < 1) {
    return res.status(400).json({ error: "Add a task first." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const numbered = tasks.map((t, i) => `${i}: ${t}`).join("\n");

  try {
    const result = await askGemini({
      system:
        "You organize a to-do inbox. For each task choose: a short project/category name " +
        "(1-2 words; reuse the same name for related tasks), a priority score from 0 to 100, " +
        "and a suggested due date as YYYY-MM-DD (or an empty string if there's no clear " +
        "deadline). Return one item per task, in the SAME order. Exactly one item per task.",
      prompt: `Today is ${today}.\nTasks:\n${numbered}`,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                project: { type: "string" },
                score: { type: "integer" },
                due: { type: "string" },
              },
              required: ["project", "score", "due"],
            },
          },
        },
        required: ["items"],
      },
    });

    const items = Array.isArray(result.items) ? result.items : [];
    if (items.length !== tasks.length) {
      return res.status(500).json({ error: "The AI returned the wrong number of items — please try again." });
    }
    const cleaned = items.map((it) => ({
      project: String(it.project || "").slice(0, 40),
      score: Math.max(0, Math.min(100, Math.round(Number(it.score) || 0))),
      due: /^\d{4}-\d{2}-\d{2}$/.test(it.due) ? it.due : null,
    }));
    res.json({ items: cleaned });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- AI project manager: risk + on-track summary --------------------------
app.post("/api/projectcheck", async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (tasks.length < 1) {
    return res.status(400).json({ error: "Add a task first." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines = tasks
    .map((t, i) => {
      const statusText = t.done ? "done" : "open";
      const dueText = t.due ? `due ${t.due}` : "no due date";
      return `${i + 1}. ${t.text} [${statusText}, ${dueText}]`;
    })
    .join("\n");

  try {
    const result = await askGemini({
      system:
        "You are an AI project manager. Given a task list with due dates and status, write a " +
        "brief status report (2-4 short sentences): call out what's at risk (overdue items, " +
        "tasks with no due date, how much is left), and give a quick on-track / off-track read. " +
        "Be concrete and practical.",
      prompt: `Today is ${today}.\nTasks:\n${lines}`,
      schema: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    });
    res.json({ summary: typeof result.summary === "string" ? result.summary : "" });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- AI meeting assistant: notes -> action items --------------------------
app.post("/api/meeting", async (req, res) => {
  const notes = (req.body?.notes || "").trim();
  if (!notes) {
    return res.status(400).json({ error: "Paste some meeting notes first." });
  }

  try {
    const result = await askGemini({
      system:
        "You are a meeting assistant. From the notes or transcript, extract concrete action " +
        "items as short imperative tasks that start with a verb. Also write a one-sentence " +
        "summary of the meeting. Ignore general discussion that isn't actionable. Return at " +
        "most 12 tasks.",
      prompt: `Meeting notes:\n${notes}`,
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          tasks: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "tasks"],
      },
    });
    res.json({
      summary: typeof result.summary === "string" ? result.summary : "",
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
    });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Summarize notes (knowledge base) -------------------------------------
app.post("/api/notes-summary", async (req, res) => {
  const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];
  if (notes.length < 1) {
    return res.status(400).json({ error: "Add a note first." });
  }

  const text = notes
    .map((n, i) => `${i + 1}. ${n.title || "(untitled)"}: ${n.body || ""}`)
    .join("\n");

  try {
    const result = await askGemini({
      system:
        "You summarize a set of personal notes into a concise digest: the key themes, any " +
        "decisions, and any implied action items. Keep it to 2-4 short sentences.",
      prompt: `Notes:\n${text}`,
      schema: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    });
    res.json({ summary: typeof result.summary === "string" ? result.summary : "" });
  } catch (err) {
    handleAiError(err, res);
  }
});

// --- Conversational assistant: reply + tasks to create --------------------
app.post("/api/chat", async (req, res) => {
  const message = (req.body?.message || "").trim();
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (!message) {
    return res.status(400).json({ error: "Type a message first." });
  }

  const taskList = tasks.length
    ? tasks
        .map((t, i) => {
          const meta = [t.done ? "done" : null, t.project ? `#${t.project}` : null, t.due ? `due ${t.due}` : null]
            .filter(Boolean)
            .join(", ");
          return `${i + 1}. ${t.text}${meta ? ` (${meta})` : ""}`;
        })
        .join("\n")
    : "(no tasks yet)";
  const convo = history
    .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
    .join("\n");

  try {
    const result = await askGemini({
      system:
        "You are a friendly assistant inside a to-do app. Reply conversationally and " +
        "concisely (1-3 sentences). If the user asks you to add, create, plan, break down, " +
        "or organize work, put the new tasks to create in 'tasks' as short imperative phrases " +
        "(start with a verb). If they're only asking a question, leave 'tasks' empty and just " +
        "answer in 'reply'. Never invent tasks the user didn't ask for.",
      prompt: `Current tasks:\n${taskList}\n\nConversation so far:\n${convo || "(none)"}\n\nUser: ${message}`,
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          tasks: { type: "array", items: { type: "string" } },
        },
        required: ["reply", "tasks"],
      },
    });
    res.json({
      reply: typeof result.reply === "string" ? result.reply : "",
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
    });
  } catch (err) {
    handleAiError(err, res);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✅ To-do app running!  Open this in your browser:\n`);
  console.log(`     http://localhost:${PORT}\n`);
});
