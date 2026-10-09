const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createProfileStore,
  ProfileError,
  PROFILE_TEMPLATES,
  normalizeProfile,
  validateProfile
} = require('../profile_store.js');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'salehelp-'));
}

test('migration with no legacy files → 3 profiles, active sales_tour, file written', () => {
  const dir = createTempDir();
  try {
    const store = createProfileStore({ dir });
    const { activeProfileId, profiles } = store.load();

    assert.equal(activeProfileId, 'sales_tour');
    assert.equal(profiles.length, 3);

    const ids = profiles.map(p => p.id);
    assert.deepEqual(ids, ['sales_tour', 'work', 'dating']);

    const filePath = path.join(dir, 'profiles_config.json');
    assert.equal(fs.existsSync(filePath), true);

    const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(persisted.activeProfileId, 'sales_tour');
    assert.equal(persisted.profiles.length, 3);

    const salesTour = profiles.find(p => p.id === 'sales_tour');
    assert.deepEqual(salesTour.skills, []);
    assert.equal(salesTour.activeSkillId, '');
    assert.equal(salesTour.name, '💼 Sale Tour Du Lịch');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('migration with legacy persona_config.json + skills_config.json → sales_tour gets that persona/skills/activeSkillId', () => {
  const dir = createTempDir();
  try {
    const legacyPersona = {
      name: 'Nguyễn Tour Guide',
      title: 'Trưởng phòng Sales Tour (8 năm EXP)',
      tone: 'Tận tình, chu đáo'
    };
    const legacySkills = {
      activeSkillId: 'vip_closing',
      skills: [
        {
          id: 'vip_closing',
          name: 'Chốt đơn VIP',
          category: 'Sales',
          description: 'Chốt đơn tour cao cấp',
          systemPrompt: 'System prompt for VIP'
        },
        {
          id: 'general_faq',
          name: 'Hỏi đáp chung',
          category: 'Support',
          description: 'Hỗ trợ chung',
          systemPrompt: 'System prompt for FAQ'
        }
      ]
    };

    fs.writeFileSync(path.join(dir, 'persona_config.json'), JSON.stringify(legacyPersona), 'utf8');
    fs.writeFileSync(path.join(dir, 'skills_config.json'), JSON.stringify(legacySkills), 'utf8');

    const store = createProfileStore({ dir });
    const { activeProfileId, profiles } = store.load();

    assert.equal(activeProfileId, 'sales_tour');
    const salesTour = profiles.find(p => p.id === 'sales_tour');

    assert.equal(salesTour.persona.name, 'Nguyễn Tour Guide');
    assert.equal(salesTour.persona.title, 'Trưởng phòng Sales Tour (8 năm EXP)');
    assert.equal(salesTour.persona.tone, 'Tận tình, chu đáo');

    assert.equal(salesTour.activeSkillId, 'vip_closing');
    assert.equal(salesTour.skills.length, 2);
    assert.equal(salesTour.skills[0].id, 'vip_closing');
    assert.equal(salesTour.skills[1].id, 'general_faq');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt profiles_config.json → load throws, file unchanged', () => {
  const dir = createTempDir();
  try {
    const filePath = path.join(dir, 'profiles_config.json');
    const corruptContent = '{ "activeProfileId": "corrupt", unclosed json content...';
    fs.writeFileSync(filePath, corruptContent, 'utf8');

    const store = createProfileStore({ dir });
    assert.throws(() => {
      store.load();
    });

    const currentContent = fs.readFileSync(filePath, 'utf8');
    assert.equal(currentContent, corruptContent);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('setActive unknown → 404; setActive valid → getActive returns it and survives a new store instance (persistence)', () => {
  const dir = createTempDir();
  try {
    const store1 = createProfileStore({ dir });
    store1.load();

    assert.throws(() => {
      store1.setActive('nonexistent_profile');
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 404);
      return true;
    });

    const active = store1.setActive('work');
    assert.equal(active.id, 'work');
    assert.equal(store1.getActive().id, 'work');

    const store2 = createProfileStore({ dir });
    assert.equal(store2.getActive().id, 'work');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upsert new valid profile; upsert invalid (bad id, temperature 5, duplicate skill ids) → 400 with errors', () => {
  const dir = createTempDir();
  try {
    const store = createProfileStore({ dir });
    store.load();

    const created = store.upsert({
      id: 'customer_care',
      name: 'Chăm sóc khách hàng',
      description: 'Hỗ trợ khách hàng sau bán',
      generation: { temperature: 0.5, topP: 0.8 }
    });
    assert.equal(created.id, 'customer_care');
    assert.equal(store.get('customer_care').name, 'Chăm sóc khách hàng');

    assert.throws(() => {
      store.upsert({
        id: 'INVALID ID WITH SPACES',
        name: 'Tên hợp lệ'
      });
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 400);
      assert(Array.isArray(err.errors));
      assert(err.errors.some(e => e.includes('ID hồ sơ không hợp lệ')));
      return true;
    });

    assert.throws(() => {
      store.upsert({
        id: 'high_temp_profile',
        name: 'Tên hồ sơ',
        generation: { temperature: 5, topP: 0.8 }
      });
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 400);
      assert(err.errors.some(e => e.includes('temperature')));
      return true;
    });

    assert.throws(() => {
      store.upsert({
        id: 'dup_skills_profile',
        name: 'Tên hồ sơ',
        skills: [
          { id: 'skill_repeat', name: 'Skill 1', systemPrompt: 'Test' },
          { id: 'skill_repeat', name: 'Skill 2', systemPrompt: 'Test' }
        ]
      });
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 400);
      assert(err.errors.some(e => e.includes('trùng lặp')));
      return true;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('normalize: knowledge.enabled=false forces required/strictGuard false; invalid activeSkillId falls back to first skill', () => {
  const norm1 = normalizeProfile({
    knowledge: {
      enabled: false,
      required: true,
      strictGuard: true
    }
  });
  assert.equal(norm1.knowledge.enabled, false);
  assert.equal(norm1.knowledge.required, false);
  assert.equal(norm1.knowledge.strictGuard, false);

  const norm2 = normalizeProfile({
    skills: [
      { id: 'skill_first', name: 'Kỹ năng 1', systemPrompt: 'P1' },
      { id: 'skill_second', name: 'Kỹ năng 2', systemPrompt: 'P2' }
    ],
    activeSkillId: 'non_existent_skill_id'
  });
  assert.equal(norm2.activeSkillId, 'skill_first');

  const norm3 = normalizeProfile({
    skills: [
      { id: 'skill_only', name: 'Kỹ năng duy nhất', systemPrompt: 'P' }
    ],
    activeSkillId: ''
  });
  assert.equal(norm3.activeSkillId, 'skill_only');

  const norm4 = normalizeProfile({
    id: 'test_drop_fields',
    name: 'Test Drop',
    unknownProperty: 'should be dropped',
    persona: {
      name: 'Name',
      extraPersonaProp: 'drop me'
    }
  });
  assert.equal(norm4.unknownProperty, undefined);
  assert.equal(norm4.persona.extraPersonaProp, undefined);
});

test('remove active → 409; remove last → 409; remove other → ok', () => {
  const dir = createTempDir();
  try {
    const store = createProfileStore({ dir });
    store.load();

    assert.throws(() => {
      store.remove('sales_tour');
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 409);
      assert(err.message.includes('kích hoạt'));
      return true;
    });

    assert.throws(() => {
      store.remove('nonexistent');
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 404);
      return true;
    });

    store.remove('dating');
    assert.throws(() => store.get('dating'), (err) => err.status === 404);
    assert.equal(store.list().profiles.length, 2);

    store.remove('work');
    assert.equal(store.list().profiles.length, 1);

    assert.throws(() => {
      store.remove('sales_tour');
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 409);
      return true;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('getPersona/savePersona and getSkills/saveSkills/setActiveSkill act on the active profile only', () => {
  const dir = createTempDir();
  try {
    const store = createProfileStore({ dir });
    store.load();

    assert.equal(store.getActive().id, 'sales_tour');

    const updatedTourPersona = store.savePersona({
      name: 'Hướng dẫn viên tour',
      title: 'Chuyên gia du lịch',
      tone: 'Vui vẻ'
    });
    assert.equal(updatedTourPersona.name, 'Hướng dẫn viên tour');
    assert.equal(store.getPersona().name, 'Hướng dẫn viên tour');

    const workProfileBefore = store.get('work');
    assert.notEqual(workProfileBefore.persona.name, 'Hướng dẫn viên tour');

    store.setActive('work');
    assert.equal(store.getActive().id, 'work');
    assert.notEqual(store.getPersona().name, 'Hướng dẫn viên tour');

    const updatedWorkPersona = store.savePersona({
      name: 'Quản lý dự án',
      title: 'PM',
      tone: 'Chính xác'
    });
    assert.equal(updatedWorkPersona.name, 'Quản lý dự án');
    assert.equal(store.getPersona().name, 'Quản lý dự án');

    store.setActive('sales_tour');
    assert.equal(store.getPersona().name, 'Hướng dẫn viên tour');

    const savedSkills = store.saveSkills({
      skills: [
        {
          id: 'tour_quote',
          name: 'Báo giá tour',
          category: 'Sales',
          description: 'Báo giá nhanh',
          systemPrompt: 'System prompt báo giá'
        },
        {
          id: 'tour_schedule',
          name: 'Lịch trình tour',
          category: 'Tư vấn',
          description: 'Gửi lịch trình',
          systemPrompt: 'System prompt lịch trình'
        }
      ],
      activeSkillId: 'tour_quote'
    });
    assert.equal(savedSkills.activeSkillId, 'tour_quote');
    assert.equal(savedSkills.skills.length, 2);

    const workSkills = store.get('work').skills;
    assert.equal(workSkills.length, 1);
    assert.equal(workSkills[0].id, 'work_assistant');

    store.setActiveSkill('tour_schedule');
    assert.equal(store.getSkills().activeSkillId, 'tour_schedule');

    assert.throws(() => {
      store.setActiveSkill('unregistered_skill');
    }, (err) => {
      assert(err instanceof ProfileError);
      assert.equal(err.status, 404);
      return true;
    });

    store.setActive('work');
    assert.equal(store.getSkills().activeSkillId, 'work_assistant');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no .tmp file is left after writes', () => {
  const dir = createTempDir();
  try {
    const store = createProfileStore({ dir });
    const tmpFile = path.join(dir, 'profiles_config.json.tmp');

    store.load();
    assert.equal(fs.existsSync(tmpFile), false);

    store.setActive('work');
    assert.equal(fs.existsSync(tmpFile), false);

    store.upsert({
      id: 'temporary_profile',
      name: 'Hồ sơ tạm'
    });
    assert.equal(fs.existsSync(tmpFile), false);

    store.savePersona({
      name: 'Persona Test'
    });
    assert.equal(fs.existsSync(tmpFile), false);

    store.saveSkills({
      skills: [
        {
          id: 'test_skill',
          name: 'Test skill',
          systemPrompt: 'Prompt'
        }
      ]
    });
    assert.equal(fs.existsSync(tmpFile), false);

    store.remove('temporary_profile');
    assert.equal(fs.existsSync(tmpFile), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('PROFILE_TEMPLATES are complete and valid', () => {
  assert.ok(PROFILE_TEMPLATES.sales_tour);
  assert.ok(PROFILE_TEMPLATES.work);
  assert.ok(PROFILE_TEMPLATES.dating);

  for (const key of ['sales_tour', 'work', 'dating']) {
    const template = PROFILE_TEMPLATES[key];
    const normalized = normalizeProfile(template);
    const errors = validateProfile(normalized);
    assert.deepEqual(errors, [], `Template ${key} should have no validation errors`);
  }

  assert.equal(PROFILE_TEMPLATES.sales_tour.name, '💼 Sale Tour Du Lịch');
  assert.equal(PROFILE_TEMPLATES.work.name, '🧑‍💼 Công Việc');
  assert.equal(PROFILE_TEMPLATES.dating.name, '💬 Trò Chuyện / Hẹn Hò');

  const workPrompt = PROFILE_TEMPLATES.work.skills[0].systemPrompt;
  assert(workPrompt.includes('{PERSONA_NAME}'));
  assert(workPrompt.includes('{PERSONA_TITLE}'));
  assert(workPrompt.includes('{PERSONA_TONE}'));
  assert(workPrompt.includes('{CUSTOMER_NAME}'));

  const datingPrompt = PROFILE_TEMPLATES.dating.skills[0].systemPrompt;
  assert(datingPrompt.includes('{PERSONA_NAME}'));
  assert(datingPrompt.includes('{PERSONA_TITLE}'));
  assert(datingPrompt.includes('{PERSONA_TONE}'));
  assert(datingPrompt.includes('{CUSTOMER_NAME}'));
});

test('validateProfile checks boundary constraints', () => {
  const base = normalizeProfile(PROFILE_TEMPLATES.sales_tour);

  assert.notEqual(validateProfile(null).length, 0);

  const longName = { ...base, name: 'a'.repeat(81) };
  assert(validateProfile(longName).some(e => e.includes('Tên hồ sơ')));

  const emptyName = { ...base, name: '   ' };
  assert(validateProfile(emptyName).some(e => e.includes('Tên hồ sơ')));

  const longDesc = { ...base, description: 'a'.repeat(301) };
  assert(validateProfile(longDesc).some(e => e.includes('Mô tả hồ sơ')));

  const longPersonaName = { ...base, persona: { ...base.persona, name: 'a'.repeat(501) } };
  assert(validateProfile(longPersonaName).some(e => e.includes('Tên persona')));

  const longSummary = { ...base, summaryPrompt: 'a'.repeat(5001) };
  assert(validateProfile(longSummary).some(e => e.includes('summaryPrompt')));

  const longFallback = { ...base, replies: { ...base.replies, fallback: 'a'.repeat(1001) } };
  assert(validateProfile(longFallback).some(e => e.includes('replies.fallback')));

  const invalidTopP = { ...base, generation: { ...base.generation, topP: 1.5 } };
  assert(validateProfile(invalidTopP).some(e => e.includes('topP')));

  const invalidNegativeTemp = { ...base, generation: { ...base.generation, temperature: -0.1 } };
  assert(validateProfile(invalidNegativeTemp).some(e => e.includes('temperature')));

  const invalidKnowledge = {
    ...base,
    knowledge: { enabled: false, required: true, strictGuard: false }
  };
  assert(validateProfile(invalidKnowledge).some(e => e.includes('knowledge')));
});
