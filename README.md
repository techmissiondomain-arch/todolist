# My To-Do List

A simple to-do list app — now with **AI task generation**. Add tasks by hand, or describe a goal (like "Plan a birthday party") and let AI break it into a checklist for you. Powered by Google Gemini's free API. Your tasks are saved automatically in your browser.

## Features

- Add a task
- Mark a task as done (and unmark it)
- Delete a task
- Tasks are saved automatically using your browser's local storage
- **✨ AI: turn a goal into a list of tasks** (powered by Google Gemini — free)
- **🔼 AI: prioritize your list** — reorder tasks so the most important come first

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
