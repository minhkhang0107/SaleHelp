// ==============================================================================
// SALEHELP REAL MULTI-CHANNEL PROXY & WEBHOOK SERVER (NODE.JS)
// ==============================================================================
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'web_dist');

// Read .env or .env.example
let GEMINI_API_KEY = '';
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');
const targetEnv = fs.existsSync(envPath) ? envPath : (fs.existsSync(envExamplePath) ? envExamplePath : null);

if (targetEnv) {
  const envContent = fs.readFileSync(targetEnv, 'utf8');
  const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
  if (match && match[1]) {
    GEMINI_API_KEY = match[1].trim();
  }
}

// SSE Clients for Realtime Webhook & Action events
let sseClients = [];

function sendSSEEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => {
    try {
      res.write(payload);
    } catch (e) {}
  });
}

// Helper to make HTTPS requests
function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS & Private Network Access Headers for Chrome Extension & Web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true'
    });
    res.end();
    return;
  }

  // 1. SSE Realtime Event Stream
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(': connected\n\n');
    sseClients.push(res);

    sendSSEEvent('action_log', {
      source: 'SaleHelp Server',
      type: 'CLIENT_CONNECTED',
      detail: `Client connected to live SSE stream (Total clients: ${sseClients.length})`,
      time: new Date().toLocaleTimeString()
    });

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // 2. Real Zalo OA Token Swap Proxy
  if (pathname === '/api/zalo/oauth/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const secretKey = payload.secretKey || req.headers['secret_key'] || '';

        const postParams = new URLSearchParams({
          app_id: payload.appId || '',
          grant_type: payload.grantType || 'authorization_code',
          code: payload.code || '',
          code_verifier: payload.codeVerifier || ''
        });

        if (payload.refreshToken) {
          postParams.set('refresh_token', payload.refreshToken);
        }

        const options = {
          hostname: 'oauth.zaloapp.com',
          path: '/v4/oa/access_token',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'secret_key': secretKey,
            'Content-Length': Buffer.byteLength(postParams.toString())
          }
        };

        const result = await makeHttpsRequest(options, postParams.toString());

        sendSSEEvent('action_log', {
          source: 'Zalo OAuth Proxy',
          type: 'OAUTH_TOKEN_EXCHANGE',
          detail: `Exchanged token for App ID: ${payload.appId}`,
          status: result.status === 200 ? 'SUCCESS' : 'ERROR',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: -1, message: err.message }));
      }
    });
    return;
  }

  // 3. Real Zalo OA Send Message Proxy
  if (pathname === '/api/zalo/message' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const accessToken = payload.accessToken || req.headers['access_token'] || '';

        const zaloPayload = {
          recipient: {
            user_id: payload.userId
          },
          message: {
            text: payload.text
          }
        };

        const postBody = JSON.stringify(zaloPayload);
        const options = {
          hostname: 'openapi.zalo.me',
          path: '/v2.0/oa/message',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': accessToken,
            'Content-Length': Buffer.byteLength(postBody)
          }
        };

        const result = await makeHttpsRequest(options, postBody);

        sendSSEEvent('action_log', {
          source: 'Zalo OA OpenAPI',
          type: 'SEND_MESSAGE_DISPATCH',
          detail: `Sent to user ${payload.userId}: "${payload.text?.substring(0, 30)}..."`,
          status: 'HTTP ' + result.status,
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: -1, message: err.message }));
      }
    });
    return;
  }

  // 4. Real Gemini AI Chat Generation (With Multi-Turn History Memory)
  if (pathname === '/api/gemini/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const apiKey = payload.apiKey || GEMINI_API_KEY;
        const model = payload.model || 'gemini-3.6-flash';
        const prompt = payload.prompt || '';
        const systemInstruction = payload.systemInstruction || '';

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }));
          return;
        }

        let geminiBody = {};
        if (payload.contents && Array.isArray(payload.contents)) {
          geminiBody = {
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            contents: payload.contents
          };
        } else if (payload.history && Array.isArray(payload.history)) {
          const contents = [];
          payload.history.forEach(h => {
            contents.push({
              role: h.role === 'user' ? 'user' : 'model',
              parts: [{ text: h.text }]
            });
          });
          if (prompt) {
            contents.push({
              role: 'user',
              parts: [{ text: prompt }]
            });
          }
          geminiBody = {
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            contents: contents
          };
        } else {
          geminiBody = {
            contents: [
              {
                parts: [{ text: (systemInstruction ? `[SYSTEM CONTEXT & KNOWLEDGE]\n${systemInstruction}\n\n[USER QUERY]\n` : '') + prompt }]
              }
            ]
          };
        }

        const postData = JSON.stringify(geminiBody);
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const result = await makeHttpsRequest(options, postData);

        // Broadcast action to Dashboard
        sendSSEEvent('action_log', {
          source: req.headers['origin'] ? 'Chrome Extension (Zalo Cá Nhân)' : 'SaleHelp Web App',
          type: 'GEMINI_AI_REPLY_GENERATED',
          detail: `User query: "${prompt.substring(0, 35)}..." ➔ Model: ${model}`,
          status: result.status === 200 ? 'SUCCESS 200' : 'ERROR ' + result.status,
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4b. Skills & Prompt Management API
  if (pathname === '/api/skills' && req.method === 'GET') {
    const skillsPath = path.join(__dirname, 'skills_config.json');
    let data = { activeSkillId: 'tour_closing_pro', skills: [] };
    if (fs.existsSync(skillsPath)) {
      try { data = JSON.parse(fs.readFileSync(skillsPath, 'utf8')); } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/skills/active' && req.method === 'GET') {
    const skillsPath = path.join(__dirname, 'skills_config.json');
    let data = { activeSkillId: 'tour_closing_pro', skills: [] };
    if (fs.existsSync(skillsPath)) {
      try { data = JSON.parse(fs.readFileSync(skillsPath, 'utf8')); } catch (e) {}
    }
    const active = data.skills.find(s => s.id === data.activeSkillId) || data.skills[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(active || {}));
    return;
  }

  if (pathname === '/api/skills/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const skillsPath = path.join(__dirname, 'skills_config.json');
        fs.writeFileSync(skillsPath, JSON.stringify(payload, null, 2), 'utf8');

        sendSSEEvent('action_log', {
          source: 'SaleHelp Dashboard',
          type: 'SKILL_PROMPT_UPDATED',
          detail: `Active Skill: "${payload.activeSkillId}" updated & persisted`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Skill configuration saved successfully!' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/skills/set-active' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const skillsPath = path.join(__dirname, 'skills_config.json');
        let data = { activeSkillId: 'tour_closing_pro', skills: [] };
        if (fs.existsSync(skillsPath)) {
          data = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
        }
        data.activeSkillId = payload.skillId;
        fs.writeFileSync(skillsPath, JSON.stringify(data, null, 2), 'utf8');

        sendSSEEvent('action_log', {
          source: 'SaleHelp Dashboard',
          type: 'ACTIVE_SKILL_CHANGED',
          detail: `Switched active skill to: ${payload.skillId}`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, activeSkillId: data.activeSkillId }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4c. Tours Knowledge Base (Live RAG Store) API
  if (pathname === '/api/tours' && req.method === 'GET') {
    const toursPath = path.join(__dirname, 'tours_config.json');
    let data = [];
    if (fs.existsSync(toursPath)) {
      try { data = JSON.parse(fs.readFileSync(toursPath, 'utf8')); } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/tours/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '[]');
        const toursPath = path.join(__dirname, 'tours_config.json');
        fs.writeFileSync(toursPath, JSON.stringify(payload, null, 2), 'utf8');

        sendSSEEvent('action_log', {
          source: 'SaleHelp Dashboard',
          type: 'TOURS_KNOWLEDGE_UPDATED',
          detail: `Tours database updated (${Array.isArray(payload) ? payload.length : 0} tours)`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 4d. Persona Configuration API
  if (pathname === '/api/persona' && req.method === 'GET') {
    const personaPath = path.join(__dirname, 'persona_config.json');
    let data = { name: 'Nguyễn Văn A', title: 'Chuyên viên tư vấn Tour Chuyên nghiệp (5 năm EXP)', tone: 'Lịch sự, nhiệt tình, tư vấn chi tiết lịch trình, xưng em gọi anh/chị' };
    if (fs.existsSync(personaPath)) {
      try { data = JSON.parse(fs.readFileSync(personaPath, 'utf8')); } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/persona/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const personaPath = path.join(__dirname, 'persona_config.json');
        fs.writeFileSync(personaPath, JSON.stringify(payload, null, 2), 'utf8');

        sendSSEEvent('action_log', {
          source: 'SaleHelp Dashboard',
          type: 'PERSONA_UPDATED',
          detail: `Persona updated: ${payload.name} (${payload.title})`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, persona: payload }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Real Telegram Send & Poll
  if (pathname === '/api/telegram/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const botToken = payload.botToken;
        const chatId = payload.chatId;
        const text = payload.text;

        const postData = JSON.stringify({ chat_id: chatId, text: text });
        const options = {
          hostname: 'api.telegram.org',
          path: `/bot${botToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const result = await makeHttpsRequest(options, postData);

        sendSSEEvent('action_log', {
          source: 'Telegram Bot API',
          type: 'TELEGRAM_MESSAGE_SENT',
          detail: `To Chat ID ${chatId}: "${text?.substring(0, 30)}..."`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // 6. Real Facebook Send Message
  if (pathname === '/api/facebook/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const pageToken = payload.pageToken;
        const recipientId = payload.recipientId;
        const text = payload.text;

        const postData = JSON.stringify({
          recipient: { id: recipientId },
          message: { text: text }
        });

        const options = {
          hostname: 'graph.facebook.com',
          path: `/v19.0/me/messages?access_token=${pageToken}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const result = await makeHttpsRequest(options, postData);

        sendSSEEvent('action_log', {
          source: 'Meta Graph API',
          type: 'FACEBOOK_MESSENGER_SENT',
          detail: `To recipient ${recipientId}: "${text?.substring(0, 30)}..."`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(result.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 7. Real Webhook Receiver (Zalo / Meta / Telegram)
  if (pathname === '/webhook/zalo' || pathname === '/api/webhook/zalo') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const sig = req.headers['x-zevent-signature'] || '';
        const parsed = JSON.parse(body || '{}');

        // Broadcast to connected web clients via SSE
        sendSSEEvent('webhook_received', {
          event: parsed,
          signature: sig,
          timestamp: Date.now()
        });

        sendSSEEvent('action_log', {
          source: 'Zalo Webhook Ingest',
          type: 'WEBHOOK_EVENT_INGESTED',
          detail: `Event: ${parsed.event_name || 'unknown'} from sender ${parsed.sender?.id || 'anonymous'}`,
          status: '200 OK',
          time: new Date().toLocaleTimeString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 0, message: 'Webhook received successfully' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: -1, message: 'Invalid payload' }));
      }
    });
    return;
  }

  // 8. Static File Serving (web_dist/index.html etc.)
  let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading ' + pathname);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 SaleHelp Real Multi-Channel Proxy Server running at http://localhost:${PORT}/`);
  console.log(`• Real Zalo OA Proxy: POST http://localhost:${PORT}/api/zalo/oauth/token & /api/zalo/message`);
  console.log(`• Real Gemini AI Proxy: POST http://localhost:${PORT}/api/gemini/generate (Key loaded: ${GEMINI_API_KEY ? 'Yes' : 'No'})`);
  console.log(`• Real Telegram Proxy: POST http://localhost:${PORT}/api/telegram/send`);
  console.log(`• Real Webhook Ingest: POST http://localhost:${PORT}/webhook/zalo (SSE Live Stream: /api/events)`);
});
