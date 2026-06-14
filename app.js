// A small to-do list that saves your tasks in the browser.

const STORAGE_KEY = "todolist.tasks";

const form = document.getElementById("new-task-form");
const input = document.getElementById("new-task-input");
const list = document.getElementById("task-list");

// Load any previously saved tasks, or start with an empty list.
let tasks = loadTasks();

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Draw the whole list from scratch based on the current tasks.
function render() {
  list.innerHTML = "";

  // When there's nothing to do yet, show a friendly hint instead of a blank space.
  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No tasks yet — add one above!";
    list.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    if (task.done) {
      li.classList.add("done");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTask(index));

    const label = document.createElement("span");
    label.textContent = task.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(index));

    li.append(checkbox, label, deleteBtn);
    list.appendChild(li);
  });
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

// Show whatever was saved when the page first loads.
render();
