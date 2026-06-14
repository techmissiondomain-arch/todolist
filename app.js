// A small to-do list that saves your tasks in the browser.
// Each task looks like:
//   { text, done, due?, score?, schedule?, subtasks?: [{ text, done }] }

const STORAGE_KEY = "todolist.tasks";

const form = document.getElementById("new-task-form");
const input = document.getElementById("new-task-input");
const list = document.getElementById("task-list");
const counter = document.getElementById("task-counter");
const clearCompletedBtn = document.getElementById("clear-completed-btn");

// Load any previously saved tasks, or start with an empty list.
let tasks = loadTasks();

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Today's date as YYYY-MM-DD in local time (matches <input type="date">).
function todayString() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function isOverdue(task) {
  return task.due && !task.done && task.due < todayString();
}

function scoreLevel(score) {
  if (score >= 67) return "high";
  if (score >= 34) return "mid";
  return "low";
}

const SCHEDULE_LABELS = { today: "Today", this_week: "This week", later: "Later" };

// Draw the whole list from scratch based on the current tasks.
function render() {
  list.innerHTML = "";

  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    if (task.done) {
      li.classList.add("done");
    }

    const row = document.createElement("div");
    row.className = "task-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTask(index));

    // Task text — click to edit (rename).
    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.text;
    label.title = "Click to edit";
    label.addEventListener("click", () => startEditing(index, row, label));

    row.append(checkbox, label);

    // Priority score badge (after AI scoring).
    if (typeof task.score === "number") {
      const badge = document.createElement("span");
      badge.className = `badge score ${scoreLevel(task.score)}`;
      badge.textContent = task.score;
      badge.title = "AI priority score";
      row.appendChild(badge);
    }

    // Schedule badge (after AI scheduling).
    if (task.schedule && SCHEDULE_LABELS[task.schedule]) {
      const badge = document.createElement("span");
      badge.className = `badge schedule ${task.schedule}`;
      badge.textContent = SCHEDULE_LABELS[task.schedule];
      row.appendChild(badge);
    }

    // Due date — pick a day; shows red when overdue and not done.
    const due = document.createElement("input");
    due.type = "date";
    due.className = "due-date";
    due.value = task.due || "";
    if (isOverdue(task)) {
      due.classList.add("overdue");
    }
    due.addEventListener("change", () => setDueDate(index, due.value));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(index));

    row.append(due, deleteBtn);
    li.appendChild(row);

    // Subtasks (steps) under the task.
    li.appendChild(renderSubtasks(task, index));

    list.appendChild(li);
  });

  updateProgress();
}

// Build the subtasks block for one task: existing steps + an "add step" box.
function renderSubtasks(task, index) {
  const wrap = document.createElement("div");
  wrap.className = "subtasks";

  const subs = task.subtasks || [];
  subs.forEach((sub, subIndex) => {
    const subRow = document.createElement("div");
    subRow.className = "subtask-row" + (sub.done ? " done" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = sub.done;
    cb.addEventListener("change", () => toggleSubtask(index, subIndex));

    const text = document.createElement("span");
    text.className = "subtask-text";
    text.textContent = sub.text;

    const del = document.createElement("button");
    del.className = "delete-sub";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete step");
    del.addEventListener("click", () => deleteSubtask(index, subIndex));

    subRow.append(cb, text, del);
    wrap.appendChild(subRow);
  });

  const adder = document.createElement("input");
  adder.type = "text";
  adder.className = "add-subtask";
  adder.placeholder = "+ add a step";
  adder.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && adder.value.trim() !== "") {
      addSubtask(index, adder.value.trim());
    }
  });
  wrap.appendChild(adder);

  return wrap;
}

// Swap a task's label for a text box so the user can rename it.
function startEditing(index, row, label) {
  const editor = document.createElement("input");
  editor.type = "text";
  editor.className = "edit-input";
  editor.value = tasks[index].text;
  row.replaceChild(editor, label);
  editor.focus();
  editor.select();

  function commit() {
    const newText = editor.value.trim();
    if (newText !== "") {
      tasks[index].text = newText;
      saveTasks();
    }
    render();
  }

  editor.addEventListener("blur", commit);
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      editor.blur();
    } else if (event.key === "Escape") {
      editor.removeEventListener("blur", commit);
      render();
    }
  });
}

function setDueDate(index, value) {
  tasks[index].due = value || null;
  saveTasks();
  render();
}

function clearCompleted() {
  tasks = tasks.filter((task) => !task.done);
  saveTasks();
  render();
}

// Update the "X of Y done" counter and show/hide the Clear completed button.
function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  counter.textContent = total === 0 ? "" : `${done} of ${total} done`;
  clearCompletedBtn.hidden = done === 0;
}

function addTask(text) {
  tasks.push({ text: text, done: false });
  saveTasks();
  render();
}

function toggleTask(index) {
  tasks[index].done = !tasks[index].done;
  saveTasks();
  render();
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
  render();
}

// --- Subtasks --------------------------------------------------------------
function addSubtask(taskIndex, text) {
  if (!tasks[taskIndex].subtasks) {
    tasks[taskIndex].subtasks = [];
  }
  tasks[taskIndex].subtasks.push({ text: text, done: false });
  saveTasks();
  render();
}

function toggleSubtask(taskIndex, subIndex) {
  const sub = tasks[taskIndex].subtasks[subIndex];
  sub.done = !sub.done;
  saveTasks();
  render();
}

function deleteSubtask(taskIndex, subIndex) {
  tasks[taskIndex].subtasks.splice(subIndex, 1);
  saveTasks();
  render();
}

clearCompletedBtn.addEventListener("click", clearCompleted);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === "") {
    return;
  }
  addTask(text);
  input.value = "";
  input.focus();
});

// --- AI helpers ------------------------------------------------------------
const status = document.getElementById("ai-status");

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

// POST a JSON body to one of our /api endpoints and return the parsed result,
// or null if it failed (after showing a friendly status message).
async function callApi(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    showStatus(data.error || "Something went wrong.");
    return null;
  }
  return data;
}

function taskTexts() {
  return tasks.map((task) => task.text);
}

// --- AI: generate tasks from a goal ---------------------------------------
const goalInput = document.getElementById("ai-goal-input");
const generateBtn = document.getElementById("ai-generate-btn");

async function generateTasks() {
  const goal = goalInput.value.trim();
  if (goal === "") {
    return;
  }
  generateBtn.disabled = true;
  showStatus("Thinking…");
  try {
    const data = await callApi("/api/generate", { goal: goal });
    if (data) {
      data.tasks.forEach((task) => addTask(task));
      goalInput.value = "";
      showStatus(`Added ${data.tasks.length} tasks.`);
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    generateBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", generateTasks);
goalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") generateTasks();
});

// --- AI: prioritize (reorder) ---------------------------------------------
const prioritizeBtn = document.getElementById("ai-prioritize-btn");

async function prioritizeTasks() {
  if (tasks.length < 2) {
    showStatus("Add at least two tasks first.");
    return;
  }
  prioritizeBtn.disabled = true;
  showStatus("Prioritizing…");
  try {
    const data = await callApi("/api/prioritize", { tasks: taskTexts() });
    if (data) {
      tasks = data.order.map((position) => tasks[position]);
      saveTasks();
      render();
      showStatus("Reordered — most important first.");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    prioritizeBtn.disabled = false;
  }
}

prioritizeBtn.addEventListener("click", prioritizeTasks);

// --- AI: score each task 0–100, then sort by score ------------------------
const scoreBtn = document.getElementById("ai-score-btn");

async function scoreTasks() {
  if (tasks.length < 1) {
    showStatus("Add a task first.");
    return;
  }
  scoreBtn.disabled = true;
  showStatus("Scoring…");
  try {
    const data = await callApi("/api/score", { tasks: taskTexts() });
    if (data) {
      data.scores.forEach((score, i) => {
        tasks[i].score = score;
      });
      tasks.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      saveTasks();
      render();
      showStatus("Scored and sorted by priority.");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    scoreBtn.disabled = false;
  }
}

scoreBtn.addEventListener("click", scoreTasks);

// --- AI: schedule into Today / This week / Later --------------------------
const scheduleBtn = document.getElementById("ai-schedule-btn");
const SCHEDULE_ORDER = { today: 0, this_week: 1, later: 2 };

async function scheduleTasks() {
  if (tasks.length < 1) {
    showStatus("Add a task first.");
    return;
  }
  scheduleBtn.disabled = true;
  showStatus("Planning…");
  try {
    const data = await callApi("/api/schedule", { tasks: taskTexts() });
    if (data) {
      data.buckets.forEach((bucket, i) => {
        tasks[i].schedule = bucket;
      });
      tasks.sort(
        (a, b) => (SCHEDULE_ORDER[a.schedule] ?? 3) - (SCHEDULE_ORDER[b.schedule] ?? 3)
      );
      saveTasks();
      render();
      showStatus("Planned — Today first, then this week, then later.");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    scheduleBtn.disabled = false;
  }
}

scheduleBtn.addEventListener("click", scheduleTasks);

// --- AI: ask a question about the tasks -----------------------------------
const askInput = document.getElementById("ai-ask-input");
const askBtn = document.getElementById("ai-ask-btn");
const answerEl = document.getElementById("ai-answer");

function showAnswer(message) {
  answerEl.textContent = message;
  answerEl.hidden = !message;
}

async function askTasks() {
  const question = askInput.value.trim();
  if (question === "") {
    return;
  }
  askBtn.disabled = true;
  showAnswer("");
  showStatus("Thinking…");
  try {
    const data = await callApi("/api/ask", { question: question, tasks: taskTexts() });
    if (data) {
      showStatus("");
      showAnswer(data.answer || "No answer.");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    askBtn.disabled = false;
  }
}

askBtn.addEventListener("click", askTasks);
askInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") askTasks();
});

// Show whatever was saved when the page first loads.
render();
