const THEME_STORAGE_KEY = "santhosh-chat-theme";

const elements = {
  chatForm: document.getElementById("chatForm"),
  questionInput: document.getElementById("questionInput"),
  sendBtn: document.getElementById("sendBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  chatMessages: document.getElementById("chatMessages"),
  connectionPill: document.getElementById("connectionPill"),
  messageTemplate: document.getElementById("messageTemplate")
};

const RENDER_WAKEUP_MESSAGE =
  "I'm waking up on Render... stretching servers and brewing coffee ☕. Give me 30-60 seconds";

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

function setConnectionStatus(text) {
  elements.connectionPill.textContent = text;
}

function appendMessage(role, text, sources = []) {
  if (role !== "welcome") {
    const welcomeNode = elements.chatMessages.querySelector(".msg.welcome");
    if (welcomeNode) {
      welcomeNode.remove();
    }
  }

  const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  const roleNode = node.querySelector(".msg-role");
  const bodyNode = node.querySelector(".msg-body");

  node.classList.add(role);
  roleNode.textContent =
    role === "user" ? "You" : role === "bot" ? "Assistant" : role === "welcome" ? "" : "Error";
  bodyNode.textContent = text;

  if (role === "bot" && sources.length > 0) {
    const sourcesNode = document.createElement("div");
    sourcesNode.className = "sources";
    sourcesNode.textContent = `Sources: ${sources.map((s) => s.sourceId).join(", ")}`;
    node.appendChild(sourcesNode);
  }

  elements.chatMessages.appendChild(node);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendChat(question) {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
  } catch (error) {
    throw buildRequestError(0, error?.message, "Chat request failed");
  }

  if (!response.ok) {
    const text = await response.text();
    throw buildRequestError(response.status, text, `Chat request failed (${response.status})`);
  }

  return response.json();
}

function init() {
  loadTheme();
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  setConnectionStatus("API Proxy Ready");
  appendMessage("welcome", "I’m waking up on Render... stretching servers and brewing coffee ☕");

  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = elements.questionInput.value.trim();
    if (!question) {
      return;
    }

    appendMessage("user", question);
    elements.questionInput.value = "";
    elements.sendBtn.disabled = true;

    try {
      const result = await sendChat(question);
      appendMessage("bot", result.answer || "No answer returned.", result.sources || []);
    } catch (error) {
      appendMessage("error", error.message || "Request failed");
    } finally {
      elements.sendBtn.disabled = false;
      elements.questionInput.focus();
    }
  });
}

init();
