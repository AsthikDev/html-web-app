(() => {
  const WORKER_URL = window.CLAUDE_WORKER_URL;
  const CODE_KEY = "claude_access_code";
  const CHATS_KEY = "claude_chats_v1";
  const EFFORT_KEY = "claude_effort";

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
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const menuToggle = document.getElementById("menu-toggle");
  const effortSelect = document.getElementById("effort-select");
  const effortBtns = effortSelect ? [...effortSelect.querySelectorAll(".effort-btn")] : [];
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "claude_theme";

  const ICON_ASSISTANT = `<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>`;
  const ICON_USER = `<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.8-3.6-5-8-5z"/></svg>`;
  const ICON_COPY = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  applyTheme(localStorage.getItem(THEME_KEY));

  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || (systemPrefersDark() ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  const SUGGESTIONS = [
    "Explain a concept simply",
    "Draft an email",
    "Debug some code",
    "Brainstorm ideas",
  ];

  let chats = loadChats();
  let activeChatId = chats.length ? chats[0].id : null;
  let streaming = false;

  function getEffort() {
    const stored = localStorage.getItem(EFFORT_KEY);
    return stored === "low" || stored === "medium" || stored === "high" ? stored : "high";
  }

  function setEffort(effort) {
    localStorage.setItem(EFFORT_KEY, effort);
    for (const btn of effortBtns) {
      btn.classList.toggle("active", btn.dataset.effort === effort);
    }
  }

  for (const btn of effortBtns) {
    btn.addEventListener("click", () => setEffort(btn.dataset.effort));
  }
  setEffort(getEffort());

  function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarBackdrop?.classList.remove("open");
  }

  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
    sidebarBackdrop?.classList.toggle("open");
  });
  sidebarBackdrop?.addEventListener("click", closeSidebar);

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
        closeSidebar();
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
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<h2>What can I help with?</h2><div class="suggestions"></div>`;
      const suggestionsEl = empty.querySelector(".suggestions");
      for (const s of SUGGESTIONS) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "suggestion-chip";
        chip.textContent = s;
        chip.addEventListener("click", () => sendMessage(s));
        suggestionsEl.appendChild(chip);
      }
      messagesEl.appendChild(empty);
      return;
    }
    for (const msg of chat.messages) {
      const bubble = appendBubble(msg.role, msg.content);
      if (msg.role === "assistant") enhanceCodeBlocks(bubble);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendBubble(role, content) {
    const emptyState = messagesEl.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const row = document.createElement("div");
    row.className = "msg-row " + role;

    const avatar = document.createElement("div");
    avatar.className = "avatar " + role;
    avatar.innerHTML = role === "user" ? ICON_USER : ICON_ASSISTANT;

    const bubbleCol = document.createElement("div");
    bubbleCol.className = "bubble-col";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.dataset.raw = content;
    bubble.innerHTML = renderMarkdown(content);

    const toolbar = document.createElement("div");
    toolbar.className = "msg-toolbar";
    const copyMsgBtn = document.createElement("button");
    copyMsgBtn.type = "button";
    copyMsgBtn.innerHTML = ICON_COPY + "<span>Copy</span>";
    copyMsgBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(bubble.dataset.raw || bubble.textContent).then(() => {
        copyMsgBtn.innerHTML = ICON_CHECK + "<span>Copied</span>";
        setTimeout(() => (copyMsgBtn.innerHTML = ICON_COPY + "<span>Copy</span>"), 1500);
      });
    });
    toolbar.appendChild(copyMsgBtn);

    bubbleCol.appendChild(bubble);
    bubbleCol.appendChild(toolbar);
    row.appendChild(avatar);
    row.appendChild(bubbleCol);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function enhanceCodeBlocks(container) {
    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.dataset.enhanced) return;
      pre.dataset.enhanced = "1";
      const codeEl = pre.querySelector("code");
      if (!codeEl) return;
      const langMatch = codeEl.className.match(/lang-(\w+)/);
      const lang = langMatch ? langMatch[1] : "code";
      const header = document.createElement("div");
      header.className = "code-header";
      header.innerHTML = `<span>${lang}</span><button type="button" class="copy-btn">${ICON_COPY}<span>Copy</span></button>`;
      pre.prepend(header);
      header.querySelector(".copy-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(codeEl.textContent).then(() => {
          const btn = header.querySelector(".copy-btn");
          btn.innerHTML = ICON_CHECK + "<span>Copied</span>";
          setTimeout(() => (btn.innerHTML = ICON_COPY + "<span>Copy</span>"), 1500);
        });
      });
    });
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
          effort: getEffort(),
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
            assistantBubble.dataset.raw = assistantText;
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
      enhanceCodeBlocks(assistantBubble);
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

  newChatBtn.addEventListener("click", () => {
    newChat();
    closeSidebar();
  });

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
