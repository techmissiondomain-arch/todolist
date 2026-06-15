# TaskFlow

An AI-powered task manager with a clean dashboard (sidebar + List / Board / Calendar views). Add tasks by hand or describe a goal and let AI plan, prioritize, schedule, and organize your work. Powered by Google Gemini's free API. Your tasks are saved automatically in your browser.

## Features

- Add a task
- Mark a task as done (and unmark it)
- Edit a task (click its text to rename)
- Give a task a due date (overdue tasks turn red)
- Delete a task, or clear all completed at once
- See your progress ("X of Y done")
- Tasks are saved automatically using your browser's local storage
- Break a task into **subtasks** (steps)
- **✨ AI: turn a goal into a list of tasks** (powered by Google Gemini — free)
- **🔼 AI: prioritize your list** — reorder tasks so the most important come first
- **📊 AI: score each task 0–100** by priority, then sort
- **🗓️ AI: plan your week** — sort tasks into Today / This week / Later
- **💬 AI: ask about your tasks** — e.g. "What should I do first?"
- **📥 AI: organize your inbox** — auto-assign a project, priority, and due date
- **🔮 AI: project check** — a quick risk / on-track status report
- **📋 Kanban board view** — To do / In progress / Done, with a project filter
- **📅 Calendar view**, **📈 stats**, 🔁 **recurring tasks**, and 📝 **notes**
- **🎙️ AI: meeting notes → action items**
- **🔍 Search tasks** and **🌙 dark mode** (both remembered between visits)
- **⚡ Quick add** — type `#Work email Sara tomorrow` to set project + due date automatically
- **🗒️ Task details**, note **project tags**, and **🧠 AI note summaries**
- **📌 Smart lists** (Today / Overdue / Upcoming), **bulk select-and-act**, **drag-to-reorder**, and **keyboard shortcuts** (`n` = new task, `/` = search)

## How to run

The AI feature needs a small server, so there's a one-time setup.

1. **Install dependencies** (one time):
   ```
   npm install
   ```
2. **Add your API key**: copy `.env.example` to a new file named `.env`, then paste in your free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no credit card needed).
3. **Start the app**:
   ```
   npm start
   ```
4. Open the link it prints (usually **http://localhost:3000**) in your browser.

> No API key yet? The app still runs and works for adding/checking/deleting tasks — only the ✨ Generate button needs the key.

## Project structure

| File           | What it does                                      |
| -------------- | ------------------------------------------------- |
| `index.html`   | The page layout                                   |
| `styles.css`   | How the page looks                                |
| `app.js`       | The browser logic (adding, saving, deleting, AI)  |
| `server.js`    | The server that talks to the AI (Google Gemini)   |
| `package.json` | Lists the project's dependencies                  |

## License

MIT
