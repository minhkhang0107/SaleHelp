// ==============================================================================
// SALEHELP ZALO PERSONAL AI AUTO-RESPONDER & COPILOT (V3 ULTRA DETECTOR)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v3 (Ultra Detector) Loaded!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 2,
    lastRepliedMsgText: '',
    lastRepliedTimestamp: 0
  };

  let isSending = false;
  let currentDetectedMsg = '';

  // Load saved configuration from storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateToggleState();
      }
    });
  }

  function updateToggleState() {
    const t = document.getElementById('salehelp-autoreply-toggle');
    if (t) t.checked = config.autoReply;
  }

  // 1. INJECT FLOATING WIDGET
  function injectFloatingWidget() {
    if (document.getElementById('salehelp-ai-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'salehelp-ai-widget';
    widget.innerHTML = `
      <div class="minimized-icon" onclick="toggleWidgetMinimize(false)">🤖</div>
      <div class="widget-header">
        <div class="widget-title">
          <span>🤖 SaleHelp AI Co-Pilot</span>
        </div>
        <div class="widget-actions">
          <button class="widget-btn-icon" onclick="toggleWidgetMinimize(true)" title="Thu nhỏ">_</button>
        </div>
      </div>
      <div class="widget-body">
        <div class="widget-toggle-row">
          <span class="widget-toggle-label">⚡ Tự động trả lời (Auto-Reply)</span>
          <label class="widget-switch">
            <input type="checkbox" id="salehelp-autoreply-toggle" ${config.autoReply ? 'checked' : ''} onchange="onAutoReplyToggle(this.checked)">
            <span class="widget-slider"></span>
          </label>
        </div>

        <div style="background:#F1F5F9; border:1px solid #CBD5E1; border-radius:8px; padding:8px 10px; margin-bottom:10px; font-size:11.5px;">
          <div style="font-weight:700; color:#0284C7; margin-bottom:2px;">Tin nhắn khách mới nhất:</div>
          <div id="salehelp-detected-msg" style="color:#0F172A; font-weight:600; min-height:16px;">Đang quét màn hình chat...</div>
        </div>

        <button class="btn-insert-send" id="salehelp-manual-btn" style="width:100%; padding:9px; margin-bottom:10px;" onclick="triggerManualReply()">
          ⚡ Bấm Để AI Trả Lời Ngay
        </button>

        <div class="suggestion-box" id="salehelp-suggestion-box" style="display:none;">
          <div class="suggestion-header">
            <span>💡 CÂU TRẢ LỜI CỦA GEMINI AI</span>
          </div>
          <div class="suggestion-text" id="salehelp-suggestion-text">Đang suy nghĩ...</div>
          <div class="suggestion-actions">
            <button class="btn-insert-send" onclick="applyAndSendSuggestion()">🚀 Chèn & Gửi</button>
            <button class="btn-insert-only" onclick="applySuggestionOnly()">✏️ Chèn</button>
          </div>
        </div>

        <div class="status-indicator">
          <span class="status-dot" id="salehelp-status-dot"></span>
          <span id="salehelp-status-text">Đang kiểm tra kết nối...</span>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    checkServerConnection();
  }

  async function checkServerConnection() {
    const dot = document.getElementById('salehelp-status-dot');
    const text = document.getElementById('salehelp-status-text');
    try {
      const res = await fetch(`${config.serverUrl}/api/gemini/generate`, {
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

  window.toggleWidgetMinimize = function(minimize) {
    const widget = document.getElementById('salehelp-ai-widget');
    if (widget) {
      if (minimize) widget.classList.add('minimized');
      else widget.classList.remove('minimized');
    }
  };

  window.onAutoReplyToggle = function(checked) {
    config.autoReply = checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ salehelp_config: config });
    }
  };

  let currentSuggestion = '';

  window.applyAndSendSuggestion = function() {
    if (!currentSuggestion) return;
    sendTextToZaloInput(currentSuggestion, true);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  window.applySuggestionOnly = function() {
    if (!currentSuggestion) return;
    sendTextToZaloInput(currentSuggestion, false);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  // 2. ULTRA ROBUST ZALO INPUT DISPATCHER
  function sendTextToZaloInput(text, autoSend = true) {
    const inputEl = document.querySelector('div[contenteditable="true"]') || 
                    document.querySelector('#input_content') || 
                    document.querySelector('.rich-input') ||
                    document.querySelector('textarea');

    if (!inputEl) {
      console.warn('[SaleHelp] ❌ Không tìm thấy ô nhập chat Zalo Web!');
      alert('Không tìm thấy khung chat Zalo. Vui lòng mở cuộc trò chuyện trước!');
      return;
    }

    inputEl.focus();

    // Clear and insert text
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {}

    // Fallback: If execCommand didn't fill text
    if (!inputEl.innerText || !inputEl.innerText.includes(text)) {
      inputEl.innerText = text;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    if (autoSend) {
      setTimeout(() => {
        // Trigger Enter Key
        const enterOpts = { bubbles: true, cancelable: true, keyCode: 13, which: 13, key: 'Enter', code: 'Enter' };
        inputEl.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

        // Click Send button icon if Enter didn't dispatch
        setTimeout(() => {
          const sendBtns = document.querySelectorAll(
            '.btn-send, div[data-translate-title="STR_SEND"], .send-btn, i[class*="send"], div[data-id="btn_send"]'
          );
          sendBtns.forEach(btn => btn.click());
        }, 150);
      }, 300);
    }
  }

  // 3. ULTRA DETECTOR: SCAN LATEST INCOMING MESSAGE IN ACTIVE CHAT
  function detectLastIncomingMessage() {
    // Collect all candidate message bubble elements
    const allBubbles = document.querySelectorAll(
      '.chat-item, .msg-item, .message-view, .chat-message, .msg-view, .card--text, div[data-id], .rel, .msg-info, .bubble-content, div[class*="chat-item"]'
    );

    if (!allBubbles || allBubbles.length === 0) return null;

    // Filter elements in main chat window (exclude sidebar list)
    const chatViewArea = document.querySelector('#messageViewScroll') || 
                         document.querySelector('.chat-message-list') || 
                         document.querySelector('.chat-content') || 
                         document.body;

    const chatItems = Array.from(allBubbles).filter(el => {
      // Must be inside main chat view and have visible height
      return chatViewArea.contains(el) && el.offsetHeight > 0;
    });

    if (chatItems.length === 0) return null;

    // Scan from bottom-most item upwards
    for (let i = chatItems.length - 1; i >= 0; i--) {
      const el = chatItems[i];

      // Check if message is sent by ME (align right / me class)
      const rect = el.getBoundingClientRect();
      const isMe = el.classList.contains('me') || 
                   el.classList.contains('msg-me') || 
                   el.classList.contains('me-view') || 
                   el.closest('.me') !== null ||
                   el.querySelector('.me') !== null ||
                   el.style.justifyContent === 'flex-end' ||
                   (rect.left > window.innerWidth * 0.55); // Located on right half of screen

      if (!isMe) {
        // This is an INCOMING message from the friend/customer
        const textNode = el.querySelector('.content, .text, .msg-text, .bubble-text, span, div.text') || el;
        let rawText = textNode ? textNode.innerText.trim() : '';

        // Clean text (remove time like "13:33", emojis only, system notifications)
        rawText = rawText.replace(/\n\d{1,2}:\d{2}$/, '').trim();

        if (rawText && rawText.length >= 1 && !rawText.startsWith('🤖') && !rawText.includes('Sử dụng Zalo PC') && !rawText.includes('Hôm nay')) {
          return rawText;
        }
      } else {
        // If the bottom-most message was sent by ME, then there is NO pending incoming message to reply!
        // (We already replied to them!)
        return null;
      }
    }

    return null;
  }

  // 4. PROCESS MESSAGE AND CALL GEMINI AI
  async function processIncomingMessage(text, isManual = false) {
    if (!text) return;
    if (isSending) return;
    if (!isManual && text === config.lastRepliedMsgText && (Date.now() - config.lastRepliedTimestamp < 60000)) {
      return; // Already replied in the last 60s
    }

    config.lastRepliedMsgText = text;
    config.lastRepliedTimestamp = Date.now();
    isSending = true;

    console.log(`[SaleHelp] 🎯 Phát hiện tin nhắn cần trả lời: "${text}"`);

    const sugBox = document.getElementById('salehelp-suggestion-box');
    const sugText = document.getElementById('salehelp-suggestion-text');
    if (sugBox && sugText) {
      sugBox.style.display = 'block';
      sugText.innerText = `🤖 Gemini AI đang trả lời: "${text}"...`;
    }

    try {
      const sysPrompt = `Bạn là chuyên viên tư vấn Tour Du Lịch nhiệt tình, lịch sự, xưng em gọi anh/chị. Khách hàng vừa nhắn tin: "${text}". Hãy trả lời chào hỏi thân thiện, giới thiệu tour Đà Nẵng 3N2Đ (giá 5,990,000đ) hoặc tour Phú Quốc (giá 7,500,000đ) và hỏi anh/chị cần tư vấn ngày nào để em hỗ trợ.`;

      const res = await fetch(`${config.serverUrl}/api/gemini/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          systemInstruction: sysPrompt,
          model: 'gemini-3.6-flash'
        })
      });

      const data = await res.json();
      let aiReply = '';
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        aiReply = data.candidates[0].content.parts[0].text;
      } else {
        aiReply = `Dạ em chào anh/chị! Em là nhân viên tư vấn du lịch. Anh/chị đang quan tâm đến tour du lịch nào để em gửi lịch trình và giá ưu đãi chi tiết ạ?`;
      }

      currentSuggestion = aiReply;
      if (sugText) sugText.innerText = aiReply;

      // If Auto-Reply is enabled, send automatically!
      if (config.autoReply || isManual) {
        console.log(`[SaleHelp] ⚡ Tự động gửi câu trả lời sau ${config.delaySeconds}s...`);
        setTimeout(() => {
          sendTextToZaloInput(aiReply, true);
          if (sugBox) sugBox.style.display = 'none';
        }, config.delaySeconds * 1000);
      }
    } catch (err) {
      console.error('[SaleHelp] Lỗi gọi Gemini AI:', err);
      if (sugText) sugText.innerText = '❌ Lỗi kết nối Server Gemini AI (:8080).';
    } finally {
      setTimeout(() => { isSending = false; }, 3000);
    }
  }

  window.triggerManualReply = function() {
    const text = currentDetectedMsg || detectLastIncomingMessage();
    if (text) {
      processIncomingMessage(text, true);
    } else {
      alert('Không tìm thấy tin nhắn cần trả lời trong cuộc trò chuyện hiện tại!');
    }
  };

  // 5. HEARTBEAT MONITORING LOOP (Runs every 1.5 seconds)
  function startHeartbeatMonitor() {
    setInterval(() => {
      const msg = detectLastIncomingMessage();
      const displayEl = document.getElementById('salehelp-detected-msg');
      const manualBtn = document.getElementById('salehelp-manual-btn');

      if (msg) {
        currentDetectedMsg = msg;
        if (displayEl) displayEl.innerText = `"${msg}"`;
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời Tin Nhắn: "${msg.substring(0, 15)}..."`;

        // If Auto-Reply is enabled and not replied yet
        if (config.autoReply && msg !== config.lastRepliedMsgText && !isSending) {
          processIncomingMessage(msg, false);
        }
      } else {
        currentDetectedMsg = '';
        if (displayEl) displayEl.innerText = 'Chưa có tin nhắn mới cần rep (Đã trả lời)';
        if (manualBtn) manualBtn.innerText = '⚡ Bấm Để AI Trả Lời Ngay';
      }
    }, 1500);
  }

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    startHeartbeatMonitor();
  }, 1000);

})();
