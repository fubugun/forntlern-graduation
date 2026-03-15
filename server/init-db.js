const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 使用 SQLite 数据库文件 database.sqlite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// 关卡模型：简单合并章节/对话/代码模板/校验规则到一张表里
const Level = sequelize.define(
  'Level',
  {
    key: {
      type: DataTypes.STRING,
      unique: true,
    },
    chapter: DataTypes.INTEGER,
    order: DataTypes.INTEGER,
    title: DataTypes.STRING,
    coreConcept: DataTypes.STRING,
    taskDescription: DataTypes.TEXT,
    // Markdown 任务书
    taskMarkdown: DataTypes.TEXT,
    // 初始代码模板
    starterHtml: DataTypes.TEXT,
    starterCss: DataTypes.TEXT,
    starterJs: DataTypes.TEXT,
    // 校验配置：type + jsonConfig
    validatorType: DataTypes.STRING, // 'regex' | 'dom' | 'function'
    validatorConfig: DataTypes.TEXT, // JSON 字符串
    // NPC 对话（JSON 数组）
    npcDialogues: DataTypes.TEXT,
  },
  {
    tableName: 'levels',
  }
);

// 用户账号：用于登录认证
const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'student',
    },
  },
  {
    tableName: 'users',
  }
);

// 用户进度/属性：绑定到具体 User
const UserProfile = sequelize.define(
  'UserProfile',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      defaultValue: 'Apprentice',
    },
    exp: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    maxChapter: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    maxOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    totalSolved: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    totalExp: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    totalStudySeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    currentLevelKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currentLevelStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    struggleStats: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
    },
    solvedLevelKeys: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
    },
    lastLoginDate: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    loginStreakDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    aiHintCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    aiHelpedPassCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    aiHintTouchedKeys: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
    },
    collabSolvedKeys: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
    },
  },
  {
    tableName: 'user_profiles',
  }
);

// 用户关卡代码存档：保存每个用户在每道题最近一次提交的代码
const UserLevelSubmission = sequelize.define(
  'UserLevelSubmission',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    levelKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    html: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    css: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    js: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    lastPassed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: 'user_level_submissions',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'levelKey'],
      },
    ],
  }
);

const Badge = sequelize.define(
  'Badge',
  {
    key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ruleType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ruleValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'badges',
  }
);

const UserBadge = sequelize.define(
  'UserBadge',
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    badgeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    awardedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'user_badges',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'badgeId'],
      },
    ],
  }
);

User.hasOne(UserProfile, { foreignKey: 'userId' });
UserProfile.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(UserLevelSubmission, { foreignKey: 'userId' });
UserLevelSubmission.belongsTo(User, { foreignKey: 'userId' });
User.belongsToMany(Badge, { through: UserBadge, foreignKey: 'userId', otherKey: 'badgeId' });
Badge.belongsToMany(User, { through: UserBadge, foreignKey: 'badgeId', otherKey: 'userId' });

async function seed() {
  // 使用普通同步，避免 SQLite 在 alter 过程中触发约束迁移问题
  // 且不会清空已有用户账号和进度数据
  await sequelize.sync();
  await ensureSchemaCompatibility();

  const levels = [
    // 1. HTML 筑基遗迹石碑
    {
      key: 'html-foundation',
      chapter: 1,
      order: 1,
      title: '筑基遗迹石碑',
      coreConcept: '基础标签',
      taskDescription: '用 h1 写名字，用 p 写一段自我简介。',
      taskMarkdown: [
        '# 任务：刻下你的名字',
        '',
        '在这块古老的遗迹石碑上，只有真正的前端学徒才能留下自己的名字。',
        '',
        '- 使用 `<h1>` 标签写下你的名字',
        '- 使用 `<p>` 标签写一小段个人简介',
        '',
        '完成后点击「校验」，如果通过，石碑会发出微光。'
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>筑基遗迹石碑</title>',
        '</head>',
        '<body>',
        '  <!-- 在这里使用 h1 和 p -->',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: '',
      validatorType: 'dom',
      validatorConfig: JSON.stringify({
        mustExistTags: ['h1', 'p'],
      }),
      npcDialogues: JSON.stringify([
        '【遗迹守护者】：“在任何伟大冒险开始前，先让世界知道你的名字。”',
        '【遗迹守护者】：“用 `<h1>` 写下名字，用 `<p>` 讲讲你是谁。”'
      ]),
    },
    // 2. 密码机关 表单元素
    {
      key: 'html-password-form',
      chapter: 1,
      order: 2,
      title: '密码机关',
      coreConcept: '表单元素',
      taskDescription: '创建一个包含密码输入框和提交按钮的表单。',
      taskMarkdown: [
        '# 任务：开启遗迹的密码机关',
        '',
        '遗迹深处封印着更强大的知识，需要密码机关验证。',
        '',
        '- 创建一个 `<form>`',
        '- 使用 `<input type="password">` 作为密码输入框',
        '- 添加一个用于提交的 `<button>` 或 `<input type="submit">`',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>密码机关</title>',
        '</head>',
        '<body>',
        '  <!-- 在这里创建表单、密码输入框和提交按钮 -->',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: '',
      validatorType: 'dom',
      validatorConfig: JSON.stringify({
        mustExistSelectors: ['input[type="password"]', 'button, input[type="submit"]'],
      }),
      npcDialogues: JSON.stringify([
        '【机关术师】：“真正的密码不在石头里，而在表单里。”',
        '【机关术师】：“记得用 `type="password"` 来隐藏输入内容。”'
      ]),
    },
    // 3. CSS 幻化变色披风
    {
      key: 'css-color-and-font',
      chapter: 2,
      order: 1,
      title: '幻化变色披风',
      coreConcept: '样式基础：color 与 font-size',
      taskDescription: '为标题设置颜色和字体大小。',
      taskMarkdown: [
        '# 任务：织就幻化披风',
        '',
        '魔法学院会为优秀学徒赠予一件会发光的披风，颜色和大小都由你决定。',
        '',
        '- 使用 `color` 改变文字颜色（例如 `color: aquamarine;`）',
        '- 使用 `font-size` 调整文字大小（例如 `font-size: 32px;`）',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>幻化变色披风</title>',
        '  <link rel="stylesheet" href="styles.css" />',
        '</head>',
        '<body>',
        '  <h1 class="cloak-title">我的魔法披风</h1>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: [
        'body {',
        '  background: #020617;',
        '  color: #e5e7eb;',
        '  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '}',
        '',
        '.cloak-title {',
        '  /* 在这里设置 color 和 font-size */',
        '}',
      ].join('\n'),
      starterJs: '',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        cssMustMatch: [
          /color\s*:\s*[^;]+;/i.source,
          /font-size\s*:\s*[^;]+;/i.source,
        ],
      }),
      npcDialogues: JSON.stringify([
        '【织法师】：“颜色用 `color`，大小用 `font-size`，写在同一个选择器里。”',
        '【织法师】：“别忘了在 `.cloak-title` 里施放样式咒语。”'
      ]),
    },
    // 4. Flex 吊桥
    {
      key: 'css-flex-bridge',
      chapter: 2,
      order: 2,
      title: 'Flex 吊桥',
      coreConcept: 'Flex 布局 与 justify-content',
      taskDescription: '使用 Flex 布局让三个木板在水面上平均分布。',
      taskMarkdown: [
        '# 任务：搭建 Flex 吊桥',
        '',
        '要跨过这片数据深渊，你需要用 Flex 魔法让三块木板平均分布。',
        '',
        '- 把容器的 `display` 设置为 `flex`',
        '- 使用 `justify-content: space-around;`',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>Flex 吊桥</title>',
        '  <link rel="stylesheet" href="styles.css" />',
        '</head>',
        '<body>',
        '  <div class="bridge">',
        '    <div class="plank">木板 1</div>',
        '    <div class="plank">木板 2</div>',
        '    <div class="plank">木板 3</div>',
        '  </div>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: [
        'body {',
        '  background: radial-gradient(circle at top, #0f172a, #020617);',
        '  min-height: 100vh;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  color: #e5e7eb;',
        '  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '}',
        '',
        '.bridge {',
        '  width: 80%;',
        '  /* 在这里开启 Flex 布局并设置 justify-content */',
        '}',
        '',
        '.plank {',
        '  background: rgba(56, 189, 248, 0.15);',
        '  border: 1px solid rgba(56, 189, 248, 0.5);',
        '  padding: 12px 24px;',
        '  border-radius: 999px;',
        '}',
      ].join('\n'),
      starterJs: '',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        cssMustMatch: [
          /display\s*:\s*flex\s*;/i.source,
          /justify-content\s*:\s*space-around\s*;/i.source,
        ],
      }),
      npcDialogues: JSON.stringify([
        '【桥匠】：“只要一句 `display: flex;`，木板就会懂得排队。”',
        '【桥匠】：“想要它们平均散开？试试 `justify-content: space-around;`。”'
      ]),
    },
    // 5. JS 灵魂能量祭坛：变量声明
    {
      key: 'js-variable-power',
      chapter: 3,
      order: 1,
      title: '灵魂能量祭坛',
      coreConcept: '变量声明 let',
      taskDescription: '声明一个能量值变量 power，并设置初始值。',
      taskMarkdown: [
        '# 任务：点亮灵魂能量祭坛',
        '',
        '每个前端术士都需要管理自己的能量值。',
        '',
        '- 使用 `let` 声明变量 `power`',
        '- 给它一个初始值，例如 `100`',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>灵魂能量祭坛</title>',
        '</head>',
        '<body>',
        '  <h1>灵魂能量祭坛</h1>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 在这里声明变量 power',
        '// 例：let power = 100;',
      ].join('\n'),
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: [/let\\s+power\\s*=\\s*\\d+/i.source],
      }),
      npcDialogues: JSON.stringify([
        '【能量祭司】：“用 `let` 绑定你的能量，记得给它一个初始值。”',
        '【能量祭司】：“变量名就叫 `power`，这是所有法师的传统。”'
      ]),
    },
    // 6. 逻辑石门 条件判断
    {
      key: 'js-if-gate',
      chapter: 3,
      order: 2,
      title: '逻辑石门',
      coreConcept: '条件判断 if',
      taskDescription: '根据 mana 值决定石门是否打开。',
      taskMarkdown: [
        '# 任务：推开逻辑石门',
        '',
        '- 声明变量 `mana`，给它一个数值',
        '- 使用 `if (mana > 50)` 判断是否可以打开石门',
        '- 可以使用 `console.log` 输出不同结果',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>逻辑石门</title>',
        '</head>',
        '<body>',
        '  <h1>逻辑石门</h1>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 声明 mana，并使用 if (mana > 50) 判断是否可以打开石门',
        '// 例：let mana = 80;',
        '// if (mana > 50) { console.log("石门缓缓打开"); }',
      ].join('\n'),
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: [
          /if\\s*\\(\\s*mana\\s*>\\s*50\\s*\\)/i.source,
        ],
      }),
      npcDialogues: JSON.stringify([
        '【石门守卫】：“能量不够，石门绝不会为你而开。”',
        '【石门守卫】：“记得用 `if (mana > 50)` 来判断。”'
      ]),
    },
    // 7. DOM 契约 元素召唤
    {
      key: 'js-dom-query',
      chapter: 3,
      order: 3,
      title: 'DOM 契约：元素召唤',
      coreConcept: 'document.querySelector',
      taskDescription: '使用 querySelector 找到 ID 为 door 的元素。',
      taskMarkdown: [
        '# 任务：与大门签订 DOM 契约',
        '',
        '- 页面中有一个 id 为 `door` 的元素',
        '- 使用 `document.querySelector("#door")` 找到它',
        '- 把结果保存到一个变量中',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>DOM 契约</title>',
        '</head>',
        '<body>',
        '  <div id="door">沉睡的大门</div>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 使用 document.querySelector 找到 id 为 door 的元素',
        '// 例：const doorEl = document.querySelector("#door");',
      ].join('\n'),
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        // 这里用字符串形式，避免正则字面量在解析阶段出错
        jsMustMatch: ['querySelector\\s*\\('],
      }),
      npcDialogues: JSON.stringify([
        '【契约文书】：“在 DOM 的世界里，一切元素都可以被召唤。”',
        '【契约文书】：“试着用 `document.querySelector("#door")` 呼唤大门的真名。”'
      ]),
    },
    // 8. 魔法触碰 点击事件
    {
      key: 'js-click-event',
      chapter: 3,
      order: 4,
      title: '魔法触碰',
      coreConcept: '点击事件 addEventListener',
      taskDescription: '点击按钮时修改文字内容。',
      taskMarkdown: [
        '# 任务：施放点击魔法',
        '',
        '- 获取按钮元素',
        '- 使用 `addEventListener("click", handler)` 监听点击',
        '- 在回调中修改某个元素的文字内容',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>魔法触碰</title>',
        '</head>',
        '<body>',
        '  <button id="castBtn">点击施法</button>',
        '  <p id="result">尚未施法</p>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 监听按钮点击事件，并修改 #result 的文字内容',
        '// 例：',
        '// const btn = document.querySelector("#castBtn");',
        '// btn.addEventListener("click", () => {',
        '//   document.querySelector("#result").textContent = "魔法已释放";',
        '// });',
      ].join('\n'),
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['addEventListener\\s*\\(\\s*["\']click["\']'],
      }),
      npcDialogues: JSON.stringify([
        '【触碰术导师】：“魔法需要触发条件，`click` 就是一种。”',
        '【触碰术导师】：“用 `addEventListener` 把事件和咒语绑定在一起。”'
      ]),
    },
    // 9. 综合实战 探险笔记 Todo App
    {
      key: 'project-todo-app',
      chapter: 4,
      order: 1,
      title: '综合实战：探险笔记',
      coreConcept: 'HTML + CSS + JS 项目集成',
      taskDescription: '实现一个简单的 Todo App，用来记录你的探险笔记。',
      taskMarkdown: [
        '# 任务：构建探险笔记本',
        '',
        '- 页面上需要有一个文本输入框，用来输入待办事项',
        '- 需要有一个列表（例如 `<ul>`）展示所有任务',
        '- 使用 JavaScript 让点击按钮时把输入内容添加到列表中',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>探险笔记 Todo</title>',
        '</head>',
        '<body>',
        '  <h1>探险笔记</h1>',
        '  <input id="todoInput" placeholder="记录今天的探险…" />',
        '  <button id="addBtn">添加</button>',
        '  <ul id="todoList"></ul>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 获取 input、button、ul 元素',
        '// 在点击按钮时，把 input 的值添加为一个新的 li 到列表中',
      ].join('\n'),
      validatorType: 'dom',
      validatorConfig: JSON.stringify({
        mustExistSelectors: ['input', 'ul'],
      }),
      npcDialogues: JSON.stringify([
        '【记录官】：“再伟大的冒险，如果不写下来，也会被时间吞没。”',
        '【记录官】：“用一个输入框和一个列表，打造属于你的探险 Todo。”'
      ]),
    },
    // 10. 记忆之石 本地存储
    {
      key: 'project-localstorage',
      chapter: 5,
      order: 1,
      title: '记忆之石',
      coreConcept: 'localStorage 本地存储',
      taskDescription: '使用 localStorage 保存数据，实现简单的持久化。',
      taskMarkdown: [
        '# 任务：唤醒记忆之石',
        '',
        '- 在添加 Todo 时，把数据保存到 `localStorage` 中',
        '- 刷新页面时，从 `localStorage` 读取数据并渲染到列表',
        '',
        '你可以在上一关的 Todo 代码基础上继续扩展。',
      ].join('\n'),
      starterHtml: [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <title>记忆之石</title>',
        '</head>',
        '<body>',
        '  <h1>记忆之石 Todo</h1>',
        '  <input id="todoInput" placeholder="记录将被封存在石中的记忆…" />',
        '  <button id="addBtn">添加</button>',
        '  <ul id="todoList"></ul>',
        '  <script src="script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      starterCss: '',
      starterJs: [
        '// 使用 localStorage 保存和读取待办事项',
        '// 例：localStorage.setItem("todos", JSON.stringify(todos));',
      ].join('\n'),
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['localStorage\\.setItem\\s*\\('],
      }),
      npcDialogues: JSON.stringify([
        '【记忆守护者】：“真正重要的事，必须刻在记忆之石上。”',
        '【记忆守护者】：“`localStorage.setItem` 就是刻字的魔法。”'
      ]),
    },
    // 11. 响应式布局
    {
      key: 'css-responsive-layout',
      chapter: 5,
      order: 2,
      title: '风暴营地：响应式布局',
      coreConcept: 'media query + 响应式',
      taskDescription: '让卡片在小屏单列、大屏双列显示。',
      taskMarkdown: [
        '# 任务：搭建响应式营地',
        '',
        '- 使用 `@media` 媒体查询',
        '- 小于 768px 时单列',
        '- 大于等于 768px 时改为双列',
      ].join('\n'),
      starterHtml: '<div class="cards"><div class="card">A</div><div class="card">B</div></div>',
      starterCss: '.cards { display: grid; grid-template-columns: 1fr; gap: 12px; }',
      starterJs: '',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        cssMustMatch: ['@media', 'grid-template-columns\\s*:\\s*repeat\\s*\\(\\s*2\\s*,\\s*1fr\\s*\\)'],
      }),
      npcDialogues: JSON.stringify([
        '【风暴工匠】：“真正的法阵要适配不同尺寸的战场。”',
      ]),
    },
    // 12. CSS 动画
    {
      key: 'css-animation-orb',
      chapter: 5,
      order: 3,
      title: '光球律动：CSS 动画',
      coreConcept: '@keyframes 与 animation',
      taskDescription: '创建一个会循环移动或缩放的魔法光球动画。',
      taskMarkdown: '# 任务：定义 `@keyframes`，并在元素上使用 `animation` 属性。',
      starterHtml: '<div class="orb"></div>',
      starterCss: '.orb { width: 60px; height: 60px; border-radius: 9999px; background: #22c55e; }',
      starterJs: '',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        cssMustMatch: ['@keyframes', 'animation\\s*:'],
      }),
      npcDialogues: JSON.stringify(['【律动师】：“让样式动起来，页面才会有生命。”']),
    },
    // 13. JS 数组方法
    {
      key: 'js-array-map',
      chapter: 6,
      order: 1,
      title: '镜像长廊：数组映射',
      coreConcept: 'Array.map',
      taskDescription: '把 [1,2,3] 变成 [2,4,6] 并输出结果。',
      taskMarkdown: '# 任务：使用 `map` 完成数组翻倍。',
      starterHtml: '<script src="script.js"></script>',
      starterCss: '',
      starterJs: 'const nums = [1, 2, 3];\n// 在这里使用 map',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['\\.map\\s*\\('],
      }),
      npcDialogues: JSON.stringify(['【镜像守卫】：“对每个元素施法，得到新的序列。”']),
    },
    // 14. 异步基础
    {
      key: 'js-async-await',
      chapter: 6,
      order: 2,
      title: '时间裂隙：异步咒语',
      coreConcept: 'async/await',
      taskDescription: '编写一个 async 函数并使用 await 获取结果。',
      taskMarkdown: '# 任务：写出 `async function`，并在函数体内使用 `await`。',
      starterHtml: '<script src="script.js"></script>',
      starterCss: '',
      starterJs: '// 在这里编写 async / await 示例',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['async\\s+function', 'await\\s+'],
      }),
      npcDialogues: JSON.stringify(['【时序导师】：“控制异步节奏，是高阶冒险者的必修课。”']),
    },
    // 15. Fetch API
    {
      key: 'js-fetch-api',
      chapter: 6,
      order: 3,
      title: '远程信标：Fetch 通讯',
      coreConcept: 'fetch API',
      taskDescription: '请求一个接口并处理 JSON 响应。',
      taskMarkdown: '# 任务：使用 `fetch` 并调用 `.json()`。',
      starterHtml: '<script src="script.js"></script>',
      starterCss: '',
      starterJs: '// 调用 fetch 并解析 json',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['fetch\\s*\\(', '\\.json\\s*\\('],
      }),
      npcDialogues: JSON.stringify(['【信标使者】：“和远方系统沟通，是现代前端的关键能力。”']),
    },
    // 16. DOM 表单校验
    {
      key: 'dom-form-validate',
      chapter: 7,
      order: 1,
      title: '审判之门：表单校验',
      coreConcept: 'input 事件 + 条件校验',
      taskDescription: '监听输入框内容长度，不足时显示提示。',
      taskMarkdown: '# 任务：监听输入变化并更新提示文案。',
      starterHtml: '<input id="nameInput" /><p id="msg"></p>',
      starterCss: '',
      starterJs: '// 监听 input 事件并更新 #msg',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['addEventListener\\s*\\(\\s*["\']input["\']', 'textContent\\s*='],
      }),
      npcDialogues: JSON.stringify(['【审判官】：“在用户提交前，先帮他发现问题。”']),
    },
    // 17. 事件委托
    {
      key: 'dom-event-delegation',
      chapter: 7,
      order: 2,
      title: '连锁回响：事件委托',
      coreConcept: 'event.target + 父容器监听',
      taskDescription: '在父容器上监听点击，处理子元素按钮点击。',
      taskMarkdown: '# 任务：在列表容器上做事件委托。',
      starterHtml: '<ul id="list"><li><button data-id="1">点我</button></li></ul>',
      starterCss: '',
      starterJs: '// 在 #list 上监听 click，并判断 event.target',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['event\\.target', 'addEventListener\\s*\\(\\s*["\']click["\']'],
      }),
      npcDialogues: JSON.stringify(['【回响术士】：“把监听挂在父级，可以节省很多魔力。”']),
    },
    // 18. 综合项目：计时器
    {
      key: 'project-timer-app',
      chapter: 8,
      order: 1,
      title: '时之沙漏：计时器项目',
      coreConcept: 'setInterval + 状态更新',
      taskDescription: '实现一个开始/暂停的倒计时小工具。',
      taskMarkdown: '# 任务：使用 `setInterval` 驱动倒计时，并支持暂停。',
      starterHtml: '<h1 id="time">60</h1><button id="startBtn">开始</button><button id="pauseBtn">暂停</button>',
      starterCss: '',
      starterJs: '// 使用 setInterval 实现倒计时',
      validatorType: 'regex',
      validatorConfig: JSON.stringify({
        jsMustMatch: ['setInterval\\s*\\(', 'clearInterval\\s*\\('],
      }),
      npcDialogues: JSON.stringify(['【沙漏守卫】：“掌握时间控制，你就能构建更多真实应用。”']),
    },
  ];

  // 幂等写入关卡：已有则更新，不存在则插入
  for (const level of levels) {
    await Level.upsert(level);
  }

  const badges = [
    { key: 'newcomer', name: '初入江湖', description: '注册成功后自动获得', ruleType: 'register', ruleValue: 1 },
    { key: 'html-master', name: '结构大师', description: '完成 HTML 章节', ruleType: 'chapterComplete', ruleValue: 1 },
    { key: 'css-magician', name: '色彩幻术师', description: '完成 CSS 章节', ruleType: 'chapterComplete', ruleValue: 2 },
    { key: 'js-awaken', name: '逻辑觉醒', description: '完成 JS 章节', ruleType: 'chapterComplete', ruleValue: 3 },
    { key: 'consistent-learner', name: '持之以恒', description: '连续登录 3 天', ruleType: 'loginStreakDays', ruleValue: 3 },
    { key: 'collab-master', name: '协作大师', description: '完成 5 道协作挑战', ruleType: 'collabComplete', ruleValue: 5 },
    { key: 'all-round-explorer', name: '全能探险家', description: '完成所有 18 关', ruleType: 'allLevelsComplete', ruleValue: 18 },
  ];

  for (const badge of badges) {
    await Badge.upsert(badge);
  }
  await Badge.destroy({
    where: {
      key: {
        [Sequelize.Op.notIn]: badges.map((b) => b.key),
      },
    },
  });

  console.log('✅ 数据库已初始化，关卡已写入。');
}

async function ensureSchemaCompatibility() {
  const userTable = await sequelize.getQueryInterface().describeTable('users');
  if (!Object.prototype.hasOwnProperty.call(userTable, 'role')) {
    await sequelize.getQueryInterface().addColumn('users', 'role', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'student',
    });
  }

  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('user_profiles');
  const addIfMissing = async (name, spec) => {
    if (!Object.prototype.hasOwnProperty.call(table, name)) {
      await qi.addColumn('user_profiles', name, spec);
    }
  };

  await addIfMissing('totalSolved', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('totalExp', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('totalStudySeconds', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('currentLevelKey', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('currentLevelStartedAt', { type: DataTypes.DATE, allowNull: true });
  await addIfMissing('lastActiveAt', { type: DataTypes.DATE, allowNull: true });
  await addIfMissing('struggleStats', { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' });
  await addIfMissing('solvedLevelKeys', { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' });
  await addIfMissing('lastLoginDate', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('loginStreakDays', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('aiHintCount', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('aiHelpedPassCount', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await addIfMissing('aiHintTouchedKeys', { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' });
  await addIfMissing('collabSolvedKeys', { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' });
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = {
  sequelize,
  Level,
  User,
  UserProfile,
  UserLevelSubmission,
  Badge,
  UserBadge,
  seed,
};

