const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'salehelp-srv-'));
process.env.SALEHELP_DATA_DIR = tempDir;

const { server } = require('../server.js');

let baseUrl = '';

before(async () => {
  await new Promise((resolve, reject) => {
    server.listen(0, (err) => {
      if (err) return reject(err);
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
});

test('GET /api/profiles returns 3 profiles with activeProfileId sales_tour and creates profiles_config.json in temp dir', async () => {
  const repoConfigPath = path.join(__dirname, '..', 'profiles_config.json');
  const readRepoConfig = () => (fs.existsSync(repoConfigPath) ? fs.readFileSync(repoConfigPath, 'utf8') : null);
  const repoConfigBefore = readRepoConfig();

  const res = await fetch(`${baseUrl}/api/profiles`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.activeProfileId, 'sales_tour');
  assert.equal(Array.isArray(data.profiles), true);
  assert.equal(data.profiles.length, 3);

  const tempConfigPath = path.join(tempDir, 'profiles_config.json');
  assert.equal(fs.existsSync(tempConfigPath), true);
  assert.equal(readRepoConfig(), repoConfigBefore);
});

test('GET /api/profiles/templates returns 3 items', async () => {
  const res = await fetch(`${baseUrl}/api/profiles/templates`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(Array.isArray(data), true);
  assert.equal(data.length, 3);
});

test('POST /api/profiles/set-active {profileId:"dating"} → 200; verify active profile, persona, and active skill', async () => {
  const setRes = await fetch(`${baseUrl}/api/profiles/set-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'dating' })
  });
  assert.equal(setRes.status, 200);
  const setData = await setRes.json();
  assert.equal(setData.success, true);
  assert.equal(setData.activeProfileId, 'dating');
  assert.equal(setData.profile.id, 'dating');

  const activeRes = await fetch(`${baseUrl}/api/profiles/active`);
  assert.equal(activeRes.status, 200);
  const activeData = await activeRes.json();
  assert.equal(activeData.id, 'dating');

  const personaRes = await fetch(`${baseUrl}/api/persona`);
  assert.equal(personaRes.status, 200);
  const personaData = await personaRes.json();
  assert.equal(personaData.name, 'David');

  const skillRes = await fetch(`${baseUrl}/api/skills/active`);
  assert.equal(skillRes.status, 200);
  const skillData = await skillRes.json();
  assert.equal(skillData.id, 'casual_chat');
  assert.equal(skillData.profileId, 'dating');
});

test('POST /api/profiles/set-active unknown → 404', async () => {
  const res = await fetch(`${baseUrl}/api/profiles/set-active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'non_existent_profile' })
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error);
});

test('POST /api/profiles/save invalid (id BAD ID) → 400 with non-empty errors; valid new profile → 200 and appears in list', async () => {
  const badRes = await fetch(`${baseUrl}/api/profiles/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'BAD ID', name: 'Tên không hợp lệ' })
  });
  assert.equal(badRes.status, 400);
  const badData = await badRes.json();
  assert.ok(badData.error);
  assert.ok(Array.isArray(badData.errors));
  assert.ok(badData.errors.length > 0);

  const newProfile = {
    id: 'customer_care',
    name: 'Chăm sóc khách hàng',
    description: 'Hỗ trợ khách hàng sau bán',
    persona: {
      name: 'Nguyễn CSKH',
      title: 'Tư vấn viên hỗ trợ',
      tone: 'Ân cần, chu đáo'
    },
    skills: [],
    activeSkillId: '',
    generation: { temperature: 0.5, topP: 0.8 }
  };

  const goodRes = await fetch(`${baseUrl}/api/profiles/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProfile)
  });
  assert.equal(goodRes.status, 200);
  const goodData = await goodRes.json();
  assert.equal(goodData.success, true);
  assert.equal(goodData.profile.id, 'customer_care');

  const listRes = await fetch(`${baseUrl}/api/profiles`);
  const listData = await listRes.json();
  const found = listData.profiles.find(p => p.id === 'customer_care');
  assert.ok(found);
  assert.equal(found.name, 'Chăm sóc khách hàng');
});

test('POST /api/profiles/delete of the active profile → 409; of the new profile → 200', async () => {
  const activeDeleteRes = await fetch(`${baseUrl}/api/profiles/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'dating' })
  });
  assert.equal(activeDeleteRes.status, 409);
  const activeDeleteData = await activeDeleteRes.json();
  assert.ok(activeDeleteData.error);

  const delRes = await fetch(`${baseUrl}/api/profiles/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'customer_care' })
  });
  assert.equal(delRes.status, 200);
  const delData = await delRes.json();
  assert.equal(delData.success, true);

  const listRes = await fetch(`${baseUrl}/api/profiles`);
  const listData = await listRes.json();
  assert.equal(listData.profiles.some(p => p.id === 'customer_care'), false);
});

test('POST with header Origin: https://evil.example → 403 (profiles/save and persona/save)', async () => {
  const profileSaveRes = await fetch(`${baseUrl}/api/profiles/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://evil.example'
    },
    body: JSON.stringify({ id: 'evil_profile', name: 'Evil' })
  });
  assert.equal(profileSaveRes.status, 403);
  const profileSaveData = await profileSaveRes.json();
  assert.equal(profileSaveData.error, 'Forbidden origin');

  const personaSaveRes = await fetch(`${baseUrl}/api/persona/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://evil.example'
    },
    body: JSON.stringify({ name: 'Hacked', title: 'Hacker', tone: 'Rude' })
  });
  assert.equal(personaSaveRes.status, 403);
  const personaSaveData = await personaSaveRes.json();
  assert.equal(personaSaveData.error, 'Forbidden origin');
});

test('POST /api/persona/save changes only the active profile\'s persona', async () => {
  const newPersona = {
    name: 'Thảo Nhi',
    title: 'Người tâm tình',
    tone: 'Ngọt ngào, sâu lắng'
  };

  const saveRes = await fetch(`${baseUrl}/api/persona/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPersona)
  });
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.equal(saveData.success, true);
  assert.equal(saveData.persona.name, 'Thảo Nhi');

  const activePersonaRes = await fetch(`${baseUrl}/api/persona`);
  const activePersona = await activePersonaRes.json();
  assert.equal(activePersona.name, 'Thảo Nhi');

  const listRes = await fetch(`${baseUrl}/api/profiles`);
  const listData = await listRes.json();
  const salesTour = listData.profiles.find(p => p.id === 'sales_tour');
  assert.equal(salesTour.persona.name, 'Nguyễn Văn A');
});

test('Invalid JSON body → 400', async () => {
  const res = await fetch(`${baseUrl}/api/profiles/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json'
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);

  const personaRes = await fetch(`${baseUrl}/api/persona/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ invalid json'
  });
  assert.equal(personaRes.status, 400);
  const personaData = await personaRes.json();
  assert.ok(personaData.error);
});
