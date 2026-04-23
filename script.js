let tasks = [];
let darkMode = false;
let showForm = false;
let showSettings = false;

if ("Notification" in window) {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

function sendNotification(title, message) {
  const options = {
    body: message,
    icon: "otter-logo.png",
    badge: "otter-logo.png",
    vibrate: [200, 100, 200]
  };

  if (Notification.permission === "granted") {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  }
}

function checkDeadlines() {
  const savedTasks = JSON.parse(localStorage.getItem("tasks") || "[]");
  const now = new Date();

  savedTasks.forEach(task => {
    if (task.completed) return;

    const deadline = new Date(`${task.date}T${task.time}`);
    const diffInMs = deadline - now;
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInDays <= 3 && diffInDays > 2.95) {
      sendNotification("Pengingat H-3", `Tugas "${task.title}" deadline 3 hari lagi.`);
    } else if (diffInDays <= 1 && diffInDays > 0.95) {
      sendNotification("Peringatan H-1", `Tugas "${task.title}" deadline besok!`);
    }
  });
}

setInterval(checkDeadlines, 3600000);

function loadData() {
  const savedTasks = localStorage.getItem("tasks");
  const savedDarkMode = localStorage.getItem("darkMode");
  if (savedTasks) {
    tasks = JSON.parse(savedTasks);
    renderTasks();
  }
  if (savedDarkMode) {
    darkMode = JSON.parse(savedDarkMode);
    updateDarkMode();
  }
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function updateDarkMode() {
  const iconMoon = document.getElementById("iconMoon");
  const iconSun = document.getElementById("iconSun");
  if (darkMode) {
    document.body.classList.add("dark");
    iconMoon.style.display = "none";
    iconSun.style.display = "block";
  } else {
    document.body.classList.remove("dark");
    iconMoon.style.display = "block";
    iconSun.style.display = "none";
  }
  localStorage.setItem("darkMode", JSON.stringify(darkMode));
}

function toggleDarkMode() {
  darkMode = !darkMode;
  updateDarkMode();
}

function toggleForm() {
  showForm = !showForm;
  const formPanel = document.getElementById("formPanel");
  const btnToggleForm = document.getElementById("btnToggleForm");
  if (showForm) {
    formPanel.classList.remove("hidden");
    btnToggleForm.classList.add("active");
    if (showSettings) toggleSettings();
  } else {
    formPanel.classList.add("hidden");
    btnToggleForm.classList.remove("active");
  }
}

function toggleSettings() {
  showSettings = !showSettings;
  const settingsPanel = document.getElementById("settingsPanel");
  const btnToggleSettings = document.getElementById("btnToggleSettings");
  if (showSettings) {
    settingsPanel.classList.remove("hidden");
    btnToggleSettings.classList.add("active");
    if (showForm) toggleForm();
  } else {
    settingsPanel.classList.add("hidden");
    btnToggleSettings.classList.remove("active");
  }
}

function addTask() {
  const titleInput = document.getElementById("taskTitle");
  const descInput = document.getElementById("taskDescription");
  const dateInput = document.getElementById("taskDate");
  const timeInput = document.getElementById("taskTime");
  if (!titleInput.value.trim() || !dateInput.value || !timeInput.value) {
    alert("Mohon isi judul, tanggal, dan jam tugas!");
    return;
  }
  const newTask = {
    id: Date.now().toString(),
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    date: dateInput.value,
    time: timeInput.value,
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(newTask);
  saveTasks();
  renderTasks();
  titleInput.value = "";
  descInput.value = "";
  dateInput.value = "";
  timeInput.value = "";
  toggleForm();
}

function toggleComplete(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(id) {
  if (confirm("Yakin ingin menghapus tugas ini?")) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    renderTasks();
  }
}

function resetAll() {
  if (confirm("Yakin ingin menghapus semua tugas?")) {
    tasks = [];
    saveTasks();
    renderTasks();
    toggleSettings();
  }
}

function getDaysUntilDeadline(taskDate, taskTime) {
  const deadline = new Date(taskDate + "T" + taskTime);
  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDeadlineWarning(taskDate, taskTime) {
  const daysUntil = getDaysUntilDeadline(taskDate, taskTime);
  if (daysUntil < 0) return { text: "Terlewat", color: "red" };
  if (daysUntil === 0) return { text: "Hari ini!", color: "red" };
  if (daysUntil === 1) return { text: "H-1", color: "orange" };
  if (daysUntil <= 3) return { text: "H-3", color: "yellow" };
  return null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function renderTasks() {
  const tasksList = document.getElementById("tasksList");
  if (tasks.length === 0) {
    tasksList.innerHTML = '<div class="empty-state">Belum ada tugas.</div>';
    return;
  }
  tasksList.innerHTML = tasks.map((task) => {
    const warning = getDeadlineWarning(task.date, task.time);
    const warningHTML = warning && !task.completed ? `<span class="warning ${warning.color}">${warning.text}</span>` : "";
    return `
      <div class="task-card ${task.completed ? "completed" : ""}">
        <button class="btn-delete" onclick="deleteTask('${task.id}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <div class="task-content">
          <div class="checkbox ${task.completed ? "checked" : ""}" onclick="toggleComplete('${task.id}')"></div>
          <div class="task-details">
            <div class="task-title ${task.completed ? "completed" : ""}">${task.title}</div>
            ${task.description ? `<div class="task-description">${task.description}</div>` : ""}
            <div class="task-meta">
              <div class="meta-item">${formatDate(task.date)}</div>
              <div class="meta-item">${task.time}</div>
              ${warningHTML}
            </div>
          </div>
        </div>
      </div>`;
  }).join("");
}

document.getElementById("btnToggleForm").addEventListener("click", toggleForm);
document.getElementById("btnToggleSettings").addEventListener("click", toggleSettings);
document.getElementById("btnToggleDark").addEventListener("click", toggleDarkMode);
document.getElementById("btnAddTask").addEventListener("click", addTask);
document.getElementById("btnResetAll").addEventListener("click", resetAll);

loadData();
