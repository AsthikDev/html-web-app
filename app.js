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
  const messagesWrap = document.querySelector(".messages-wrap");
  const scrollBottomBtn = document.getElementById("scroll-bottom");
  const composer = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("send");
  const sendIcon = document.getElementById("send-icon");
  const stopIcon = document.getElementById("stop-icon");
  const tokenEstimateEl = document.getElementById("token-estimate");
  const exportBtn = document.getElementById("export-chat");
  const newChatBtn = document.getElementById("new-chat");
  const historyList = document.getElementById("history-list");
  const historySearch = document.getElementById("history-search");
  const clearChatsBtn = document.getElementById("clear-chats");
  const logoutBtn = document.getElementById("logout");
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const menuToggle = document.getElementById("menu-toggle");
  const effortSelect = document.getElementById("effort-select");
  const effortBtns = effortSelect ? [...effortSelect.querySelectorAll(".effort-btn")] : [];
  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "claude_theme";

  const ICON_ASSISTANT = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>`;
  const ICON_USER = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>`;
  const ICON_COPY = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const ICON_REDO = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
  const ICON_PENCIL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

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
  let currentAbortController = null;
  let pinnedToBottom = true;
  let historyFilter = "";

  function getEffort() {
    const stored = localStorage.getItem(EFFORT_KEY);
    return stored === "low" || stored === "medium" || stored === "high" ? stored : "low";
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

  function deleteChat(id) {
    const idx = chats.findIndex((c) => c.id === id);
    if (idx === -1) return;
    chats.splice(idx, 1);
    if (activeChatId === id) {
      activeChatId = chats.length ? chats[0].id : null;
      if (!activeChatId) newChat();
    }
    saveChats();
    renderHistory();
    renderMessages();
  }

  function renameChat(id, title) {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    chat.title = title.trim() || "New chat";
    saveChats();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    const q = historyFilter.trim().toLowerCase();
    const visible = q
      ? chats.filter((c) => (c.title || "").toLowerCase().includes(q))
      : chats;

    if (chats.length && !visible.length) {
      const empty = document.createElement("div");
      empty.className = "history-item";
      empty.style.cursor = "default";
      empty.textContent = "No matching chats";
      historyList.appendChild(empty);
      return;
    }

    for (const chat of visible) {
      const item = document.createElement("div");
      item.className = "history-item" + (chat.id === activeChatId ? " active" : "");

      const title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = chat.title || "New chat";

      const actions = document.createElement("div");
      actions.className = "history-item-actions";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.title = "Rename";
      renameBtn.innerHTML = ICON_PENCIL;
      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        title.contentEditable = "true";
        title.focus();
        document.execCommand("selectAll", false, null);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.title = "Delete chat";
      deleteBtn.innerHTML = ICON_TRASH;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${chat.title || "New chat"}"?`)) deleteChat(chat.id);
      });

      function commitRename() {
        title.contentEditable = "false";
        renameChat(chat.id, title.textContent);
        renderHistory();
      }
      title.addEventListener("blur", commitRename);
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); title.blur(); }
        if (e.key === "Escape") { title.textContent = chat.title || "New chat"; title.blur(); }
      });
      title.addEventListener("click", (e) => {
        if (title.isContentEditable) e.stopPropagation();
      });

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(title);
      item.appendChild(actions);

      item.addEventListener("click", () => {
        activeChatId = chat.id;
        renderHistory();
        renderMessages();
        closeSidebar();
      });
      historyList.appendChild(item);
    }
  }

  historySearch?.addEventListener("input", () => {
    historyFilter = historySearch.value;
    renderHistory();
  });

  clearChatsBtn?.addEventListener("click", () => {
    if (!chats.length) return;
    if (!confirm("Delete all chats? This can't be undone.")) return;
    chats = [];
    activeChatId = null;
    newChat();
  });

  // Lightweight markdown: fenced code, headings, lists, blockquotes, rules, links, inline styles.
  function renderMarkdown(text) {
    const escape = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    function renderSpan(s) {
      let e = escape(s);
      e = e.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      e = e.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
      e = e.replace(/`([^`]+)`/g, "<code>$1</code>");
      e = e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return e;
    }

    function renderBlock(chunk) {
      const lines = chunk.split("\n");
      let html = "";
      let list = null; // { type: 'ul'|'ol', items: [] }
      let para = [];

      function flushPara() {
        if (para.length) {
          html += `<p>${para.map(renderSpan).join("<br>")}</p>`;
          para = [];
        }
      }
      function flushList() {
        if (list) {
          html += `<${list.type}>${list.items.map((i) => `<li>${renderSpan(i)}</li>`).join("")}</${list.type}>`;
          list = null;
        }
      }

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
          flushPara();
          flushList();
          continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        const ul = line.match(/^[-*]\s+(.*)$/);
        const ol = line.match(/^\d+\.\s+(.*)$/);
        const quote = line.match(/^>\s?(.*)$/);
        if (/^(-{3,}|\*{3,})$/.test(line)) {
          flushPara();
          flushList();
          html += "<hr>";
        } else if (heading) {
          flushPara();
          flushList();
          const level = Math.min(heading[1].length + 2, 6);
          html += `<h${level}>${renderSpan(heading[2])}</h${level}>`;
        } else if (ul) {
          flushPara();
          if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
          list.items.push(ul[1]);
        } else if (ol) {
          flushPara();
          if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
          list.items.push(ol[1]);
        } else if (quote) {
          flushPara();
          flushList();
          html += `<blockquote>${renderSpan(quote[1])}</blockquote>`;
        } else {
          flushList();
          para.push(line);
        }
      }
      flushPara();
      flushList();
      return html;
    }

    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);
    let html = "";
    for (let i = 0; i < parts.length; i += 3) {
      const textChunk = parts[i] || "";
      html += renderBlock(textChunk);
      const lang = parts[i + 1];
      const code = parts[i + 2];
      if (code !== undefined) {
        html += `<pre><code${lang ? ` class="lang-${lang}"` : ""}>${escape(code)}</code></pre>`;
      }
    }
    return html;
  }

  function renderMessages() {
    const chat = activeChat();
    messagesEl.innerHTML = "";
    if (!chat || chat.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-mark">${ICON_ASSISTANT}</div><h2>What can I help with?</h2><div class="suggestions"></div>`;
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
    chat.messages.forEach((msg, i) => {
      const isLast = i === chat.messages.length - 1;
      const bubble = appendBubble(msg.role, msg.content, { isLast, chat });
      if (msg.role === "assistant") enhanceCodeBlocks(bubble);
    });
    pinnedToBottom = true;
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    scrollBottomBtn?.classList.add("hidden");
  }

  messagesEl.addEventListener("scroll", () => {
    const distanceFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    pinnedToBottom = distanceFromBottom < 60;
    scrollBottomBtn?.classList.toggle("hidden", pinnedToBottom);
  });

  scrollBottomBtn?.addEventListener("click", () => {
    pinnedToBottom = true;
    scrollToBottom();
  });

  function appendBubble(role, content, opts = {}) {
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

    if (role === "assistant" && opts.isLast && opts.chat) {
      const regenBtn = document.createElement("button");
      regenBtn.type = "button";
      regenBtn.innerHTML = ICON_REDO + "<span>Regenerate</span>";
      regenBtn.addEventListener("click", () => regenerate(opts.chat));
      toolbar.appendChild(regenBtn);
    }

    bubbleCol.appendChild(bubble);
    bubbleCol.appendChild(toolbar);
    row.appendChild(avatar);
    row.appendChild(bubbleCol);
    messagesEl.appendChild(row);
    if (pinnedToBottom) scrollToBottom();
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

  function setStreamingUI(isStreaming) {
    streaming = isStreaming;
    sendIcon?.classList.toggle("hidden", isStreaming);
    stopIcon?.classList.toggle("hidden", !isStreaming);
    sendBtn.classList.toggle("stopping", isStreaming);
    sendBtn.setAttribute("aria-label", isStreaming ? "Stop generating" : "Send");
  }

  async function streamAssistantReply(chat) {
    const assistantBubble = appendBubble("assistant", "");
    assistantBubble.innerHTML = `<span class="typing-dot"></span>`;

    setStreamingUI(true);
    const controller = new AbortController();
    currentAbortController = controller;

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
        signal: controller.signal,
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
            if (pinnedToBottom) scrollToBottom();
          } else if (evt.type === "error") {
            throw new Error(evt.error?.message || "Stream error");
          }
        }
      }

      if (!assistantText) assistantText = "(empty response)";
      chat.messages.push({ role: "assistant", content: assistantText });
      saveChats();
      renderMessages();
    } catch (err) {
      if (err && err.name === "AbortError") {
        if (assistantText) {
          chat.messages.push({ role: "assistant", content: assistantText });
          saveChats();
        }
        renderMessages();
      } else {
        assistantBubble.innerHTML = `<span class="error-bubble">${(err && err.message) || "Something went wrong."}</span>`;
      }
    } finally {
      setStreamingUI(false);
      currentAbortController = null;
    }
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
    await streamAssistantReply(chat);
  }

  async function regenerate(chat) {
    if (streaming) return;
    const lastIdx = chat.messages.length - 1;
    if (lastIdx < 0 || chat.messages[lastIdx].role !== "assistant") return;
    chat.messages.pop();
    saveChats();
    renderMessages();
    await streamAssistantReply(chat);
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (streaming) {
      currentAbortController?.abort();
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    updateTokenEstimate();
    sendMessage(text);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) composer.requestSubmit();
    }
  });

  function updateTokenEstimate() {
    if (!tokenEstimateEl) return;
    const len = input.value.trim().length;
    tokenEstimateEl.textContent = len ? `~${Math.max(1, Math.ceil(len / 4))} tokens` : "";
  }

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
    updateTokenEstimate();
  });

  exportBtn?.addEventListener("click", () => {
    const chat = activeChat();
    if (!chat || !chat.messages.length) return;
    const lines = [`# ${chat.title || "Chat"}`, ""];
    for (const m of chat.messages) {
      lines.push(m.role === "user" ? "**You:**" : "**Asthik:**", "", m.content, "");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(chat.title || "chat").replace(/[^\w-]+/g, "_").slice(0, 50)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  newChatBtn.addEventListener("click", () => {
    newChat();
    closeSidebar();
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(CODE_KEY);
    showGate("");
  });

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      newChat();
      closeSidebar();
      input.focus();
    } else if (e.key === "Escape") {
      closeSidebar();
    }
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

  const gateSubmitBtn = document.getElementById("gate-submit");

  gateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = gateInput.value.trim();
    if (!code) return;

    gateError.textContent = "";
    gateSubmitBtn.disabled = true;
    const originalLabel = gateSubmitBtn.textContent;
    gateSubmitBtn.textContent = "Checking...";

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-code": code },
        body: JSON.stringify({}),
      });
      if (res.status === 401) {
        gateError.textContent = "Incorrect access code.";
        gateInput.value = "";
        gateInput.focus();
        return;
      }
      // Any non-401 response (including 400 for the deliberately empty body)
      // means the access code itself was accepted.
      localStorage.setItem(CODE_KEY, code);
      showApp();
    } catch {
      gateError.textContent = "Couldn't reach the server. Check your connection and try again.";
    } finally {
      gateSubmitBtn.disabled = false;
      gateSubmitBtn.textContent = originalLabel;
    }
  });

  // Initial boot: if we have a stored code, try the app straight away.
  // A bad code will surface as a 401 on the first message send.
  if (localStorage.getItem(CODE_KEY)) {
    showApp();
  } else {
    showGate("");
  }
})();
