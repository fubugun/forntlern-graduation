## 游戏化前端学习与 AI 辅导平台

### 答辩文档包

- `docs/01-功能对照表.md`
- `docs/02-系统设计与实现.md`
- `docs/03-测试与验收报告.md`
- `docs/04-学习效果数据分析方案.md`
- `docs/05-答辩演示提纲.md`

### 一键运行

在项目根目录执行：

```bash
npm install
node start.js
```

`start.js` 会自动完成：

- 安装根依赖（含 `concurrently`）
- 为 `server` 安装：`express`、`sequelize`、`sqlite3`、`cors`、`jsdom`
- 为 `client` 安装：`vue`、`vite`、`@vitejs/plugin-vue`、`tailwindcss`、`postcss`、`autoprefixer`、`monaco-editor`
- 同步 SQLite 表结构并执行 SeedData（10 个 HTML/CSS/JS/DOM 关卡 + 默认用户档案）
- 同时启动后端（端口 `3000`）和前端（端口 `5173`）

浏览器打开：

- 前端工作台与世界地图：`http://localhost:5173`

---

### 接入真实 AI（必看）

当前项目已支持调用外部大模型（OpenAI 兼容接口）。  
如果未配置密钥，会自动回退到本地规则引擎，不会影响功能可用性。

在启动前先设置环境变量（PowerShell）：

```powershell
$env:AI_API_KEY="你的密钥"
$env:AI_BASE_URL="https://api.openai.com/v1"
$env:AI_MODEL="gpt-4o-mini"
node start.js
```

说明：

- `AI_API_KEY`：必填，有值才会调用外部 AI
- `AI_BASE_URL`：可选，默认 `https://api.openai.com/v1`（也可换成 DeepSeek/其他 OpenAI 兼容网关）
- `AI_MODEL`：可选，默认 `gpt-4o-mini`

当前已接入 AI 的接口：

- `/api/ai/solve-hint`：根据你本次代码和校验错误给个性化提示
- `/api/ai/learning-path`：生成学习路径建议
- `/api/ai/remedial-plan`：生成补强练习题

---

### sqlite3 / node-gyp 安装报错排查（Windows）

如果在 `npm install` 时遇到与 `sqlite3` / `node-gyp` 相关的报错，可以尝试：

1. **确保 Node 版本为 LTS 且 16+**

```bash
node -v
```

2. **安装 Windows 构建工具（任选其一）：**

- 方式 A：使用 npm 安装

```bash
npm install --global --production windows-build-tools
```

- 方式 B：手动安装

  - 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - 勾选「使用 C++ 的桌面开发」组件

3. **重新安装依赖**

```bash
npm install
node start.js
```

如果仍有问题，可以删除 `node_modules` 和 `package-lock.json` 后重试：

```bash
rm -rf node_modules package-lock.json
npm install
```

