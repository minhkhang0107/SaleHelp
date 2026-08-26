// ==============================================================================
// SALEHELP ZALO PERSONAL AI AUTO-RESPONDER & COPILOT (V4 BULLETPROOF DISPATCHER)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v4 (Bulletproof Input Dispatcher) Loaded!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 1.5,
    lastRepliedMsgText: '',
    lastRepliedTimestamp: 0
  };

  let isSending = false;
  let currentDetectedMsg = '';
  let lastGeneratedAnswer = '';

  // Load saved configuration from Chrome Storage
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

        <div style="display:flex; gap:6px; margin-bottom:10px;">
          <button class="btn-insert-send" id="salehelp-manual-btn" style="flex:1; padding:8px; font-size:11px;" onclick="triggerManualReply()">
            ⚡ Trả Lời Ngay
          </button>
          <button class="btn-insert-only" style="padding:8px; font-size:11px;" onclick="copyLastAnswer()" title="Copy câu trả lời">
            📋 Copy
          </button>
        </div>

        <div class="suggestion-box" id="salehelp-suggestion-box" style="display:none;">
          <div class="suggestion-header">
            <span>💡 CÂU TRẢ LỜI CỦA GEMINI AI</span>
          </div>
          <div class="suggestion-text" id="salehelp-suggestion-text">Đang suy nghĩ...</div>
          <div class="suggestion-actions">
            <button class="btn-insert-send" onclick="applyAndSendSuggestion()">🚀 Điền & Gửi</button>
            <button class="btn-insert-only" onclick="applySuggestionOnly()">✏️ Chỉ Điền</button>
          </div>
        </div>

        <div id="salehelp-dispatch-status" style="font-size:11px; color:#0284C7; font-weight:600; margin-bottom:6px; display:none;"></div>

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

  window.copyLastAnswer = function() {
    if (!lastGeneratedAnswer) {
      alert('Chưa có câu trả lời nào từ AI!');
      return;
    }
    navigator.clipboard.writeText(lastGeneratedAnswer);
    alert('📋 Đã copy câu trả lời AI vào Clipboard:\n\n' + lastGeneratedAnswer);
  };

  window.applyAndSendSuggestion = function() {
    if (!lastGeneratedAnswer) return;
    executeZaloInputAndSubmit(lastGeneratedAnswer, true);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  window.applySuggestionOnly = function() {
    if (!lastGeneratedAnswer) return;
    executeZaloInputAndSubmit(lastGeneratedAnswer, false);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  // 2. BULLETPROOF ZALO INPUT & SEND SUBMISSION
  function executeZaloInputAndSubmit(text, autoSend = true) {
    const statusEl = document.getElementById('salehelp-dispatch-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '✍️ Đang điền câu trả lời vào Zalo...';
    }

    // Find Zalo input element
    let inputEl = document.querySelector('#input_content') || 
                  document.querySelector('div[contenteditable="true"]') ||
                  document.querySelector('.rich-input') ||
                  document.querySelector('[data-id="chat-input"]') ||
                  document.querySelector('textarea');

    if (!inputEl) {
      console.warn('[SaleHelp] ❌ Không tìm thấy ô nhập chat Zalo Web!');
      if (statusEl) statusEl.innerText = '❌ Không tìm thấy khung chat Zalo';
      return;
    }

    // Step A: Focus input box and set selection
    inputEl.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    // Step B: Native execCommand (Select All -> Delete -> Insert Text)
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {}

    // Step C: Fallback innerText if empty
    if (!inputEl.innerText || !inputEl.innerText.includes(text.substring(0, 10))) {
      inputEl.innerText = text;
    }

    // Step D: Dispatch Events
    try {
      inputEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text, composed: true }));
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text, composed: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}

    if (autoSend) {
      if (statusEl) statusEl.innerText = '⚡ Đang bấm Gửi tin nhắn...';

      setTimeout(() => {
        inputEl.focus();

        // 1. Dispatch Enter KeyboardEvent sequence
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

        // 2. Click all possible Send Icon / Button Selectors on Zalo Web
        setTimeout(() => {
          const sendSelectors = [
            '#btn_send',
            '.btn-send',
            '.send-btn',
            'div[data-id="btn_send"]',
            'div[data-translate-title="STR_SEND"]',
            'div[title*="Gửi"]',
            'div[title*="Send"]',
            'div.chat-input__send',
            'span[data-translate-inner="STR_SEND"]',
            'i[class*="send"]',
            'i[class*="paper-plane"]',
            'div[class*="icon-send"]'
          ];

          sendSelectors.forEach(s => {
            const btns = document.querySelectorAll(s);
            btns.forEach(b => {
              try {
                b.click();
                b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              } catch (e) {}
            });
          });

          if (statusEl) {
            statusEl.innerText = `✅ Đã gửi phản hồi lúc ${new Date().toLocaleTimeString()}!`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
          }
        }, 200);
      }, 400);
    }
  }

  // 3. DETECT LAST INCOMING MESSAGE
  function detectLastIncomingMessage() {
    const allBubbles = document.querySelectorAll(
      '.chat-item, .msg-item, .message-view, .chat-message, .msg-view, .card--text, div[data-id], .rel, .msg-info, .bubble-content, div[class*="chat-item"]'
    );

    if (!allBubbles || allBubbles.length === 0) return null;

    const chatViewArea = document.querySelector('#messageViewScroll') || 
                         document.querySelector('.chat-message-list') || 
                         document.querySelector('.chat-content') || 
                         document.body;

    const chatItems = Array.from(allBubbles).filter(el => {
      return chatViewArea.contains(el) && el.offsetHeight > 0;
    });

    if (chatItems.length === 0) return null;

    // Scan from bottom upwards
    for (let i = chatItems.length - 1; i >= 0; i--) {
      const el = chatItems[i];
      const rect = el.getBoundingClientRect();
      const isMe = el.classList.contains('me') || 
                   el.classList.contains('msg-me') || 
                   el.classList.contains('me-view') || 
                   el.closest('.me') !== null ||
                   el.querySelector('.me') !== null ||
                   el.style.justifyContent === 'flex-end' ||
                   (rect.left > window.innerWidth * 0.55);

      if (!isMe) {
        const textNode = el.querySelector('.content, .text, .msg-text, .bubble-text, span, div.text') || el;
        let rawText = textNode ? textNode.innerText.trim() : '';
        rawText = rawText.replace(/\n\d{1,2}:\d{2}$/, '').trim();

        if (rawText && rawText.length >= 1 && !rawText.startsWith('🤖') && !rawText.includes('Sử dụng Zalo PC') && !rawText.includes('Hôm nay')) {
          return rawText;
        }
      } else {
        // If bottom-most message is ME, no reply needed!
        return null;
      }
    }

    return null;
  }

  // 4. PROCESS INCOMING MESSAGE WITH GEMINI AI
  async function processIncomingMessage(text, isManual = false) {
    if (!text) return;
    if (isSending) return;
    if (!isManual && text === config.lastRepliedMsgText && (Date.now() - config.lastRepliedTimestamp < 60000)) {
      return;
    }

    config.lastRepliedMsgText = text;
    config.lastRepliedTimestamp = Date.now();
    isSending = true;

    console.log(`[SaleHelp] 🎯 Đang gọi Gemini AI trả lời: "${text}"`);

    const sugBox = document.getElementById('salehelp-suggestion-box');
    const sugText = document.getElementById('salehelp-suggestion-text');
    const statusEl = document.getElementById('salehelp-dispatch-status');

    if (sugBox && sugText) {
      sugBox.style.display = 'block';
      sugText.innerText = `🤖 Gemini AI đang sinh câu trả lời cho: "${text}"...`;
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '🤖 Đang gọi Gemini 3.6 Flash AI...';
    }

    try {
      const sysPrompt = `Bạn là chuyên viên tư vấn Tour Du Lịch nhiệt tình, lịch sự, xưng em gọi anh/chị. Khách hàng vừa nhắn tin: "${text}". Hãy trả lời chào hỏi thân thiện, giới thiệu tour Đà Nẵng 3N2Đ (giá 5,990,000đ) hoặc tour Phú Quốc 4N3Đ (giá 7,500,000đ) và hỏi anh/chị cần tư vấn ngày nào để em hỗ trợ.`;

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
        aiReply = `Dạ em chào anh/chị! Em là nhân viên tư vấn du lịch. Anh/chị đang quan tâm đến tour Đà Nẵng hay Phú Quốc để em gửi lịch trình và giá ưu đãi chi tiết ạ?`;
      }

      lastGeneratedAnswer = aiReply;
      if (sugText) sugText.innerText = aiReply;

      // Auto Send if enabled or manual
      if (config.autoReply || isManual) {
        console.log(`[SaleHelp] ⚡ Tự động gõ và gửi sau ${config.delaySeconds}s...`);
        setTimeout(() => {
          executeZaloInputAndSubmit(aiReply, true);
        }, config.delaySeconds * 1000);
      }
    } catch (err) {
      console.error('[SaleHelp] Lỗi gọi Gemini AI:', err);
      if (sugText) sugText.innerText = '❌ Lỗi kết nối Server Gemini AI (:8080).';
      if (statusEl) statusEl.innerText = '❌ Không thể kết nối Server Local (:8080)';
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
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời: "${msg.substring(0, 15)}..."`;

        // If Auto-Reply is enabled and not replied yet
        if (config.autoReply && msg !== config.lastRepliedMsgText && !isSending) {
          processIncomingMessage(msg, false);
        }
      } else {
        currentDetectedMsg = '';
        if (displayEl) displayEl.innerText = 'Chưa có tin nhắn mới cần rep (Đã trả lời)';
        if (manualBtn) manualBtn.innerText = '⚡ Trả Lời Ngay';
      }
    }, 1500);
  }

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    startHeartbeatMonitor();
  }, 1000);

})();
