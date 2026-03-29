const ADMIN_TOKEN_SESSION_KEY = "santhosh-chat-admin-token";
const THEME_STORAGE_KEY = "santhosh-chat-theme";
let authPromise = null;
const RENDER_WAKEUP_MESSAGE =
  "I'm waking up on Render... stretching servers and brewing coffee ☕. Give me 30-60 seconds, then try again.";

const elements = {
  ingestBtn: document.getElementById("ingestBtn"),
  changePasswordBtn: document.getElementById("changePasswordBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  ingestStatus: document.getElementById("ingestStatus"),
  docId: document.getElementById("docId"),
  docTitle: document.getElementById("docTitle"),
  docText: document.getElementById("docText"),
  chatMessages: document.getElementById("chatMessages"),
  connectionPill: document.getElementById("connectionPill"),
  messageTemplate: document.getElementById("messageTemplate"),
  adminAuthDialog: document.getElementById("adminAuthDialog"),
  adminAuthForm: document.getElementById("adminAuthForm"),
  adminPasswordInput: document.getElementById("adminPasswordInput"),
  adminPasswordCancel: document.getElementById("adminPasswordCancel"),
  authError: document.getElementById("authError")
};

function isLikelyRenderWakeup(status, details = "") {
  const text = String(details || "").toLowerCase();
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("bad gateway") ||
    text.includes("service unavailable") ||
    text.includes("gateway timeout") ||
    text.includes("upstream request timeout")
  );
}

function buildRequestError(status, details, fallbackMessage) {
  if (isLikelyRenderWakeup(status, details)) {
    return new Error(RENDER_WAKEUP_MESSAGE);
  }
  return new Error(details || fallbackMessage);
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  elements.themeToggleBtn.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  applyTheme("light");
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
}

function getAdminToken() {
  return (sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY) || "").trim();
}

function setAdminToken(token) {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, token);
  }
}

function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
}

function closeAuthDialog() {
  if (typeof elements.adminAuthDialog.close === "function" && elements.adminAuthDialog.open) {
    elements.adminAuthDialog.close();
    return;
  }
  elements.adminAuthDialog.removeAttribute("open");
}

function openAuthDialog() {
  if (authPromise) {
    return authPromise;
  }

  authPromise = new Promise((resolve) => {
    const onCancel = (event) => {
      if (event) {
        event.preventDefault();
      }
      cleanup();
      closeAuthDialog();
      resolve("");
    };

    const onSubmit = (event) => {
      event.preventDefault();
      const token = (elements.adminPasswordInput.value || "").trim();
      if (!token) {
        elements.authError.textContent = "Password is required.";
        return;
      }

      setAdminToken(token);
      cleanup();
      closeAuthDialog();
      resolve(token);
    };

    const onDialogCancel = (event) => {
      event.preventDefault();
      onCancel();
    };

    const cleanup = () => {
      elements.adminAuthForm.removeEventListener("submit", onSubmit);
      elements.adminPasswordCancel.removeEventListener("click", onCancel);
      elements.adminAuthDialog.removeEventListener("cancel", onDialogCancel);
      authPromise = null;
    };

    elements.authError.textContent = "";
    elements.adminPasswordInput.value = "";
    elements.adminAuthForm.addEventListener("submit", onSubmit);
    elements.adminPasswordCancel.addEventListener("click", onCancel);
    elements.adminAuthDialog.addEventListener("cancel", onDialogCancel);
    if (typeof elements.adminAuthDialog.showModal === "function") {
      elements.adminAuthDialog.showModal();
    } else {
      elements.adminAuthDialog.setAttribute("open", "open");
    }
    elements.adminPasswordInput.focus();
  });

  return authPromise;
}

async function ensureAdminToken(forcePrompt = false) {
  if (!forcePrompt) {
    const existing = getAdminToken();
    if (existing) {
      return existing;
    }
  }
  return openAuthDialog();
}

function setConnectionStatus(text) {
  elements.connectionPill.textContent = text;
}

function appendMessage(role, text) {
  const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  const roleNode = node.querySelector(".msg-role");
  const bodyNode = node.querySelector(".msg-body");

  node.classList.add(role);
  roleNode.textContent = role === "bot" ? "System" : role === "user" ? "Admin" : "Error";
  bodyNode.textContent = text;

  elements.chatMessages.appendChild(node);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function ingestDocument(payload) {
  const adminToken = await ensureAdminToken();
  if (!adminToken) {
    throw new Error("Admin password is required");
  }

  let response;
  try {
    response = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw buildRequestError(0, error?.message, "Ingest failed");
  }

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      clearAdminToken();
    }
    throw buildRequestError(response.status, text, `Ingest failed (${response.status})`);
  }

  return response.json();
}

function setIngestStatus(message, isError = false) {
  elements.ingestStatus.textContent = message;
  elements.ingestStatus.classList.toggle("error", isError);
}

function init() {
  loadTheme();
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  setConnectionStatus("API via Vercel rewrite");

  appendMessage("bot", "Admin portal ready. Enter password in popup to upload.");

  ensureAdminToken().then((token) => {
    if (token) {
      appendMessage("bot", "Admin password saved for this tab.");
    }
  });

  elements.changePasswordBtn.addEventListener("click", async () => {
    const token = await ensureAdminToken(true);
    if (token) {
      appendMessage("bot", "Admin password updated.");
    } else {
      appendMessage("error", "Password update cancelled.");
    }
  });

  elements.ingestBtn.addEventListener("click", async () => {
    const documentId = elements.docId.value.trim();
    const title = elements.docTitle.value.trim();
    const text = elements.docText.value.trim();

    if (!documentId || !title || !text) {
      setIngestStatus("documentId, title, and text are required.", true);
      return;
    }

    elements.ingestBtn.disabled = true;
    setIngestStatus("Uploading to KB...");

    try {
      const result = await ingestDocument({ documentId, title, text });
      setIngestStatus(`Uploaded ${result.chunkCount} chunks for ${result.documentId}.`);
      appendMessage("user", `Uploaded ${result.documentId} (${result.chunkCount} chunks).`);
    } catch (error) {
      setIngestStatus(error.message || "Upload failed", true);
      appendMessage("error", error.message || "Upload failed");
    } finally {
      elements.ingestBtn.disabled = false;
    }
  });
}

init();
