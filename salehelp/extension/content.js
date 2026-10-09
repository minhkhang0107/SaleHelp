// ==============================================================================
// SALEHELP ZALO AI COPILOT (V10 ZERO-HALLUCINATION & STRICT KNOWLEDGE GROUNDING)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v10 (Strict Grounding & Live Persona Sync) Loaded!');

  const P = window.SaleHelpProfilePrompt;

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 1.5,
    lastRepliedMap: {}, // { [contactName]: { lastText: '', timestamp: 0 } }
  };

  // Active Profile loaded from localhost:8080/api/profiles/active
  let activeProfile = null;

  // Live Dynamic Tours Knowledge Base loaded from localhost:8080/api/tours
  let liveToursState = [];

  // Multi-user Isolated Conversation Memory Store
  let contactMemoryStore = {};

  // Sequential Multi-User Queue
  let processingQueue = [];
  let isQueueBusy = false;
  let activeJobs = 0; // replies being generated / waiting to be sent
  const MAX_QUEUE_WAIT_MS = 20000; // after this, a waiting customer preempts the active chat's next auto-reply
  let currentActiveContact = '';
  let lastGeneratedAnswer = '';

  // Load saved configuration from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config', 'salehelp_memory', 'salehelp_active_profile', 'salehelp_tours'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateToggleState();
      }
      if (res.salehelp_memory) {
        // v1 stored a bare array per contact; v2 stores { messages, updatedAt }
        Object.entries(res.salehelp_memory).forEach(([name, v]) => {
          const messages = Array.isArray(v) ? v : (v && v.messages) || [];
          contactMemoryStore[name] = { messages, summary: (v && v.summary) || '', updatedAt: (v && v.updatedAt) || 0 };
        });
      }
      if (res.salehelp_active_profile && res.salehelp_active_profile.id) {
        activeProfile = res.salehelp_active_profile;
        updateSkillUI();
      }
      if (res.salehelp_tours && Array.isArray(res.salehelp_tours)) {
        liveToursState = res.salehelp_tours;
      }
    });
  }

  const MEMORY_MAX_MESSAGES = 100;  // hard cap per customer (only reached if summarizing keeps failing)
  const SUMMARIZE_THRESHOLD = 40;   // above this many stored messages, fold the oldest into the summary
  const SUMMARIZE_KEEP_RECENT = 16; // always keep this many latest messages verbatim
  const MEMORY_MAX_CONTACTS = 200;  // oldest-touched customers are evicted first

  const sameMsg = (a, b) =>
    a.role === b.role && a.text.replace(/\s+/g, '') === b.text.replace(/\s+/g, '');

  // Merge what Zalo currently shows (a window of the chat) into the stored per-customer transcript.
  // Align on the overlap instead of overwriting, so older messages that scrolled out of the DOM survive.
  function mergeHistory(stored, dom) {
    if (!stored.length) return dom.slice();
    if (!dom.length) return stored.slice();

    for (let i = stored.length - 1; i >= 0; i--) {
      const m = Math.min(stored.length - i, dom.length);
      let ok = true;
      for (let k = 0; k < m; k++) {
        if (!sameMsg(stored[i + k], dom[k])) { ok = false; break; }
      }
      // require 2+ matching messages (or the whole DOM window) so a lone "Dạ" can't misalign
      if (ok && (m >= 2 || dom.length === 1)) {
        return stored.slice(0, i).concat(dom);
      }
    }
    // DOM may start earlier than what we kept (older messages already folded into the summary):
    // align the stored head inside the DOM and only take what comes after it
    for (let j = 1; j < dom.length; j++) {
      const m = Math.min(dom.length - j, stored.length);
      let ok = m >= 2;
      for (let k = 0; ok && k < m; k++) {
        if (!sameMsg(dom[j + k], stored[k])) ok = false;
      }
      if (ok) return stored.concat(dom.slice(j + m));
    }
    return stored.concat(dom);
  }

  function updateContactMemory(contactName, domHistory) {
    const entry = contactMemoryStore[contactName] || { messages: [], summary: '', updatedAt: 0 };
    entry.messages = mergeHistory(entry.messages, domHistory).slice(-MEMORY_MAX_MESSAGES);
    entry.updatedAt = Date.now();
    contactMemoryStore[contactName] = entry;

    const names = Object.keys(contactMemoryStore);
    if (names.length > MEMORY_MAX_CONTACTS) {
      names.sort((a, b) => contactMemoryStore[a].updatedAt - contactMemoryStore[b].updatedAt)
        .slice(0, names.length - MEMORY_MAX_CONTACTS)
        .forEach(n => delete contactMemoryStore[n]);
    }
    saveMemoryToStorage();
    return entry.messages;
  }

  // Fold the oldest messages into entry.summary, keep the recent ones verbatim. On failure nothing is dropped.
  async function compactContactMemory(contactName) {
    const entry = contactMemoryStore[contactName];
    if (!entry || entry.compacting || entry.messages.length <= SUMMARIZE_THRESHOLD) return;

    const older = entry.messages.slice(0, entry.messages.length - SUMMARIZE_KEEP_RECENT);
    const transcript = older
      .map(m => `${m.role === 'user' ? 'Khách' : 'Tư vấn'}: ${m.text.substring(0, 500)}`)
      .join('\n');

    entry.compacting = true;
    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = `🧠 Đang tóm tắt hội thoại cũ của [${contactName}]...`;
    }

    try {
      const data = await safeApiFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `TÓM TẮT CŨ:\n${entry.summary || '(chưa có)'}\n\nHỘI THOẠI MỚI CẦN GỘP VÀO TÓM TẮT:\n${transcript}`,
          systemInstruction: P.getSummaryPrompt(activeProfile),
          model: 'gemini-3.6-flash',
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
        })
      });
      const text = data && data.candidates && data.candidates[0]?.content?.parts[0]?.text;
      if (text && text.trim()) {
        entry.summary = text.trim().substring(0, 1500);
        entry.messages = entry.messages.slice(older.length); // drop exactly what was summarized
        saveMemoryToStorage();
        console.log(`[SaleHelp] 🧠 Đã tóm tắt ${older.length} tin cũ của [${contactName}].`);
      }
    } catch (e) {
      console.warn(`[SaleHelp] Chưa tóm tắt được [${contactName}], giữ nguyên tin nhắn:`, e.message);
    } finally {
      entry.compacting = false;
    }
  }

  function saveMemoryToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const toSave = {};
      Object.entries(contactMemoryStore).forEach(([n, e]) => {
        toSave[n] = { messages: e.messages, summary: e.summary || '', updatedAt: e.updatedAt };
      });
      chrome.storage.local.set({ salehelp_memory: toSave });
    }
  }

  function updateToggleState() {
    const t = document.getElementById('salehelp-autoreply-toggle');
    if (t) t.checked = config.autoReply;
  }

  function updateSkillUI() {
    const skillEl = document.getElementById('salehelp-active-skill-label');
    if (!skillEl) return;
    if (!activeProfile) {
      skillEl.innerText = '🎯 Chốt Đơn Tour';
      return;
    }
    const skill = P.getActiveSkill(activeProfile);
    if (skill && skill.name) {
      skillEl.innerText = `${activeProfile.name} · ${skill.name}`;
    } else {
      skillEl.innerText = activeProfile.name || '🎯 Chốt Đơn Tour';
    }
  }

  // Check if Chrome extension context is still valid (not invalidated after extension reload)
  function isExtensionContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Universal Safe API Fetcher (Uses Background Worker when valid, smoothly falls back to Direct Fetch)
  async function safeApiFetch(endpoint, options = {}) {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${config.serverUrl}${endpoint}`;

    // 1. Try Extension Background Service Worker if extension context is valid
    if (isExtensionContextValid() && typeof chrome.runtime.sendMessage === 'function') {
      try {
        const res = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'api_request',
            url: fullUrl,
            options: options
          }, response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        if (res && res.ok) {
          return res.data;
        } else if (res && res.error) {
          console.warn('[SaleHelp] Background worker response error:', res.error);
        }
      } catch (err) {
        // If context invalidated or messaging failed, smoothly continue to direct fetch
        if (!err.message.includes('context invalidated')) {
          console.warn('[SaleHelp] Background worker fetch fallback to direct:', err.message);
        }
      }
    }

    // 2. Direct Fetch fallback (always available)
    try {
      const directRes = await fetch(fullUrl, options);
      if (!directRes.ok) {
        throw new Error(`HTTP ${directRes.status}`);
      }
      const contentType = directRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await directRes.json();
      }
      return await directRes.text();
    } catch (err) {
      throw err;
    }
  }

  // 1. FETCH LIVE ACTIVE PROFILE FROM LOCAL SERVER (:8080/api/profiles/active)
  async function fetchLiveActiveProfile() {
    try {
      const data = await safeApiFetch('/api/profiles/active');
      if (data && data.id) {
        activeProfile = data;
        updateSkillUI();
        if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_active_profile: data });
        }
      }
    } catch (e) {
      if (!e.message.includes('context invalidated')) {
        console.warn('[SaleHelp] Chưa lấy được profile từ server:', e.message);
      }
    }
  }

  // 2. FETCH LIVE TOURS KNOWLEDGE BASE FROM LOCAL SERVER (:8080/api/tours)
  async function fetchLiveToursKnowledge() {
    try {
      const data = await safeApiFetch('/api/tours');
      if (Array.isArray(data) && data.length > 0) {
        liveToursState = data;
        if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_tours: data });
        }
      }
    } catch (e) {
      if (!e.message.includes('context invalidated')) {
        console.warn('[SaleHelp] Chưa lấy được tour knowledge từ server:', e.message);
      }
    }
  }

  // 4. INJECT FLOATING WIDGET (DRAGGABLE & COLLAPSIBLE)
  function injectFloatingWidget() {
    if (document.getElementById('salehelp-ai-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'salehelp-ai-widget';
    widget.innerHTML = `
      <div class="minimized-icon" id="salehelp-minimized-icon">🤖</div>
      <div class="widget-header" id="salehelp-widget-header">
        <div class="widget-title">
          <span>🤖 SaleHelp AI v10</span>
        </div>
        <div class="widget-actions">
          <button class="widget-btn-icon" id="salehelp-btn-minimize" title="Thu nhỏ">_</button>
        </div>
      </div>
      <div class="widget-body">
        <div class="widget-toggle-row">
          <span class="widget-toggle-label">⚡ Tự động trả lời (Auto-Reply)</span>
          <label class="widget-switch">
            <input type="checkbox" id="salehelp-autoreply-toggle" ${config.autoReply ? 'checked' : ''}>
            <span class="widget-slider"></span>
          </label>
        </div>

        <!-- Live Skill Selector Badge -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:6px 10px; margin-bottom:8px; font-size:11px; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#64748B; font-weight:600;">⚡ Skill & Knowledge:</span>
          <a href="http://localhost:8080" target="_blank" id="salehelp-active-skill-label" style="color:#0284C7; font-weight:700; text-decoration:none; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Bấm để mở trang sửa Skill & Tour trên Dashboard">
            🎯 Chốt Đơn Tour (Click sửa)
          </a>
        </div>

        <!-- Active Contact & Context Card -->
        <div style="background:#F1F5F9; border:1px solid #CBD5E1; border-radius:8px; padding:8px 10px; margin-bottom:8px; font-size:11.5px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <span style="font-weight:700; color:#0284C7;">👤 Đang chat với:</span>
            <span id="salehelp-active-contact-badge" style="font-weight:700; color:#1E293B; background:white; padding:1px 6px; border-radius:4px; border:1px solid #E2E8F0;">Chưa chọn</span>
          </div>
          <div style="color:#475569; font-size:11px; margin-top:2px;">
            Tin nhắn: <b id="salehelp-detected-msg" style="color:#0F172A;">Đang quét hội thoại...</b>
          </div>
        </div>

        <!-- Multi-User Queue Status Card -->
        <div style="background:rgba(2,132,199,0.06); border:1px solid rgba(2,132,199,0.2); border-radius:8px; padding:8px 10px; margin-bottom:10px; font-size:11.5px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:#0284C7;">📋 Hàng đợi (Queue):</span>
            <span id="salehelp-queue-count" style="font-weight:700; padding:1px 8px; border-radius:10px; background:#0284C7; color:white; font-size:10.5px;">0 người</span>
          </div>
          <div id="salehelp-queue-list" style="font-size:11px; color:#64748B; margin-top:4px; max-height:48px; overflow-y:auto;">
            Không có ai đang chờ trong hàng đợi.
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <div style="display:flex; gap:6px; margin-bottom:8px;">
          <button class="btn-insert-send" id="salehelp-manual-btn" style="flex:1; padding:8px; font-size:11px;">
            ⚡ Trả Lời Người Này
          </button>
          <button class="btn-insert-only" id="salehelp-copy-btn" style="padding:8px; font-size:11px;" title="Copy câu trả lời">
            📋 Copy
          </button>
        </div>

        <div id="salehelp-dispatch-status" style="font-size:11px; color:#0284C7; font-weight:600; margin-bottom:6px; display:none;"></div>

        <div class="status-indicator">
          <span class="status-dot" id="salehelp-status-dot"></span>
          <span id="salehelp-status-text">Đang kết nối Server...</span>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // 5. ATTACH UI EVENT LISTENERS
    const minBtn = document.getElementById('salehelp-btn-minimize');
    const minIcon = document.getElementById('salehelp-minimized-icon');
    const autoToggle = document.getElementById('salehelp-autoreply-toggle');
    const manualBtn = document.getElementById('salehelp-manual-btn');
    const copyBtn = document.getElementById('salehelp-copy-btn');
    const header = document.getElementById('salehelp-widget-header');

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.add('minimized');
      });
    }

    if (minIcon) {
      minIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.remove('minimized');
      });
    }

    if (autoToggle) {
      autoToggle.addEventListener('change', (e) => {
        config.autoReply = e.target.checked;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_config: config });
        }
      });
    }

    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        const contact = getActiveContactName();
        const text = detectLastIncomingMessageInActiveChat();
        if (contact && text) {
          processContactMessage(contact, text, true);
        } else {
          alert(`Không tìm thấy tin nhắn mới cần trả lời trong cuộc trò chuyện với "${contact}"!`);
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!lastGeneratedAnswer) {
          alert('Chưa có câu trả lời nào từ AI!');
          return;
        }
        navigator.clipboard.writeText(lastGeneratedAnswer);
        alert('📋 Đã copy câu trả lời AI vào Clipboard:\n\n' + lastGeneratedAnswer);
      });
    }

    enableWidgetDrag(widget, header);
    checkServerConnection();
    fetchLiveActiveProfile();
    fetchLiveToursKnowledge();
  }

  // 6. DRAG AND DROP
  function enableWidgetDrag(widget, dragHandle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;

      isDragging = true;
      widget.classList.add('is-dragging');

      const rect = widget.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      widget.style.left = `${initialLeft}px`;
      widget.style.top = `${initialTop}px`;
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';

      function onMouseMove(moveEvent) {
        if (!isDragging) return;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        newLeft = Math.max(10, Math.min(window.innerWidth - widget.offsetWidth - 10, newLeft));
        newTop = Math.max(10, Math.min(window.innerHeight - widget.offsetHeight - 10, newTop));

        widget.style.left = `${newLeft}px`;
        widget.style.top = `${newTop}px`;
      }

      function onMouseUp() {
        if (isDragging) {
          isDragging = false;
          widget.classList.remove('is-dragging');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        }
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  async function checkServerConnection() {
    const dot = document.getElementById('salehelp-status-dot');
    const text = document.getElementById('salehelp-status-text');
    try {
      await safeApiFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping', model: 'gemini-3.6-flash' })
      });
      if (dot && text) {
        dot.className = 'status-dot';
        text.innerText = 'Server kết nối tốt (Gemini AI Sẵn Sàng)';
      }
    } catch (e) {
      if (dot && text) {
        dot.className = 'status-dot offline';
        text.innerText = 'Chưa bật SaleHelp Server (:8080)';
      }
    }
  }

  // 7. GET CURRENT ACTIVE CONTACT NAME FROM HEADER
  function getActiveContactName() {
    const headerTitleEl = document.querySelector('.header-title, .chat-title, .chat-name, div[data-id="header-name"], .conv-header__title, div[class*="header__title"], div[class*="title--name"]');
    if (headerTitleEl) {
      const name = headerTitleEl.innerText.trim().split('\n')[0];
      if (name) return name;
    }

    const activeSidebarItem = document.querySelector('.conv-item.active, .chat-item.active, div[class*="conv-item--active"], div[class*="item--selected"]');
    if (activeSidebarItem) {
      const nameEl = activeSidebarItem.querySelector('.name, .conv-item__name, .title, div[class*="name"]');
      if (nameEl) return nameEl.innerText.trim();
    }

    return 'Khách hàng';
  }

  // 8. EXTRACT CONVERSATION HISTORY (ACCURATE & DEDUPLICATED)
  function extractActiveChatHistory() {
    const chatViewArea = document.querySelector('#messageViewScroll') || 
                         document.querySelector('.chat-message-list') || 
                         document.querySelector('.chat-content') || 
                         document.body;

    const allBubbles = chatViewArea.querySelectorAll(
      '.chat-item, .msg-item, div[data-id]'
    );

    const history = [];
    const chatItems = Array.from(allBubbles).filter(el => {
      return el.offsetHeight > 0 && !el.querySelector('.chat-item, .msg-item');
    });

    const startIndex = Math.max(0, chatItems.length - 20);
    for (let i = startIndex; i < chatItems.length; i++) {
      const el = chatItems[i];
      const rect = el.getBoundingClientRect();
      const isMe = el.classList.contains('me') || 
                   el.classList.contains('msg-me') || 
                   el.classList.contains('me-view') || 
                   el.closest('.me') !== null ||
                   el.querySelector('.me') !== null ||
                   el.style.justifyContent === 'flex-end' ||
                   (rect.left > window.innerWidth * 0.55);

      const textNode = el.querySelector('.content, .text, .msg-text, .bubble-text, span, div.text') || el;
      let rawText = textNode ? textNode.innerText.trim() : '';
      rawText = rawText.replace(/\n\d{1,2}:\d{2}$/, '').trim();

      if (rawText && rawText.length > 0 && !rawText.startsWith('🤖') && !rawText.includes('Sử dụng Zalo PC') && !rawText.includes('Hôm nay')) {
        if (history.length === 0 || history[history.length - 1].text !== rawText) {
          history.push({
            role: isMe ? 'model' : 'user',
            text: rawText
          });
        }
      }
    }

    return history;
  }

  // 9. DETECT LATEST UNREPLIED INCOMING MESSAGE IN ACTIVE CHAT
  function detectLastIncomingMessageInActiveChat() {
    const history = extractActiveChatHistory();
    if (history.length === 0) return null;

    const lastMsg = history[history.length - 1];
    if (lastMsg.role === 'user') {
      return lastMsg.text;
    }
    return null;
  }

  // 10. MULTI-TIER ROBUST ZALO CHAT INPUT ELEMENT FINDER
  function findZaloChatInputElement() {
    // Priority 1: Specific Zalo chat input element IDs & data attributes
    const specificSelectors = [
      '#input_content',
      '#richInput',
      '#chatInput',
      '[data-id="chat-input"]',
      'div[data-translate-placeholder*="CHAT"]',
      'div[data-placeholder*="nhập"]',
      'div[data-placeholder*="Nhập"]',
      '.chat-input__content',
      '.chat-input div[contenteditable="true"]',
      '#chat-input-area div[contenteditable="true"]',
      '.footer-chat div[contenteditable="true"]',
      '.chat-box div[contenteditable="true"]',
      'div[class*="chat-input"] div[contenteditable="true"]',
      'div[class*="rich-input"]',
      'div[role="textbox"]'
    ];

    for (const sel of specificSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 0 && !el.closest('#salehelp-ai-widget')) {
        return el;
      }
    }

    // Priority 2: Any contenteditable located in the chat area (exclude top-left search bar)
    const allEditables = document.querySelectorAll('div[contenteditable="true"], [role="textbox"]');
    for (const edit of allEditables) {
      if (edit.offsetHeight > 0 && !edit.closest('#salehelp-ai-widget')) {
        const rect = edit.getBoundingClientRect();
        // Chat inputs are located in the right conversation panel or bottom half
        if (rect.top > window.innerHeight * 0.35 || rect.left > window.innerWidth * 0.25) {
          return edit;
        }
      }
    }

    // Priority 3: Fallback textarea / inputs
    const allTextareas = document.querySelectorAll('textarea, input[type="text"]');
    for (const ta of allTextareas) {
      if (ta.offsetHeight > 0 && !ta.closest('#salehelp-ai-widget')) {
        const rect = ta.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.35 || rect.left > window.innerWidth * 0.25) {
          return ta;
        }
      }
    }

    return null;
  }

  // 11. BULLETPROOF ZALO INPUT & ANTI-LIKE GUARD
  function executeZaloInputAndSubmit(text, autoSend = true) {
    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '✍️ Đang điền câu trả lời vào Zalo...';
    }

    const inputEl = findZaloChatInputElement();

    if (!inputEl) {
      console.warn('[SaleHelp] ⚠️ Chưa chọn cuộc trò chuyện hoặc chưa mở khung chat Zalo Web!');
      if (statusEl) statusEl.innerText = '⚠️ Vui lòng mở 1 cuộc trò chuyện Zalo';
      return false;
    }

    inputEl.focus();

    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {}

    if (!inputEl.innerText || !inputEl.innerText.includes(text.substring(0, 10))) {
      inputEl.innerText = text;
    }

    try {
      inputEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text, composed: true }));
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text, composed: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}

    if (autoSend) {
      if (statusEl) statusEl.innerText = '⚡ Đang gửi tin nhắn (Chống nút Like)...';

      setTimeout(() => {
        inputEl.focus();

        const enterParams = {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          charCode: 13,
          bubbles: true,
          cancelable: true,
          composed: true
        };

        inputEl.dispatchEvent(new KeyboardEvent('keydown', enterParams));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', enterParams));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', enterParams));

        setTimeout(() => {
          const sendButtons = document.querySelectorAll(
            'div[data-translate-title="STR_SEND"], div[title="Gửi"], div[title="Send"], span[data-translate-inner="STR_SEND"], i.fa-paper-plane'
          );

          sendButtons.forEach(btn => {
            const btnHtml = (btn.outerHTML || '').toLowerCase();
            const isLikeBtn = btnHtml.includes('thumb') || btnHtml.includes('like') || btnHtml.includes('thích') || btnHtml.includes('str_like');
            if (!isLikeBtn) {
              try {
                btn.click();
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              } catch (e) {}
            }
          });

          if (statusEl) {
            statusEl.innerText = `✅ Đã gửi cho "${currentActiveContact}" lúc ${new Date().toLocaleTimeString()}!`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
          }
        }, 200);
      }, 400);
    }

    return true;
  }

  // 11. PROCESS MESSAGE WITH ISOLATED CONTEXT & STRICT GROUNDING
  async function processContactMessage(contactName, userText, isManual = false) {
    if (!userText || !contactName) return;

    const contactState = config.lastRepliedMap[contactName] || { lastText: '', timestamp: 0 };
    if (!isManual && contactState.lastText === userText && (Date.now() - contactState.timestamp < 60000)) {
      return;
    }

    config.lastRepliedMap[contactName] = {
      lastText: userText,
      timestamp: Date.now()
    };

    console.log(`[SaleHelp] 🎯 [${contactName}] Xử lý tin nhắn: "${userText}"`);
    activeJobs++;
    try {

    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (!activeProfile) {
      console.warn('[SaleHelp] Chưa tải được profile từ server — không tự trả lời.');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerText = '⚠️ Chưa tải được profile từ server — cần nhân viên trả lời';
      }
      delete config.lastRepliedMap[contactName];
      return;
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = `🤖 Gemini AI [${activeProfile.name}] đang trả lời [${contactName}]...`;
    }

    // Never read another customer's messages: the DOM must really be showing this contact's chat
    if (getActiveContactName() !== contactName) {
      console.warn(`[SaleHelp] Bỏ qua [${contactName}]: chat đang mở là [${getActiveContactName()}].`);
      delete config.lastRepliedMap[contactName];
      enqueueContact(contactName);
      return;
    }

    updateContactMemory(contactName, extractActiveChatHistory());
    await compactContactMemory(contactName);
    const fullHistory = contactMemoryStore[contactName].messages;

    // The current question is sent as `prompt`, so drop it from history; Gemini wants history to start with a user turn
    let historyPayload = fullHistory.slice();
    const lastItem = historyPayload[historyPayload.length - 1];
    if (lastItem && lastItem.role === 'user' && lastItem.text === userText) historyPayload.pop();
    while (historyPayload.length && historyPayload[0].role !== 'user') historyPayload.shift();

    const promptResult = P.buildSystemPrompt({
      profile: activeProfile,
      tours: liveToursState,
      contactName: contactName,
      memorySummary: contactMemoryStore[contactName]?.summary || ''
    });

    if (!promptResult.canReply) {
      console.warn('[SaleHelp] Kho dữ liệu tour trống — không tự trả lời để tránh bịa thông tin.');
      if (statusEl) statusEl.innerText = '⚠️ Chưa có dữ liệu tour (kho trống) — cần nhân viên trả lời';
      delete config.lastRepliedMap[contactName];
      return;
    }

    const sysPrompt = promptResult.systemPrompt;

    try {
      const replies = P.getReplies(activeProfile);
      const FALLBACK_REPLY = replies.fallback;
      const SAFE_HANDOFF_REPLY = replies.handoff;
      const generationConfig = P.buildGenerationConfig(activeProfile);
      const shouldValidate = P.shouldValidateReplies(activeProfile);

      let aiReply = '';
      let correction = '';
      const maxAttempts = shouldValidate ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const data = await safeApiFetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userText,
            history: historyPayload,
            systemInstruction: sysPrompt + correction,
            model: 'gemini-3.6-flash',
            generationConfig: generationConfig
          })
        });

        const candidate = data && data.candidates && data.candidates[0]?.content?.parts[0]?.text;
        if (!candidate) {
          aiReply = FALLBACK_REPLY;
          break;
        }

        if (!shouldValidate) {
          aiReply = candidate;
          break;
        }

        const problems = P.validateReplyAgainstKnowledge(candidate, liveToursState);
        if (problems.length === 0) {
          aiReply = candidate;
          break;
        }

        console.warn(`[SaleHelp] ⚠️ [${contactName}] Câu trả lời lần ${attempt} bị chặn:`, problems, '\n', candidate);
        correction = `\n\n❌ BẢN NHÁP TRƯỚC BỊ TỪ CHỐI vì: ${problems.join('; ')}. Viết lại CHỈ dùng số liệu có trong kho dữ liệu; nếu không có thì không nêu số.`;
        if (attempt === 2) {
          aiReply = SAFE_HANDOFF_REPLY;
          if (statusEl) statusEl.innerText = `⚠️ AI trả lời sai kho dữ liệu cho [${contactName}] — đã dùng câu an toàn, nên kiểm tra lại`;
        }
      }

      lastGeneratedAnswer = aiReply;

      if (config.autoReply || isManual) {
        console.log(`[SaleHelp] ⚡ [${contactName}] Tự động gửi sau ${config.delaySeconds}s...`);
        await new Promise(r => setTimeout(r, config.delaySeconds * 1000));

        // The user (or the queue) may have switched chats while we waited: never type into another customer's chat
        const nowActive = getActiveContactName();
        if (nowActive !== contactName) {
          console.warn(`[SaleHelp] ⛔ Hủy gửi cho [${contactName}] vì chat đang mở là [${nowActive}].`);
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerText = `⛔ Đã hủy gửi cho [${contactName}] vì bạn đã chuyển sang [${nowActive}]`;
          }
          delete config.lastRepliedMap[contactName]; // allow a retry when that chat is opened again
          enqueueContact(contactName);
          return;
        }
        executeZaloInputAndSubmit(aiReply, true);
        // let the send finish (400ms + 200ms inside executeZaloInputAndSubmit)
        await new Promise(r => setTimeout(r, 900));
      }
    } catch (err) {
      console.error(`[SaleHelp] Lỗi gọi Gemini AI cho [${contactName}]:`, err);
      if (statusEl) statusEl.innerText = `❌ Lỗi kết nối Server Gemini AI cho [${contactName}]`;
    }
    } finally {
      activeJobs--;
    }
  }

  // 12. MULTI-USER QUEUE SCANNER
  const SIDEBAR_ITEM_SELECTOR =
    '#conversationList .conv-item, .chat-item-list .chat-item, div[class*="conv-item"], div[class*="item--contact"]';
  const SIDEBAR_NAME_SELECTOR = '.name, .conv-item__name, .title, div[class*="name"]';

  function getSidebarItems() {
    // keep only outermost matches so nested "conv-item__*" nodes are not treated as rows
    const all = Array.from(document.querySelectorAll(SIDEBAR_ITEM_SELECTOR));
    return all.filter(el => !all.some(other => other !== el && other.contains(el)));
  }

  function getSidebarItemName(item) {
    const nameEl = item.querySelector(SIDEBAR_NAME_SELECTOR);
    return nameEl ? nameEl.innerText.trim().split('\n')[0] : '';
  }

  // Re-resolve the row at click time: Zalo re-renders the list, so stored nodes go stale
  function findSidebarItemByName(contactName) {
    return getSidebarItems().find(item => getSidebarItemName(item) === contactName) || null;
  }

  // Zalo's React list reacts to the full pointer sequence, not a bare element.click()
  function clickLikeUser(el) {
    el.scrollIntoView({ block: 'nearest' });
    const rect = el.getBoundingClientRect();
    const opts = {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
    };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ctor(type, opts));
    });
  }

  function scanSidebarForIncomingUsers() {
    const sidebarItems = getSidebarItems();

    if (sidebarItems.length === 0) return;

    sidebarItems.forEach(item => {
      const contactName = getSidebarItemName(item);
      if (!contactName) return;

      const unreadBadge = item.querySelector(
        '.badge, .unread, .dot-unread, div[class*="unread"], div[class*="badge"], span[class*="badge"], .count'
      );
      const isUnread = unreadBadge !== null && unreadBadge.offsetHeight > 0;

      if (isUnread && contactName !== currentActiveContact) {
        const existing = processingQueue.find(q => q.contactName === contactName);
        if (!existing) {
          processingQueue.push({
            contactName: contactName,
            timestamp: Date.now()
          });
          console.log(`[SaleHelp] 📥 Đã thêm [${contactName}] vào Hàng đợi (Queue)!`);
        }
      }
    });

    updateQueueUI();
  }

  function enqueueContact(contactName) {
    if (!contactName || processingQueue.some(q => q.contactName === contactName)) return;
    processingQueue.push({ contactName, timestamp: Date.now() });
    updateQueueUI();
  }

  function updateQueueUI() {
    const countEl = document.getElementById('salehelp-queue-count');
    const listEl = document.getElementById('salehelp-queue-list');
    if (countEl) countEl.innerText = `${processingQueue.length} người`;
    if (listEl) {
      if (processingQueue.length === 0) {
        listEl.innerText = 'Không có ai đang chờ trong hàng đợi.';
      } else {
        listEl.innerHTML = processingQueue.map((q, idx) => `
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>${idx + 1}. <b>${q.contactName}</b></span>
            <span style="color:#0284C7;">Đang chờ</span>
          </div>
        `).join('');
      }
    }
  }

  // Wait until Zalo has really switched: header shows the target AND the message list stopped changing.
  // A fixed sleep can read the previous customer's bubbles under the new customer's name.
  async function waitForChatReady(contactName, timeoutMs = 5000) {
    const signature = () => extractActiveChatHistory().map(m => `${m.role}:${m.text}`).join('|');
    const start = Date.now();
    let prev = null;
    let stableTicks = 0;
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 350));
      if (getActiveContactName() !== contactName) { prev = null; stableTicks = 0; continue; }
      const sig = signature();
      if (sig && sig === prev) {
        if (++stableTicks >= 2) return true;
      } else {
        stableTicks = 0;
      }
      prev = sig;
    }
    return false;
  }

  // 13. QUEUE WORKER
  async function processNextUserInQueue() {
    if (isQueueBusy || processingQueue.length === 0 || !config.autoReply) return;

    isQueueBusy = true;
    const nextUser = processingQueue.shift();
    updateQueueUI();

    console.log(`[SaleHelp] 🔄 [QUEUE] Đang chuyển sang xử lý khách hàng: [${nextUser.contactName}]...`);
    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = `🔄 Đang chuyển sang khách hàng [${nextUser.contactName}]...`;
    }

    try {
      const item = findSidebarItemByName(nextUser.contactName);
      if (!item) {
        console.warn(`[SaleHelp] Không tìm thấy [${nextUser.contactName}] trong danh sách hội thoại (có thể đã cuộn khỏi màn hình).`);
        return;
      }
      clickLikeUser(item);

      const ready = await waitForChatReady(nextUser.contactName);
      currentActiveContact = getActiveContactName();
      if (!ready) {
        console.warn(`[SaleHelp] Chưa chuyển/nạp xong chat [${nextUser.contactName}] (đang ở [${currentActiveContact}]) — bỏ qua lượt này để tránh đọc nhầm hội thoại.`);
        return;
      }
      const detectedMsg = detectLastIncomingMessageInActiveChat();

      if (detectedMsg) {
        await processContactMessage(currentActiveContact, detectedMsg, false);
      }

      await new Promise(r => setTimeout(r, (config.delaySeconds + 1.5) * 1000));
    } catch (e) {
      console.error('[SaleHelp] Lỗi khi xử lý hàng đợi:', e);
    } finally {
      isQueueBusy = false;
    }
  }

  // 14. MAIN HEARTBEAT LOOP
  function startHeartbeatLoop() {
    setInterval(() => {
      currentActiveContact = getActiveContactName();

      const activeBadge = document.getElementById('salehelp-active-contact-badge');
      const detectedMsgEl = document.getElementById('salehelp-detected-msg');
      const manualBtn = document.getElementById('salehelp-manual-btn');

      if (activeBadge) activeBadge.innerText = currentActiveContact;

      const unrepliedMsg = detectLastIncomingMessageInActiveChat();
      const handled = Boolean(unrepliedMsg) &&
        config.lastRepliedMap[currentActiveContact]?.lastText === unrepliedMsg;

      // Fairness: if someone has waited too long, don't start another reply for the active chat.
      // Park it at the back of the queue so it is revisited after the waiting customer.
      const head = processingQueue[0];
      const yieldToQueue = Boolean(unrepliedMsg) && !handled && activeJobs === 0 && !isQueueBusy &&
        head && head.contactName !== currentActiveContact &&
        Date.now() - head.timestamp > MAX_QUEUE_WAIT_MS;
      if (yieldToQueue) enqueueContact(currentActiveContact);

      if (unrepliedMsg) {
        if (detectedMsgEl) detectedMsgEl.innerText = `"${unrepliedMsg.substring(0, 30)}..."`;
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời: "${unrepliedMsg.substring(0, 12)}..."`;

        if (config.autoReply && !isQueueBusy && !yieldToQueue) {
          processContactMessage(currentActiveContact, unrepliedMsg, false);
        }
      } else {
        if (detectedMsgEl) detectedMsgEl.innerText = 'Đã trả lời xong';
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời [${currentActiveContact.substring(0, 10)}]`;
      }

      scanSidebarForIncomingUsers();

      // The active chat only blocks the queue while a reply is actually pending.
      // A last message we already handled (dedup / failed send) must not stall other customers.
      const activeChatBlocking = activeJobs > 0 || (unrepliedMsg && !handled && !yieldToQueue);

      if (!activeChatBlocking && processingQueue.length > 0 && !isQueueBusy && config.autoReply) {
        processNextUserInQueue();
      }

    }, 1500);
  }

  // Periodically refresh active profile & live tours from server
  setInterval(() => {
    fetchLiveActiveProfile();
    fetchLiveToursKnowledge();
  }, 8000);

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    startHeartbeatLoop();
  }, 1000);

})();
