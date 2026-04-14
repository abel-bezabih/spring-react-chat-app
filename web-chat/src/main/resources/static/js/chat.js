(function () {
  const STORAGE_KEY = "webchat_jwt";
  const USER_KEY = "webchat_user";
  const CHANNEL_KEY = "webchat_channel_id";
  const ONBOARDING_KEY = "aurora_onboarding_v1";
  const THEME_KEY = "aurora_theme";

  const el = {
    landing: document.getElementById("landing-wrap"),
    auth: document.getElementById("auth-panel"),
    chat: document.getElementById("chat-panel"),
    tabLogin: document.getElementById("tab-login"),
    tabRegister: document.getElementById("tab-register"),
    formLogin: document.getElementById("form-login"),
    formRegister: document.getElementById("form-register"),
    errAuth: document.getElementById("err-auth"),
    userLabel: document.getElementById("sidebar-user-name"),
    avatar: document.getElementById("sidebar-avatar"),
    status: document.getElementById("conn-status"),
    messages: document.getElementById("messages"),
    input: document.getElementById("msg-input"),
    typing: document.getElementById("typing-line"),
    btnSend: document.getElementById("btn-send"),
    btnLogout: document.getElementById("btn-logout"),
    btnTheme: document.getElementById("btn-theme"),
    toasts: document.getElementById("toasts"),
    dlgOnboarding: document.getElementById("dlg-onboarding"),
    dlgLogout: document.getElementById("dlg-logout"),
    dlgCreateChannel: document.getElementById("dlg-create-channel"),
    channelList: document.getElementById("channel-list"),
    channelTitleText: document.getElementById("channel-title-text"),
    channelTopic: document.getElementById("channel-topic"),
    msgInputLabel: document.getElementById("msg-input-label"),
    formCreateChannel: document.getElementById("form-create-channel"),
    newChannelName: document.getElementById("new-channel-name"),
    newChannelDesc: document.getElementById("new-channel-desc"),
    errCreateChannel: document.getElementById("err-create-channel"),
    btnAddChannel: document.getElementById("btn-add-channel"),
    channelFilter: document.getElementById("channel-filter"),
  };

  const btnLoginSubmit = document.getElementById("btn-login-submit");
  const btnRegisterSubmit = document.getElementById("btn-register-submit");
  const btnCreateChannelSubmit = document.getElementById("dlg-create-channel-submit");
  const btnCreateChannelCancel = document.getElementById("dlg-create-channel-cancel");
  const onbNext = document.getElementById("onb-next");
  const onbBack = document.getElementById("onb-back");
  const onbSkip = document.getElementById("onb-skip");
  const onbClose = document.getElementById("onb-close");
  const onbDots = document.querySelector(".onb-dots");
  const slides = function () {
    return Array.from(document.querySelectorAll(".onb-slide"));
  };

  let token = sessionStorage.getItem(STORAGE_KEY);
  let username = sessionStorage.getItem(USER_KEY) || "";
  let ws = null;
  let wsHadConnected = false;
  let closingWsOnPurpose = false;
  let typingTimer = null;
  const seenIds = new Set();
  let onbIndex = 0;

  let channels = [];
  let selectedChannelId = null;
  let channelFilterText = "";
  let pendingGotoKey = false;
  let pendingGotoTimer = null;

  let lastDayKey = null;
  let lastMsgSender = null;

  function api(path, opts) {
    const headers = { "Content-Type": "application/json", ...(opts && opts.headers ? opts.headers : {}) };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(path, Object.assign({}, opts || {}, { headers }));
  }

  async function apiOrSession(path, opts) {
    const res = await api(path, opts);
    if (res.status === 401 && token) {
      handleSessionExpired();
      return res;
    }
    return res;
  }

  function toast(message, type, duration) {
    type = type || "info";
    duration = duration === undefined ? 4200 : duration;
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.setAttribute("role", "status");
    t.textContent = message;
    el.toasts.appendChild(t);
    const remove = function () {
      t.style.opacity = "0";
      t.style.transition = "opacity 0.2s";
      setTimeout(function () {
        t.remove();
      }, 220);
    };
    const timer = setTimeout(remove, duration);
    t.addEventListener("click", function () {
      clearTimeout(timer);
      remove();
    });
  }

  function setStatus(state) {
    const live = state === "live";
    el.status.dataset.state = live ? "live" : "off";
    el.status.textContent = live ? "Connected" : "Offline";
  }

  var AUTH_COPY = {
    login: { title: "Welcome back", sub: "Sign in to continue to Aurora." },
    register: { title: "Create your account", sub: "Join your team in channels and real-time chat." },
  };

  function clearAuthFieldErrors() {
    ["err-login-user", "err-login-pass", "err-reg-user", "err-reg-pass", "err-reg-confirm"].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) p.textContent = "";
    });
  }

  function showAuthError(msg) {
    if (!el.errAuth) return;
    if (msg) clearAuthFieldErrors();
    el.errAuth.textContent = msg || "";
  }

  function setFieldError(fieldId, msg) {
    var p = document.getElementById(fieldId);
    if (p) p.textContent = msg || "";
    if (msg && el.errAuth) el.errAuth.textContent = "";
  }

  function setAuthHeading(mode) {
    var copy = AUTH_COPY[mode];
    if (!copy) return;
    var h = document.getElementById("auth-heading");
    var s = document.getElementById("auth-sublead");
    if (h) h.textContent = copy.title;
    if (s) s.textContent = copy.sub;
  }

  function updatePasswordStrength() {
    var input = document.getElementById("reg-pass");
    var wrap = document.getElementById("pw-strength");
    var label = document.getElementById("pw-strength-label");
    if (!input || !wrap || !label) return;
    var pw = input.value;
    if (!pw.length) {
      wrap.setAttribute("data-strength", "0");
      label.textContent = "";
      wrap.setAttribute("aria-hidden", "true");
      return;
    }
    wrap.setAttribute("aria-hidden", "false");
    var variety =
      (/[a-z]/.test(pw) ? 1 : 0) +
      (/[A-Z]/.test(pw) ? 1 : 0) +
      (/[0-9]/.test(pw) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
    var level = 1;
    var text = "";
    if (pw.length < 6) {
      level = 1;
      text = "Add " + (6 - pw.length) + " more character" + (6 - pw.length === 1 ? "" : "s");
    } else if (pw.length >= 10 && variety >= 3) {
      level = 3;
      text = "Strong password";
    } else if (pw.length >= 8 && variety >= 2) {
      level = 3;
      text = "Strong password";
    } else {
      level = 2;
      text = variety >= 2 ? "Good password" : "Good — mix letters, numbers, or symbols";
    }
    wrap.setAttribute("data-strength", String(level));
    label.textContent = text;
  }

  function activateAuthTab(which) {
    var isLogin = which === "login";
    el.tabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
    el.tabRegister.setAttribute("aria-selected", isLogin ? "false" : "true");
    el.tabLogin.tabIndex = isLogin ? 0 : -1;
    el.tabRegister.tabIndex = isLogin ? -1 : 0;
    el.formLogin.classList.toggle("hidden", !isLogin);
    el.formRegister.classList.toggle("hidden", isLogin);
    setAuthHeading(isLogin ? "login" : "register");
    clearAuthFieldErrors();
    if (el.errAuth) el.errAuth.textContent = "";
    if (isLogin) {
      requestAnimationFrame(function () {
        var u = document.getElementById("login-user");
        if (u) u.focus();
      });
    } else {
      requestAnimationFrame(function () {
        var r = document.getElementById("reg-user");
        if (r) r.focus();
        updatePasswordStrength();
      });
    }
  }

  function wireAuthFieldClear() {
    var pairs = [
      ["login-user", "err-login-user"],
      ["login-pass", "err-login-pass"],
      ["reg-user", "err-reg-user"],
      ["reg-pass", "err-reg-pass"],
      ["reg-pass-confirm", "err-reg-confirm"],
    ];
    pairs.forEach(function (pair) {
      var inp = document.getElementById(pair[0]);
      if (!inp) return;
      inp.addEventListener("input", function () {
        var err = document.getElementById(pair[1]);
        if (err) err.textContent = "";
        if (el.errAuth) el.errAuth.textContent = "";
      });
    });
  }

  function initAuthTabsKeyboard() {
    el.tabLogin.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        activateAuthTab("register");
        el.tabRegister.focus();
      }
    });
    el.tabRegister.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        activateAuthTab("login");
        el.tabLogin.focus();
      }
    });
  }

  function setFormLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle("is-loading", loading);
    btn.disabled = loading;
    btn.setAttribute("aria-busy", loading ? "true" : "false");
  }

  function updateThemeColorMeta() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var light = document.documentElement.getAttribute("data-theme") === "light";
    meta.setAttribute("content", light ? "#ffffff" : "#1a1d21");
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || "dark";
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
    updateThemeColorMeta();
    function toggleTheme() {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
      updateThemeColorMeta();
      toast(next === "light" ? "Light theme on" : "Dark theme on", "info", 2000);
    }
    if (el.btnTheme) el.btnTheme.addEventListener("click", toggleTheme);
    var landingTheme = document.getElementById("btn-theme-landing");
    if (landingTheme) landingTheme.addEventListener("click", toggleTheme);
  }

  function getChannelSlugFromUrl() {
    try {
      var q = new URLSearchParams(location.search).get("channel");
      if (!q) return null;
      q = q.trim().toLowerCase();
      return q || null;
    } catch (e) {
      return null;
    }
  }

  function stripChannelQueryFromUrl() {
    try {
      var url = new URL(location.href);
      if (!url.searchParams.has("channel")) return;
      url.searchParams.delete("channel");
      var qs = url.searchParams.toString();
      history.replaceState(null, "", url.pathname + (qs ? "?" + qs : "") + url.hash);
    } catch (e) {}
  }

  function syncChannelSlugToUrl(ch) {
    if (!ch || !ch.slug) return;
    try {
      var url = new URL(location.href);
      if (url.searchParams.get("channel") === ch.slug) return;
      url.searchParams.set("channel", ch.slug);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  function isAnyModalOpen() {
    return (
      (el.dlgOnboarding && el.dlgOnboarding.open) ||
      (el.dlgLogout && el.dlgLogout.open) ||
      (el.dlgCreateChannel && el.dlgCreateChannel.open)
    );
  }

  async function copyCurrentChannelLink() {
    var ch = null;
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id === selectedChannelId) {
        ch = channels[i];
        break;
      }
    }
    if (!ch || !ch.slug) {
      toast("Pick a channel first.", "warning", 2500);
      return;
    }
    try {
      var url = new URL(location.origin + location.pathname);
      url.searchParams.set("channel", ch.slug);
      await navigator.clipboard.writeText(url.toString());
      toast("Link to #" + ch.name + " copied.", "success", 2500);
    } catch (e) {
      toast("Could not copy automatically. Copy the URL from the address bar.", "warning", 4500);
    }
  }

  function initWorkspaceShortcuts() {
    var copyBtn = document.getElementById("btn-copy-channel-link");
    if (copyBtn) copyBtn.addEventListener("click", copyCurrentChannelLink);

    document.addEventListener("keydown", function (e) {
      if (!el.chat || el.chat.classList.contains("hidden") || isAnyModalOpen()) return;
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      var inField = tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable);
      if (!inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var key = (e.key || "").toLowerCase();
        if (pendingGotoKey && key === "c") {
          e.preventDefault();
          pendingGotoKey = false;
          clearTimeout(pendingGotoTimer);
          if (el.channelFilter) el.channelFilter.focus();
          return;
        }
        if (key === "g") {
          pendingGotoKey = true;
          clearTimeout(pendingGotoTimer);
          pendingGotoTimer = setTimeout(function () {
            pendingGotoKey = false;
          }, 900);
          return;
        }
      }
      if (e.key === "/" && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        el.input.focus();
        return;
      }
      if (e.key === "Escape" && e.target === el.input) {
        el.input.blur();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!el.chat || el.chat.classList.contains("hidden") || isAnyModalOpen()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        el.input.focus();
      }
    });

    if (el.channelFilter) {
      el.channelFilter.addEventListener("input", function () {
        channelFilterText = (el.channelFilter.value || "").trim().toLowerCase();
        renderChannelList();
      });
    }

    window.addEventListener("popstate", function () {
      handlePopStateChannel();
    });
  }

  function initPasswordToggles() {
    document.querySelectorAll(".toggle-pass").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-target");
        var input = document.getElementById(id);
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  function initials(name) {
    if (!name || !name.trim()) return "?";
    var p = name.trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase().slice(0, 2);
    return name.slice(0, 2).toUpperCase();
  }

  function updateSidebarUser() {
    if (el.userLabel) el.userLabel.textContent = username || "—";
    if (el.avatar) el.avatar.textContent = initials(username);
  }

  function parseMessageDate(ts) {
    if (!ts) return null;
    try {
      if (typeof ts === "string") return new Date(ts);
      if (Array.isArray(ts)) {
        return new Date(ts[0], (ts[1] || 1) - 1, ts[2] || 1, ts[3] || 0, ts[4] || 0, ts[5] || 0, ts[6] || 0);
      }
      return new Date(ts);
    } catch (e) {
      return null;
    }
  }

  function dayKey(d) {
    if (!d || isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function labelForDay(d) {
    if (!d || isNaN(d.getTime())) return "";
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    var diff = (today - cmp) / 86400000;
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7 && diff > 0) {
      return d.toLocaleDateString(undefined, { weekday: "long" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
  }

  function appendDateSeparator(d) {
    var sep = document.createElement("div");
    sep.className = "msg-date-sep";
    sep.setAttribute("role", "separator");
    sep.textContent = labelForDay(d);
    el.messages.appendChild(sep);
  }

  function resetThreadState() {
    lastDayKey = null;
    lastMsgSender = null;
  }

  function appendMessageRow(from, content, isMe, ts) {
    var empty = el.messages.querySelector(".empty-hint");
    if (empty) empty.remove();

    var d = parseMessageDate(ts);
    var dk = d && !isNaN(d.getTime()) ? dayKey(d) : "";
    if (d && dk && dk !== lastDayKey) {
      appendDateSeparator(d);
      lastDayKey = dk;
      lastMsgSender = null;
    }
    var compact = from === lastMsgSender && dk !== "" && dk === lastDayKey;

    var row = document.createElement("article");
    row.className = "msg-row" + (compact ? " msg-row--compact" : "") + (isMe ? " msg-row--me" : "");
    row.setAttribute("data-sender", from || "");

    var av = document.createElement("div");
    av.className = "msg-avatar";
    av.textContent = initials(from);

    var body = document.createElement("div");
    if (!compact) {
      var head = document.createElement("header");
      head.className = "msg-head";
      var author = document.createElement("span");
      author.className = "msg-author";
      author.textContent = from || "?";
      var time = document.createElement("time");
      time.className = "msg-time";
      time.dateTime = d && !isNaN(d.getTime()) ? d.toISOString() : "";
      time.textContent = formatTime(ts);
      if (d && !isNaN(d.getTime())) {
        time.title = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      }
      head.appendChild(author);
      head.appendChild(time);
      body.appendChild(head);
    }
    var text = document.createElement("div");
    text.className = "msg-text";
    text.textContent = content || "";
    body.appendChild(text);

    row.appendChild(av);
    row.appendChild(body);
    el.messages.appendChild(row);
    lastMsgSender = from;
    scrollBottom();
  }

  function scrollBottom() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function formatTime(iso) {
    var d = parseMessageDate(iso);
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function applyChannelHeader() {
    var ch = null;
    for (var i = 0; i < channels.length; i++) {
      if (channels[i].id === selectedChannelId) {
        ch = channels[i];
        break;
      }
    }
    if (!ch || !el.channelTitleText || !el.channelTopic) return;
    el.channelTitleText.textContent = ch.name;
    var desc = ch.description && String(ch.description).trim();
    el.channelTopic.textContent = desc ? desc : "Channel messages";
    document.title = "#" + ch.name + " — Aurora";
    var label = "Message #" + ch.name;
    if (el.msgInputLabel) el.msgInputLabel.textContent = label;
    el.input.placeholder = label;
    syncChannelSlugToUrl(ch);
  }

  function renderChannelList() {
    if (!el.channelList) return;
    el.channelList.innerHTML = "";
    var shown = 0;
    for (var i = 0; i < channels.length; i++) {
      var ch = channels[i];
      if (channelFilterText) {
        var hay = (ch.name + " " + (ch.slug || "")).toLowerCase();
        if (hay.indexOf(channelFilterText) === -1) continue;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "channel-pill" + (ch.id === selectedChannelId ? " is-active" : "");
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-current", ch.id === selectedChannelId ? "true" : "false");
      btn.dataset.channelId = String(ch.id);
      var hash = document.createElement("span");
      hash.className = "hash";
      hash.setAttribute("aria-hidden", "true");
      hash.textContent = "#";
      var span = document.createElement("span");
      var rawName = ch.name || "";
      if (!channelFilterText) {
        span.textContent = rawName;
      } else {
        var lowerName = rawName.toLowerCase();
        var idx = lowerName.indexOf(channelFilterText);
        if (idx === -1) {
          span.textContent = rawName;
        } else {
          var before = escapeHtml(rawName.slice(0, idx));
          var mid = escapeHtml(rawName.slice(idx, idx + channelFilterText.length));
          var after = escapeHtml(rawName.slice(idx + channelFilterText.length));
          span.innerHTML = before + '<mark class="channel-match">' + mid + "</mark>" + after;
        }
      }
      btn.appendChild(hash);
      btn.appendChild(span);
      (function (cid) {
        btn.addEventListener("click", function () {
          switchChannel(cid);
        });
      })(ch.id);
      el.channelList.appendChild(btn);
      shown++;
    }
    if (shown === 0) {
      el.channelList.innerHTML = '<p class="empty-hint">No channels match your filter.</p>';
    }
  }

  function handlePopStateChannel() {
    if (!channels.length) return;
    var slug = getChannelSlugFromUrl();
    if (!slug) return;
    for (var i = 0; i < channels.length; i++) {
      if ((channels[i].slug || "").toLowerCase() === slug) {
        if (channels[i].id !== selectedChannelId) {
          switchChannel(channels[i].id);
        }
        return;
      }
    }
  }

  async function switchChannel(id) {
    if (id === selectedChannelId) return;
    selectedChannelId = id;
    sessionStorage.setItem(CHANNEL_KEY, String(selectedChannelId));
    el.typing.textContent = "";
    seenIds.clear();
    resetThreadState();
    renderChannelList();
    applyChannelHeader();
    await loadHistory();
    connectWs();
  }

  async function loadChannelContext() {
    var res = await apiOrSession("/api/channels");
    if (!res.ok) return false;
    try {
      channels = await res.json();
    } catch (e) {
      return false;
    }
    if (!channels.length) {
      toast("No channels available.", "error");
      return false;
    }
    var qp = getChannelSlugFromUrl();
    var pick = null;
    if (qp) {
      for (var a = 0; a < channels.length; a++) {
        if ((channels[a].slug || "").toLowerCase() === qp) {
          pick = channels[a].id;
          break;
        }
      }
    }
    var saved = sessionStorage.getItem(CHANNEL_KEY);
    if (pick == null && saved) {
      var sid = parseInt(saved, 10);
      for (var i = 0; i < channels.length; i++) {
        if (channels[i].id === sid) {
          pick = sid;
          break;
        }
      }
    }
    if (pick == null) {
      for (var j = 0; j < channels.length; j++) {
        if (channels[j].slug === "general") {
          pick = channels[j].id;
          break;
        }
      }
    }
    if (pick == null) pick = channels[0].id;
    selectedChannelId = pick;
    sessionStorage.setItem(CHANNEL_KEY, String(selectedChannelId));
    renderChannelList();
    applyChannelHeader();
    return true;
  }

  function renderSkeleton() {
    el.messages.innerHTML =
      '<div class="skeleton-stack" aria-hidden="true">' +
      '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>' +
      "</div>";
    el.messages.setAttribute("aria-busy", "true");
  }

  function handleIncoming(raw) {
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (data.type === "TYPING") {
      if (data.username && data.username !== username) {
        if (data.typing) {
          el.typing.innerHTML =
            '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span> ' +
            escapeHtml(data.username) +
            " is typing";
        } else {
          el.typing.textContent = "";
        }
      }
      return;
    }
    if (data.type === "MESSAGE") {
      if (data.channelId != null && selectedChannelId != null && Number(data.channelId) !== Number(selectedChannelId)) {
        return;
      }
      var id = data.id;
      if (id != null && seenIds.has(id)) return;
      if (id != null) seenIds.add(id);
      var sender = data.sender || "?";
      var isMe = sender === username;
      appendMessageRow(sender, data.content || "", isMe, data.timestamp);
    }
  }

  async function loadHistory() {
    if (selectedChannelId == null) return;
    renderSkeleton();
    var res;
    try {
      res = await apiOrSession(
        "/api/messages?channelId=" + encodeURIComponent(String(selectedChannelId)) + "&limit=80"
      );
    } catch (e) {
      el.messages.setAttribute("aria-busy", "false");
      el.messages.innerHTML =
        '<p class="empty-hint">Could not load history. Check your connection and try refreshing.</p>';
      toast("Failed to load messages.", "error");
      return;
    }
    el.messages.setAttribute("aria-busy", "false");
    if (!res.ok) {
      if (res.status === 401) return;
      el.messages.innerHTML = '<p class="empty-hint">Unable to load history.</p>';
      toast("Could not load history.", "warning");
      return;
    }
    var list = await res.json();
    el.messages.innerHTML = "";
    seenIds.clear();
    resetThreadState();

    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.id != null) seenIds.add(m.id);
      var sender = m.sender || "?";
      var isMe = sender === username;
      appendMessageRow(sender, m.content, isMe, m.timestamp);
    }
    if (list.length === 0) {
      var chName = "this channel";
      for (var k = 0; k < channels.length; k++) {
        if (channels[k].id === selectedChannelId) {
          chName = channels[k].name;
          break;
        }
      }
      el.messages.innerHTML =
        '<p class="empty-hint"><strong>This is the start of #' +
        escapeHtml(chName) +
        ".</strong><br />Say hello — messages appear instantly for everyone in this channel.</p>";
    }
  }

  function connectWs() {
    if (ws) {
      closingWsOnPurpose = true;
      try {
        ws.close();
      } catch (e) {}
      closingWsOnPurpose = false;
    }
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    var url =
      proto +
      "//" +
      location.host +
      "/chat?token=" +
      encodeURIComponent(token) +
      "&channelId=" +
      encodeURIComponent(String(selectedChannelId));
    ws = new WebSocket(url);
    setStatus("off");
    wsHadConnected = false;

    ws.onopen = function () {
      wsHadConnected = true;
      setStatus("live");
    };
    ws.onclose = function () {
      setStatus("off");
      if (wsHadConnected && !closingWsOnPurpose && !el.chat.classList.contains("hidden")) {
        toast("Real-time connection lost. Refresh the page if messages stop updating.", "warning", 6500);
      }
    };
    ws.onerror = function () {
      setStatus("off");
    };
    ws.onmessage = function (ev) {
      if (typeof ev.data === "string") handleIncoming(ev.data);
    };
  }

  function sendChat() {
    var text = (el.input.value || "").trim();
    if (!text) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast("Not connected yet. Wait until status shows Connected.", "warning");
      return;
    }
    ws.send(
      JSON.stringify({
        type: "MESSAGE",
        content: text,
        clientMessageId: crypto.randomUUID(),
      })
    );
    el.input.value = "";
    autoResizeComposer();
    sendTyping(false);
  }

  function sendTyping(active) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "TYPING", typing: !!active }));
  }

  function autoResizeComposer() {
    var ta = el.input;
    if (!ta || ta.tagName !== "TEXTAREA") return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  function clearTokenStorage() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(CHANNEL_KEY);
  }

  function handleSessionExpired() {
    toast("Session expired — sign in again.", "warning", 7000);
    token = null;
    username = "";
    clearTokenStorage();
    stripChannelQueryFromUrl();
    document.title = "Aurora";
    if (ws) {
      closingWsOnPurpose = true;
      try {
        ws.close();
      } catch (e) {}
      closingWsOnPurpose = false;
    }
    ws = null;
    el.chat.classList.add("hidden");
    el.landing.classList.remove("hidden");
    updateSidebarUser();
    setStatus("off");
    showAuthError("");
  }

  function performLogout() {
    token = null;
    username = "";
    clearTokenStorage();
    stripChannelQueryFromUrl();
    document.title = "Aurora";
    if (ws) {
      closingWsOnPurpose = true;
      try {
        ws.close();
      } catch (e) {}
      closingWsOnPurpose = false;
    }
    ws = null;
    el.chat.classList.add("hidden");
    el.landing.classList.remove("hidden");
    updateSidebarUser();
    setStatus("off");
    showAuthError("");
    toast("Signed out.", "info");
  }

  function initLogoutDialog() {
    var cancel = document.getElementById("dlg-logout-cancel");
    var confirm = document.getElementById("dlg-logout-confirm");
    el.btnLogout.addEventListener("click", function () {
      el.dlgLogout.showModal();
    });
    cancel.addEventListener("click", function () {
      el.dlgLogout.close();
    });
    confirm.addEventListener("click", function () {
      el.dlgLogout.close();
      performLogout();
    });
  }

  function onboardingDone() {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  }

  function finishOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    el.dlgOnboarding.close();
    if (!el.chat.classList.contains("hidden")) {
      toast("Tour complete.", "info", 2500);
      return;
    }
    toast("You’re set — sign in to open your workspace.", "success", 4500);
    var u = document.getElementById("login-user");
    if (u) u.focus();
  }

  function skipOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    el.dlgOnboarding.close();
    if (!el.chat.classList.contains("hidden")) {
      toast("Tour dismissed.", "info", 2000);
      return;
    }
    toast("Skipped. Replay anytime from the landing page or sidebar.", "info");
    var u = document.getElementById("login-user");
    if (u) u.focus();
  }

  function renderOnboardingStep() {
    var s = slides();
    for (var i = 0; i < s.length; i++) {
      s[i].classList.toggle("hidden", i !== onbIndex);
    }
    var dots = onbDots.querySelectorAll(".onb-dot");
    for (var j = 0; j < dots.length; j++) {
      dots[j].setAttribute("aria-current", j === onbIndex ? "true" : "false");
    }
    onbBack.hidden = onbIndex === 0;
    onbNext.textContent = onbIndex >= s.length - 1 ? "Get started" : "Next";
  }

  function openOnboarding() {
    onbIndex = 0;
    renderOnboardingStep();
    el.dlgOnboarding.showModal();
  }

  function bindReplay(btn) {
    if (!btn) return;
    btn.addEventListener("click", function () {
      onbIndex = 0;
      renderOnboardingStep();
      el.dlgOnboarding.showModal();
    });
  }

  function initOnboarding() {
    var n = slides().length;
    onbDots.innerHTML = "";
    for (var i = 0; i < n; i++) {
      (function (idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "onb-dot";
        b.setAttribute("aria-label", "Step " + (idx + 1));
        b.addEventListener("click", function () {
          onbIndex = idx;
          renderOnboardingStep();
        });
        onbDots.appendChild(b);
      })(i);
    }

    onbNext.addEventListener("click", function () {
      if (onbIndex >= slides().length - 1) {
        finishOnboarding();
        return;
      }
      onbIndex++;
      renderOnboardingStep();
    });

    onbBack.addEventListener("click", function () {
      if (onbIndex > 0) {
        onbIndex--;
        renderOnboardingStep();
      }
    });

    onbSkip.addEventListener("click", skipOnboarding);
    onbClose.addEventListener("click", skipOnboarding);

    el.dlgOnboarding.addEventListener("cancel", function (e) {
      e.preventDefault();
      skipOnboarding();
    });

    bindReplay(document.getElementById("btn-replay-tour"));
    bindReplay(document.getElementById("btn-replay-tour-sidebar"));

    document.addEventListener("keydown", function (e) {
      if (!el.dlgOnboarding.open) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onbNext.click();
      }
      if (e.key === "ArrowLeft" && onbIndex > 0) {
        e.preventDefault();
        onbBack.click();
      }
    });

  }

  function maybeOpenOnboarding() {
    if (onboardingDone()) return;
    requestAnimationFrame(openOnboarding);
  }

  el.tabLogin.addEventListener("click", function () {
    activateAuthTab("login");
  });

  el.tabRegister.addEventListener("click", function () {
    activateAuthTab("register");
  });

  initAuthTabsKeyboard();

  el.formLogin.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAuthFieldErrors();
    if (el.errAuth) el.errAuth.textContent = "";
    var lu = document.getElementById("login-user");
    var lp = document.getElementById("login-pass");
    var u = lu.value.trim();
    var p = lp.value;
    var ok = true;
    if (!u) {
      setFieldError("err-login-user", "Enter your username.");
      ok = false;
    } else if (u.length < 2) {
      setFieldError("err-login-user", "Username must be at least 2 characters.");
      ok = false;
    }
    if (!p) {
      setFieldError("err-login-pass", "Enter your password.");
      ok = false;
    }
    if (!ok) {
      if (!u || u.length < 2) lu.focus();
      else lp.focus();
      return;
    }
    setFormLoading(btnLoginSubmit, true);
    var res;
    try {
      res = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: u, password: p }),
      });
    } catch (err) {
      setFormLoading(btnLoginSubmit, false);
      toast("Network error. Try again.", "error");
      return;
    }
    setFormLoading(btnLoginSubmit, false);
    if (!res.ok) {
      showAuthError("That username or password does not match our records. Try again.");
      toast("Sign-in failed.", "error");
      lp.focus();
      return;
    }
    var body = await res.json();
    token = body.token;
    username = u;
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(USER_KEY, username);
    toast("Welcome back.", "success", 2800);
    await enterChat(true);
  });

  el.formRegister.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearAuthFieldErrors();
    if (el.errAuth) el.errAuth.textContent = "";
    var ru = document.getElementById("reg-user");
    var rp = document.getElementById("reg-pass");
    var rc = document.getElementById("reg-pass-confirm");
    var u = ru.value.trim();
    var p = rp.value;
    var p2 = rc.value;
    var ok = true;
    if (!u) {
      setFieldError("err-reg-user", "Choose a username.");
      ok = false;
    } else if (u.length < 2) {
      setFieldError("err-reg-user", "Username must be at least 2 characters.");
      ok = false;
    }
    if (!p) {
      setFieldError("err-reg-pass", "Enter a password.");
      ok = false;
    } else if (p.length < 6) {
      setFieldError("err-reg-pass", "Use at least 6 characters.");
      ok = false;
    }
    if (!p2) {
      setFieldError("err-reg-confirm", "Confirm your password.");
      ok = false;
    } else if (p !== p2) {
      setFieldError("err-reg-confirm", "Passwords do not match.");
      ok = false;
    }
    if (!ok) {
      if (!u || u.length < 2) ru.focus();
      else if (!p || p.length < 6) rp.focus();
      else rc.focus();
      return;
    }
    setFormLoading(btnRegisterSubmit, true);
    var res;
    try {
      res = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ username: u, password: p }),
      });
    } catch (err) {
      setFormLoading(btnRegisterSubmit, false);
      toast("Network error.", "error");
      return;
    }
    setFormLoading(btnRegisterSubmit, false);
    if (res.status === 409) {
      showAuthError("That username is already taken. Pick another.");
      toast("Username taken.", "warning");
      ru.focus();
      return;
    }
    if (!res.ok) {
      showAuthError("We could not create your account. Check your password and try again.");
      toast("Registration failed.", "error");
      return;
    }
    var body = await res.json();
    token = body.token;
    username = u;
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(USER_KEY, username);
    toast("You’re in — pick a channel and say hello.", "success", 4000);
    await enterChat(true);
  });

  el.btnSend.addEventListener("click", sendChat);
  el.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  el.input.addEventListener("input", function () {
    autoResizeComposer();
    sendTyping(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      sendTyping(false);
    }, 1200);
  });

  var btnEmoji = document.getElementById("btn-emoji");
  if (btnEmoji) {
    btnEmoji.addEventListener("click", function () {
      el.input.value = (el.input.value || "") + "👋 ";
      el.input.focus();
      autoResizeComposer();
    });
  }

  async function enterChat(fromAuth) {
    el.landing.classList.add("hidden");
    el.chat.classList.remove("hidden");
    updateSidebarUser();
    var ok = await loadChannelContext();
    if (!ok) {
      toast("Could not load channels.", "error");
      return;
    }
    await loadHistory();
    connectWs();
    if (fromAuth) {
      el.input.focus();
    }
  }

  function initCreateChannelDialog() {
    if (!el.btnAddChannel || !el.dlgCreateChannel || !el.formCreateChannel) return;
    el.btnAddChannel.addEventListener("click", function () {
      if (el.errCreateChannel) el.errCreateChannel.textContent = "";
      if (el.newChannelName) el.newChannelName.value = "";
      if (el.newChannelDesc) el.newChannelDesc.value = "";
      el.dlgCreateChannel.showModal();
    });
    if (btnCreateChannelCancel) {
      btnCreateChannelCancel.addEventListener("click", function () {
        el.dlgCreateChannel.close();
      });
    }
    el.formCreateChannel.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (el.errCreateChannel) el.errCreateChannel.textContent = "";
      var name = el.newChannelName ? el.newChannelName.value.trim() : "";
      var desc = el.newChannelDesc ? el.newChannelDesc.value.trim() : "";
      if (!name) return;
      setFormLoading(btnCreateChannelSubmit, true);
      var res;
      try {
        res = await apiOrSession("/api/channels", {
          method: "POST",
          body: JSON.stringify({ name: name, description: desc || null }),
        });
      } catch (err) {
        setFormLoading(btnCreateChannelSubmit, false);
        toast("Network error.", "error");
        return;
      }
      setFormLoading(btnCreateChannelSubmit, false);
      if (res.status === 401) return;
      if (!res.ok) {
        if (el.errCreateChannel) {
          el.errCreateChannel.textContent = "Could not create channel. Try a different name.";
        }
        toast("Channel creation failed.", "error");
        return;
      }
      var created;
      try {
        created = await res.json();
      } catch (err2) {
        toast("Invalid response from server.", "error");
        return;
      }
      el.dlgCreateChannel.close();
      if (el.newChannelName) el.newChannelName.value = "";
      if (el.newChannelDesc) el.newChannelDesc.value = "";
      var listRes = await apiOrSession("/api/channels");
      if (listRes.ok) {
        try {
          channels = await listRes.json();
        } catch (e3) {}
      }
      toast("Created #" + created.name, "success", 3500);
      await switchChannel(created.id);
    });
  }

  (async function init() {
    initTheme();
    initPasswordToggles();
    wireAuthFieldClear();
    var regPassEl = document.getElementById("reg-pass");
    if (regPassEl) regPassEl.addEventListener("input", updatePasswordStrength);
    setAuthHeading("login");
    el.chat.classList.add("hidden");
    initOnboarding();
    initLogoutDialog();
    initCreateChannelDialog();
    initWorkspaceShortcuts();

    if (token && username) {
      updateSidebarUser();
      var check = await apiOrSession("/api/channels");
      if (check.status === 401) {
        handleSessionExpired();
        return;
      }
      if (check.ok) {
        await enterChat(false);
        toast("Welcome back, " + username + ".", "info", 3200);
        return;
      }
      clearTokenStorage();
      token = null;
      username = "";
    }
    el.landing.classList.remove("hidden");
    maybeOpenOnboarding();
  })();
})();
