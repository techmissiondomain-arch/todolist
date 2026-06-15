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
const calendarEl = document.getElementById("calendar");
const viewNav = document.querySelectorAll(".nav-item[data-view]");
const insightNav = document.querySelectorAll(".nav-item.insight");
const projectNav = document.getElementById("project-nav");
const viewTitle = document.getElementById("view-title");
const workspace = document.getElementById("workspace");
const addTaskBtn = document.getElementById("add-task-btn");

// Load any previously saved tasks, or start with an empty list.
let tasks = loadTasks();
let view = localStorage.getItem("todolist.view") || "list"; // list / board / calendar
let activeProject = localStorage.getItem("todolist.filter") || "all";
let smartFilter = localStorage.getItem("todolist.smart") || null; // today / overdue / upcoming
let searchTerm = "";
let selectMode = false;
let activePanel = null; // null (tasks) | "stats" | "notes" | "meeting"
const selected = new Set();

function genId() {
  return "t" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const arr = saved ? JSON.parse(saved) : [];
  arr.forEach((t) => {
    if (!t.id) t.id = genId();
  });
  return arr;
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
  const projectOk = activeProject === "all" || (task.project || "") === activeProject;
  const searchOk = searchTerm === "" || task.text.toLowerCase().includes(searchTerm);
  const today = todayString();
  let smartOk = true;
  if (smartFilter === "today") smartOk = !task.done && task.due && task.due <= today;
  else if (smartFilter === "overdue") smartOk = isOverdue(task);
  else if (smartFilter === "upcoming") smartOk = !task.done && task.due && task.due > today;
  return projectOk && searchOk && smartOk;
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
const SMART_TITLES = { today: "Today", overdue: "Overdue", upcoming: "Upcoming" };
const PANEL_TITLES = { stats: "Stats", notes: "Notes", meeting: "Meeting" };
const smartNav = document.querySelectorAll(".nav-item.smart");

// Open an insight panel (or toggle it off, returning to the task views).
function showPanel(name) {
  activePanel = activePanel === name ? null : name;
  render();
}

function render() {
  const onTasks = !activePanel;
  updateProjectNav();

  // Highlight exactly the active item per group (filters only highlight on tasks).
  viewNav.forEach((btn) => btn.classList.toggle("active", onTasks && btn.dataset.view === view));
  smartNav.forEach((btn) => btn.classList.toggle("active", onTasks && btn.dataset.smart === smartFilter));
  insightNav.forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === activePanel));

  viewTitle.textContent = activePanel
    ? PANEL_TITLES[activePanel]
    : smartFilter
      ? SMART_TITLES[smartFilter]
      : activeProject === "all"
        ? "All tasks"
        : activeProject;

  // Show exactly one area: the task workspace, or one insight panel.
  workspace.hidden = !onTasks;
  statsPanel.hidden = activePanel !== "stats";
  notesPanel.hidden = activePanel !== "notes";
  meetingPanel.hidden = activePanel !== "meeting";

  if (onTasks) {
    list.hidden = view !== "list";
    boardEl.hidden = view !== "board";
    calendarEl.hidden = view !== "calendar";
    if (view === "list") {
      renderList();
    } else if (view === "board") {
      renderBoard();
    } else {
      renderCalendar();
    }
    updateProgress();
    updateBulkBar();
  } else if (activePanel === "stats") {
    renderStats();
  } else if (activePanel === "notes") {
    renderNotes();
  }
}

function renderList() {
  list.innerHTML = "";
  let shown = 0;

  tasks.forEach((task, index) => {
    if (!matchesFilter(task)) return;
    shown += 1;

    const li = document.createElement("li");
    if (task.done) {
      li.classList.add("done");
    }

    const row = document.createElement("div");
    row.className = "task-row";

    if (selectMode) {
      const sel = document.createElement("input");
      sel.type = "checkbox";
      sel.className = "select-box";
      sel.checked = selected.has(task.id);
      sel.addEventListener("change", () => {
        if (sel.checked) selected.add(task.id);
        else selected.delete(task.id);
        updateBulkBar();
      });
      row.appendChild(sel);
    } else {
      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "⠿";
      handle.title = "Drag to reorder";
      handle.draggable = true;
      handle.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
      });
      row.appendChild(handle);
      li.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      li.addEventListener("drop", (event) => {
        event.preventDefault();
        reorderTask(event.dataTransfer.getData("text/plain"), task.id);
      });
    }

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

    const repeatBtn = document.createElement("button");
    const repeating = task.repeat && task.repeat !== "none";
    repeatBtn.className = "repeat-btn" + (repeating ? " active" : "");
    repeatBtn.textContent = "🔁";
    repeatBtn.title = "Repeat: " + (repeating ? task.repeat : "off") + " (click to change)";
    repeatBtn.addEventListener("click", () => cycleRepeat(index));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(index));

    row.append(due, repeatBtn, deleteBtn);
    li.appendChild(row);
    li.appendChild(renderSubtasks(task, index));
    list.appendChild(li);
  });

  if (shown === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent =
      searchTerm || activeProject !== "all"
        ? "No matching tasks."
        : "No tasks yet — add one above, or describe a goal and ✨ Generate.";
    list.appendChild(empty);
  }
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
  if (task.repeat && task.repeat !== "none") {
    const rb = document.createElement("span");
    rb.className = "badge repeat";
    rb.textContent = REPEAT_LABELS[task.repeat] || "🔁";
    badges.appendChild(rb);
  }
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

  // Optional free-text description / details for the task.
  const desc = document.createElement("input");
  desc.type = "text";
  desc.className = "task-desc";
  desc.placeholder = "Add details…";
  desc.value = task.description || "";
  desc.addEventListener("change", () => {
    tasks[index].description = desc.value.trim() || null;
    saveTasks();
  });
  wrap.appendChild(desc);

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

// Rebuild the sidebar project list from the projects currently in use.
function updateProjectNav() {
  const projects = [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort();
  if (activeProject !== "all" && !projects.includes(activeProject)) {
    activeProject = "all";
  }

  projectNav.innerHTML = "";

  function addItem(value, label, count) {
    const btn = document.createElement("button");
    btn.className = "nav-item" + (!activePanel && activeProject === value ? " active" : "");

    const name = document.createElement("span");
    name.textContent = label;

    const badge = document.createElement("span");
    badge.className = "nav-count";
    badge.textContent = count;

    btn.append(name, badge);
    btn.addEventListener("click", () => {
      activeProject = value;
      activePanel = null;
      localStorage.setItem("todolist.filter", value);
      render();
    });
    projectNav.appendChild(btn);
  }

  addItem("all", "All tasks", tasks.length);
  projects.forEach((project) => {
    addItem(project, project, tasks.filter((t) => t.project === project).length);
  });
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
  tasks.push({ id: genId(), text: text, done: false, status: "todo" });
  saveTasks();
  render();
}

// Parse quick-add syntax: "#Project email Sara tomorrow" -> {text, project, due}.
function parseQuickAdd(raw) {
  let text = raw;
  let project = null;
  let due = null;

  const projectMatch = text.match(/#(\S+)/);
  if (projectMatch) {
    project = projectMatch[1];
    text = text.replace(projectMatch[0], "");
  }

  const fmt = (d) => {
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
  };
  const today = new Date();
  const lower = text.toLowerCase();
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  let m;
  if ((m = lower.match(/\bin (\d+) days?\b/))) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(m[1], 10));
    due = fmt(d);
    text = text.replace(/\bin \d+ days?\b/i, "");
  } else if (/\btoday\b/i.test(text)) {
    due = fmt(today);
    text = text.replace(/\btoday\b/i, "");
  } else if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    due = fmt(d);
    text = text.replace(/\btomorrow\b/i, "");
  } else if (/\bnext week\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    due = fmt(d);
    text = text.replace(/\bnext week\b/i, "");
  } else if ((m = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const target = weekdays.indexOf(m[1]);
    const d = new Date(today);
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    due = fmt(d);
    text = text.replace(new RegExp(`\\b${m[1]}\\b`, "i"), "");
  } else if ((m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/))) {
    due = m[1];
    text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/, "");
  }

  text = text.replace(/\s+/g, " ").trim();
  return { text, project, due };
}

function addTaskFromText(raw) {
  const parsed = parseQuickAdd(raw);
  if (parsed.text === "") return;
  const task = { id: genId(), text: parsed.text, done: false, status: "todo" };
  if (parsed.project) task.project = parsed.project;
  if (parsed.due) task.due = parsed.due;
  tasks.push(task);
  saveTasks();
  render();
}

function toggleTask(index) {
  const task = tasks[index];
  const nowDone = !task.done;
  task.done = nowDone;
  task.status = nowDone ? "done" : "todo";

  // When a recurring task is completed, queue up its next occurrence.
  // Roll forward from whichever is later (the old due date or today) so the
  // next occurrence always lands in the future, even if this one was overdue.
  if (nowDone && task.repeat && task.repeat !== "none") {
    const base = task.due && task.due > todayString() ? task.due : todayString();
    tasks.push({
      id: genId(),
      text: task.text,
      done: false,
      status: "todo",
      repeat: task.repeat,
      project: task.project || null,
      due: advanceDate(base, task.repeat),
    });
  }

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
const searchInput = document.getElementById("search");
clearCompletedBtn.addEventListener("click", clearCompleted);
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  if (searchTerm) activePanel = null; // show results in the task view
  render();
});
viewNav.forEach((btn) => {
  btn.addEventListener("click", () => {
    view = btn.dataset.view;
    activePanel = null;
    localStorage.setItem("todolist.view", view);
    render();
  });
});

smartNav.forEach((btn) => {
  btn.addEventListener("click", () => {
    smartFilter = smartFilter === btn.dataset.smart ? null : btn.dataset.smart;
    activePanel = null;
    localStorage.setItem("todolist.smart", smartFilter || "");
    render();
  });
});

insightNav.forEach((btn) => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});

addTaskBtn.addEventListener("click", openModal);

// --- Bulk select + actions -------------------------------------------------
const selectToggle = document.getElementById("select-toggle");
const bulkBar = document.getElementById("bulk-bar");
const bulkCount = document.getElementById("bulk-count");

function updateBulkBar() {
  bulkBar.hidden = !selectMode;
  selectToggle.classList.toggle("active", selectMode);
  bulkCount.textContent = `${selected.size} selected`;
}

selectToggle.addEventListener("click", () => {
  selectMode = !selectMode;
  if (!selectMode) selected.clear();
  render();
});

bulkBar.addEventListener("click", (event) => {
  const action = event.target.dataset.bulk;
  if (!action) return;
  if (action === "clear") {
    selected.clear();
    render();
    return;
  }
  if (action === "delete") {
    tasks = tasks.filter((t) => !selected.has(t.id));
  } else {
    const status = action === "complete" ? "done" : action;
    tasks.forEach((t) => {
      if (selected.has(t.id)) {
        t.status = status;
        t.done = status === "done";
      }
    });
  }
  selected.clear();
  saveTasks();
  render();
});

// --- Drag to reorder -------------------------------------------------------
function reorderTask(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return;
  const from = tasks.findIndex((t) => t.id === sourceId);
  if (from < 0) return;
  const [moved] = tasks.splice(from, 1);
  const to = tasks.findIndex((t) => t.id === targetId);
  tasks.splice(to < 0 ? tasks.length : to, 0, moved);
  saveTasks();
  render();
}

// --- Keyboard shortcuts ----------------------------------------------------
document.addEventListener("keydown", (event) => {
  // Escape closes the add-task modal first, from anywhere.
  if (event.key === "Escape" && !addModal.hidden) {
    closeModal();
    return;
  }
  const tag = (event.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || event.target.isContentEditable) {
    if (event.key === "Escape") event.target.blur();
    return;
  }
  if (event.key === "n") {
    event.preventDefault();
    openModal();
  } else if (event.key === "/") {
    event.preventDefault();
    searchInput.focus();
  } else if (event.key === "Escape" && selectMode) {
    selectMode = false;
    selected.clear();
    render();
  }
});

// --- Add-task modal --------------------------------------------------------
const addModal = document.getElementById("add-modal");
const modalTaskInput = document.getElementById("modal-task-input");
const modalDue = document.getElementById("modal-due");
const modalProject = document.getElementById("modal-project");
const modalGoal = document.getElementById("modal-goal");
const modalGenerateBtn = document.getElementById("modal-generate");
const modalStatus = document.getElementById("modal-status");
const modalAddBtn = document.getElementById("modal-add");
const modalCancelBtn = document.getElementById("modal-cancel");
const modalCloseBtn = document.getElementById("modal-close");

function showModalStatus(message) {
  modalStatus.textContent = message;
  modalStatus.hidden = !message;
}

function openModal() {
  modalTaskInput.value = "";
  modalGoal.value = "";
  modalDue.value = "";
  modalProject.value = "";
  showModalStatus("");
  addModal.hidden = false;
  modalTaskInput.focus();
}

function closeModal() {
  addModal.hidden = true;
}

// Add a single task from the modal (with quick-add parsing + the extra fields).
function modalAdd() {
  const raw = modalTaskInput.value.trim();
  if (raw === "") {
    showModalStatus("Type a task name, or use AI generate below.");
    return;
  }
  const parsed = parseQuickAdd(raw);
  const task = { id: genId(), text: parsed.text, done: false, status: "todo" };
  const project = modalProject.value.trim() || parsed.project;
  if (project) task.project = project;
  const due = modalDue.value || parsed.due;
  if (due) task.due = due;
  tasks.push(task);
  saveTasks();
  activePanel = null;
  closeModal();
  render();
}

// Let AI turn an idea/goal into several tasks, straight from the modal.
async function modalGenerate() {
  const goal = modalGoal.value.trim() || modalTaskInput.value.trim();
  if (goal === "") {
    showModalStatus("Type an idea or goal to generate from.");
    return;
  }
  modalGenerateBtn.disabled = true;
  showModalStatus("✨ Thinking…");
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal }),
    });
    const data = await res.json();
    if (!res.ok) {
      showModalStatus(data.error || "Something went wrong.");
      return;
    }
    data.tasks.forEach((t) =>
      tasks.push({ id: genId(), text: t, done: false, status: "todo" })
    );
    saveTasks();
    activePanel = null;
    closeModal();
    render();
  } catch (err) {
    showModalStatus("Couldn't reach the server. Is it running?");
  } finally {
    modalGenerateBtn.disabled = false;
  }
}

modalAddBtn.addEventListener("click", modalAdd);
modalGenerateBtn.addEventListener("click", modalGenerate);
modalCancelBtn.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
addModal.addEventListener("click", (event) => {
  if (event.target === addModal) closeModal();
});
modalTaskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") modalAdd();
});
modalGoal.addEventListener("keydown", (event) => {
  if (event.key === "Enter") modalGenerate();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (input.value.trim() === "") {
    return;
  }
  addTaskFromText(input.value);
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

// --- Recurring tasks -------------------------------------------------------
const REPEATS = ["none", "daily", "weekly", "monthly"];
const REPEAT_LABELS = { daily: "🔁 Daily", weekly: "🔁 Weekly", monthly: "🔁 Monthly" };

function cycleRepeat(index) {
  const current = REPEATS.indexOf(tasks[index].repeat || "none");
  const next = REPEATS[(current + 1) % REPEATS.length];
  tasks[index].repeat = next === "none" ? null : next;
  saveTasks();
  render();
}

// Return a YYYY-MM-DD string advanced by one repeat period from the given date.
function advanceDate(dateStr, repeat) {
  const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  if (repeat === "daily") base.setDate(base.getDate() + 1);
  else if (repeat === "weekly") base.setDate(base.getDate() + 7);
  else if (repeat === "monthly") base.setMonth(base.getMonth() + 1);
  const offsetMs = base.getTimezoneOffset() * 60000;
  return new Date(base.getTime() - offsetMs).toISOString().slice(0, 10);
}

// --- Calendar view ---------------------------------------------------------
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  calendarEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "cal-header";

  const prev = document.createElement("button");
  prev.textContent = "◀";
  prev.title = "Previous month";
  prev.addEventListener("click", () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    render();
  });

  const title = document.createElement("span");
  title.className = "cal-title";
  title.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const next = document.createElement("button");
  next.textContent = "▶";
  next.title = "Next month";
  next.addEventListener("click", () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    render();
  });

  header.append(prev, title, next);
  calendarEl.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "cal-grid";

  WEEKDAYS.forEach((wd) => {
    const cell = document.createElement("div");
    cell.className = "cal-weekday";
    cell.textContent = wd;
    grid.appendChild(cell);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayString();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "cal-day empty";
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "cal-day" + (dateStr === today ? " today" : "");

    const num = document.createElement("div");
    num.className = "cal-daynum";
    num.textContent = day;
    cell.appendChild(num);

    tasks.forEach((task) => {
      if (!matchesFilter(task) || task.due !== dateStr) return;
      const item = document.createElement("div");
      item.className = "cal-task" + (task.done ? " done" : "");
      item.textContent = task.text;
      item.title = task.text;
      cell.appendChild(item);
    });

    grid.appendChild(cell);
  }

  calendarEl.appendChild(grid);
}

// --- Stats panel -----------------------------------------------------------
const statsPanel = document.getElementById("stats-panel");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const open = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const today = todayString();
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const dueToday = tasks.filter((t) => !t.done && t.due === today).length;
  const noDue = tasks.filter((t) => !t.due && !t.done).length;

  const agg = {};
  tasks.forEach((t) => {
    const key = t.project || "No project";
    if (!agg[key]) agg[key] = { done: 0, total: 0 };
    agg[key].total += 1;
    if (t.done) agg[key].done += 1;
  });
  const projectBars = Object.entries(agg)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([p, v]) => {
      const ppc = v.total ? Math.round((v.done / v.total) * 100) : 0;
      return `<div class="proj-prog">
        <div class="proj-prog-head"><span>${escapeHtml(p)}</span><span>${v.done}/${v.total}</span></div>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${ppc}%"></div></div>
      </div>`;
    })
    .join("");

  statsPanel.innerHTML = `
    <div class="stat-big">${pct}% complete</div>
    <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
    <ul class="stat-list">
      <li><span>Total tasks</span><span>${total}</span></li>
      <li><span>Done</span><span>${done}</span></li>
      <li><span>Open</span><span>${open}</span></li>
    </ul>
    <div class="stat-subtitle">Today's load</div>
    <ul class="stat-list">
      <li><span>Due today</span><span>${dueToday}</span></li>
      <li><span>Overdue</span><span>${overdue}</span></li>
      <li><span>No due date</span><span>${noDue}</span></li>
    </ul>
    <div class="stat-subtitle">By project</div>
    ${projectBars || '<div class="proj-prog"><div class="proj-prog-head"><span>No tasks yet</span><span></span></div></div>'}
  `;
}

// The Stats panel opens via the sidebar Insights nav (see showPanel).

// --- Notes (knowledge base) ------------------------------------------------
const NOTES_KEY = "todolist.notes";
let notes = loadNotes();
const notesPanel = document.getElementById("notes-panel");
const notesList = document.getElementById("notes-list");
const noteTitle = document.getElementById("note-title");
const noteProject = document.getElementById("note-project");
const noteBody = document.getElementById("note-body");
const noteAdd = document.getElementById("note-add");
const noteSummarize = document.getElementById("note-summarize");

function loadNotes() {
  const saved = localStorage.getItem(NOTES_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
  notesList.innerHTML = "";
  notes.forEach((note, index) => {
    const li = document.createElement("li");
    li.className = "note";

    const heading = document.createElement("div");
    heading.className = "note-heading";
    const titleSpan = document.createElement("span");
    titleSpan.textContent = note.title || "(untitled)";
    heading.appendChild(titleSpan);
    if (note.project) {
      const badge = document.createElement("span");
      badge.className = "badge project";
      badge.textContent = note.project;
      heading.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "note-text";
    body.textContent = note.body || "";

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "×";
    del.title = "Delete note";
    del.addEventListener("click", () => {
      notes.splice(index, 1);
      saveNotes();
      renderNotes();
    });

    li.append(del, heading, body);
    notesList.appendChild(li);
  });

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No notes yet — jot down an idea above.";
    notesList.appendChild(empty);
  }
}

function addNote() {
  const title = noteTitle.value.trim();
  const body = noteBody.value.trim();
  const project = noteProject.value.trim();
  if (title === "" && body === "") return;
  notes.push({ title: title, body: body, project: project || null });
  saveNotes();
  noteTitle.value = "";
  noteBody.value = "";
  noteProject.value = "";
  renderNotes();
}

async function summarizeNotes() {
  if (notes.length === 0) {
    showStatus("Add a note first.");
    return;
  }
  noteSummarize.disabled = true;
  showAnswer("");
  showStatus("Summarizing…");
  try {
    const data = await callApi("/api/notes-summary", { notes: notes });
    if (data) {
      showStatus("");
      showAnswer("🧠 " + (data.summary || ""));
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    noteSummarize.disabled = false;
  }
}

noteAdd.addEventListener("click", addNote);
noteSummarize.addEventListener("click", summarizeNotes);

// --- AI meeting assistant --------------------------------------------------
const meetingPanel = document.getElementById("meeting-panel");
const meetingNotes = document.getElementById("meeting-notes");
const meetingExtract = document.getElementById("meeting-extract");

async function extractMeeting() {
  const notes = meetingNotes.value.trim();
  if (notes === "") return;
  meetingExtract.disabled = true;
  showAnswer("");
  showStatus("Reading notes…");
  try {
    const data = await callApi("/api/meeting", { notes: notes });
    if (data) {
      data.tasks.forEach((task) => addTask(task));
      meetingNotes.value = "";
      showStatus(`Added ${data.tasks.length} action items.`);
      showAnswer(data.summary ? "📝 " + data.summary : "");
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    meetingExtract.disabled = false;
  }
}

meetingExtract.addEventListener("click", extractMeeting);

// --- Dark mode -------------------------------------------------------------
const THEME_KEY = "todolist.theme";
const themeToggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.querySelector("span").textContent =
    theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
}

let theme = localStorage.getItem(THEME_KEY) || "light";
applyTheme(theme);

themeToggle.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

// Show whatever was saved when the page first loads.
render();
