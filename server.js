// A tiny web server that does two jobs:
//   1. Serves the to-do app (index.html, styles.css, app.js)
//   2. Provides an /api/generate endpoint that asks Claude to turn a
//      plain-language goal into a short checklist of tasks.
//
// Your Anthropic API key lives here on the server (loaded from .env), never
// in the browser — that keeps it secret.

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve the front-end files

// Build the Claude client only when it's first needed, so the app still boots
// (and serves the page) even before an API key has been added.
let client;
function getClient() {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  }
  return client;
}

app.post("/api/generate", async (req, res) => {
  const goal = (req.body?.goal || "").trim();
  if (!goal) {
    return res.status(400).json({ error: "Please describe a goal first." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error:
        "AI isn't configured yet. Copy .env.example to .env, add your ANTHROPIC_API_KEY, and restart.",
    });
  }

  try {
    const response = await getClient().messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "You turn a user's goal into a short, ordered checklist of concrete, " +
        "actionable to-do items. Return between 3 and 7 tasks. Each task is a " +
        "brief imperative phrase (e.g. 'Book the venue'). No numbering, no extra text.",
      messages: [{ role: "user", content: `Goal: ${goal}` }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              tasks: { type: "array", items: { type: "string" } },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const { tasks } = JSON.parse(textBlock?.text ?? '{"tasks":[]}');
    res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({
        error:
          "AI isn't configured yet. Add your ANTHROPIC_API_KEY to the .env file and restart.",
      });
    }
    res.status(500).json({ error: "Sorry — something went wrong generating tasks." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  ✅ To-do app running!  Open this in your browser:\n`);
  console.log(`     http://localhost:${PORT}\n`);
});
