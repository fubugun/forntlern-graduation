const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Level, sequelize, User, UserProfile, UserLevelSubmission, Badge, UserBadge } = require('./init-db');
const { validateLevel } = require('./validationEngine');
const { authRequired, JWT_SECRET } = require('./authMiddleware');

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadEnvFromFile(path.join(__dirname, '..', '.env'));

const app = express();
const PORT = process.env.PORT || 3000;
const collabRooms = new Map();
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

function canUseExternalAI() {
  return Boolean(AI_API_KEY);
}

function clipCode(text, maxLen = 1200) {
  const raw = String(text || '');
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}\n...`;
}

async function requestAIJson({ systemPrompt, userPrompt, temperature = 0.3 }) {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 请求失败(${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

function buildRuleBasedSolveHint(result) {
  let hint = '先从最小可运行版本开始：结构（HTML）-> 样式（CSS）-> 交互（JS）。';
  const checklist = [];
  if (!result.pass && result.errors.length > 0) {
    const first = result.errors[0];
    if (first.code === 'MISSING_TAG') {
      hint = '先补齐基础结构标签，再考虑样式。建议先写 `<h1>` / `<p>` 等必需标签。';
      checklist.push('确认页面中出现任务要求的标签（如 h1、p）');
      checklist.push('标签拼写全部小写，成对闭合');
    } else if (first.code === 'MISSING_SELECTOR') {
      hint = `优先检查元素选择器是否存在：${first.meta?.selector || ''}`;
      checklist.push('检查选择器字符串是否与 HTML 中的 id/class 完全一致');
      checklist.push('先在控制台打印 querySelector 结果是否为 null');
    } else if (first.code === 'CSS_REGEX_NOT_MATCH') {
      hint = '你的 CSS 关键属性可能没写完整，检查属性名、冒号、分号和属性值。';
      checklist.push('每条样式都加分号结束');
      checklist.push('属性值与题目要求保持一致');
    } else if (first.code === 'JS_REGEX_NOT_MATCH') {
      hint = '你的 JS 关键语句格式可能不匹配，先按任务示例写最短版本再扩展。';
      checklist.push('先写最短可用语句，例如 let/if/addEventListener');
      checklist.push('确保括号和引号是成对的');
    }
  } else if (result.pass) {
    hint = '这题已通过！建议继续挑战下一关，保持学习节奏。';
    checklist.push('可以继续下一关，或返回做一次复盘巩固');
  }
  return { hint, checklist };
}

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// 简单健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/collab/rooms/:roomId', authRequired, (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  const room = collabRooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }
  res.json(serializeRoom(room));
});

app.get('/api/collab/challenges', authRequired, (req, res) => {
  res.json(
    COLLAB_CHALLENGES.map((c, idx) => ({
      id: c.id,
      index: idx,
      title: c.title,
      description: c.description,
    }))
  );
});

app.post('/api/collab/room-code', authRequired, (req, res) => {
  const roomId = createRandomRoomCode();
  res.json({ roomId });
});

// ---------- 认证相关接口 ----------

// 注册
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  if (String(username || '').toLowerCase() === 'admin' && password !== '000000') {
    return res.status(400).json({ error: '注册失败，请检查账号或密码规则' });
  }

  const existing = await User.findOne({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: '该用户名已被占用' });
  }

  const hash = await bcrypt.hash(password, 10);
  const role = String(username || '').toLowerCase() === 'admin' ? 'admin' : 'student';
  const user = await User.create({ username, password: hash, role });

  const profile = await UserProfile.create({
    userId: user.id,
    name: username,
    exp: 0,
    level: 1,
    maxChapter: 1,
    maxOrder: 1,
    totalSolved: 0,
    totalExp: 0,
    totalStudySeconds: 0,
    currentLevelKey: null,
    currentLevelStartedAt: null,
    lastActiveAt: new Date(),
    struggleStats: '{}',
    solvedLevelKeys: '[]',
    lastLoginDate: new Date().toISOString().slice(0, 10),
    loginStreakDays: 1,
    aiHintCount: 0,
    aiHelpedPassCount: 0,
    aiHintTouchedKeys: '[]',
    collabSolvedKeys: '[]',
  });

  await awardBadgesForUser(user.id);

  const token = jwt.sign({ userId: user.id, username, role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: { id: user.id, username, role },
    profile,
  });
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  if (String(username || '').toLowerCase() === 'admin' && password !== '000000') {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  let user = await User.findOne({ where: { username } });
  if (!user) {
    if (String(username || '').toLowerCase() === 'admin' && password === '000000') {
      const adminHash = await bcrypt.hash('000000', 10);
      user = await User.create({ username: 'admin', password: adminHash, role: 'admin' });
    } else {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
  }

  if (String(username || '').toLowerCase() === 'admin') {
    // 强制 admin 密码统一为 000000
    const adminHash = await bcrypt.hash('000000', 10);
    user.password = adminHash;
    user.role = 'admin';
    await user.save();
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  let profile = await UserProfile.findOne({ where: { userId: user.id } });
  if (!profile) {
    profile = await UserProfile.create({
      userId: user.id,
      name: username,
      exp: 0,
      level: 1,
      maxChapter: 1,
      maxOrder: 1,
      totalSolved: 0,
      totalExp: 0,
      totalStudySeconds: 0,
      currentLevelKey: null,
      currentLevelStartedAt: null,
      lastActiveAt: new Date(),
      struggleStats: '{}',
      solvedLevelKeys: '[]',
      lastLoginDate: null,
      loginStreakDays: 0,
      aiHintCount: 0,
      aiHelpedPassCount: 0,
      aiHintTouchedKeys: '[]',
      collabSolvedKeys: '[]',
    });
  }

  updateLoginStreak(profile);
  await profile.save();
  await awardBadgesForUser(user.id);

  const token = jwt.sign({ userId: user.id, username, role: user.role || 'student' }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: { id: user.id, username, role: user.role || 'student' },
    profile,
  });
});

// 获取关卡列表（用于前端世界地图/关卡选择）
app.get('/api/levels', authRequired, async (req, res) => {
  const levels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['id', 'key', 'chapter', 'order', 'title', 'coreConcept'],
  });
  res.json(levels);
});

// 世界地图 & 进度：返回关卡 + 用户档案 + 每个关卡状态
app.get('/api/map', authRequired, async (req, res) => {
  try {
    const levels = await Level.findAll({
      order: [['chapter', 'ASC'], ['order', 'ASC']],
    });

    const profile = await getOrCreateProfile(req.user.userId, req.user.username);
    const changed = reconcileProfileWithCurrentPointer(profile, levels);
    if (changed) {
      await profile.save();
    }
    await awardBadgesForUser(profile.userId);
    const solvedSet = getSolvedLevelSet(profile);
    const currentUser = await User.findOne({ where: { id: req.user.userId }, attributes: ['role'] });
    const isAdminUser = currentUser?.role === 'admin';
    const firstUnsolvedIndex = getFirstUnsolvedIndex(levels, solvedSet);

    const mapLevels = levels.map((lvl, idx) => {
      let status = 'locked';
      if (isAdminUser && !solvedSet.has(lvl.key)) {
        status = 'current';
      } else if (solvedSet.has(lvl.key)) {
        status = 'completed';
      } else if (idx === firstUnsolvedIndex) {
        status = 'current';
      }

      return {
        id: lvl.id,
        key: lvl.key,
        chapter: lvl.chapter,
        order: lvl.order,
        title: lvl.title,
        coreConcept: lvl.coreConcept,
        status,
      };
    });

    res.json({
      profile,
      levels: mapLevels,
    });
  } catch (e) {
    console.error('map api error:', e.message);
    res.status(500).json({ error: '地图加载失败' });
  }
});

// 当前用户档案（用于前端启动后同步）
app.get('/api/me', authRequired, async (req, res) => {
  const user = await User.findOne({ where: { id: req.user.userId } });
  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  res.json({
    user: {
      id: req.user.userId,
      username: req.user.username,
      role: user?.role || 'student',
    },
    profile,
  });
});

// 获取单个关卡详细信息（任务书、初始代码等）
app.get('/api/levels/:key', authRequired, async (req, res) => {
  const key = req.params.key;
  const level = await Level.findOne({ where: { key } });
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }

  let npcDialogues = [];
  try {
    npcDialogues = level.npcDialogues ? JSON.parse(level.npcDialogues) : [];
  } catch (e) {
    npcDialogues = [];
  }

  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  const currentUser = await User.findOne({ where: { id: req.user.userId }, attributes: ['role'] });
  const isAdminUser = currentUser?.role === 'admin';
  const orderedLevels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['key', 'chapter', 'order'],
  });
  if (!isAdminUser && !canAccessLevel(profile, level.key, orderedLevels)) {
    return res.status(403).json({ error: '请先完成前一关再进入该关卡' });
  }
  await updateStudyProgress(profile, key);
  const submission = await UserLevelSubmission.findOne({
    where: { userId: req.user.userId, levelKey: key },
  });
  const savedCode = pickSavedCode(submission, level);

  res.json({
    id: level.id,
    key: level.key,
    chapter: level.chapter,
    order: level.order,
    title: level.title,
    coreConcept: level.coreConcept,
    taskDescription: level.taskDescription,
    taskMarkdown: level.taskMarkdown,
    starterHtml: level.starterHtml,
    starterCss: level.starterCss,
    starterJs: level.starterJs,
    savedCode,
    hasSavedSubmission: Boolean(savedCode && savedCode.trim()),
    codeExample: getCodeExampleForLevel(level),
    adminAnswer: isAdminUser ? getAdminAnswerForLevel(level) : '',
    npcDialogues,
  });
});

// 徽章列表（含当前用户已获得状态）
app.get('/api/rewards/badges', authRequired, async (req, res) => {
  const badges = await Badge.findAll({ order: [['id', 'ASC']] });
  const earned = await UserBadge.findAll({ where: { userId: req.user.userId } });
  const earnedSet = new Set(earned.map((x) => x.badgeId));

  res.json(
    badges.map((b) => ({
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      ruleType: b.ruleType,
      ruleValue: b.ruleValue,
      earned: earnedSet.has(b.id),
    }))
  );
});

// 排行榜：按 totalExp 与 level 排序
app.get('/api/leaderboard', authRequired, async (req, res) => {
  const currentUser = await User.findOne({ where: { id: req.user.userId }, attributes: ['role'] });
  const isAdminUser = currentUser?.role === 'admin';
  const rows = await UserProfile.findAll({
    include: [{ model: User, attributes: ['username', 'role'] }],
    order: [['totalExp', 'DESC'], ['level', 'DESC'], ['updatedAt', 'ASC']],
    limit: 60,
  });
  const filteredRows = isAdminUser ? rows : rows.filter((r) => r.User?.role !== 'admin');

  res.json(
    filteredRows.slice(0, 20).map((r, idx) => ({
      rank: idx + 1,
      username: r.User?.username || r.name || 'unknown',
      level: r.level,
      exp: r.exp,
      totalExp: r.totalExp || 0,
      totalSolved: r.totalSolved || 0,
      totalStudySeconds: r.totalStudySeconds || 0,
    }))
  );
});

// AI 解题提示（规则引擎版）
app.post('/api/ai/solve-hint', authRequired, async (req, res) => {
  const { levelKey, html, css, js } = req.body || {};
  const level = await Level.findOne({ where: { key: levelKey } });
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const result = await validateLevel(level, { html, css, js });
  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  profile.aiHintCount = (profile.aiHintCount || 0) + 1;
  const touchedSet = getAiHintTouchedSet(profile);
  touchedSet.add(level.key);
  profile.aiHintTouchedKeys = JSON.stringify([...touchedSet]);
  await profile.save();
  const fallback = buildRuleBasedSolveHint(result);
  let hint = fallback.hint;
  let checklist = fallback.checklist;

  if (canUseExternalAI()) {
    try {
      const ai = await requestAIJson({
        systemPrompt:
          '你是前端学习平台的 AI 导师。请用中文返回严格 JSON：{"hint":"...","checklist":["..."]}。hint 1-2 句，checklist 2-4 条，务必具体可执行。',
        userPrompt: JSON.stringify({
          task: {
            key: level.key,
            title: level.title,
            coreConcept: level.coreConcept,
            taskMarkdown: String(level.taskMarkdown || '').slice(0, 1200),
          },
          validateResult: {
            pass: result.pass,
            errors: result.errors.slice(0, 3),
          },
          userCode: {
            html: clipCode(html),
            css: clipCode(css),
            js: clipCode(js),
          },
          requirement:
            '不要直接给完整答案，优先指出最关键的下一步。若已通过，请给下一关学习建议。',
        }),
        temperature: 0.2,
      });
      if (typeof ai?.hint === 'string' && ai.hint.trim()) {
        hint = ai.hint.trim();
      }
      if (Array.isArray(ai?.checklist)) {
        checklist = ai.checklist.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);
      }
    } catch (e) {
      console.warn('[AI] solve-hint 调用失败，自动回退规则引擎:', e.message);
    }
  }

  res.json({
    pass: result.pass,
    hint,
    checklist,
    errors: result.errors,
  });
});

// AI 学习路径建议
app.get('/api/ai/learning-path', authRequired, async (req, res) => {
  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  const now = Date.now();
  const start = profile.currentLevelStartedAt ? new Date(profile.currentLevelStartedAt).getTime() : null;
  const stuckSeconds = start ? Math.max(0, Math.floor((now - start) / 1000)) : 0;

  const suggestions = [];
  if (stuckSeconds > 900) {
    suggestions.push('你在当前关卡停留超过 15 分钟，建议先回顾该章节核心知识点，再重试。');
    suggestions.push('建议先写最小可运行代码：先满足校验规则，再逐步美化。');
  } else {
    suggestions.push('学习节奏良好，建议继续推进下一关，保持连续学习。');
  }

  if ((profile.totalSolved || 0) < 3) {
    suggestions.push('建议先完成前 3 关打基础，再进入 DOM 与事件章节。');
  } else if ((profile.totalSolved || 0) < 6) {
    suggestions.push('你可以增加 1 道复习题：重新完成一个已通过的 CSS/JS 关卡。');
  } else {
    suggestions.push('建议做 1 道综合实战题（Todo + localStorage）巩固结构与交互。');
  }

  const weakTopics = getWeakTopicsFromProfile(profile);
  const remedial = buildRemedialExercises(weakTopics);

  let aiUsed = false;
  if (canUseExternalAI()) {
    try {
      const ai = await requestAIJson({
        systemPrompt:
          '你是学习路径规划导师。仅返回 JSON：{"suggestions":["..."]}。中文，2-4 条，每条一句，强调下一步行动。',
        userPrompt: JSON.stringify({
          stuckSeconds,
          weakTopics,
          profile: {
            level: profile.level,
            totalSolved: profile.totalSolved || 0,
            totalStudySeconds: profile.totalStudySeconds || 0,
          },
        }),
        temperature: 0.3,
      });
      if (Array.isArray(ai?.suggestions) && ai.suggestions.length > 0) {
        suggestions.splice(
          0,
          suggestions.length,
          ...ai.suggestions.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4)
        );
        aiUsed = true;
      }
    } catch (e) {
      console.warn('[AI] learning-path 调用失败，自动回退规则引擎:', e.message);
    }
  }

  res.json({
    stuckSeconds,
    suggestions,
    weakTopics,
    remedial,
    aiUsed,
    profile: {
      level: profile.level,
      totalSolved: profile.totalSolved || 0,
      totalStudySeconds: profile.totalStudySeconds || 0,
    },
  });
});

// AI 智能补强题（根据薄弱点返回可直接练的题）
app.get('/api/ai/remedial-plan', authRequired, async (req, res) => {
  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  const weakTopics = getWeakTopicsFromProfile(profile);
  const generatedExercises = buildRemedialExercises(weakTopics);
  const mapLevels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['key', 'title', 'chapter', 'order', 'coreConcept'],
    limit: 50,
  });

  const recommendedLevels = mapLevels
    .filter((x) => shouldRecommendLevelByWeakTopics(x, weakTopics))
    .slice(0, 5);

  let aiExercises = generatedExercises;
  let aiUsed = false;
  if (canUseExternalAI()) {
    try {
      const ai = await requestAIJson({
        systemPrompt:
          '你是前端补强练习出题助手。仅返回 JSON：{"generatedExercises":[{"id":"...","title":"...","goal":"...","hint":"...","checklist":["..."],"starterCode":"..."}]}。中文，返回 2-4 道题。',
        userPrompt: JSON.stringify({
          weakTopics,
          profile: {
            level: profile.level,
            totalSolved: profile.totalSolved || 0,
          },
          constraints: '题目要短小、可实操、偏 HTML/CSS/JS/DOM 基础，不要过长。',
        }),
        temperature: 0.4,
      });

      if (Array.isArray(ai?.generatedExercises) && ai.generatedExercises.length > 0) {
        aiExercises = ai.generatedExercises
          .map((x, idx) => ({
            id: String(x.id || `ai-remedial-${idx + 1}`),
            title: String(x.title || '补强练习'),
            goal: String(x.goal || '完成关键知识点练习'),
            hint: String(x.hint || '先写最小可运行版本，再逐步补充细节。'),
            checklist: Array.isArray(x.checklist)
              ? x.checklist.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 5)
              : ['完成题目要求的核心代码', '自检语法与结构是否正确'],
            starterCode: String(x.starterCode || '<!-- 在这里开始补强练习 -->'),
          }))
          .slice(0, 4);
        aiUsed = true;
      }
    } catch (e) {
      console.warn('[AI] remedial-plan 调用失败，自动回退规则引擎:', e.message);
    }
  }

  res.json({
    weakTopics,
    generatedExercises: aiExercises,
    recommendedLevels,
    aiUsed,
  });
});

// ---------- 管理员题库管理 ----------
app.get('/api/admin/users', authRequired, requireAdminDb, async (req, res) => {
  const users = await User.findAll({
    attributes: ['id', 'username', 'role', 'createdAt'],
    include: [
      {
        model: UserProfile,
        attributes: ['exp', 'level', 'totalExp', 'totalSolved', 'currentLevelKey', 'maxChapter', 'maxOrder'],
      },
    ],
    order: [['id', 'ASC']],
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      profile: u.UserProfile || null,
    }))
  );
});

app.get('/api/admin/users/:id/analytics', authRequired, requireAdminDb, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: '无效用户ID' });
  }

  const user = await User.findOne({
    where: { id: userId },
    attributes: ['id', 'username', 'role'],
  });
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const profile = await getOrCreateProfile(user.id, user.username);
  const levels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['key', 'chapter', 'order', 'title'],
  });

  const solvedSet = getSolvedLevelSet(profile);
  const collabSolvedSet = getCollabSolvedSet(profile);
  const analytics = buildUserAnalyticsData({
    profile,
    levels,
    solvedSet,
    collabSolvedSet,
  });
  analytics.aiNarrative = await buildUserAIPedagogicalComment(user.username, analytics);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    analytics,
  });
});

app.get('/api/admin/levels', authRequired, requireAdminDb, async (req, res) => {
  const levels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
  });
  res.json(levels);
});

app.put('/api/admin/levels/:key', authRequired, requireAdminDb, async (req, res) => {
  const key = req.params.key;
  const level = await Level.findOne({ where: { key } });
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const { taskMarkdown, initCode, validationRules } = req.body || {};
  if (typeof taskMarkdown === 'string') {
    level.taskMarkdown = taskMarkdown;
  }
  if (initCode && typeof initCode === 'object') {
    if (typeof initCode.html === 'string') level.starterHtml = initCode.html;
    if (typeof initCode.css === 'string') level.starterCss = initCode.css;
    if (typeof initCode.js === 'string') level.starterJs = initCode.js;
  }
  if (validationRules && typeof validationRules === 'object') {
    level.validatorConfig = JSON.stringify(validationRules);
  }

  await level.save();
  res.json({ ok: true, level });
});

// 校验接口：核心 ValidationEngine + AI 辅导逻辑
app.post('/api/levels/:key/validate', authRequired, async (req, res) => {
  const key = req.params.key;
  const { html, css, js } = req.body || {};

  const level = await Level.findOne({ where: { key } });
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const validation = await validateLevel(level, { html, css, js });

  let profile = await getOrCreateProfile(req.user.userId, req.user.username);
  const currentUser = await User.findOne({ where: { id: req.user.userId }, attributes: ['role'] });
  const isAdminUser = currentUser?.role === 'admin';
  const orderedLevels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['key', 'chapter', 'order'],
  });
  if (!isAdminUser && !canAccessLevel(profile, level.key, orderedLevels)) {
    return res.status(403).json({ error: '请先按顺序完成前置关卡' });
  }

  const pass = validation.pass;
  const errors = validation.errors;
  await saveUserSubmission(req.user.userId, level.key, { html, css, js }, pass);
  updateStruggleStats(profile, level, pass, errors);

  let nextLevelKey = null;
  // 通过时按“首次通关”发奖励，并推进到下一关
  if (pass) {
    const aiTouchedSet = getAiHintTouchedSet(profile);
    if (aiTouchedSet.has(level.key)) {
      profile.aiHelpedPassCount = (profile.aiHelpedPassCount || 0) + 1;
      aiTouchedSet.delete(level.key);
      profile.aiHintTouchedKeys = JSON.stringify([...aiTouchedSet]);
    }

    const solvedSet = getSolvedLevelSet(profile);
    const levelIndex = orderedLevels.findIndex((x) => x.key === level.key);

    // 兜底修复：若历史数据异常，当前题之前的关卡也一并补齐为已通过，保证解锁链不断裂
    if (levelIndex >= 0) {
      for (let i = 0; i <= levelIndex; i += 1) {
        solvedSet.add(orderedLevels[i].key);
      }
    } else {
      solvedSet.add(level.key);
    }
    profile.solvedLevelKeys = JSON.stringify([...solvedSet]);

    const solvedCount = solvedSet.size;
    if ((profile.totalSolved || 0) < solvedCount) {
      profile.totalSolved = solvedCount;
    }
    const minTotalExp = solvedCount * 30;
    if ((profile.totalExp || 0) < minTotalExp) {
      profile.totalExp = minTotalExp;
    }

    // 用 totalExp 反推展示用 exp/level，避免旧数据导致等级异常
    let levelNum = 1;
    let remain = profile.totalExp;
    while (remain >= levelNum * 100) {
      remain -= levelNum * 100;
      levelNum += 1;
    }
    profile.level = levelNum;
    profile.exp = remain;

    const next = levelIndex >= 0 ? orderedLevels[levelIndex + 1] : null;
    if (next) {
      profile.maxChapter = next.chapter;
      profile.maxOrder = next.order;
      nextLevelKey = next.key;
    } else {
      profile.maxChapter = level.chapter;
      profile.maxOrder = level.order;
      nextLevelKey = null;
    }
  }

  // 保存薄弱点统计（即使本次未通关也需要落库）
  await profile.save();

  const newlyAwardedBadges = await awardBadgesForUser(profile.userId);

  let npcDialogues = [];
  try {
    npcDialogues = level.npcDialogues ? JSON.parse(level.npcDialogues) : [];
  } catch (e) {
    npcDialogues = [];
  }

  // AI 辅导逻辑：校验失败时，返回 NPC 提示
  const npcHints = pass ? [] : npcDialogues;

  res.json({
    levelKey: level.key,
    nextLevelKey,
    pass,
    errors,
    profile,
    newlyAwardedBadges,
    npcHints,
  });
});

app.post('/api/levels/:key/reset-submission', authRequired, async (req, res) => {
  const key = req.params.key;
  const level = await Level.findOne({ where: { key } });
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const profile = await getOrCreateProfile(req.user.userId, req.user.username);
  const currentUser = await User.findOne({ where: { id: req.user.userId }, attributes: ['role'] });
  const isAdminUser = currentUser?.role === 'admin';
  const orderedLevels = await Level.findAll({
    order: [['chapter', 'ASC'], ['order', 'ASC']],
    attributes: ['key', 'chapter', 'order'],
  });
  if (!isAdminUser && !canAccessLevel(profile, level.key, orderedLevels)) {
    return res.status(403).json({ error: '请先按顺序完成前置关卡' });
  }

  await UserLevelSubmission.destroy({
    where: { userId: req.user.userId, levelKey: key },
  });
  res.json({
    ok: true,
    levelKey: key,
    starterHtml: level.starterHtml || '',
    starterCss: level.starterCss || '',
    starterJs: level.starterJs || '',
  });
});

async function getOrCreateProfile(userId, username) {
  const [profile] = await UserProfile.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      name: username || 'Apprentice',
      exp: 0,
      level: 1,
      maxChapter: 1,
      maxOrder: 1,
      totalSolved: 0,
      totalExp: 0,
      totalStudySeconds: 0,
      currentLevelKey: null,
      currentLevelStartedAt: null,
      lastActiveAt: new Date(),
      struggleStats: '{}',
      solvedLevelKeys: '[]',
      lastLoginDate: null,
      loginStreakDays: 0,
      aiHintCount: 0,
      aiHelpedPassCount: 0,
      aiHintTouchedKeys: '[]',
      collabSolvedKeys: '[]',
    },
  });
  return profile;
}

async function updateStudyProgress(profile, newLevelKey) {
  const now = new Date();
  if (profile.currentLevelStartedAt && profile.currentLevelKey) {
    const previousStart = new Date(profile.currentLevelStartedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - previousStart) / 1000));
    // 防止异常累积（例如页面挂起很久）
    const boundedSeconds = Math.min(elapsedSeconds, 3600);
    profile.totalStudySeconds = (profile.totalStudySeconds || 0) + boundedSeconds;
  }

  profile.currentLevelKey = newLevelKey;
  profile.currentLevelStartedAt = now;
  profile.lastActiveAt = now;
  await profile.save();
}

async function awardBadgesForUser(userId) {
  const profile = await UserProfile.findOne({ where: { userId } });
  if (!profile) return [];
  const user = await User.findOne({ where: { id: userId } });

  const badges = await Badge.findAll({ order: [['id', 'ASC']] });
  const earned = await UserBadge.findAll({ where: { userId } });
  const earnedSet = new Set(earned.map((x) => x.badgeId));
  const newlyAwarded = [];
  const solvedSet = getSolvedLevelSet(profile);
  const collabSolvedSet = getCollabSolvedSet(profile);
  const solvedLevels = await Level.findAll({
    where: { key: [...solvedSet] },
    attributes: ['key', 'chapter'],
  });

  for (const badge of badges) {
    if (earnedSet.has(badge.id)) continue;

    let matched = false;
    if (badge.ruleType === 'register') {
      matched = Boolean(user);
    } else if (badge.ruleType === 'chapterComplete') {
      const chapter = Number(badge.ruleValue);
      matched = isChapterCompleted(chapter, solvedSet, solvedLevels);
    } else if (badge.ruleType === 'loginStreakDays') {
      matched = (profile.loginStreakDays || 0) >= badge.ruleValue;
    } else if (badge.ruleType === 'allLevelsComplete') {
      matched = solvedSet.size >= badge.ruleValue;
    } else if (badge.ruleType === 'collabComplete') {
      matched = collabSolvedSet.size >= badge.ruleValue;
    } else if (badge.ruleType === 'totalSolved') {
      matched = (profile.totalSolved || 0) >= badge.ruleValue;
    }

    if (matched) {
      await UserBadge.create({
        userId,
        badgeId: badge.id,
        awardedAt: new Date(),
      });
      newlyAwarded.push({
        key: badge.key,
        name: badge.name,
        description: badge.description,
      });
    }
  }

  return newlyAwarded;
}

function updateStruggleStats(profile, level, pass, errors) {
  let stats = {};
  try {
    stats = profile.struggleStats ? JSON.parse(profile.struggleStats) : {};
  } catch (e) {
    stats = {};
  }

  const topic = inferTopicFromLevel(level);
  if (!stats[topic]) {
    stats[topic] = { fail: 0, pass: 0, score: 0 };
  }

  if (pass) {
    stats[topic].pass += 1;
    stats[topic].score = Math.max(0, stats[topic].score - 1);
  } else {
    stats[topic].fail += 1;
    const errorWeight = Array.isArray(errors) ? Math.max(1, errors.length) : 1;
    stats[topic].score += errorWeight;
  }

  profile.struggleStats = JSON.stringify(stats);
}

function inferTopicFromLevel(level) {
  const title = `${level?.title || ''} ${level?.coreConcept || ''}`.toLowerCase();
  if (title.includes('html')) return 'html';
  if (title.includes('css') || title.includes('flex') || title.includes('响应式') || title.includes('动画')) return 'css';
  if (title.includes('dom') || title.includes('事件')) return 'dom';
  if (title.includes('async') || title.includes('fetch')) return 'async';
  if (title.includes('storage') || title.includes('todo') || title.includes('项目')) return 'project';
  return 'javascript';
}

function getWeakTopicsFromProfile(profile) {
  let stats = {};
  try {
    stats = profile.struggleStats ? JSON.parse(profile.struggleStats) : {};
  } catch (e) {
    stats = {};
  }

  const rows = Object.entries(stats).map(([topic, v]) => ({
    topic,
    score: v?.score || 0,
    fail: v?.fail || 0,
    pass: v?.pass || 0,
  }));

  return rows
    .filter((x) => x.score > 0 || x.fail > 0)
    .sort((a, b) => b.score - a.score || b.fail - a.fail)
    .slice(0, 3);
}

function buildRemedialExercises(weakTopics) {
  const top = weakTopics[0]?.topic || 'javascript';
  const templates = {
    html: [
      {
        id: 'r-html-1',
        title: '补强题：语义标签三件套',
        goal: '写出 header/main/footer 结构并包含一个 h1。',
        starterCode: '<header></header>\n<main></main>\n<footer></footer>',
        hint: '先完成结构，再填充文字。',
        checklist: ['包含 header/main/footer', '至少一个 h1 标签'],
      },
    ],
    css: [
      {
        id: 'r-css-1',
        title: '补强题：卡片布局修复',
        goal: '使用 flex + gap 让三张卡片水平排列。',
        starterCode: '.cards { }\n.card { }',
        hint: '父元素先设置 display:flex。',
        checklist: ['出现 display:flex', '出现 gap', '卡片可横向排列'],
      },
    ],
    dom: [
      {
        id: 'r-dom-1',
        title: '补强题：点击后计数 +1',
        goal: '按钮点击时让数字自增。',
        starterCode: '<button id="add">+1</button><p id="num">0</p>',
        hint: 'querySelector + addEventListener + textContent。',
        checklist: ['有 querySelector', '有 addEventListener("click")', '更新 textContent'],
      },
    ],
    async: [
      {
        id: 'r-async-1',
        title: '补强题：异步获取并渲染',
        goal: '用 fetch 获取 JSON 并渲染第一条 title。',
        starterCode: 'async function load(){\n  // TODO\n}\nload();',
        hint: 'await fetch(...); await res.json();',
        checklist: ['有 async/await', '有 fetch', '有 .json()'],
      },
    ],
    project: [
      {
        id: 'r-project-1',
        title: '补强题：Todo 持久化',
        goal: '新增任务后写入 localStorage，刷新后恢复。',
        starterCode: 'const todos = [];\n// TODO: save/load',
        hint: 'JSON.stringify / JSON.parse。',
        checklist: ['setItem', 'getItem', '页面刷新可恢复'],
      },
    ],
    javascript: [
      {
        id: 'r-js-1',
        title: '补强题：条件判断强化',
        goal: '当分数 >= 60 显示通过，否则显示继续练习。',
        starterCode: 'const score = 58;\n// TODO',
        hint: '先写 if，再补 else。',
        checklist: ['包含 if/else', '输出两种结果'],
      },
    ],
  };

  return templates[top] || templates.javascript;
}

function shouldRecommendLevelByWeakTopics(level, weakTopics) {
  if (!weakTopics || weakTopics.length === 0) return false;
  const text = `${level.title || ''} ${level.coreConcept || ''}`.toLowerCase();
  return weakTopics.some((w) => {
    if (w.topic === 'html') return text.includes('html') || text.includes('标签');
    if (w.topic === 'css') return text.includes('css') || text.includes('flex') || text.includes('响应式') || text.includes('动画');
    if (w.topic === 'dom') return text.includes('dom') || text.includes('事件');
    if (w.topic === 'async') return text.includes('async') || text.includes('fetch');
    if (w.topic === 'project') return text.includes('项目') || text.includes('todo') || text.includes('storage');
    return text.includes('js') || text.includes('javascript');
  });
}

function compareChapterOrder(chapterA, orderA, chapterB, orderB) {
  if (chapterA !== chapterB) return chapterA - chapterB;
  return orderA - orderB;
}

function getSolvedLevelSet(profile) {
  try {
    const arr = profile.solvedLevelKeys ? JSON.parse(profile.solvedLevelKeys) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function getCollabSolvedSet(profile) {
  try {
    const arr = profile.collabSolvedKeys ? JSON.parse(profile.collabSolvedKeys) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function getAiHintTouchedSet(profile) {
  try {
    const arr = profile.aiHintTouchedKeys ? JSON.parse(profile.aiHintTouchedKeys) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function getChapterLabel(chapter) {
  const n = Number(chapter || 0);
  if (n === 1) return 'Chapter 1 · HTML';
  if (n === 2) return 'Chapter 2 · CSS';
  if (n === 3) return 'Chapter 3 · JavaScript';
  if (n === 4) return 'Chapter 4 · DOM';
  if (n === 5) return 'Chapter 5 · 综合实战';
  return `Chapter ${n}`;
}

function buildUserAnalyticsData({ profile, levels, solvedSet, collabSolvedSet }) {
  const chapterMap = new Map();
  for (const level of levels) {
    const key = Number(level.chapter || 0);
    const item = chapterMap.get(key) || {
      chapter: key,
      label: getChapterLabel(key),
      total: 0,
      solved: 0,
    };
    item.total += 1;
    if (solvedSet.has(level.key)) item.solved += 1;
    chapterMap.set(key, item);
  }
  const chapters = [...chapterMap.values()].sort((a, b) => a.chapter - b.chapter);
  const completionBars = chapters.map((x) => ({
    label: x.label,
    solved: x.solved,
    total: x.total,
    rate: x.total ? Number(((x.solved / x.total) * 100).toFixed(1)) : 0,
  }));

  const chapterHeat = chapters.map((x) => {
    const unsolved = Math.max(x.total - x.solved, 0);
    const stuckScore = x.total ? Number(((unsolved / x.total) * 100).toFixed(1)) : 0;
    let level = 'low';
    if (stuckScore >= 60) level = 'high';
    else if (stuckScore >= 30) level = 'mid';
    return {
      label: x.label,
      stuckScore,
      level,
      note: unsolved === 0 ? '已顺利通过' : `还有 ${unsolved} 关待突破`,
    };
  });

  const totalSolved = Number(profile.totalSolved || solvedSet.size || 0);
  const aiHintCount = Number(profile.aiHintCount || 0);
  const aiHelpedPassCount = Number(profile.aiHelpedPassCount || 0);
  const totalAttempts = Math.max(
    Number(profile.totalSolved || 0) + Number(profile.maxOrder || 0),
    totalSolved,
    aiHintCount
  );
  const withAiPassRate = aiHintCount ? Number(((aiHelpedPassCount / aiHintCount) * 100).toFixed(1)) : 0;
  const withoutAiPasses = Math.max(totalSolved - aiHelpedPassCount, 0);
  const withoutAiAttempts = Math.max(totalAttempts - aiHintCount, withoutAiPasses, 1);
  const withoutAiPassRate = Number(((withoutAiPasses / withoutAiAttempts) * 100).toFixed(1));

  const collabSolved = collabSolvedSet.size;
  const collabFunnel = [
    { label: '已开通协作学习', achieved: true, progress: 100, detail: '' },
    {
      label: '参与过协作挑战',
      achieved: collabSolved > 0,
      progress: collabSolved > 0 ? 100 : 0,
      detail: collabSolved > 0 ? `已参与，已通关 ${collabSolved} 题` : '尚未参与',
    },
    {
      label: '至少通关1题',
      achieved: collabSolved >= 1,
      progress: collabSolved >= 1 ? 100 : 0,
      detail: collabSolved >= 1 ? '已完成首题突破' : '还差首题通关',
    },
    {
      label: '达成5题全通关',
      achieved: collabSolved >= 5,
      progress: Number((Math.min(collabSolved, 5) / 5 * 100).toFixed(1)),
      detail: `当前 ${Math.min(collabSolved, 5)}/5`,
    },
  ];

  const overallRate = levels.length ? Number(((solvedSet.size / levels.length) * 100).toFixed(1)) : 0;

  return {
    completionBars,
    chapterHeat,
    aiCompare: {
      withoutAiPassRate,
      withAiPassRate,
      aiHintCount,
      aiHelpedPassCount,
    },
    collabFunnel,
    overall: {
      solved: solvedSet.size,
      total: levels.length,
      rate: overallRate,
    },
  };
}

async function buildUserAIPedagogicalComment(username, analytics) {
  const fallback = (() => {
    const rate = analytics?.overall?.rate || 0;
    const aiRate = analytics?.aiCompare?.withAiPassRate || 0;
    const noAiRate = analytics?.aiCompare?.withoutAiPassRate || 0;
    const collabDone = analytics?.collabFunnel?.[2]?.value === 1;
    const growthText =
      aiRate >= noAiRate
        ? '使用提示后的通过表现有提升，说明“先提示再尝试”对这位同学是有效的。'
        : '当前提示后的通过表现还不稳定，建议把提示拆成更小步骤来练习。';
    const collabText = collabDone
      ? '协作挑战已经产生正向作用，建议继续保持每周至少一次双人协作。'
      : '还可以多尝试协作挑战，让同伴互评帮助突破卡点。';
    if (rate >= 80) {
      return `${username} 当前整体完成度很高，学习节奏稳定。${growthText}${collabText}`;
    }
    if (rate >= 40) {
      return `${username} 正处于持续爬坡阶段，基础正在变扎实。${growthText}${collabText}`;
    }
    return `${username} 目前还在起步期，但方向是对的。建议先把当前章节做成“每次只突破一小点”。${growthText}${collabText}`;
  })();

  if (!canUseExternalAI()) {
    return fallback;
  }

  try {
    const ai = await requestAIJson({
      systemPrompt:
        '你是一个温和、具体、鼓励式的学习分析助手。请输出 JSON：{"comment":"..."}。comment 使用中文，语气自然，不要生硬，不要使用“系统是否帮助了该用户”这种措辞。',
      userPrompt: `用户名：${username}\n学习数据：${JSON.stringify(analytics)}`,
      temperature: 0.4,
      maxTokens: 220,
      fallback: { comment: fallback },
    });
    return String(ai.comment || fallback);
  } catch (e) {
    return fallback;
  }
}

function getFirstUnsolvedIndex(orderedLevels, solvedSet) {
  for (let i = 0; i < orderedLevels.length; i += 1) {
    if (!solvedSet.has(orderedLevels[i].key)) {
      return i;
    }
  }
  return -1;
}

function canAccessLevel(profile, levelKey, orderedLevels) {
  const solvedSet = getSolvedLevelSet(profile);
  const firstUnsolvedIndex = getFirstUnsolvedIndex(orderedLevels, solvedSet);
  const targetIndex = orderedLevels.findIndex((x) => x.key === levelKey);
  if (targetIndex < 0) return false;
  if (firstUnsolvedIndex === -1) return true;
  return targetIndex <= firstUnsolvedIndex;
}

function reconcileProfileWithCurrentPointer(profile, levels) {
  const inferredSolvedLevels = levels.filter(
    (lvl) => compareChapterOrder(lvl.chapter, lvl.order, profile.maxChapter, profile.maxOrder) < 0
  );
  const inferredSolved = inferredSolvedLevels.length;

  let changed = false;
  if ((profile.totalSolved || 0) < inferredSolved) {
    profile.totalSolved = inferredSolved;
    changed = true;
  }
  const minTotalExp = inferredSolved * 30;
  if ((profile.totalExp || 0) < minTotalExp) {
    profile.totalExp = minTotalExp;
    changed = true;
  }

  const keySet = getSolvedLevelSet(profile);
  let keySetChanged = false;
  for (const lvl of inferredSolvedLevels) {
    if (!keySet.has(lvl.key)) {
      keySet.add(lvl.key);
      keySetChanged = true;
    }
  }
  if (keySetChanged) {
    profile.solvedLevelKeys = JSON.stringify([...keySet]);
    changed = true;
  }

  return changed;
}

function updateLoginStreak(profile) {
  const today = new Date().toISOString().slice(0, 10);
  const last = profile.lastLoginDate;
  if (!last) {
    profile.lastLoginDate = today;
    profile.loginStreakDays = 1;
    return;
  }
  if (last === today) return;
  const diffDays = Math.floor((new Date(today).getTime() - new Date(last).getTime()) / 86400000);
  if (diffDays === 1) {
    profile.loginStreakDays = (profile.loginStreakDays || 0) + 1;
  } else {
    profile.loginStreakDays = 1;
  }
  profile.lastLoginDate = today;
}

function isChapterCompleted(chapterNum, solvedSet, solvedLevels) {
  if (chapterNum === 1) {
    return ['html-foundation', 'html-password-form'].every((k) => solvedSet.has(k));
  }
  if (chapterNum === 2) {
    return ['css-color-and-font', 'css-flex-bridge'].every((k) => solvedSet.has(k));
  }
  if (chapterNum === 3) {
    return ['js-variable-power', 'js-if-gate', 'js-dom-query', 'js-click-event'].every((k) =>
      solvedSet.has(k)
    );
  }
  return solvedLevels.some((x) => x.chapter === chapterNum);
}

function getCodeExampleForLevel(level) {
  const examples = {
    'html-foundation': '<h1>这是标题</h1>\n<p>这是段落</p>',
    'html-password-form': '<form>\n  <input type="password" placeholder="输入密码" />\n  <button type="submit">提交</button>\n</form>',
    'css-color-and-font': '.title {\n  color: #22c55e;\n  font-size: 28px;\n}',
    'css-flex-bridge': '.bridge {\n  display: flex;\n  justify-content: space-around;\n}',
    'js-variable-power': 'let power = 100;',
    'js-if-gate': 'let mana = 80;\nif (mana > 50) {\n  console.log("石门开启");\n}',
    'js-dom-query': "const doorEl = document.querySelector('#door');",
    'js-click-event':
      "const btn = document.querySelector('#castBtn');\nbtn.addEventListener('click', () => {\n  document.querySelector('#result').textContent = '魔法已释放';\n});",
    'project-todo-app': '<input id="todoInput" />\n<ul id="todoList"></ul>',
    'project-localstorage': "localStorage.setItem('todos', JSON.stringify(['任务A']));",
    'css-responsive-layout':
      '.cards { display: grid; grid-template-columns: 1fr; }\n@media (min-width: 768px) {\n  .cards { grid-template-columns: repeat(2, 1fr); }\n}',
    'css-animation-orb':
      '@keyframes floatOrb {\n  from { transform: scale(1); }\n  to { transform: scale(1.15); }\n}\n.orb { animation: floatOrb 1.2s ease-in-out infinite alternate; }',
    'js-array-map':
      'const nums = [1, 2, 3];\nconst doubled = nums.map((n) => n * 2);\nconsole.log(doubled);',
    'js-async-await':
      'async function demo() {\n  const value = await Promise.resolve(123);\n  return value;\n}',
    'js-fetch-api':
      "async function loadPosts() {\n  const res = await fetch('https://jsonplaceholder.typicode.com/posts');\n  const data = await res.json();\n  return data;\n}",
    'dom-form-validate':
      "const input = document.querySelector('#nameInput');\nconst msg = document.querySelector('#msg');\ninput.addEventListener('input', () => {\n  msg.textContent = input.value.length < 3 ? '至少输入3个字符' : '通过';\n});",
    'dom-event-delegation':
      "const list = document.querySelector('#list');\nlist.addEventListener('click', (event) => {\n  if (event.target.matches('button')) {\n    console.log(event.target.dataset.id);\n  }\n});",
    'project-timer-app':
      "let sec = 60;\nlet timer = null;\nfunction start() { timer = setInterval(() => { sec -= 1; }, 1000); }\nfunction pause() { clearInterval(timer); }",
  };
  if (examples[level.key]) return examples[level.key];
  return buildAnswerFromStarter(level) || '// 参考：按任务完成最小可运行版本';
}

function getAdminAnswerForLevel(level) {
  const answerMap = {
    'html-foundation': '<h1>这是标题</h1>\n<p>这是段落</p>',
    'html-password-form': '<form>\n  <input type="password" />\n  <button type="submit">提交</button>\n</form>',
    'css-color-and-font': '.title {\n  color: #22c55e;\n  font-size: 28px;\n}',
    'css-flex-bridge': '.bridge {\n  display: flex;\n  justify-content: space-around;\n}',
    'js-variable-power': 'let power = 100;',
    'js-if-gate': 'if (mana > 50) {\n  return true;\n}\nreturn false;',
    'js-dom-query': "const door = document.querySelector('#door');",
    'js-click-event':
      "const btn = document.querySelector('#magicBtn');\nbtn.addEventListener('click', () => {\n  btn.textContent = '魔法已触发';\n});",
    'project-todo-app':
      '<input id="todoInput" />\n<button id="addBtn">添加</button>\n<ul id="todoList"></ul>',
    'project-localstorage':
      "const items = ['任务1', '任务2'];\nlocalStorage.setItem('todo_items', JSON.stringify(items));",
    'css-responsive-layout':
      '.cards {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 12px;\n}\n@media (min-width: 768px) {\n  .cards {\n    grid-template-columns: repeat(2, 1fr);\n  }\n}',
    'css-animation-orb':
      '.orb {\n  width: 64px;\n  height: 64px;\n  border-radius: 9999px;\n  animation: pulseOrb 1.6s ease-in-out infinite;\n}\n@keyframes pulseOrb {\n  0% { transform: scale(1); opacity: 0.8; }\n  50% { transform: scale(1.15); opacity: 1; }\n  100% { transform: scale(1); opacity: 0.8; }\n}',
    'js-array-map':
      'const nums = [1, 2, 3, 4];\nconst doubled = nums.map((n) => n * 2);\nconsole.log(doubled);',
    'js-async-await':
      'async function loadData() {\n  const result = await Promise.resolve({ ok: true });\n  return result;\n}',
    'js-fetch-api':
      "async function fetchPosts() {\n  const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3');\n  const data = await res.json();\n  return data;\n}",
    'dom-form-validate':
      "const input = document.querySelector('#nameInput');\nconst msg = document.querySelector('#msg');\ninput.addEventListener('input', () => {\n  msg.textContent = input.value.length < 3 ? '至少输入3个字符' : '输入通过';\n});",
    'dom-event-delegation':
      "const list = document.querySelector('#todoList');\nlist.addEventListener('click', (e) => {\n  if (e.target.matches('.remove')) {\n    e.target.closest('li')?.remove();\n  }\n});",
    'project-timer-app':
      "let remain = 60;\nlet timer = null;\nconst timeEl = document.querySelector('#time');\nfunction startTimer() {\n  clearInterval(timer);\n  timer = setInterval(() => {\n    remain -= 1;\n    timeEl.textContent = String(remain);\n  }, 1000);\n}\nfunction pauseTimer() {\n  clearInterval(timer);\n}\ndocument.querySelector('#startBtn')?.addEventListener('click', startTimer);\ndocument.querySelector('#pauseBtn')?.addEventListener('click', pauseTimer);",
  };
  if (answerMap[level.key]) return answerMap[level.key];
  const fromStarter = buildAnswerFromStarter(level);
  if (fromStarter) return fromStarter;
  return getCodeExampleForLevel(level);
}

function buildAnswerFromStarter(level) {
  const parts = [];
  if (String(level?.starterHtml || '').trim()) parts.push(`// HTML\n${level.starterHtml}`);
  if (String(level?.starterCss || '').trim()) parts.push(`// CSS\n${level.starterCss}`);
  if (String(level?.starterJs || '').trim()) parts.push(`// JS\n${level.starterJs}`);
  return parts.join('\n\n');
}

function pickSavedCode(submission, level) {
  if (!submission) return '';
  const html = String(submission.html || '').trim();
  const css = String(submission.css || '').trim();
  const js = String(submission.js || '').trim();
  if (html) return submission.html;
  if (css && !String(level?.starterCss || '').trim()) return submission.css;
  if (js && !String(level?.starterJs || '').trim()) return submission.js;
  return submission.html || submission.css || submission.js || '';
}

async function saveUserSubmission(userId, levelKey, code, pass) {
  const payload = {
    userId,
    levelKey,
    html: String(code?.html || ''),
    css: String(code?.css || ''),
    js: String(code?.js || ''),
    lastPassed: Boolean(pass),
  };
  const existing = await UserLevelSubmission.findOne({ where: { userId, levelKey } });
  if (!existing) {
    await UserLevelSubmission.create(payload);
    return;
  }
  // 已通关存档优先保留：失败提交不覆盖历史通过答案
  if (!pass && existing.lastPassed) {
    return;
  }
  existing.html = payload.html;
  existing.css = payload.css;
  existing.js = payload.js;
  existing.lastPassed = payload.lastPassed;
  await existing.save();
}

async function requireAdminDb(req, res, next) {
  const user = await User.findOne({ where: { id: req.user.userId } });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  req.user.role = user.role;
  next();
}

const COLLAB_CHALLENGES = [
  {
    id: 'team-1',
    title: '语义结构 + 信息列表',
    description: '两人合作完成一段语义化 HTML 结构。',
    parts: {
      A: {
        title: 'A部分：主容器',
        instruction: '创建 <article class="card">，并在其中写入 <h2>探险日志</h2>。',
        starterCode: '<article class="card">\n  <!-- 在这里完成 A 部分 -->\n</article>',
        checks: [
          { pattern: '<article\\s+class="card"', message: '需要创建 article.card 容器' },
          { pattern: '<h2>\\s*探险日志\\s*</h2>', message: '需要包含标题“探险日志”' },
        ],
      },
      B: {
        title: 'B部分：清单内容',
        instruction: '在容器中添加 <ul class="quest-list">，并至少写 3 个 <li>。',
        starterCode: '<ul class="quest-list">\n  <li></li>\n  <li></li>\n  <li></li>\n</ul>',
        checks: [
          { pattern: '<ul\\s+class="quest-list"', message: '需要创建 ul.quest-list' },
          { pattern: '<li>[\\s\\S]*<li>[\\s\\S]*<li>', message: '至少需要 3 个 li 条目' },
        ],
      },
    },
  },
  {
    id: 'team-2',
    title: 'Flex 双列卡片布局',
    description: '两人分别完成容器布局与卡片样式。',
    parts: {
      A: {
        title: 'A部分：布局容器',
        instruction: '编写 .panel 样式，要求 display:flex 且 gap 不小于 12px。',
        starterCode: '.panel {\n  /* 在这里完成 A 部分 */\n}',
        checks: [
          { pattern: '\\.panel\\s*\\{[\\s\\S]*display\\s*:\\s*flex\\s*;', message: '.panel 需要 display:flex' },
          { pattern: '\\.panel\\s*\\{[\\s\\S]*gap\\s*:\\s*(1[2-9]|[2-9]\\d)px\\s*;', message: '.panel 需要设置 >=12px 的 gap' },
        ],
      },
      B: {
        title: 'B部分：卡片样式',
        instruction: '编写 .panel .item 样式，要求有 border-radius 且宽度为 48%。',
        starterCode: '.panel .item {\n  /* 在这里完成 B 部分 */\n}',
        checks: [
          { pattern: '\\.panel\\s+\\.item\\s*\\{[\\s\\S]*width\\s*:\\s*48%\\s*;', message: '.panel .item 需要 width: 48%' },
          { pattern: '\\.panel\\s+\\.item\\s*\\{[\\s\\S]*border-radius\\s*:\\s*\\d+px\\s*;', message: '.panel .item 需要 border-radius' },
        ],
      },
    },
  },
  {
    id: 'team-3',
    title: '函数拆分协作',
    description: '两人分别完成计算函数与判断函数。',
    parts: {
      A: {
        title: 'A部分：分数计算',
        instruction: '实现 function calcScore(exp, bonus) { return exp * 2 + bonus; }',
        starterCode: 'function calcScore(exp, bonus) {\n  // 在这里完成 A 部分\n}',
        checks: [
          { pattern: 'function\\s+calcScore\\s*\\(\\s*exp\\s*,\\s*bonus\\s*\\)', message: '需要声明 calcScore(exp, bonus)' },
          { pattern: 'return\\s+exp\\s*\\*\\s*2\\s*\\+\\s*bonus\\s*;', message: '返回值需要是 exp * 2 + bonus' },
        ],
      },
      B: {
        title: 'B部分：通过判断',
        instruction: '实现 function isQualified(score) { return score >= 120; }',
        starterCode: 'function isQualified(score) {\n  // 在这里完成 B 部分\n}',
        checks: [
          { pattern: 'function\\s+isQualified\\s*\\(\\s*score\\s*\\)', message: '需要声明 isQualified(score)' },
          { pattern: 'return\\s+score\\s*>=\\s*120\\s*;', message: '返回值需要是 score >= 120' },
        ],
      },
    },
  },
  {
    id: 'team-4',
    title: 'DOM 事件联动',
    description: '两人分别完成监听与状态更新逻辑。',
    parts: {
      A: {
        title: 'A部分：绑定按钮',
        instruction: "通过 querySelector('#start-btn') 获取按钮并绑定 click 事件。",
        starterCode:
          "const btn = document.querySelector('#start-btn');\n// 在这里完成 A 部分",
        checks: [
          { pattern: "querySelector\\(\\s*['\"]#start-btn['\"]\\s*\\)", message: '需要获取 #start-btn 按钮' },
          { pattern: 'addEventListener\\(\\s*[\'"]click[\'"]\\s*,', message: '需要绑定 click 事件' },
        ],
      },
      B: {
        title: 'B部分：更新状态',
        instruction: "点击时把 #status 的 textContent 改为“已启动”。",
        starterCode:
          "const statusEl = document.querySelector('#status');\n// 在这里完成 B 部分",
        checks: [
          { pattern: "querySelector\\(\\s*['\"]#status['\"]\\s*\\)", message: '需要获取 #status 元素' },
          { pattern: "textContent\\s*=\\s*['\"]已启动['\"]", message: '需要把 textContent 改为“已启动”' },
        ],
      },
    },
  },
  {
    id: 'team-5',
    title: '本地存储协作',
    description: '两人分别完成保存与读取函数，完成整题通关。',
    parts: {
      A: {
        title: 'A部分：保存函数',
        instruction: "实现 saveTask(name)，内部执行 localStorage.setItem('task-name', name)。",
        starterCode: "function saveTask(name) {\n  // 在这里完成 A 部分\n}",
        checks: [
          { pattern: 'function\\s+saveTask\\s*\\(\\s*name\\s*\\)', message: '需要声明 saveTask(name)' },
          { pattern: "localStorage\\.setItem\\(\\s*['\"]task-name['\"]\\s*,\\s*name\\s*\\)", message: "需要 setItem('task-name', name)" },
        ],
      },
      B: {
        title: 'B部分：读取函数',
        instruction:
          "实现 loadTask()，返回 localStorage.getItem('task-name') || '未命名'。",
        starterCode: "function loadTask() {\n  // 在这里完成 B 部分\n}",
        checks: [
          { pattern: 'function\\s+loadTask\\s*\\(', message: '需要声明 loadTask()' },
          {
            pattern:
              "return\\s+localStorage\\.getItem\\(\\s*['\"]task-name['\"]\\s*\\)\\s*\\|\\|\\s*['\"]未命名['\"]\\s*;",
            message: "返回值需要为 localStorage.getItem('task-name') || '未命名'",
          },
        ],
      },
    },
  },
];

function createEmptySubmissions() {
  return {
    A: { passed: false, by: null, feedback: [] },
    B: { passed: false, by: null, feedback: [] },
  };
}

function buildPublicChallenge(challenge) {
  if (!challenge) return null;
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    parts: {
      A: {
        title: challenge.parts.A.title,
        instruction: challenge.parts.A.instruction,
        starterCode: challenge.parts.A.starterCode,
      },
      B: {
        title: challenge.parts.B.title,
        instruction: challenge.parts.B.instruction,
        starterCode: challenge.parts.B.starterCode,
      },
    },
  };
}

function serializeRoom(room) {
  const challenge = COLLAB_CHALLENGES[room.challengeIndex] || null;
  return {
    roomId: room.roomId,
    status: room.status,
    challengeIndex: room.challengeIndex,
    totalChallenges: COLLAB_CHALLENGES.length,
    challenge: buildPublicChallenge(challenge),
    members: [...room.members.values()],
    submissions: room.submissions,
    lastRewards: room.lastRewards || [],
  };
}

function upsertRoom(roomId, challengeIndex = 0) {
  let room = collabRooms.get(roomId);
  if (!room) {
    room = {
      roomId,
      members: new Map(),
      challengeIndex,
      status: 'waiting',
      submissions: createEmptySubmissions(),
      lastRewards: [],
    };
    collabRooms.set(roomId, room);
  } else if (Number.isInteger(challengeIndex)) {
    room.challengeIndex = challengeIndex;
  }
  return room;
}

function validateCollabSubmission(challenge, part, code) {
  const partCfg = challenge?.parts?.[part];
  if (!partCfg) {
    return { pass: false, feedback: ['无效的协作分工'] };
  }
  const text = String(code || '');
  const feedback = [];
  for (const rule of partCfg.checks) {
    const reg = new RegExp(rule.pattern, 'm');
    if (!reg.test(text)) {
      feedback.push(rule.message);
    }
  }
  return { pass: feedback.length === 0, feedback };
}

function removeSocketFromRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return null;
  const room = collabRooms.get(roomId);
  if (!room) return null;
  room.members.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (room.members.size === 0) {
    collabRooms.delete(roomId);
    return null;
  }
  room.status = 'waiting';
  room.submissions = createEmptySubmissions();
  room.lastRewards = [];
  return room;
}

function getChallengeIndexById(challengeId) {
  const idx = COLLAB_CHALLENGES.findIndex((x) => x.id === challengeId);
  return idx >= 0 ? idx : -1;
}

function createRandomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i += 1) {
    let code = 'TEAM-';
    for (let j = 0; j < 6; j += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!collabRooms.has(code)) return code;
  }
  return `TEAM-${Date.now().toString(36).toUpperCase()}`;
}

async function grantCollabRewardsForRoom(room) {
  const challenge = COLLAB_CHALLENGES[room.challengeIndex];
  if (!challenge) return [];
  const challengeId = challenge.id;
  const uniqUsers = new Map();
  for (const m of room.members.values()) {
    uniqUsers.set(m.userId, m.username);
  }

  const rewards = [];
  for (const [userId, username] of uniqUsers.entries()) {
    const profile = await getOrCreateProfile(userId, username);
    const solvedSet = getCollabSolvedSet(profile);
    let awardedExp = 0;
    if (!solvedSet.has(challengeId)) {
      solvedSet.add(challengeId);
      profile.collabSolvedKeys = JSON.stringify([...solvedSet]);
      profile.totalExp = (profile.totalExp || 0) + 20;

      let levelNum = 1;
      let remain = profile.totalExp;
      while (remain >= levelNum * 100) {
        remain -= levelNum * 100;
        levelNum += 1;
      }
      profile.level = levelNum;
      profile.exp = remain;
      await profile.save();
      awardedExp = 20;
    }
    const newlyAwardedBadges = await awardBadgesForUser(userId);
    rewards.push({
      userId,
      username,
      awardedExp,
      newlyAwardedBadges,
      collabSolvedCount: getCollabSolvedSet(profile).size,
    });
  }
  return rewards;
}

function setupCollaborationSocket(io) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers?.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : '');
      if (!token) return next(new Error('未提供身份凭证'));
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = {
        userId: payload.userId,
        username: payload.username,
      };
      next();
    } catch (e) {
      next(new Error('凭证无效'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('collab:join-game', (payload = {}) => {
      const roomId = String(payload.roomId || '').trim();
      const challengeId = String(payload.challengeId || '').trim();
      if (!roomId) {
        socket.emit('collab:error', { message: '房间号不能为空' });
        return;
      }

      const selectedIndex = challengeId ? getChallengeIndexById(challengeId) : -1;
      if (challengeId && selectedIndex < 0) {
        socket.emit('collab:error', { message: '无效的协作关卡' });
        return;
      }

      const exists = collabRooms.get(roomId);
      if (!exists && selectedIndex < 0) {
        socket.emit('collab:error', { message: '新建房间时请先选择协作关卡' });
        return;
      }
      if (exists && selectedIndex >= 0 && exists.challengeIndex !== selectedIndex) {
        socket.emit('collab:error', { message: '该房间已绑定其他关卡' });
        return;
      }

      const room = upsertRoom(roomId, exists ? exists.challengeIndex : selectedIndex);
      if (room.members.size >= 2) {
        socket.emit('collab:error', { message: '房间已满（最多2人）' });
        return;
      }

      const usedParts = new Set([...room.members.values()].map((m) => m.part));
      const part = usedParts.has('A') ? 'B' : 'A';

      socket.join(roomId);
      socket.data.roomId = roomId;
      room.members.set(socket.id, {
        socketId: socket.id,
        userId: socket.user.userId,
        username: socket.user.username,
        part,
      });
      room.status = room.members.size >= 2 ? 'in_progress' : 'waiting';
      room.submissions = createEmptySubmissions();
      room.lastRewards = [];
      io.to(roomId).emit('collab:state', serializeRoom(room));
    });

    socket.on('collab:submit-part', async (payload = {}) => {
      const roomId = String(payload.roomId || socket.data.roomId || '').trim();
      const code = String(payload.code || '');
      if (!roomId) return;
      const room = collabRooms.get(roomId);
      if (!room) return;
      const member = room.members.get(socket.id);
      if (!member) return;
      if (room.members.size < 2) {
        socket.emit('collab:submit-result', { pass: false, feedback: ['请等待第二位队友加入后再提交'] });
        return;
      }
      if (room.status === 'challenge_completed') {
        socket.emit('collab:submit-result', { pass: false, feedback: ['本关已通关，请返回选择其他关卡'] });
        return;
      }

      const challenge = COLLAB_CHALLENGES[room.challengeIndex];
      const result = validateCollabSubmission(challenge, member.part, code);
      room.submissions[member.part] = {
        passed: result.pass,
        by: socket.user.username,
        feedback: result.feedback,
      };
      socket.emit('collab:submit-result', result);

      const bothPassed = room.submissions.A.passed && room.submissions.B.passed;
      if (bothPassed) {
        room.status = 'challenge_completed';
        room.lastRewards = await grantCollabRewardsForRoom(room);
      }
      io.to(roomId).emit('collab:state', serializeRoom(room));
    });

    socket.on('collab:next-challenge', (payload = {}) => {
      const roomId = String(payload.roomId || socket.data.roomId || '').trim();
      if (!roomId) return;
      const room = collabRooms.get(roomId);
      if (!room) return;
      room.status = 'challenge_completed';
      io.to(roomId).emit('collab:state', serializeRoom(room));
    });

    socket.on('collab:leave-game', () => {
      const room = removeSocketFromRoom(socket);
      if (room) {
        io.to(room.roomId).emit('collab:state', serializeRoom(room));
      }
    });

    socket.on('disconnect', () => {
      const room = removeSocketFromRoom(socket);
      if (room) {
        io.to(room.roomId).emit('collab:state', serializeRoom(room));
      }
    });
  });
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
  } catch (e) {
    console.error('❌ 数据库连接失败', e);
  }

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
  });
  setupCollaborationSocket(io);

  server.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };

