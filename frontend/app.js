const STORAGE_KEY = "santhosh-chat-config";
const RENDER_WAKEUP_MESSAGE =
  "I'm waking up on Render... stretching servers and brewing coffee ☕. Give me 30-60 seconds, then try again.";

const elements = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  topK: document.getElementById("topK"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  ingestBtn: document.getElementById("ingestBtn"),
  ingestStatus: document.getElementById("ingestStatus"),
  docId: document.getElementById("docId"),
  docTitle: document.getElementById("docTitle"),
  docText: document.getElementById("docText"),
  chatForm: document.getElementById("chatForm"),
  questionInput: document.getElementById("questionInput"),
  sendBtn: document.getElementById("sendBtn"),
  chatMessages: document.getElementById("chatMessages"),
  connectionPill: document.getElementById("connectionPill"),
  messageTemplate: document.getElementById("messageTemplate")
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

function defaultApiBase() {
  return window.location.origin;
}

function normalizeBaseUrl(value) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\/$/, "");
}

function loadConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      apiBaseUrl: defaultApiBase(),
      topK: 4
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      apiBaseUrl: normalizeBaseUrl(parsed.apiBaseUrl) || defaultApiBase(),
      topK: Number(parsed.topK) || 4
    };
  } catch {
    return {
      apiBaseUrl: defaultApiBase(),
      topK: 4
    };
  }
}

function saveConfig() {
  const apiBaseUrl = normalizeBaseUrl(elements.apiBaseUrl.value);
  const topK = Math.min(10, Math.max(1, Number(elements.topK.value) || 4));

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ apiBaseUrl, topK })
  );

  elements.topK.value = String(topK);
  setConnectionStatus(apiBaseUrl ? `API: ${apiBaseUrl}` : "Not Connected");
}

function currentConfig() {
  const apiBaseUrl = normalizeBaseUrl(elements.apiBaseUrl.value);
  const topK = Math.min(10, Math.max(1, Number(elements.topK.value) || 4));
  return { apiBaseUrl, topK };
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

  if (role === "bot" && Array.isArray(sources) && sources.length > 0) {
    const sourcesNode = document.createElement("div");
    sourcesNode.className = "sources";
    sourcesNode.textContent = `Sources: ${sources.map((s) => s.sourceId).join(", ")}`;
    node.appendChild(sourcesNode);
  }

  elements.chatMessages.appendChild(node);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendChat(question) {
  const { apiBaseUrl, topK } = currentConfig();
  if (!apiBaseUrl) {
    throw new Error("Backend URL is required");
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, topK })
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

async function ingestDocument(payload) {
  const { apiBaseUrl } = currentConfig();
  if (!apiBaseUrl) {
    throw new Error("Backend URL is required");
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw buildRequestError(0, error?.message, "Ingest failed");
  }

  if (!response.ok) {
    const text = await response.text();
    throw buildRequestError(response.status, text, `Ingest failed (${response.status})`);
  }

  return response.json();
}

function setIngestStatus(message, isError = false) {
  elements.ingestStatus.textContent = message;
  elements.ingestStatus.classList.toggle("error", isError);
}

function init() {
  const cfg = loadConfig();
  elements.apiBaseUrl.value = cfg.apiBaseUrl;
  elements.topK.value = String(cfg.topK);
  setConnectionStatus(`API: ${cfg.apiBaseUrl}`);

  appendMessage(
    "bot",
    "Hi, I am ready. Ask a question, or ingest a document from the left panel first."
  );

  elements.saveConfigBtn.addEventListener("click", () => {
    saveConfig();
    appendMessage("bot", "Settings saved.");
  });

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

  elements.ingestBtn.addEventListener("click", async () => {
    const documentId = elements.docId.value.trim();
    const title = elements.docTitle.value.trim();
    const text = elements.docText.value.trim();

    if (!documentId || !title || !text) {
      setIngestStatus("documentId, title, and text are required.", true);
      return;
    }

    elements.ingestBtn.disabled = true;
    setIngestStatus("Ingesting...");

    try {
      const result = await ingestDocument({ documentId, title, text });
      setIngestStatus(`Ingested ${result.chunkCount} chunks for ${result.documentId}.`);
      appendMessage("bot", `Document ${result.documentId} ingested (${result.chunkCount} chunks).`);
    } catch (error) {
      setIngestStatus(error.message || "Ingest failed", true);
    } finally {
      elements.ingestBtn.disabled = false;
    }
  });
}

init();
