(() => {
  const WORKER_URL = window.CLAUDE_WORKER_URL;
  const CODE_KEY = "claude_access_code";
  const CHATS_KEY = "claude_chats_v1";

  const gate = document.getElementById("gate");
  const gateForm = document.getElementById("gate-form");
  const gateInput = document.getElementById("gate-input");
  const gateError = document.getElementById("gate-error");
  const app = document.getElementById("app");
  const messagesEl = document.getElementById("messages");
  const composer = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const newChatBtn = document.getElementById("new-chat");
  const historyList = document.getElementById("history-list");
  const logoutBtn = document.getElementById("logout");

  let chats = loadChats();
  let activeChatId = chats.length ? chats[0].id : null;
  let streaming = false;

  function loadChats() {
    try {
      return JSON.parse(localStorage.getItem(CHATS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveChats() {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }

  function activeChat() {
    return chats.find((c) => c.id === activeChatId);
  }

  function newChat() {
    const chat = { id: crypto.randomUUID(), title: "New chat", messages: [] };
    chats.unshift(chat);
    activeChatId = chat.id;
    saveChats();
    renderHistory();
    renderMessages();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    for (const chat of chats) {
      const item = document.createElement("div");
      item.className = "history-item" + (chat.id === activeChatId ? " active" : "");
      item.textContent = chat.title || "New chat";
      item.addEventListener("click", () => {
        activeChatId = chat.id;
        renderHistory();
        renderMessages();
      });
      historyList.appendChild(item);
    }
  }

  // Minimal markdown: fenced code blocks, inline code, bold, italic, paragraphs, lists.
  function renderMarkdown(text) {
    const escape = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);
    let html = "";
    for (let i = 0; i < parts.length; i += 3) {
      const textChunk = parts[i] || "";
      html += renderInline(textChunk);
      const lang = parts[i + 1];
      const code = parts[i + 2];
      if (code !== undefined) {
        html += `<pre><code${lang ? ` class="lang-${lang}"` : ""}>${escape(code)}</code></pre>`;
      }
    }
    return html;

    function renderInline(chunk) {
      const paragraphs = chunk.split(/\n{2,}/).filter((p) => p.trim());
      return paragraphs
        .map((p) => {
          let e = escape(p);
          e = e.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          e = e.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
          e = e.replace(/`([^`]+)`/g, "<code>$1</code>");
          e = e.replace(/\n/g, "<br>");
          return `<p>${e}</p>`;
        })
        .join("");
    }
  }

  function renderMessages() {
    const chat = activeChat();
    messagesEl.innerHTML = "";
    if (!chat || chat.messages.length === 0) {
      messagesEl.innerHTML = `<div class="empty-state"><h2>What can I help with?</h2></div>`;
      return;
    }
    for (const msg of chat.messages) {
      appendBubble(msg.role, msg.content);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendBubble(role, content) {
    const emptyState = messagesEl.querySelector(".empty-state");
    if (emptyState) emptyState.remove();
    const row = document.createElement("div");
    row.className = "msg-row " + role;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = renderMarkdown(content);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function autoTitle(chat) {
    if (chat.title !== "New chat") return;
    const first = chat.messages.find((m) => m.role === "user");
    if (first) chat.title = first.content.slice(0, 40);
  }

  async function sendMessage(text) {
    let chat = activeChat();
    if (!chat) {
      newChat();
      chat = activeChat();
    }
    chat.messages.push({ role: "user", content: text });
    autoTitle(chat);
    saveChats();
    renderHistory();
    appendBubble("user", text);

    const assistantBubble = appendBubble("assistant", "");
    assistantBubble.innerHTML = `<span class="typing-dot"></span>`;

    streaming = true;
    sendBtn.disabled = true;

    let assistantText = "";
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-code": localStorage.getItem(CODE_KEY) || "",
        },
        body: JSON.stringify({
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem(CODE_KEY);
        assistantBubble.innerHTML = `<span class="error-bubble">Access code rejected. Refresh and re-enter it.</span>`;
        showGate("Access code rejected.");
        return;
      }
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}) ${errText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          let evt;
          try {
            evt = JSON.parse(data);
          } catch {
            continue;
          }
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            assistantText += evt.delta.text;
            assistantBubble.innerHTML = renderMarkdown(assistantText);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else if (evt.type === "error") {
            throw new Error(evt.error?.message || "Stream error");
          }
        }
      }

      if (!assistantText) assistantText = "(empty response)";
      chat.messages.push({ role: "assistant", content: assistantText });
      saveChats();
    } catch (err) {
      assistantBubble.innerHTML = `<span class="error-bubble">${(err && err.message) || "Something went wrong."}</span>`;
    } finally {
      streaming = false;
      sendBtn.disabled = false;
    }
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || streaming) return;
    input.value = "";
    input.style.height = "auto";
    sendMessage(text);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  });

  newChatBtn.addEventListener("click", newChat);

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(CODE_KEY);
    showGate("");
  });

  function showGate(message) {
    app.classList.add("hidden");
    gate.classList.remove("hidden");
    gateError.textContent = message || "";
    gateInput.value = "";
    gateInput.focus();
  }

  function showApp() {
    gate.classList.add("hidden");
    app.classList.remove("hidden");
    if (!chats.length) newChat();
    renderHistory();
    renderMessages();
  }

  gateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = gateInput.value.trim();
    if (!code) return;
    localStorage.setItem(CODE_KEY, code);
    showApp();
  });

  // Initial boot: if we have a stored code, try the app straight away.
  // A bad code will surface as a 401 on the first message send.
  if (localStorage.getItem(CODE_KEY)) {
    showApp();
  } else {
    showGate("");
  }
})();
