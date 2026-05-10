const SUPABASE_URL = "https://tlzymhpodpoxfijgpjdz.supabase.co";
const SUPABASE_KEY = "sb_publishable_1zvntvfOu2TPesq7C8v8EQ_bUyCSueu";
const LOCAL_NOTIFICATION_CHECK_INTERVAL_MS = 30000;

const supabaseClient =
  typeof window.supabase !== "undefined"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

let tasks = [];
let currentUser = null;
let darkMode = JSON.parse(localStorage.getItem("darkMode") || "false");
let notifActive = JSON.parse(localStorage.getItem("notifActive") || "false");
let currentFilter = "all";
let editingTaskId = null;
let authMode = "signin";
let currentProfile = null;
let reminderTimerId = null;

const sidebar = document.getElementById("sidebar");
const btnHamburger = document.getElementById("btnHamburger");
const btnDeskAddTask = document.getElementById("btnDeskAddTask");
const fabMobile = document.getElementById("fabMobile");
const toggleDarkModeSwitch = document.getElementById("toggleDarkModeSwitch");
const btnToggleNotif = document.getElementById("btnToggleNotif");
const btnConnectTelegram = document.getElementById("btnConnectTelegram");
const btnCloudSync = document.getElementById("btnCloudSync");
const btnUpgradePremium = document.getElementById("btnUpgradePremium");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("Service Worker Terdaftar!"))
      .catch((err) => console.log("Gagal daftar SW:", err));
  });
}

async function init() {
  updateDarkMode();
  updateNotifUI();
  await checkUser();

  if ("Notification" in window && Notification.permission === "default") {
    requestNotificationPermission();
  }

  supabaseClient?.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      await loadUserProfile();
      await syncProfileTimezone();
      notifActive = !!currentProfile?.notif_active;
      if (isPremiumUser()) await loadTasksFromCloud();
      else tasks = loadTasksFromLocalStorage();
    } else {
      currentProfile = null;
      tasks = loadTasksFromLocalStorage();
      notifActive = JSON.parse(localStorage.getItem("notifActive") || "false");
    }
    updateNotifUI();
    updatePremiumUI();
    updateAuthUI();
    renderTasks();
    generateCalendar();
  });

  renderTasks();
  setupEventListeners();
  generateCalendar();
  startLocalReminderLoop();
}

let deferredPrompt;
const installContainer = document.getElementById("installContainer");
const btnInstallApp = document.getElementById("btnInstallApp");

window.addEventListener("beforeinstallprompt", (e) => {
  deferredPrompt = e;
  if (installContainer) {
    installContainer.style.display = "block";
  }
});

function triggerInstallApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User menginstall Otter Notes");
      }
      deferredPrompt = null;
    });
  } else {
    showToast("Aplikasi sudah terinstal atau browser tidak mendukung.");
  }
}

btnInstallApp?.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User response to the install prompt: ${outcome}`);

  deferredPrompt = null;
  if (outcome === "accepted" && installContainer) {
    installContainer.style.display = "none";
  }
});

window.addEventListener("appinstalled", () => {
  if (installContainer) installContainer.style.display = "none";
  deferredPrompt = null;
  console.log("Otter Notes berhasil di-install!");
});

if (window.matchMedia("(display-mode: standalone)").matches) {
  if (installContainer) installContainer.style.display = "none";
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("Browser ini tidak mendukung notifikasi.");
    return;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    console.log("Izin notifikasi diberikan.");
    return true;
  } else {
    console.warn("Izin notifikasi ditolak.");
    return false;
  }
}

async function handleNotifToggle() {
  const isGranted = await requestNotificationPermission();

  if (!isGranted) {
    showToast("Mohon aktifkan izin notifikasi di pengaturan browser Anda.");
    return;
  }

  const nextValue = !notifActive;
  await setNotificationPreference(nextValue);

  if (nextValue) {
    new Notification("Otter Notes", {
      body: "Notifikasi perangkat berhasil diaktifkan!",
      icon: "otter-logo.png",
    });
  }
}

function getDisplayName(user) {
  if (currentProfile?.display_name && currentProfile.display_name.trim())
    return currentProfile.display_name.trim();
  const metadataName = user?.user_metadata?.display_name;
  if (metadataName && metadataName.trim()) return metadataName.trim();
  const emailPrefix = user?.email?.split("@")[0];
  if (emailPrefix) return emailPrefix;
  return "Tamu";
}

function isPremiumUser() {
  return !!currentProfile?.is_premium;
}

function isUuidLike(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
}

function buildDueAtIsoFromInputs(date, time) {
  if (!date || !time) return null;

  const timePart = String(time).slice(0, 5);
  const localDate = new Date(`${date}T${timePart}:00`);
  if (Number.isNaN(localDate.getTime())) return null;
  return localDate.toISOString();
}

function getLocalDateTimeFromDueAt(dueAtIso, timezone) {
  if (!dueAtIso) return { date: null, time: null };

  const dueAt = new Date(dueAtIso);
  if (Number.isNaN(dueAt.getTime())) return { date: null, time: null };

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dueAt);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dueAt);

  return { date, time };
}

function normalizeTaskForUI(task) {
  const timezone = currentProfile?.timezone || getBrowserTimezone();
  const normalized = { ...task };

  if (normalized.due_at) {
    const localParts = getLocalDateTimeFromDueAt(normalized.due_at, timezone);
    normalized.date = localParts.date || normalized.date || null;
    normalized.time = localParts.time || normalized.time || null;
  } else {
    normalized.due_at = buildDueAtIsoFromInputs(
      normalized.date,
      normalized.time,
    );
  }

  normalized.completed = !!normalized.completed;
  normalized.deleted = !!normalized.deleted;
  normalized.description = normalized.description || "";
  return normalized;
}

function loadTasksFromLocalStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem("tasks") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTaskForUI);
  } catch {
    return [];
  }
}

function updatePremiumUI() {
  const locked = !currentUser || !isPremiumUser();
  const telegramLabel = document.getElementById("telegramLabel");
  const cloudLabel = document.getElementById("cloudLabel");

  if (btnConnectTelegram) {
    btnConnectTelegram.classList.toggle("locked", locked);
    btnConnectTelegram.title = locked ? "Fitur Premium" : "Kelola Telegram";
    if (telegramLabel)
      telegramLabel.innerText = locked
        ? "Hubungkan Telegram (Premium)"
        : currentProfile?.telegram_id
          ? `Telegram (${currentProfile.telegram_id})`
          : "Hubungkan Telegram";
  }

  if (btnCloudSync) {
    btnCloudSync.classList.toggle("locked", locked);
    btnCloudSync.title = locked ? "Fitur Premium" : "Sinkronkan sekarang";
    if (cloudLabel)
      cloudLabel.innerText = locked
        ? "Sinkronisasi Cloud (Premium)"
        : "Sinkronisasi Cloud";
  }

  if (btnUpgradePremium) {
    btnUpgradePremium.innerText = isPremiumUser()
      ? "Akun Premium Aktif"
      : "Beralih ke Premium";
    btnUpgradePremium.disabled = isPremiumUser();
  }
}

async function loadUserProfile() {
  if (!supabaseClient || !currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, is_premium, telegram_id, notif_active, timezone")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Gagal memuat profil:", error);
    currentProfile = null;
    return;
  }

  if (!data) {
    const displayName =
      currentUser.user_metadata?.display_name ||
      currentUser.email?.split("@")[0] ||
      "Pengguna";
    const { data: inserted, error: insertError } = await supabaseClient
      .from("profiles")
      .insert([
        {
          id: currentUser.id,
          display_name: displayName,
          is_premium: false,
          telegram_id: null,
          notif_active: false,
          timezone: getBrowserTimezone(),
        },
      ])
      .select(
        "id, display_name, is_premium, telegram_id, notif_active, timezone",
      )
      .single();

    if (insertError) {
      console.error("Gagal membuat profil:", insertError);
      currentProfile = null;
      return;
    }

    currentProfile = inserted;
    return;
  }

  currentProfile = data;
}

async function syncProfileTimezone() {
  if (!currentUser || !supabaseClient || !currentProfile) return;

  const timezone = getBrowserTimezone();
  if (currentProfile.timezone === timezone) return;

  const { error } = await supabaseClient
    .from("profiles")
    .update({ timezone })
    .eq("id", currentUser.id);

  if (!error) {
    currentProfile = { ...currentProfile, timezone };
  }
}

function openPremiumUpgrade() {
  if (!currentUser) {
    openModal("authModal");
    return;
  }
  const message = `Halo Admin, saya ingin upgrade ke Premium.%0A%0AEmail: ${currentUser.email}%0AUser ID: ${currentUser.id}`;
  window.open(`https://t.me/otternotes_bot?text=${message}`, "_blank");
}

async function setNotificationPreference(active) {
  if (!currentUser || !supabaseClient) {
    notifActive = active;
    localStorage.setItem("notifActive", JSON.stringify(notifActive));
    updateNotifUI();
    return true;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({ notif_active: active })
    .eq("id", currentUser.id);

  if (error) {
    showToast(error.message || "Gagal menyimpan preferensi notifikasi.");
    return false;
  }

  currentProfile = { ...currentProfile, notif_active: active };
  notifActive = active;
  localStorage.setItem("notifActive", JSON.stringify(notifActive));
  updateNotifUI();
  return true;
}

async function connectTelegram() {
  if (!currentUser) return showToast("Silakan login dulu.");
  if (!isPremiumUser())
    return showToast("Fitur Telegram hanya untuk akun premium.");

  const currentTelegramId = currentProfile?.telegram_id;
  if (currentTelegramId) {
    if (
      !confirm(
        `Telegram terhubung: ${currentTelegramId}\nIngin ganti ID atau lepas koneksi?`,
      )
    )
      return;
  }

  document.getElementById("inputTelegramId").value = currentTelegramId || "";
  document.getElementById("telegramModal").classList.remove("hidden");
}

document
  .getElementById("btnSaveTelegram")
  ?.addEventListener("click", async () => {
    const telegramId = document.getElementById("inputTelegramId").value.trim();

    if (telegramId && !/^-?\d+$/.test(telegramId)) {
      return showToast("Chat ID harus berupa angka numerik.");
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({ telegram_id: telegramId || null })
      .eq("id", currentUser.id);

    if (error) return showToast("Gagal menyimpan: " + error.message);

    currentProfile.telegram_id = telegramId || null;
    updatePremiumUI();
    closeModal("telegramModal");
    showToast(
      telegramId
        ? "Telegram berhasil dihubungkan!"
        : "Koneksi Telegram dihapus.",
    );
  });

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-1rem)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.addEventListener("online", () => {
  showToast("Koneksi kembali online. Menyinkronkan data...", "success");
  if (currentUser && isPremiumUser()) {
    syncCloudNow(true);
  }
});

window.addEventListener("offline", () => {
  showToast(
    "Anda sedang offline. Perubahan akan disimpan secara lokal.",
    "error",
  );
});

async function syncCloudNow(silent = false) {
  if (!currentUser) {
    if (!silent) showToast("Silakan login dulu.", "error");
    return;
  }
  if (!isPremiumUser()) {
    if (!silent)
      showToast("Sinkronisasi cloud hanya untuk akun premium.", "error");
    return;
  }

  const syncItems = tasks.filter((task) => !task.deleted);
  if (syncItems.length === 0) {
    if (!silent) showToast("Tidak ada tugas untuk disinkronkan.");
    return;
  }

  const payloads = syncItems.map((task) => {
    const dueAt = task.due_at || buildDueAtIsoFromInputs(task.date, task.time);
    const p = {
      user_id: currentUser.id,
      title: task.title || "",
      description: task.description || "",
      date: task.date || null,
      time: task.time || null,
      due_at: dueAt,
      completed: !!task.completed,
      deleted: !!task.deleted,
    };
    if (isUuidLike(task.id)) p.id = task.id;
    return p;
  });

  const { error } = await supabaseClient.from("tasks").upsert(payloads);
  if (error) {
    if (!silent)
      showToast(error.message || "Gagal sinkronisasi cloud.", "error");
    return;
  }

  await loadTasksFromCloud();
  renderTasks();
  generateCalendar();
  if (!silent) showToast("Sinkronisasi cloud selesai.", "success");
}

function updateDisplayedUserNames() {
  const name = currentUser ? getDisplayName(currentUser) : "Tamu";
  document.querySelectorAll(".displayUserName").forEach((el) => {
    el.innerText = name;
  });
  const loggedUserName = document.getElementById("loggedUserName");
  if (loggedUserName) loggedUserName.innerText = name;
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";

  const authTitle = document.getElementById("authTitle");
  const btnSubmitAuth = document.getElementById("btnSubmitAuth");
  const displayNameGroup = document.getElementById("authDisplayNameGroup");
  const btnModeSignIn = document.getElementById("btnModeSignIn");
  const btnModeSignUp = document.getElementById("btnModeSignUp");

  if (authTitle)
    authTitle.innerText = authMode === "signup" ? "Daftar Akun" : "Masuk";
  if (btnSubmitAuth)
    btnSubmitAuth.innerText = authMode === "signup" ? "Daftar" : "Masuk";
  if (displayNameGroup)
    displayNameGroup.classList.toggle("hidden", authMode !== "signup");

  if (btnModeSignIn)
    btnModeSignIn.style.borderColor =
      authMode === "signin" ? "#56433B" : "#e2e8f0";
  if (btnModeSignUp)
    btnModeSignUp.style.borderColor =
      authMode === "signup" ? "#56433B" : "#e2e8f0";
}

async function signUp(email, password, displayName) {
  if (!supabaseClient) {
    showToast("Supabase belum aktif.");
    return null;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  if (!supabaseClient) {
    showToast("Supabase belum aktif.");
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}

async function signOut() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function changePassword(newPassword) {
  if (!supabaseClient) {
    showToast("Supabase belum aktif.");
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}

async function deleteAccount() {
  if (!supabaseClient || !currentUser) return;

  const { error } = await supabaseClient.rpc("delete_current_user");
  if (error) throw error;
}

function updateAuthUI() {
  const authFormArea = document.getElementById("authFormArea");
  const loggedInArea = document.getElementById("loggedInArea");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authDisplayName = document.getElementById("authDisplayName");
  const authHint = document.getElementById("authHint");

  updateDisplayedUserNames();
  if (!authFormArea || !loggedInArea) return;

  if (currentUser) {
    authFormArea.classList.add("hidden");
    loggedInArea.classList.remove("hidden");
    if (authHint) authHint.classList.add("hidden");
    return;
  }

  loggedInArea.classList.add("hidden");
  authFormArea.classList.remove("hidden");
  if (authHint) authHint.classList.remove("hidden");
  if (authEmail) authEmail.value = "";
  if (authPassword) authPassword.value = "";
  if (authDisplayName) authDisplayName.value = "";
  setAuthMode("signin");
}

async function handleAuthSubmit() {
  if (!supabaseClient) {
    showToast("Supabase belum aktif.");
    return;
  }

  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authDisplayName = document.getElementById("authDisplayName");

  const email = authEmail?.value.trim();
  const password = authPassword?.value;
  const displayName = authDisplayName?.value.trim();

  if (!email || !password) {
    showToast("Email dan password wajib diisi.");
    return;
  }

  try {
    if (authMode === "signup") {
      if (!displayName) {
        showToast("Display name wajib diisi saat daftar.");
        return;
      }

      const data = await signUp(email, password, displayName);
      if (!data?.session) {
        showToast("Akun dibuat. Cek email verifikasi lalu login.");
        setAuthMode("signin");
        return;
      }
    } else {
      await signIn(email, password);
    }

    closeModal("authModal");
  } catch (error) {
    showToast(error.message || "Autentikasi gagal.");
  }
}

async function handleChangePassword() {
  const newPasswordInput = document.getElementById("newPasswordInput");
  const newPassword = newPasswordInput?.value || "";

  if (newPassword.length < 6) {
    showToast("Password baru minimal 6 karakter.", "error");
    return;
  }

  try {
    await changePassword(newPassword);
    newPasswordInput.value = "";
    closeModal("passwordModal");
    showToast("Password berhasil diperbarui.", "success");
  } catch (error) {
    showToast(error.message || "Gagal mengganti password.", "error");
  }
}

async function handleDeleteAccount() {
  if (!currentUser) return;

  const confirmed = confirm(
    "Hapus akun permanen? Semua data tugas akan hilang.",
  );
  if (!confirmed) return;

  try {
    await deleteAccount();
    await signOut();
    closeModal("authModal");
    tasks = [];
    renderTasks();
    generateCalendar();
    showToast("Akun berhasil dihapus.");
  } catch (error) {
    showToast(
      "Fitur hapus akun butuh SQL function `delete_current_user` di Supabase.",
    );
  }
}

function setupEventListeners() {
  if (btnHamburger) {
    btnHamburger.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }

  toggleDarkModeSwitch?.addEventListener("change", (e) => {
    darkMode = e.target.checked;
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    updateDarkMode();
  });

  if (btnToggleNotif) {
    btnToggleNotif.addEventListener("click", handleNotifToggle);
  }

  document.getElementById("btnSaveTask")?.addEventListener("click", saveTask);
  document.getElementById("btnResetAll")?.addEventListener("click", resetAll);
  document
    .getElementById("btnModeSignIn")
    ?.addEventListener("click", () => setAuthMode("signin"));
  document
    .getElementById("btnModeSignUp")
    ?.addEventListener("click", () => setAuthMode("signup"));
  document
    .getElementById("btnSubmitAuth")
    ?.addEventListener("click", handleAuthSubmit);
  document
    .getElementById("btnSubmitNewPassword")
    ?.addEventListener("click", handleChangePassword);
  document
    .getElementById("btnDeleteAccount")
    ?.addEventListener("click", handleDeleteAccount);
  btnConnectTelegram?.addEventListener("click", connectTelegram);
  btnCloudSync?.addEventListener("click", syncCloudNow);
  btnUpgradePremium?.addEventListener("click", openPremiumUpgrade);
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
      await signOut();
      closeModal("authModal");
    } catch (error) {
      showToast(error.message || "Gagal logout.");
    }
  });

  document.querySelectorAll(".desk-filter").forEach((item) => {
    item.addEventListener("click", (e) => {
      document
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const filter = e.currentTarget.getAttribute("data-filter");
      switchFilter(filter, e.currentTarget.innerText.trim());
    });
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", (e) => {
      document
        .querySelectorAll(".nav-item")
        .forEach((n) => n.classList.remove("active"));
      e.currentTarget.classList.add("active");
      switchView(
        "view" +
          e.currentTarget.getAttribute("data-view").charAt(0).toUpperCase() +
          e.currentTarget.getAttribute("data-view").slice(1).toLowerCase(),
      );
    });
  });

  document.querySelectorAll(".b-nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      document
        .querySelectorAll(".b-nav-item")
        .forEach((n) => n.classList.remove("active"));
      const target = e.currentTarget;
      target.classList.add("active");
      const viewName = target.getAttribute("data-view");

      if (viewName === "tasks") {
        switchFilter("all", "Semua Tugas");
        document
          .querySelectorAll(".filter-pill")
          .forEach((n) => n.classList.remove("active"));
        document
          .querySelector('.filter-pill[data-filter="all"]')
          .classList.add("active");
      } else {
        switchView(
          "view" +
            viewName.charAt(0).toUpperCase() +
            viewName.slice(1).toLowerCase(),
        );
      }
    });
  });

  document.querySelectorAll(".filter-pill").forEach((item) => {
    item.addEventListener("click", (e) => {
      document
        .querySelectorAll(".filter-pill")
        .forEach((n) => n.classList.remove("active"));
      e.currentTarget.classList.add("active");
      switchFilter(
        e.currentTarget.getAttribute("data-filter"),
        e.currentTarget.innerText.trim(),
      );
    });
  });
}

function switchView(viewId) {
  // Pastikan ID menggunakan format camelCase yang benar (misal: viewCalendar)
  const normalizedId =
    "view" +
    viewId.replace("view", "").charAt(0).toUpperCase() +
    viewId.replace("view", "").slice(1).toLowerCase();
  const targetElement =
    document.getElementById(normalizedId) || document.getElementById(viewId);

  if (!targetElement) {
    console.error("View not found:", viewId);
    return;
  }

  document.querySelectorAll(".view-section").forEach((v) => {
    v.classList.add("hidden");
    v.classList.remove("active");
  });

  targetElement.classList.remove("hidden");
  targetElement.classList.add("active");

  if (normalizedId !== "viewTasks") {
    if (btnDeskAddTask) btnDeskAddTask.style.display = "none";
    if (fabMobile) fabMobile.style.display = "none";
  }

  if (normalizedId === "viewCalendar") renderCalendarTasks();

  if (normalizedId === "viewSettings") {
    const filterContainer = document.getElementById("mobileFilterContainer");
    if (filterContainer) filterContainer.style.display = "none";
  }
}

function switchFilter(filter, titleText) {
  switchView("viewTasks");
  currentFilter = filter;
  if (titleText) document.getElementById("viewTitle").innerText = titleText;

  const filterContainer = document.getElementById("mobileFilterContainer");
  if (filter === "trash") {
    if (btnDeskAddTask) btnDeskAddTask.style.display = "none";
    if (fabMobile) fabMobile.style.display = "none";
    if (filterContainer) filterContainer.style.display = "none";
  } else {
    if (btnDeskAddTask) btnDeskAddTask.style.display = "flex";
    if (fabMobile)
      fabMobile.style.display = window.innerWidth <= 768 ? "flex" : "none";
    if (filterContainer) filterContainer.style.display = "flex";
  }
  renderTasks();
}

function openMobileTrash() {
  document
    .querySelectorAll(".b-nav-item")
    .forEach((n) => n.classList.remove("active"));
  document
    .querySelector('.b-nav-item[data-view="tasks"]')
    .classList.add("active");
  switchFilter("trash", "Sampah");
}

function openModal(mode, taskId = null) {
  if (mode === "authModal") {
    updateAuthUI();
    document.getElementById("authModal").classList.remove("hidden");
    return;
  }

  if (mode === "passwordModal") {
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("passwordModal").classList.remove("hidden");
    return;
  }

  editingTaskId = taskId;
  document.getElementById("taskModal").classList.remove("hidden");

  if (mode === "edit") {
    document.getElementById("modalTitle").innerText = "Edit Tugas";
    const task = tasks.find((t) => t.id === taskId);
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDescription").value = task.description || "";
    document.getElementById("taskDate").value = task.date || "";
    document.getElementById("taskTime").value = task.time || "";
  } else {
    document.getElementById("modalTitle").innerText = "Tambah Tugas";
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDescription").value = "";
    document.getElementById("taskDate").value = "";
    document.getElementById("taskTime").value = "";
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
  editingTaskId = null;
}

async function saveTask() {
  const btnSave = document.getElementById("btnSaveTask");

  const title = document.getElementById("taskTitle").value.trim();
  const date = document.getElementById("taskDate").value;
  const time = document.getElementById("taskTime").value;
  const desc = document.getElementById("taskDescription").value.trim();

  if (!title) return showToast("Judul tugas wajib diisi!");

  btnSave.innerText = "Menyimpan...";
  btnSave.disabled = true;

  try {
    const dueAt = buildDueAtIsoFromInputs(date, time);
    const existingTask = editingTaskId
      ? tasks.find((t) => t.id === editingTaskId)
      : null;
    const isCompleted = existingTask ? !!existingTask.completed : false;
    const isDeleted = existingTask ? !!existingTask.deleted : false;

    if (!currentUser || !supabaseClient || !isPremiumUser()) {
      if (editingTaskId) {
        const index = tasks.findIndex((t) => t.id === editingTaskId);
        if (index !== -1) {
          tasks[index] = normalizeTaskForUI({
            ...tasks[index],
            title,
            date,
            time,
            due_at: dueAt,
            description: desc,
          });
        }
      } else {
        tasks.unshift(
          normalizeTaskForUI({
            id: Date.now().toString(),
            title,
            date,
            time,
            due_at: dueAt,
            description: desc,
            completed: false,
            deleted: false,
          }),
        );
      }
      localStorage.setItem("tasks", JSON.stringify(tasks));
    } else {
      const taskData = {
        user_id: currentUser.id,
        title,
        date: date || null,
        time: time || null,
        due_at: dueAt,
        description: desc,
        completed: isCompleted,
        deleted: isDeleted,
      };
      if (editingTaskId && isUuidLike(editingTaskId)) {
        const { error } = await supabaseClient
          .from("tasks")
          .update(taskData)
          .eq("id", editingTaskId)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("tasks").insert([taskData]);
        if (error) throw error;
      }

      await loadTasksFromCloud();
    }

    renderTasks();
    generateCalendar();
    closeModal("taskModal");
  } catch (err) {
    console.error("Gagal menyimpan:", err);
    showToast("Gagal menyimpan tugas: " + err.message);
  } finally {
    btnSave.innerText = "Simpan";
    btnSave.disabled = false;
  }
}

async function checkUser() {
  if (!supabaseClient) {
    currentProfile = null;
    tasks = loadTasksFromLocalStorage();
    updatePremiumUI();
    updateAuthUI();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Gagal mengecek sesi:", error);
    currentProfile = null;
    tasks = loadTasksFromLocalStorage();
    updatePremiumUI();
    updateAuthUI();
    return;
  }

  currentUser = data.session?.user || null;

  if (currentUser) {
    await loadUserProfile();
    await syncProfileTimezone();
    notifActive = !!currentProfile?.notif_active;
    if (isPremiumUser()) await loadTasksFromCloud();
    else tasks = loadTasksFromLocalStorage();
    updateNotifUI();
    updatePremiumUI();
    updateAuthUI();
    return;
  }

  currentProfile = null;
  tasks = loadTasksFromLocalStorage();
  notifActive = JSON.parse(localStorage.getItem("notifActive") || "false");
  updateNotifUI();
  updatePremiumUI();
  updateAuthUI();
}

async function loadTasksFromCloud() {
  if (!supabaseClient || !currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal memuat tugas cloud:", error);
      return;
    }

    tasks = (data || []).map(normalizeTaskForUI);
  } catch (err) {
    console.error("Unexpected error in loadTasksFromCloud:", err);
  } finally {
    renderTasks();
    generateCalendar();
  }
}

async function toggleComplete(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.completed = !task.completed;

  if (currentUser && supabaseClient && isPremiumUser() && isUuidLike(task.id)) {
    const { error } = await supabaseClient
      .from("tasks")
      .update({ completed: task.completed })
      .eq("id", task.id)
      .eq("user_id", currentUser.id);
    if (error) {
      task.completed = !task.completed;
      showToast(error.message || "Gagal update tugas.");
      return;
    }
  } else {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  renderTasks();
  generateCalendar();
}

async function moveToTrash(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.deleted = true;

  if (currentUser && supabaseClient && isPremiumUser() && isUuidLike(task.id)) {
    const { error } = await supabaseClient
      .from("tasks")
      .update({ deleted: true })
      .eq("id", task.id)
      .eq("user_id", currentUser.id);
    if (error) {
      task.deleted = false;
      showToast(error.message || "Gagal memindahkan ke sampah.");
      return;
    }
  } else {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  renderTasks();
  generateCalendar();
}

async function restoreTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.deleted = false;

  if (currentUser && supabaseClient && isPremiumUser() && isUuidLike(task.id)) {
    const { error } = await supabaseClient
      .from("tasks")
      .update({ deleted: false })
      .eq("id", task.id)
      .eq("user_id", currentUser.id);
    if (error) {
      task.deleted = true;
      showToast(error.message || "Gagal memulihkan tugas.");
      return;
    }
  } else {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  renderTasks();
  generateCalendar();
}

async function deletePermanent(id) {
  if (!confirm("Hapus tugas ini secara permanen?")) return;

  if (currentUser && supabaseClient && isPremiumUser() && isUuidLike(id)) {
    const { error } = await supabaseClient
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);
    if (error) {
      showToast(error.message || "Gagal menghapus tugas.");
      return;
    }
  }

  tasks = tasks.filter((t) => t.id !== id);
  localStorage.setItem("tasks", JSON.stringify(tasks));
  renderTasks();
  generateCalendar();
}

async function resetAll() {
  if (!confirm("Hapus seluruh data tugas secara permanen?")) return;

  if (currentUser && supabaseClient && isPremiumUser()) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session) {
        showToast("Sesi berakhir, silakan login kembali.", "error");
        signOut();
        return;
      }

      const { error } = await supabaseClient
        .from("tasks")
        .delete()
        .eq("user_id", currentUser.id);

      if (error) {
        if (error.status === 401 || error.message.includes("Refresh Token")) {
          showToast("Masalah autentikasi, silakan login ulang.", "error");
          signOut();
          return;
        }
        throw error;
      }
    } catch (err) {
      console.error("Gagal reset cloud tasks:", err);
      showToast("Gagal menghapus data di cloud: " + err.message, "error");
      return;
    }
  }

  tasks = [];
  localStorage.removeItem("tasks");
  showToast("Semua tugas berhasil dihapus.", "success");
  renderTasks();
  generateCalendar();
}

function getDaysDifference(taskDate) {
  if (!taskDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(taskDate);
  target.setHours(0, 0, 0, 0);

  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getTaskComparableDate(task) {
  if (task?.date) return task.date;
  if (!task?.due_at) return null;
  const timezone = currentProfile?.timezone || getBrowserTimezone();
  return getLocalDateTimeFromDueAt(task.due_at, timezone).date;
}

function renderTasks() {
  const list = document.getElementById("tasksList");

  let filteredTasks = tasks.filter((t) => {
    if (currentFilter === "trash") return t.deleted === true;
    if (t.deleted) return false;

    const diff = getDaysDifference(getTaskComparableDate(t));
    if (currentFilter === "today") return diff === 0 && !t.completed;
    if (currentFilter === "upcoming") return diff > 0 && !t.completed;
    if (currentFilter === "overdue") return diff < 0 && !t.completed;
    if (currentFilter === "completed") return t.completed;
    return true;
  });

  if (filteredTasks.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:3rem; color:#94a3b8; font-size:0.9rem;">Tidak ada tugas.</div>`;
    return;
  }

  list.innerHTML = filteredTasks
    .map((task) => {
      const comparableDate = getTaskComparableDate(task);
      const diff = getDaysDifference(comparableDate);
      let statusTag = "";
      let dateInfo = "";

      if (!task.completed && diff !== null) {
        if (diff < 0)
          statusTag = `<span class="status-tag overdue">Terlewat</span>`;
        else if (diff === 0)
          statusTag = `<span class="status-tag today">Hari Ini</span>`;
        else if (diff > 0 && diff <= 7)
          statusTag = `<span class="status-tag upcoming">H-${diff}</span>`;
      }

      if (comparableDate) {
        let timeStr = task.time
          ? `&nbsp; <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${String(task.time).slice(0, 5)}`
          : "";
        dateInfo = `
                <div class="task-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    ${comparableDate} ${timeStr}
                    ${statusTag ? `&nbsp; ${statusTag}` : ""}
                </div>`;
      }

      let actionButtons = "";
      if (currentFilter === "trash") {
        actionButtons = `
                <button class="btn-action" onclick="restoreTask('${task.id}')" title="Pulihkan">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                </button>
                <button class="btn-action danger" onclick="deletePermanent('${task.id}')" title="Hapus Permanen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
      } else {
        actionButtons = `
                <button class="btn-action" onclick="openModal('edit', '${task.id}')" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-action danger" onclick="moveToTrash('${task.id}')" title="Hapus">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
      }

      return `
        <div class="task-card ${task.completed ? "completed" : ""}">
            <div class="checkbox-wrapper">
                <div class="checkbox ${task.completed ? "checked" : ""}" onclick="toggleComplete('${task.id}')"></div>
            </div>
            <div class="task-content">
                <div class="task-actions">${actionButtons}</div>
                <div class="task-title">${task.title}</div>
                ${task.description ? `<div class="task-desc">${task.description}</div>` : ""}

                <div class="task-footer">
                    ${dateInfo}
                </div>
            </div>
        </div>`;
    })
    .join("");
}

function renderCalendarTasks() {
  const calList = document.getElementById("calendarUpcomingList");
  if (!calList) return;

  const upcoming = tasks
    .filter(
      (t) =>
        !t.deleted &&
        !t.completed &&
        getDaysDifference(getTaskComparableDate(t)) >= 0,
    )
    .sort((a, b) => {
      const aValue = a.due_at
        ? new Date(a.due_at).getTime()
        : new Date(getTaskComparableDate(a) || "").getTime();
      const bValue = b.due_at
        ? new Date(b.due_at).getTime()
        : new Date(getTaskComparableDate(b) || "").getTime();
      return aValue - bValue;
    })
    .slice(0, 5);

  calList.innerHTML = upcoming.length
    ? upcoming
        .map(
          (t) => `
        <div class="upcoming-item">
            <div class="up-title">${t.title}</div>
            <div class="up-date">${getTaskComparableDate(t) || "-"}</div>
        </div>
    `,
        )
        .join("")
    : '<div style="color:#94a3b8; font-size:0.85rem;">Belum ada tugas mendatang.</div>';
}

function updateDarkMode() {
  if (darkMode) document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  if (toggleDarkModeSwitch) toggleDarkModeSwitch.checked = darkMode;
}

function updateNotifUI() {
  if (notifActive) btnToggleNotif?.classList.add("active");
  else btnToggleNotif?.classList.remove("active");
}

function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTaskNotifyKey(task) {
  return `${task.id || task.title}|${task.due_at || task.date || ""}|${task.time || ""}`;
}

function readNotifiedKeys() {
  try {
    const raw = localStorage.getItem("notifiedTaskKeys");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotifiedKeys(keys) {
  const trimmed = keys.slice(-500);
  localStorage.setItem("notifiedTaskKeys", JSON.stringify(trimmed));
}

function checkAndSendLocalNotifications() {
  if (!notifActive) return;
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;

  const timezone = currentProfile?.timezone || getBrowserTimezone();
  const now = new Date();
  const nowLocalDate = getLocalDateTimeFromDueAt(
    now.toISOString(),
    timezone,
  ).date;
  const nowLocalTime = getLocalDateTimeFromDueAt(
    now.toISOString(),
    timezone,
  ).time;

  const notified = new Set(readNotifiedKeys());
  let changed = false;

  for (const task of tasks) {
    if (task.completed || task.deleted) continue;
    const taskDate = getTaskComparableDate(task);
    const taskTime = task.time ? String(task.time).slice(0, 5) : null;
    if (!taskDate || !taskTime) continue;
    if (taskDate !== nowLocalDate) continue;
    if (taskTime !== nowLocalTime) continue;

    const key = getTaskNotifyKey(task);
    if (notified.has(key)) continue;

    new Notification("Otter Notes Reminder", {
      body: `${task.title}${task.description ? ` - ${task.description}` : ""}`,
      tag: key,
      icon: "otter-logo.png",
    });

    notified.add(key);
    changed = true;
  }

  if (changed) writeNotifiedKeys(Array.from(notified));
}

function startLocalReminderLoop() {
  if (reminderTimerId !== null) return;
  checkAndSendLocalNotifications();
  reminderTimerId = window.setInterval(
    checkAndSendLocalNotifications,
    LOCAL_NOTIFICATION_CHECK_INTERVAL_MS,
  );
}

function generateCalendar() {
  const grid = document.getElementById("calendarFullGrid");
  const monthTitle = document.getElementById("calMonthTitle");
  if (!grid || !monthTitle) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  monthTitle.innerText = now.toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
  });

  grid.innerHTML = "";

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    grid.innerHTML += `<div class="cal-day-box muted"><span class="cal-day-num">${day}</span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = d === now.getDate() && month === new Date().getMonth();

    const dayTasks = tasks.filter(
      (t) => getTaskComparableDate(t) === dateStr && !t.deleted,
    );

    const maxTasksToShow = window.innerWidth <= 768 ? 2 : 4;
    const tasksToShow = dayTasks.slice(0, maxTasksToShow);
    const extraTasksCount = dayTasks.length - maxTasksToShow;

    let tasksHtml = tasksToShow
      .map(
        (t) => `
            <div class="cal-task-bar ${t.completed ? "completed" : ""}" onclick="event.stopPropagation(); openModal('edit', '${t.id}')">
                ${t.title}
            </div>
        `,
      )
      .join("");

    if (extraTasksCount > 0) {
      tasksHtml += `<div class="cal-task-more">+${extraTasksCount} lagi</div>`;
    }

    grid.innerHTML += `
            <div class="cal-day-box ${isToday ? "is-today" : ""}" onclick="prepareNewTask('${dateStr}')">
                <span class="cal-day-num">${d}</span>
                <div class="cal-tasks-container">
                    ${tasksHtml}
                </div>
            </div>
        `;
  }

  const totalCellsSoFar = firstDayOfMonth + daysInMonth;
  const remainingCells = 42 - totalCellsSoFar;
  for (let i = 1; i <= remainingCells; i++) {
    grid.innerHTML += `<div class="cal-day-box muted"><span class="cal-day-num">${i}</span></div>`;
  }
}

function prepareNewTask(date) {
  openModal("add");
  document.getElementById("taskDate").value = date;
}

init();
