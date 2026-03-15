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
  const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  const roleNode = node.querySelector(".msg-role");
  const bodyNode = node.querySelector(".msg-body");

  node.classList.add(role);
  roleNode.textContent = role === "user" ? "You" : role === "bot" ? "Assistant" : "Error";
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
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Chat request failed (${response.status})`);
  }

  return response.json();
}

function init() {
  loadTheme();
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  setConnectionStatus("API Proxy Ready");
  appendMessage("bot", "Ask anything about your uploaded knowledge base.");

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
