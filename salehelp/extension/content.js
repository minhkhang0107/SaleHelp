// ==============================================================================
// SALEHELP ZALO AI COPILOT & MULTI-USER QUEUE CONTEXT MANAGER (V5 ENTERPRISE)
// Injected into https://chat.zalo.me/*
// ==============================================================================

(function() {
  console.log('🚀 [SaleHelp] AI Co-Pilot Extension v5 (Multi-User Queue & Isolated Context Memory) Loaded!');

  let config = {
    serverUrl: 'http://localhost:8080',
    autoReply: true,
    delaySeconds: 1.5,
    lastRepliedMap: {}, // { [contactName]: { lastText: '', timestamp: 0 } }
  };

  // Multi-user Isolated Conversation Memory Store
  // Format: { [contactName]: [ { role: 'user'|'model', text: '...' } ] }
  let contactMemoryStore = {};

  // Sequential Multi-User Queue
  // Array of { contactName, element, unreadCount, detectedMsg, timestamp }
  let processingQueue = [];
  let isQueueBusy = false;
  let currentActiveContact = '';

  // Load configuration from Chrome Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config', 'salehelp_memory'], (res) => {
      if (res.salehelp_config) {
        config = { ...config, ...res.salehelp_config };
        updateToggleState();
      }
      if (res.salehelp_memory) {
        contactMemoryStore = res.salehelp_memory;
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

  // 1. INJECT FLOATING WIDGET WITH QUEUE & CONTEXT DISPLAY
  function injectFloatingWidget() {
    if (document.getElementById('salehelp-ai-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'salehelp-ai-widget';
    widget.innerHTML = `
      <div class="minimized-icon" onclick="toggleWidgetMinimize(false)">🤖</div>
      <div class="widget-header">
        <div class="widget-title">
          <span>🤖 SaleHelp AI Co-Pilot v5</span>
        </div>
        <div class="widget-actions">
          <button class="widget-btn-icon" onclick="toggleWidgetMinimize(true)" title="Thu nhỏ">_</button>
        </div>
      </div>
      <div class="widget-body">
        <div class="widget-toggle-row">
          <span class="widget-toggle-label">⚡ Tự động xử lý Queue (Auto-Reply)</span>
          <label class="widget-switch">
            <input type="checkbox" id="salehelp-autoreply-toggle" ${config.autoReply ? 'checked' : ''} onchange="onAutoReplyToggle(this.checked)">
            <span class="widget-slider"></span>
          </label>
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
          <button class="btn-insert-send" id="salehelp-manual-btn" style="flex:1; padding:8px; font-size:11px;" onclick="triggerManualReply()">
            ⚡ Trả Lời Người Hiện Tại
          </button>
          <button class="btn-insert-only" style="padding:8px; font-size:11px;" onclick="copyLastAnswer()" title="Copy câu trả lời">
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

  let lastGeneratedAnswer = '';

  window.copyLastAnswer = function() {
    if (!lastGeneratedAnswer) {
      alert('Chưa có câu trả lời nào từ AI!');
      return;
    }
    navigator.clipboard.writeText(lastGeneratedAnswer);
    alert('📋 Đã copy câu trả lời AI vào Clipboard:\n\n' + lastGeneratedAnswer);
  };

  // 2. GET CURRENT ACTIVE CONTACT NAME FROM HEADER
  function getActiveContactName() {
    const headerTitleEl = document.querySelector('.header-title, .chat-title, .chat-name, div[data-id="header-name"], .conv-header__title, div[class*="header__title"], div[class*="title--name"]');
    if (headerTitleEl) {
      const name = headerTitleEl.innerText.trim().split('\n')[0];
      if (name) return name;
    }

    // Fallback: active item in sidebar
    const activeSidebarItem = document.querySelector('.conv-item.active, .chat-item.active, div[class*="conv-item--active"], div[class*="item--selected"]');
    if (activeSidebarItem) {
      const nameEl = activeSidebarItem.querySelector('.name, .conv-item__name, .title, div[class*="name"]');
      if (nameEl) return nameEl.innerText.trim();
    }

    return 'Khách hàng';
  }

  // 3. EXTRACT FULL CONVERSATION HISTORY FROM ACTIVE CHAT WINDOW
  function extractActiveChatHistory() {
    const chatViewArea = document.querySelector('#messageViewScroll') || 
                         document.querySelector('.chat-message-list') || 
                         document.querySelector('.chat-content') || 
                         document.body;

    const allBubbles = chatViewArea.querySelectorAll(
      '.chat-item, .msg-item, .message-view, .chat-message, .msg-view, .card--text, div[data-id], .bubble-content, div[class*="chat-item"]'
    );

    const history = [];
    const chatItems = Array.from(allBubbles).filter(el => el.offsetHeight > 0);

    // Collect last 10 messages
    const startIndex = Math.max(0, chatItems.length - 10);
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
        history.push({
          role: isMe ? 'model' : 'user',
          text: rawText
        });
      }
    }

    return history;
  }

  // 4. DETECT LATEST UNREPLIED INCOMING MESSAGE IN ACTIVE CHAT
  function detectLastIncomingMessageInActiveChat() {
    const history = extractActiveChatHistory();
    if (history.length === 0) return null;

    // Check if the VERY LAST message in history is from 'user' (customer)
    const lastMsg = history[history.length - 1];
    if (lastMsg.role === 'user') {
      return lastMsg.text;
    }
    return null;
  }

  // 5. BULLETPROOF ZALO INPUT & SEND SUBMISSION
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

    // Selection range & native execCommand
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
      if (statusEl) statusEl.innerText = '⚡ Đang bấm Gửi tin nhắn...';

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
            statusEl.innerText = `✅ Đã gửi cho "${currentActiveContact}" lúc ${new Date().toLocaleTimeString()}!`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
          }
        }, 200);
      }, 400);
    }

    return true;
  }

  // 6. PROCESS MESSAGE WITH ISOLATED CONTEXT & GEMINI AI
  async function processContactMessage(contactName, userText, isManual = false) {
    if (!userText || !contactName) return;

    // Check if already replied recently
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
      statusEl.innerText = `🤖 Gemini AI đang trả lời [${contactName}]...`;
    }

    // 1. Get isolated conversation history for this specific contact
    const activeHistory = extractActiveChatHistory();
    contactMemoryStore[contactName] = activeHistory;
    saveMemoryToStorage();

    // 2. Prepare History Context for Gemini API
    const historyPayload = activeHistory.slice(0, activeHistory.length - 1); // exclude last query

    try {
      const sysPrompt = `Bạn là chuyên viên tư vấn Tour Du Lịch chuyên nghiệp, lịch sự, xưng em gọi anh/chị.
Khách hàng đang trò chuyện tên là: "${contactName}".
Bạn PHẢI ghi nhớ toàn bộ nội dung lịch sử cuộc trò chuyện trước đó của khách hàng này để trả lời chính xác, liền mạch, không hỏi lại những gì khách đã cung cấp, và không nhầm lẫn với khách hàng khác.
Thông tin tour có sẵn:
- Tour Đà Nẵng 3N2Đ: 5,990,000đ (Bao gồm vé máy bay + khách sạn 4 sao).
- Tour Phú Quốc 4N3Đ: 7,500,000đ (Bao gồm resort + vé máy bay + ăn sáng).
- Tour Nha Trang 3N2Đ: 4,800,000đ.
Hãy trả lời thân thiện, nhiệt tình, tư vấn chi tiết lịch trình và giải đáp đúng câu hỏi hiện tại.`;

      const res = await fetch(`${config.serverUrl}/api/gemini/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          history: historyPayload,
          systemInstruction: sysPrompt,
          model: 'gemini-3.6-flash'
        })
      });

      const data = await res.json();
      let aiReply = '';
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        aiReply = data.candidates[0].content.parts[0].text;
      } else {
        aiReply = `Dạ em chào anh/chị! Em là nhân viên tư vấn du lịch. Về câu hỏi của anh/chị, em xin gửi thông tin chi tiết lịch trình và giá tour ưu đãi tốt nhất ạ!`;
      }

      lastGeneratedAnswer = aiReply;

      // Update memory store with AI's reply
      contactMemoryStore[contactName].push({
        role: 'model',
        text: aiReply
      });
      saveMemoryToStorage();

      // Auto Send into Zalo Web input box
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

  window.triggerManualReply = function() {
    const contact = getActiveContactName();
    const text = detectLastIncomingMessageInActiveChat();
    if (contact && text) {
      processContactMessage(contact, text, true);
    } else {
      alert(`Không tìm thấy tin nhắn cần trả lời trong cuộc trò chuyện với "${contact}"!`);
    }
  };

  // 7. MULTI-USER QUEUE SCANNER (Scans left sidebar for other incoming chats)
  function scanSidebarForIncomingUsers() {
    const sidebarItems = document.querySelectorAll(
      '#conversationList .conv-item, .chat-item-list .chat-item, div[class*="conv-item"], div[class*="item--contact"]'
    );

    if (!sidebarItems || sidebarItems.length === 0) return;

    sidebarItems.forEach(item => {
      // Find contact name in sidebar item
      const nameEl = item.querySelector('.name, .conv-item__name, .title, div[class*="name"]');
      const contactName = nameEl ? nameEl.innerText.trim().split('\n')[0] : '';
      if (!contactName) return;

      // Check if this sidebar item has an unread badge
      const unreadBadge = item.querySelector(
        '.badge, .unread, .dot-unread, div[class*="unread"], div[class*="badge"], span[class*="badge"], .count'
      );
      const isUnread = unreadBadge !== null && unreadBadge.offsetHeight > 0;

      // If this contact is NOT current active contact and has unread messages
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

  // 8. QUEUE WORKER: SEQUENTIALLY SWITCH TO NEXT USER IN QUEUE
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
      // 1. Click on sidebar contact item
      if (nextUser.element) {
        nextUser.element.click();
      }

      // 2. Wait 800ms for chat view to fully load
      await new Promise(r => setTimeout(r, 800));

      currentActiveContact = getActiveContactName();
      const detectedMsg = detectLastIncomingMessageInActiveChat();

      if (detectedMsg) {
        await processContactMessage(currentActiveContact, detectedMsg, false);
      }

      // 3. Wait for send delay before moving to next person
      await new Promise(r => setTimeout(r, (config.delaySeconds + 1.5) * 1000));
    } catch (e) {
      console.error('[SaleHelp] Lỗi khi xử lý hàng đợi:', e);
    } finally {
      isQueueBusy = false;
    }
  }

  // 9. MAIN HEARTBEAT LOOP (Runs every 1.5s)
  function startHeartbeatLoop() {
    setInterval(() => {
      currentActiveContact = getActiveContactName();

      const activeBadge = document.getElementById('salehelp-active-contact-badge');
      const detectedMsgEl = document.getElementById('salehelp-detected-msg');
      const manualBtn = document.getElementById('salehelp-manual-btn');

      if (activeBadge) activeBadge.innerText = currentActiveContact;

      // 1. Check active chat unreplied message
      const unrepliedMsg = detectLastIncomingMessageInActiveChat();
      if (unrepliedMsg) {
        if (detectedMsgEl) detectedMsgEl.innerText = `"${unrepliedMsg.substring(0, 30)}..."`;
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời: "${unrepliedMsg.substring(0, 12)}..."`;

        // If Auto-Reply is enabled and not busy
        if (config.autoReply && !isQueueBusy) {
          processContactMessage(currentActiveContact, unrepliedMsg, false);
        }
      } else {
        if (detectedMsgEl) detectedMsgEl.innerText = 'Đã trả lời xong';
        if (manualBtn) manualBtn.innerText = `⚡ Trả Lời [${currentActiveContact.substring(0, 10)}]`;
      }

      // 2. Scan sidebar for other users (User B, User C)
      scanSidebarForIncomingUsers();

      // 3. If current chat is done and queue has pending users, process next
      if (!unrepliedMsg && processingQueue.length > 0 && !isQueueBusy && config.autoReply) {
        processNextUserInQueue();
      }

    }, 1500);
  }

  // Initialize
  setTimeout(() => {
    injectFloatingWidget();
    startHeartbeatLoop();
  }, 1000);

})();
