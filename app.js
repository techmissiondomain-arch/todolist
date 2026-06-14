// A small to-do list that saves your tasks in the browser.

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

// Draw the whole list from scratch based on the current tasks.
function render() {
  list.innerHTML = "";

  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    if (task.done) {
      li.classList.add("done");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTask(index));

    // Task text — click to edit (rename).
    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.text;
    label.title = "Click to edit";
    label.addEventListener("click", () => startEditing(index, li, label));

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

    li.append(checkbox, label, due, deleteBtn);
    list.appendChild(li);
  });

  updateProgress();
}

// Swap a task's label for a text box so the user can rename it.
function startEditing(index, li, label) {
  const editor = document.createElement("input");
  editor.type = "text";
  editor.className = "edit-input";
  editor.value = tasks[index].text;
  li.replaceChild(editor, label);
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

// --- AI task generation ---------------------------------------------------
// Send the user's goal to our server, which asks Claude to break it into
// tasks, then add each returned task to the list.

const goalInput = document.getElementById("ai-goal-input");
const generateBtn = document.getElementById("ai-generate-btn");
const status = document.getElementById("ai-status");

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

async function generateTasks() {
  const goal = goalInput.value.trim();
  if (goal === "") {
    return;
  }

  generateBtn.disabled = true;
  showStatus("Thinking…");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal }),
    });
    const data = await response.json();

    if (!response.ok) {
      showStatus(data.error || "Something went wrong.");
      return;
    }

    data.tasks.forEach((task) => addTask(task));
    goalInput.value = "";
    showStatus(`Added ${data.tasks.length} tasks.`);
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    generateBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", generateTasks);
goalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    generateTasks();
  }
});

// --- AI prioritization ----------------------------------------------------
// Send the current task list to our server, which asks the AI for the best
// order, then reorder the list to match.

const prioritizeBtn = document.getElementById("ai-prioritize-btn");

async function prioritizeTasks() {
  if (tasks.length < 2) {
    showStatus("Add at least two tasks first.");
    return;
  }

  prioritizeBtn.disabled = true;
  showStatus("Prioritizing…");

  try {
    const response = await fetch("/api/prioritize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: tasks.map((task) => task.text) }),
    });
    const data = await response.json();

    if (!response.ok) {
      showStatus(data.error || "Something went wrong.");
      return;
    }

    // Reorder the tasks using the order the AI returned (a list of positions).
    tasks = data.order.map((position) => tasks[position]);
    saveTasks();
    render();
    showStatus("Reordered — most important first.");
  } catch (err) {
    showStatus("Couldn't reach the server. Is it running?");
  } finally {
    prioritizeBtn.disabled = false;
  }
}

prioritizeBtn.addEventListener("click", prioritizeTasks);

// Show whatever was saved when the page first loads.
render();
