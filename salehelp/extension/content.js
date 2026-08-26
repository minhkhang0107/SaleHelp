// ==============================================================================
// SALEHELP ZALO AI COPILOT (V10 ZERO-HALLUCINATION & STRICT KNOWLEDGE GROUNDING)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v10 (Strict Grounding & Live Persona Sync) Loaded!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 1.5,
    lastRepliedMap: {}, // { [contactName]: { lastText: '', timestamp: 0 } }
  };

  // Live Persona loaded from localhost:8080/api/persona
  let livePersonaState = {
    name: 'Nguyễn Văn A',
    title: 'Chuyên viên tư vấn Tour Chuyên nghiệp (5 năm EXP)',
    tone: 'Lịch sự, nhiệt tình, tư vấn chi tiết lịch trình, xưng em gọi anh/chị'
  };

  // Active Dynamic Skill loaded from localhost:8080/api/skills/active
  let activeSkillConfig = {
    id: 'tour_closing_pro',
    name: '🎯 Tư Vấn & Chốt Đơn Tour (Mặc định)',
    systemPrompt: ''
  };

  // Live Dynamic Tours Knowledge Base loaded from localhost:8080/api/tours
  let liveToursState = [];

  // Multi-user Isolated Conversation Memory Store
  let contactMemoryStore = {};

  // Sequential Multi-User Queue
  let processingQueue = [];
  let isQueueBusy = false;
  let currentActiveContact = '';
  let lastGeneratedAnswer = '';

  // Load saved configuration from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config', 'salehelp_memory', 'salehelp_active_skill', 'salehelp_tours', 'salehelp_persona'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateToggleState();
      }
      if (res.salehelp_memory) {
        contactMemoryStore = res.salehelp_memory;
      }
      if (res.salehelp_active_skill) {
        activeSkillConfig = res.salehelp_active_skill;
        updateSkillUI();
      }
      if (res.salehelp_tours && Array.isArray(res.salehelp_tours)) {
        liveToursState = res.salehelp_tours;
      }
      if (res.salehelp_persona) {
        livePersonaState = res.salehelp_persona;
      }
    });
  }

  function saveMemoryToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ salehelp_memory: contactMemoryStore });
    }
  }

  function updateToggleState() {
    const t = document.getElementById('salehelp-autoreply-toggle');
    if (t) t.checked = config.autoReply;
  }

  function updateSkillUI() {
    const skillEl = document.getElementById('salehelp-active-skill-label');
    if (skillEl) skillEl.innerText = activeSkillConfig.name || '🎯 Chốt Đơn Tour';
  }

  // Universal Safe API Fetcher (Uses Background Worker to bypass all CORS / Mixed Content / PNA restrictions)
  async function safeApiFetch(endpoint, options = {}) {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${config.serverUrl}${endpoint}`;

    // 1. Try Extension Background Service Worker
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
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
          throw new Error(res.error);
        }
      } catch (err) {
        console.warn('[SaleHelp] Background worker fetch fallback to direct:', err.message);
      }
    }

    // 2. Direct Fetch fallback
    const directRes = await fetch(fullUrl, options);
    if (!directRes.ok) {
      throw new Error(`HTTP ${directRes.status}`);
    }
    const contentType = directRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await directRes.json();
    }
    return await directRes.text();
  }

  // 1. FETCH LIVE ACTIVE SKILL FROM LOCAL SERVER
  async function fetchLiveActiveSkill() {
    try {
      const data = await safeApiFetch('/api/skills/active');
      if (data && data.name) {
        activeSkillConfig = data;
        updateSkillUI();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_active_skill: data });
        }
      }
    } catch (e) {
      console.warn('[SaleHelp] Chưa lấy được skill từ server:', e.message);
    }
  }

  // 2. FETCH LIVE PERSONA FROM LOCAL SERVER (:8080/api/persona)
  async function fetchLivePersona() {
    try {
      const data = await safeApiFetch('/api/persona');
      if (data && data.name) {
        livePersonaState = data;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_persona: data });
        }
      }
    } catch (e) {
      console.warn('[SaleHelp] Chưa lấy được persona từ server:', e.message);
    }
  }

  // 3. FETCH LIVE TOURS KNOWLEDGE BASE FROM LOCAL SERVER (:8080/api/tours)
  async function fetchLiveToursKnowledge() {
    try {
      const data = await safeApiFetch('/api/tours');
      if (Array.isArray(data) && data.length > 0) {
        liveToursState = data;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ salehelp_tours: data });
        }
      }
    } catch (e) {
      console.warn('[SaleHelp] Chưa lấy được tour knowledge từ server:', e.message);
    }
  }

  function formatToursKnowledgeBlock() {
    if (!liveToursState || liveToursState.length === 0) {
      return `[GÓI TOUR 1]
• Tên Tour: Tour Đà Nẵng - Hội An - Bà Nà Hills 3N2Đ (3 Ngày 2 Đêm)
• Giá trọn gói chính xác: 5,990,000 VNĐ / người (BẮT BUỘC BÁO ĐÚNG GIÁ 5,990,000 VNĐ)
• Chi tiết trọn gói: Trọn gói vé máy bay khứ hồi + Khách sạn 4 sao gần biển Mỹ Khê + Vé cáp treo Bà Nà Hills + Ăn 5 bữa chính theo tour.
• Hạn áp dụng: 2026-09-30 (Active)

[GÓI TOUR 2]
• Tên Tour: Voucher Giảm 20% Tour Phú Quốc 4N3Đ Combo VinWonders
• Giá trọn gói chính xác: 7,200,000 VNĐ / người
• Chi tiết trọn gói: Bao gồm vé máy bay khứ hồi + 3 đêm tại Vinholidays Fiesta Phú Quốc có buffet sáng + Vé vui chơi không giới hạn VinWonders & Safari + Xe đón tiễn sân bay.

[GÓI TOUR 3]
• Tên Tour: Tour Nha Trang - Biển Đảo 3N2Đ Khách Sạn 4 Sao
• Giá trọn gói chính xác: 4,800,000 VNĐ / người
• Chi tiết trọn gói: Vé máy bay khứ hồi + Khách sạn 4 sao trung tâm Trần Phú + Tour cano cao tốc tham quan 3 đảo Hòn Mun, Hòn Tằm lặn ngắm san hô + Tắm bùn khoáng nóng.`;
    }

    return liveToursState
      .filter(t => t.isActive)
      .map((t, idx) => `[GÓI TOUR ${idx + 1}]
• Tên Tour: ${t.title}
• Giá trọn gói chính xác: ${t.price} / người (BẮT BUỘC BÁO ĐÚNG MỨC GIÁ ${t.price}, CẤM TỰ Ý ĐỔI GIÁ)
• Chi tiết trọn gói: ${t.content}
• Hạn sử dụng: ${t.expiryDate || 'Đang mở bán'}`)
      .join('\n\n');
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
    fetchLiveActiveSkill();
    fetchLivePersona();
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

  // 10. BULLETPROOF ZALO INPUT & ANTI-LIKE GUARD
  function executeZaloInputAndSubmit(text, autoSend = true) {
    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '✍️ Đang điền câu trả lời vào Zalo...';
    }

    const inputEl = document.querySelector('#input_content') || 
                    document.querySelector('div[contenteditable="true"]') ||
                    document.querySelector('.rich-input') ||
                    document.querySelector('[data-id="chat-input"]') ||
                    document.querySelector('textarea');

    if (!inputEl) {
      console.warn('[SaleHelp] ❌ Không tìm thấy ô nhập chat Zalo Web!');
      if (statusEl) statusEl.innerText = '❌ Không tìm thấy khung chat Zalo';
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

    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = `🤖 Gemini AI đang tra cứu Knowledge Base & trả lời [${contactName}]...`;
    }

    const activeHistory = extractActiveChatHistory();
    contactMemoryStore[contactName] = activeHistory;
    saveMemoryToStorage();

    const historyPayload = activeHistory.slice(0, activeHistory.length - 1);

    // Dynamic Live Knowledge Base Formatting
    const liveKnowledgeBlock = formatToursKnowledgeBlock();

    // Strict Grounding & Zero-Hallucination System Prompt
    let sysPrompt = `BẠN LÀ ${livePersonaState.name.toUpperCase()}, ${livePersonaState.title.toUpperCase()}.
PHONG CÁCH TƯ VẤN: ${livePersonaState.tone}.
TÊN KHÁCH HÀNG: ${contactName}.

🎯 NGUYÊN TẮC BẮT BUỘC & CHỐNG BỊA ĐẶT THÔNG TIN (STRICT ZERO-HALLUCINATION):
1. QUY TẮC BÁM SÁT 100% KHO DỮ LIỆU KNOWLEDGE BASE (GROUNDING):
   - BẮT BUỘC dùng đúng Tên Tour, đúng Số Ngày/Đêm (ví dụ: Tour Đà Nẵng là "3N2Đ" - TUYỆT ĐỐI CẤM tự bịa thành "4N3Đ"), đúng Giá Bán (ví dụ: "5.990.000 VNĐ" - TUYỆT ĐỐI CẤM tự đổi thành "4.990.000 VNĐ") và đúng Chi Tiết Dịch Vụ đã được cấu hình trong Kho Dữ Liệu Tour bên dưới.
   - TUYỆT ĐỐI CẤM tự ý bịa thêm điểm tham quan, tự sửa giá tiền hoặc tự tăng/giảm số ngày đêm của tour!
2. QUY TẮC BÁM SÁT ĐỊA ĐIỂM (TOPIC LOCKING):
   - Đọc kỹ lịch sử trò chuyện. Nếu khách đã hỏi về ĐÀ NẴNG (hoặc bất kỳ địa điểm nào), bạn PHẢI TIẾP TỤC TƯ VẤN VỀ ĐÀ NẴNG. Tuyệt đối không tự ý nhảy sang Nha Trang hay Phú Quốc.
3. VÀO THẲNG VẤN ĐỀ & BÁO GIÁ TRỌN GÓI:
   - Nêu đúng tên gói tour và giá tiền chính xác theo bảng giá. CẤM tuyệt đối khen thời tiết hay tâm sự phiếm.
4. LUÔN HỎI THÔNG TIN ĐỂ CHỐT ĐƠN Ở CUỐI:
   - "Anh/chị dự kiến đi vào ngày nào trong tháng và đoàn mình đi bao nhiêu người (lớn + trẻ em) để em kiểm tra vé máy bay giờ đẹp và giữ giá ưu đãi tốt nhất cho mình ạ?"

📚 KHO DỮ LIỆU BẢNG GIÁ TOUR & DỊCH VỤ THỰC TẾ (LIVE KNOWLEDGE BASE):
${liveKnowledgeBlock}`;

    // If active custom skill has a custom template, inject placeholders
    if (activeSkillConfig && activeSkillConfig.systemPrompt) {
      sysPrompt = activeSkillConfig.systemPrompt
        .replace(/{PERSONA_NAME}/g, livePersonaState.name)
        .replace(/{PERSONA_TITLE}/g, livePersonaState.title)
        .replace(/{PERSONA_TONE}/g, livePersonaState.tone)
        .replace(/{CUSTOMER_NAME}/g, contactName);
      
      sysPrompt += `\n\n📚 KHO DỮ LIỆU BẢNG GIÁ TOUR & DỊCH VỤ THỰC TẾ (LIVE KNOWLEDGE BASE):\n${liveKnowledgeBlock}`;
    }

    try {
      const data = await safeApiFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          history: historyPayload,
          systemInstruction: sysPrompt,
          model: 'gemini-3.6-flash'
        })
      });

      let aiReply = '';
      if (data && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        aiReply = data.candidates[0].content.parts[0].text;
      } else {
        aiReply = `Dạ em chào anh/chị! Em xin gửi thông tin giá tour ưu đãi tốt nhất trọn gói vé máy bay và khách sạn. Anh/chị dự kiến đi vào ngày nào và đoàn mình đi bao nhiêu người để em giữ giá vé tốt nhất ạ?`;
      }

      lastGeneratedAnswer = aiReply;

      contactMemoryStore[contactName].push({
        role: 'model',
        text: aiReply
      });
      saveMemoryToStorage();

      if (config.autoReply || isManual) {
        console.log(`[SaleHelp] ⚡ [${contactName}] Tự động gửi sau ${config.delaySeconds}s...`);
        setTimeout(() => {
          executeZaloInputAndSubmit(aiReply, true);
        }, config.delaySeconds * 1000);
      }
    } catch (err) {
      console.error(`[SaleHelp] Lỗi gọi Gemini AI cho [${contactName}]:`, err);
      if (statusEl) statusEl.innerText = `❌ Lỗi kết nối Server Gemini AI cho [${contactName}]`;
    }
  }

  // 12. MULTI-USER QUEUE SCANNER
  function scanSidebarForIncomingUsers() {
    const sidebarItems = document.querySelectorAll(
      '#conversationList .conv-item, .chat-item-list .chat-item, div[class*="conv-item"], div[class*="item--contact"]'
    );

    if (!sidebarItems || sidebarItems.length === 0) return;

    sidebarItems.forEach(item => {
      const nameEl = item.querySelector('.name, .conv-item__name, .title, div[class*="name"]');
      const contactName = nameEl ? nameEl.innerText.trim().split('\n')[0] : '';
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
            element: item,
            timestamp: Date.now()
          });
          console.log(`[SaleHelp] 📥 Đã thêm [${contactName}] vào Hàng đợi (Queue)!`);
        }
      }
    });

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
      if (nextUser.element) {
        nextUser.element.click();
      }

      await new Promise(r => setTimeout(r, 800));

      currentActiveContact = getActiveContactName();
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
      if (unrepliedMsg) {
        if (detectedMsgEl) detectedMsgEl.innerText = `"${unrepliedMsg.substring(0, 30)}..."`;
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời: "${unrepliedMsg.substring(0, 12)}..."`;

        if (config.autoReply && !isQueueBusy) {
          processContactMessage(currentActiveContact, unrepliedMsg, false);
        }
      } else {
        if (detectedMsgEl) detectedMsgEl.innerText = 'Đã trả lời xong';
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời [${currentActiveContact.substring(0, 10)}]`;
      }

      scanSidebarForIncomingUsers();

      if (!unrepliedMsg && processingQueue.length > 0 && !isQueueBusy && config.autoReply) {
        processNextUserInQueue();
      }

    }, 1500);
  }

  // Periodically refresh active skill, persona & live tours from server
  setInterval(() => {
    fetchLiveActiveSkill();
    fetchLivePersona();
    fetchLiveToursKnowledge();
  }, 8000);

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    startHeartbeatLoop();
  }, 1000);

})();
