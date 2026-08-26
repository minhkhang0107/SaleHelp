// ==============================================================================
// SALEHELP ZALO PERSONAL AI COPILOT & AUTO-RESPONDER CONTENT SCRIPT
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension loaded into Zalo Web!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 2,
    personaName: 'Nguyễn Văn A',
    lastProcessedMsg: ''
  };

  // Load saved settings from Chrome Storage
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateWidgetUI();
      }
    });
  }

  // 1. INJECT FLOATING WIDGET INTO ZALO WEB
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

        <div class="suggestion-box" id="salehelp-suggestion-box" style="display:none;">
          <div class="suggestion-header">
            <span>💡 GỢI Ý CÂU TRẢ LỜI TỪ GEMINI AI</span>
          </div>
          <div class="suggestion-text" id="salehelp-suggestion-text">Đang phân tích tin nhắn...</div>
          <div class="suggestion-actions">
            <button class="btn-insert-send" onclick="applyAndSendSuggestion()">🚀 Chèn & Gửi</button>
            <button class="btn-insert-only" onclick="applySuggestionOnly()">✏️ Chèn</button>
          </div>
        </div>

        <div class="status-indicator">
          <span class="status-dot" id="salehelp-status-dot"></span>
          <span id="salehelp-status-text">Đang kết nối SaleHelp Server...</span>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    checkServerConnection();
  }

  // Check connection to SaleHelp Local Server
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

  // Toggle widget minimize
  window.toggleWidgetMinimize = function(minimize) {
    const widget = document.getElementById('salehelp-ai-widget');
    if (widget) {
      if (minimize) widget.classList.add('minimized');
      else widget.classList.remove('minimized');
    }
  };

  window.onAutoReplyToggle = function(checked) {
    config.autoReply = checked;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ salehelp_config: config });
    }
  };

  let currentSuggestion = '';

  window.applyAndSendSuggestion = function() {
    if (!currentSuggestion) return;
    insertTextIntoZaloInput(currentSuggestion, true);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  window.applySuggestionOnly = function() {
    if (!currentSuggestion) return;
    insertTextIntoZaloInput(currentSuggestion, false);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  // 2. INSERT TEXT INTO ZALO WEB CHAT INPUT BOX
  function insertTextIntoZaloInput(text, autoSend = false) {
    const inputEl = document.querySelector('div[contenteditable="true"]') || 
                    document.querySelector('#input_content') || 
                    document.querySelector('.rich-input') ||
                    document.querySelector('textarea');

    if (inputEl) {
      inputEl.focus();
      // Use document.execCommand for rich text editable div
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);

      // Trigger input event
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));

      if (autoSend) {
        setTimeout(() => {
          // Trigger Enter keydown
          const enterDown = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            keyCode: 13,
            which: 13,
            key: 'Enter'
          });
          inputEl.dispatchEvent(enterDown);

          // Fallback: Click send button if Enter didn't submit
          const sendBtn = document.querySelector('.btn-send') || 
                          document.querySelector('div[data-translate-title="STR_SEND"]') ||
                          document.querySelector('.send-btn');
          if (sendBtn) sendBtn.click();
        }, 300);
      }
    }
  }

  // 3. LISTEN TO NEW INCOMING MESSAGES VIA MUTATION OBSERVER
  let isProcessing = false;

  async function handleNewIncomingMessage(text, sender) {
    if (isProcessing || text === config.lastProcessedMsg) return;
    if (!text || text.length < 2) return;

    config.lastProcessedMsg = text;
    isProcessing = true;

    console.log(`[SaleHelp] 📩 Tin nhắn mới từ khách (${sender}): "${text}"`);

    // Show suggestion box in UI
    const sugBox = document.getElementById('salehelp-suggestion-box');
    const sugText = document.getElementById('salehelp-suggestion-text');
    if (sugBox && sugText) {
      sugBox.style.display = 'block';
      sugText.innerText = '🤖 AI đang suy nghĩ câu trả lời...';
    }

    try {
      // Call SaleHelp Gemini AI API
      const sysPrompt = `Bạn là trợ lý AI tư vấn Tour Du Lịch chuyên nghiệp, lịch sự, xưng em gọi anh/chị. Hãy trả lời ngắn gọn, nhiệt tình, tư vấn chi tiết và báo giá rõ ràng.`;
      
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
        aiReply = `Dạ em chào anh/chị! Em đã nhận được tin nhắn về "${text}". Em xin gửi thông tin chi tiết các tour ưu đãi hiện có bên em ạ!`;
      }

      currentSuggestion = aiReply;
      if (sugText) sugText.innerText = aiReply;

      // Auto Reply if enabled
      if (config.autoReply) {
        console.log(`[SaleHelp] ⚡ Tự động gửi sau ${config.delaySeconds}s: ${aiReply.substring(0, 40)}...`);
        setTimeout(() => {
          insertTextIntoZaloInput(aiReply, true);
          if (sugBox) sugBox.style.display = 'none';
        }, config.delaySeconds * 1000);
      }
    } catch (err) {
      console.error('[SaleHelp] Lỗi gọi Gemini AI:', err);
      if (sugText) sugText.innerText = '❌ Không thể kết nối tới Server AI.';
    } finally {
      setTimeout(() => { isProcessing = false; }, 3000);
    }
  }

  // 4. OBSERVE CHAT CONTAINER ON CHAT.ZALO.ME
  function setupMessageObserver() {
    const observer = new MutationObserver((mutations) => {
      // Find latest message items
      const msgItems = document.querySelectorAll('.chat-item, .msg-item, .message-item, div[data-id]');
      if (msgItems && msgItems.length > 0) {
        const lastMsgEl = msgItems[msgItems.length - 1];

        // Check if message is from the other person (not me / me-bubble)
        const isMyMessage = lastMsgEl.classList.contains('me') || 
                            lastMsgEl.classList.contains('msg-me') ||
                            lastMsgEl.querySelector('.me') !== null;

        if (!isMyMessage) {
          const textEl = lastMsgEl.querySelector('.content, .text, .msg-text, .bubble-text') || lastMsgEl;
          const text = textEl ? textEl.innerText.trim() : '';
          if (text) {
            handleNewIncomingMessage(text, 'Khách hàng');
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    setupMessageObserver();
  }, 2000);

})();
