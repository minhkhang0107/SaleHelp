// ==============================================================================
// SALEHELP EXTENSION POPUP SCRIPT
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const autoReplyCheck = document.getElementById('auto-reply-check');
  const serverUrlInput = document.getElementById('server-url');
  const delaySelect = document.getElementById('delay-select');
  const saveBtn = document.getElementById('save-btn');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  const openZaloBtn = document.getElementById('open-zalo-btn');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');

  // Load configuration
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['salehelp_config'], (res) => {
      if (res.salehelp_config) {
        autoReplyCheck.checked = res.salehelp_config.autoReply !== false;
        serverUrlInput.value = res.salehelp_config.serverUrl || 'http://localhost:8080';
        delaySelect.value = res.salehelp_config.delaySeconds || '2';
      }
      checkStatus(serverUrlInput.value);
    });
  } else {
    checkStatus('http://localhost:8080');
  }

  async function checkStatus(url) {
    try {
      const res = await fetch(`${url}/api/gemini/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'ping', model: 'gemini-3.6-flash' })
      });
      statusBadge.style.background = '#DCFCE7';
      statusBadge.style.color = '#166534';
      statusText.innerText = 'Server & Gemini AI Sẵn Sàng';
    } catch (e) {
      statusBadge.style.background = '#FEE2E2';
      statusBadge.style.color = '#991B1B';
      statusText.innerText = 'Chưa kết nối Server (:8080)';
    }
  }

  saveBtn.addEventListener('click', () => {
    const newConfig = {
      autoReply: autoReplyCheck.checked,
      serverUrl: serverUrlInput.value.trim() || 'http://localhost:8080',
      delaySeconds: parseInt(delaySelect.value, 10) || 2
    };

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ salehelp_config: newConfig }, () => {
        alert('✅ Đã lưu cấu hình SaleHelp Extension thành công!');
        checkStatus(newConfig.serverUrl);
      });
    } else {
      alert('✅ Đã lưu cấu hình!');
    }
  });

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: serverUrlInput.value || 'http://localhost:8080' });
  });

  openZaloBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://chat.zalo.me' });
  });
});
