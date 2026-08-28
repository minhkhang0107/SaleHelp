// ==============================================================================
// SALEHELP CHROME EXTENSION BACKGROUND SERVICE WORKER (MANIFEST V3)
// ==============================================================================

console.log('[SaleHelp Background Service Worker] Initialized.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'api_request') {
    const url = request.url;
    const options = request.options || {};

    fetch(url, options)
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = await res.text();
        }
        sendResponse({ ok: res.ok, status: res.status, data: data });
      })
      .catch((err) => {
        console.error('[SaleHelp Background] Fetch Error:', err);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep message channel open for async sendResponse
  }
});
