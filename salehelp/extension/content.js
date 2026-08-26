// ==============================================================================
// SALEHELP ZALO PERSONAL AI COPILOT & AUTO-RESPONDER CONTENT SCRIPT (V2 ULTRA)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v2 loaded into Zalo Web!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 2,
    personaName: 'Nguyễn Văn A',
    lastProcessedMsg: ''
  };

  // Load saved settings from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateWidgetToggleUI();
      }
    });
  }

  function updateWidgetToggleUI() {
    const toggle = document.getElementById('salehelp-autoreply-toggle');
    if (toggle) toggle.checked = config.autoReply;
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

        <div style="margin-bottom: 10px;">
          <button class="btn-insert-send" style="width:100%; padding:8px;" onclick="triggerManualReply()">⚡ Trả Lời Tin Nhắn Mới Nhất (AI Reply)</button>
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
        text.innerText = 'Server: Sẵn sàng (Gemini AI Active)';
      }
    } catch (e) {
      if (dot && text) {
        dot.className = 'status-dot offline';
        text.innerText = 'Chưa bật Server (:8080)';
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
    insertTextIntoZaloInput(currentSuggestion, true);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  window.applySuggestionOnly = function() {
    if (!currentSuggestion) return;
    insertTextIntoZaloInput(currentSuggestion, false);
    document.getElementById('salehelp-suggestion-box').style.display = 'none';
  };

  // 2. INSERT TEXT INTO ZALO WEB CHAT INPUT BOX (MULTI-STRATEGY)
  function insertTextIntoZaloInput(text, autoSend = false) {
    const inputEl = document.querySelector('div[contenteditable="true"]') || 
                    document.querySelector('#input_content') || 
                    document.querySelector('.rich-input') ||
                    document.querySelector('textarea');

    if (!inputEl) {
      console.warn('[SaleHelp] Không tìm thấy ô nhập tin nhắn Zalo Web!');
      return;
    }

    inputEl.focus();

    // Strategy A: execCommand insertText
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {}

    // Strategy B: Direct innerText & input event
    if (!inputEl.innerText || !inputEl.innerText.includes(text)) {
      inputEl.innerText = text;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    if (autoSend) {
      setTimeout(() => {
        // Trigger Enter key events
        const enterDown = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, which: 13, key: 'Enter' });
        const enterPress = new KeyboardEvent('keypress', { bubbles: true, cancelable: true, keyCode: 13, which: 13, key: 'Enter' });
        const enterUp = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, keyCode: 13, which: 13, key: 'Enter' });
        
        inputEl.dispatchEvent(enterDown);
        inputEl.dispatchEvent(enterPress);
        inputEl.dispatchEvent(enterUp);

        // Click Send button
        setTimeout(() => {
          const sendBtn = document.querySelector('.btn-send') || 
                          document.querySelector('div[data-translate-title="STR_SEND"]') ||
                          document.querySelector('.send-btn') ||
                          document.querySelector('i.fa-paper-plane')?.parentElement;
          if (sendBtn) sendBtn.click();
        }, 150);
      }, 300);
    }
  }

  // 3. LISTEN & EXTRACT LATEST INCOMING MESSAGE ON ZALO WEB
  let isProcessing = false;

  function extractLatestIncomingMessage() {
    // Find all message containers
    const messageBlocks = document.querySelectorAll(
      '.chat-item, .msg-item, .message-view, .chat-message, .msg-view, div[data-id], .rel, .msg-info'
    );

    if (!messageBlocks || messageBlocks.length === 0) return null;

    // Scan from bottom up to find the latest incoming message
    for (let i = messageBlocks.length - 1; i >= 0; i--) {
      const el = messageBlocks[i];

      // Check if outgoing message (me)
      const isMe = el.classList.contains('me') || 
                   el.classList.contains('msg-me') || 
                   el.classList.contains('me-view') ||
                   el.closest('.me') !== null ||
                   el.querySelector('.me') !== null ||
                   el.style.justifyContent === 'flex-end' ||
                   el.getAttribute('data-is-me') === 'true';

      if (!isMe) {
        // Extract text content
        const textNode = el.querySelector('.content, .text, .msg-text, .bubble-text, span, div.text') || el;
        const text = textNode ? textNode.innerText.trim() : '';
        if (text && text.length > 1 && !text.startsWith('🤖 SaleHelp')) {
          return text;
        }
      }
    }
    return null;
  }

  async function processCustomerMessage(text) {
    if (isProcessing) return;
    if (!text || text === config.lastProcessedMsg) return;

    config.lastProcessedMsg = text;
    isProcessing = true;

    console.log(`[SaleHelp] 📩 Đang xử lý tin nhắn khách: "${text}"`);

    const sugBox = document.getElementById('salehelp-suggestion-box');
    const sugText = document.getElementById('salehelp-suggestion-text');
    if (sugBox && sugText) {
      sugBox.style.display = 'block';
      sugText.innerText = '🤖 Gemini AI đang phân tích và tra cứu kho Tour...';
    }

    try {
      const sysPrompt = `Bạn là chuyên viên tư vấn Tour Du Lịch nhiệt tình, lịch sự, xưng em gọi anh/chị. Hãy trả lời câu hỏi của khách ngắn gọn, nêu rõ giá tour và tư vấn chi tiết lịch trình.`;
      
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
        aiReply = `Dạ em chào anh/chị! Em đã nhận được câu hỏi về "${text}". Em xin gửi thông tin lịch trình tour và ưu đãi tốt nhất cho anh/chị tham khảo ạ!`;
      }

      currentSuggestion = aiReply;
      if (sugText) sugText.innerText = aiReply;

      if (config.autoReply) {
        console.log(`[SaleHelp] ⚡ Tự động gửi sau ${config.delaySeconds}s: ${aiReply.substring(0, 40)}...`);
        setTimeout(() => {
          insertTextIntoZaloInput(aiReply, true);
          if (sugBox) sugBox.style.display = 'none';
        }, config.delaySeconds * 1000);
      }
    } catch (err) {
      console.error('[SaleHelp] Lỗi gọi Gemini AI:', err);
      if (sugText) sugText.innerText = '❌ Không thể kết nối tới Server AI (:8080).';
    } finally {
      setTimeout(() => { isProcessing = false; }, 3000);
    }
  }

  window.triggerManualReply = function() {
    const text = extractLatestIncomingMessage();
    if (text) {
      config.lastProcessedMsg = ''; // Reset to force re-evaluation
      processCustomerMessage(text);
    } else {
      alert('Không tìm thấy tin nhắn mới trong khung chat hiện tại. Vui lòng mở cuộc trò chuyện với khách hàng!');
    }
  };

  // 4. OBSERVE AND POLL CHAT CONTAINER ON CHAT.ZALO.ME
  function setupMessageMonitoring() {
    // A. Mutation Observer
    const observer = new MutationObserver(() => {
      const text = extractLatestIncomingMessage();
      if (text && text !== config.lastProcessedMsg) {
        processCustomerMessage(text);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // B. Safe Polling Loop (Every 2 seconds) as bulletproof fallback
    setInterval(() => {
      const text = extractLatestIncomingMessage();
      if (text && text !== config.lastProcessedMsg && !isProcessing) {
        processCustomerMessage(text);
      }
    }, 2000);
  }

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    setupMessageMonitoring();
  }, 1500);

})();
