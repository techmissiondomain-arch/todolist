// A small to-do list that saves your tasks in the browser.
// Each task looks like:
//   { text, done, status?, project?, due?, score?, schedule?, subtasks?: [{ text, done }] }

const STORAGE_KEY = "todolist.tasks";

const form = document.getElementById("new-task-form");
const input = document.getElementById("new-task-input");
const list = document.getElementById("task-list");
const boardEl = document.getElementById("board");
const counter = document.getElementById("task-counter");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const projectFilter = document.getElementById("project-filter");
const viewToggle = document.getElementById("view-toggle");

// Load any previously saved tasks, or start with an empty list.
let tasks = loadTasks();
let view = "list"; // "list" or "board"
let activeProject = "all"; // project filter

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

const STATUSES = ["todo", "in_progress", "done"];
const STATUS_LABELS = { todo: "To do", in_progress: "In progress", done: "Done" };

function getStatus(task) {
  if (task.status && STATUSES.includes(task.status)) return task.status;
  return task.done ? "done" : "todo";
}

function setStatus(index, status) {
  tasks[index].status = status;
  tasks[index].done = status === "done";
  saveTasks();
  render();
}

function moveStatus(index, direction) {
  const current = STATUSES.indexOf(getStatus(tasks[index]));
  const next = Math.max(0, Math.min(STATUSES.length - 1, current + direction));
  setStatus(index, STATUSES[next]);
}

function matchesFilter(task) {
  return activeProject === "all" || (task.project || "") === activeProject;
}

// Add the project / score / schedule badges (whichever the task has) to a row.
function appendBadges(container, task) {
  if (task.project) {
    const badge = document.createElement("span");
    badge.className = "badge project";
    badge.textContent = task.project;
    container.appendChild(badge);
  }
  if (typeof task.score === "number") {
    const badge = document.createElement("span");
    badge.className = `badge score ${scoreLevel(task.score)}`;
    badge.textContent = task.score;
    badge.title = "AI priority score";
    container.appendChild(badge);
  }
  if (task.schedule && SCHEDULE_LABELS[task.schedule]) {
    const badge = document.createElement("span");
    badge.className = `badge schedule ${task.schedule}`;
    badge.textContent = SCHEDULE_LABELS[task.schedule];
    container.appendChild(badge);
  }
}

// --- Rendering ------------------------------------------------------------
function render() {
  updateProjectFilter();
  if (view === "list") {
    boardEl.hidden = true;
    list.hidden = false;
    renderList();
  } else {
    list.hidden = true;
    boardEl.hidden = false;
    renderBoard();
  }
  updateProgress();
}

function renderList() {
  list.innerHTML = "";

  tasks.forEach((task, index) => {
    if (!matchesFilter(task)) return;

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

    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.text;
    label.title = "Click to edit";
    label.addEventListener("click", () => startEditing(index, row, label));

    row.append(checkbox, label);
    appendBadges(row, task);

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
    li.appendChild(renderSubtasks(task, index));
    list.appendChild(li);
  });
}

function renderBoard() {
  boardEl.innerHTML = "";

  STATUSES.forEach((status) => {
    const col = document.createElement("div");
    col.className = "board-col";

    const count = tasks.filter((t) => matchesFilter(t) && getStatus(t) === status).length;
    const header = document.createElement("h3");
    header.className = "board-col-title";
    header.textContent = `${STATUS_LABELS[status]} (${count})`;
    col.appendChild(header);

    tasks.forEach((task, index) => {
      if (!matchesFilter(task) || getStatus(task) !== status) return;
      col.appendChild(buildCard(task, index));
    });

    boardEl.appendChild(col);
  });
}

function buildCard(task, index) {
  const card = document.createElement("div");
  card.className = "card" + (task.done ? " done" : "");

  const text = document.createElement("div");
  text.className = "card-text";
  text.textContent = task.text;
  card.appendChild(text);

  const badges = document.createElement("div");
  badges.className = "card-badges";
  appendBadges(badges, task);
  if (badges.children.length) {
    card.appendChild(badges);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const left = document.createElement("button");
  left.textContent = "◀";
  left.title = "Move left";
  left.disabled = getStatus(task) === "todo";
  left.addEventListener("click", () => moveStatus(index, -1));

  const right = document.createElement("button");
  right.textContent = "▶";
  right.title = "Move right";
  right.disabled = getStatus(task) === "done";
  right.addEventListener("click", () => moveStatus(index, 1));

  const del = document.createElement("button");
  del.textContent = "×";
  del.className = "delete";
  del.setAttribute("aria-label", "Delete task");
  del.addEventListener("click", () => deleteTask(index));

  actions.append(left, right, del);
  card.appendChild(actions);
  return card;
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

// Rebuild the project filter dropdown from the projects currently in use.
function updateProjectFilter() {
  const projects = [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort();
  if (activeProject !== "all" && !projects.includes(activeProject)) {
    activeProject = "all";
  }

  projectFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All projects";
  projectFilter.appendChild(allOption);

  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project;
    option.textContent = project;
    projectFilter.appendChild(option);
  });

  projectFilter.value = activeProject;
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
  tasks.push({ text: text, done: false, status: "todo" });
  saveTasks();
  render();
}

function toggleTask(index) {
  const nowDone = !tasks[index].done;
  tasks[index].done = nowDone;
  tasks[index].status = nowDone ? "done" : "todo";
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

// --- View + filter controls -----------------------------------------------
function toggleView() {
  view = view === "list" ? "board" : "list";
  viewToggle.textContent = view === "list" ? "📋 Board view" : "📃 List view";
  render();
}

clearCompletedBtn.addEventListener("click", clearCompleted);
viewToggle.addEventListener("click", toggleView);
projectFilter.addEventListener("change", () => {
  activeProject = projectFilter.value;
  render();
});

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

// --- AI: organize the inbox (project + score + due) -----------------------
const organizeBtn = document.getElementById("ai-organize-btn");

async function organizeTasks() {
  if (tasks.length < 1) {
    showStatus("Add a task first.");
    return;
  }
  organizeBtn.disabled = true;
  showStatus("Organizing…");
  try {
    const data = await callApi("/api/organize", { tasks: taskTexts() });
    if (data) {
      data.items.forEach((item, i) => {
        tasks[i].project = item.project || null;
        tasks[i].score = item.score;
        if (item.due) tasks[i].due = item.due;
      });
      saveTasks();
      render();
      showStatus("Organized — projects, priorities, and due dates added.");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    organizeBtn.disabled = false;
  }
}

organizeBtn.addEventListener("click", organizeTasks);

// --- AI: ask a question about the tasks -----------------------------------
const askInput = document.getElementById("ai-ask-input");
const askBtn = document.getElementById("ai-ask-btn");
const answerEl = document.getElementById("ai-answer");
const projectcheckBtn = document.getElementById("ai-projectcheck-btn");

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

// --- AI: project check (risk + on-track summary) --------------------------
async function projectCheck() {
  if (tasks.length < 1) {
    showStatus("Add a task first.");
    return;
  }
  projectcheckBtn.disabled = true;
  showAnswer("");
  showStatus("Checking…");
  try {
    const payload = {
      tasks: tasks.map((t) => ({ text: t.text, done: !!t.done, due: t.due || null })),
    };
    const data = await callApi("/api/projectcheck", payload);
    if (data) {
      showStatus("");
      showAnswer("🔮 " + (data.summary || "No summary."));
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    projectcheckBtn.disabled = false;
  }
}

projectcheckBtn.addEventListener("click", projectCheck);

// Show whatever was saved when the page first loads.
render();
