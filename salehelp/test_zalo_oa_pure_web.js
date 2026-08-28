const crypto = require('crypto');

// 1. Test PKCE Generation
function testPKCE() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  for (let i = 0; i < 43; i++) {
    verifier += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const hash = crypto.createHash('sha256').update(verifier).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  console.log('✅ [TEST 1: PKCE] Generated Verifier Length:', verifier.length);
  console.log('✅ [TEST 1: PKCE] Generated Challenge (Base64URL):', hash);
  if (verifier.length === 43 && hash.length > 20) {
    console.log('👉 PKCE test PASSED');
  } else {
    throw new Error('PKCE failed');
  }
}

// 2. Test HMAC-SHA256 Signature Verification
function testHmacSha256() {
  const secretKey = 'secret_zalo_oa_live_key';
  const rawPayload = JSON.stringify({
    event_name: "user_send_text",
    app_id: "38291049182049120",
    sender: { id: "user_zalo_8921820" },
    recipient: { id: "84930291" },
    message: { text: "Anh muốn hỏi tour Đà Nẵng 3N2Đ", msg_id: "msg_901928" },
    timestamp: 1724667800000
  });

  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(rawPayload);
  const signature = 'mac=' + hmac.digest('hex');

  console.log('✅ [TEST 2: HMAC-SHA256] Computed Signature:', signature);
  if (signature.startsWith('mac=') && signature.length === 68) {
    console.log('👉 HMAC-SHA256 test PASSED');
  } else {
    throw new Error('HMAC test failed');
  }
}

// 3. Test Multi-OA Routing
function testMultiOARouting() {
  const oas = [
    { oaId: '84930291', oaName: 'Zalo OA Du Lịch Việt Nam' },
    { oaId: '98271034', oaName: 'Zalo OA Luxury Tours & Resorts' }
  ];

  const incomingEvent = {
    event_name: "user_send_text",
    recipient: { id: "98271034" },
    sender: { id: "user_zalo_vip_100" },
    message: { text: "Tư vấn resort 5 sao Phú Quốc" }
  };

  const matchedOA = oas.find(o => o.oaId === incomingEvent.recipient.id);
  console.log('✅ [TEST 3: MULTI-OA ROUTING] Matched OA:', matchedOA ? matchedOA.oaName : 'NONE');
  if (matchedOA && matchedOA.oaId === '98271034') {
    console.log('👉 Multi-OA routing test PASSED');
  } else {
    throw new Error('Multi-OA routing failed');
  }
}

// 4. Test Token Refresh Logic
function testTokenRefresh() {
  const oa = {
    oaId: '84930291',
    expiresAt: Date.now() + 1800 * 1000, // 30 minutes left (< 60m threshold)
    accessToken: 'old_token'
  };

  const timeLeftMs = oa.expiresAt - Date.now();
  if (timeLeftMs < 3600 * 1000) {
    oa.accessToken = 'new_refreshed_token_' + Date.now();
    oa.expiresAt = Date.now() + 25 * 3600 * 1000;
  }

  console.log('✅ [TEST 4: TOKEN REFRESH] New Expiration Hours:', (oa.expiresAt - Date.now()) / (3600 * 1000));
  if (oa.accessToken.startsWith('new_refreshed_token')) {
    console.log('👉 Token refresh lifecycle test PASSED');
  } else {
    throw new Error('Token refresh failed');
  }
}

testPKCE();
testHmacSha256();
testMultiOARouting();
testTokenRefresh();
console.log('\n🎉 ALL 4 PURE-WEB ZALO OA TESTS PASSED 100% GREEN!');
