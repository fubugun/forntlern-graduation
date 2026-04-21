# 游戏化前端学习平台

面向前端入门的闯关式学习平台，集成在线编辑、实时预览与规则判题，支持题库管理与 Vue 专题扩展。

---

## 功能概要

- **游戏化闯关**：按章节解锁关卡，地图选关，完成任务获得经验与徽章。
- **在线编码**：内置 Monaco 编辑器，支持 HTML/CSS/JS 编辑，右侧 iframe 实时预览。
- **规则校验**：服务端校验引擎对提交代码做正则 / DOM / 自定义关卡校验。
- **用户体系**：注册登录、个人档案（EXP、等级、通关进度、当前关卡）。
- **管理员**：`admin` 角色可进入管理后台；管理用户与题库；学习侧可无解锁限制进入任意关、查看参考答案、一键填入答案。
- **题库扩展**：支持 Vue 3 等专题关卡；关卡数据由 SQLite 种子初始化，可在线编辑任务书、初始代码与校验 JSON。

---

## 系统架构

**逻辑分层**

- **客户端（`client/`）**：Vue 3 + Vite + Tailwind；地图、工作台、编辑器、预览、管理页等。
- **服务端（`server/`）**：Node.js + Express；REST API、JWT 鉴权、关卡与进度、校验引擎、SQLite 持久化。
- **数据**：SQLite（`database.sqlite`，建议勿将本地库提交到 Git）。

**架构图（Mermaid）**

```mermaid
flowchart LR
  subgraph Client["浏览器"]
    UI[Vue3 前端]
    ED[Monaco 编辑器]
    PV[iframe 预览]
  end
  subgraph Server["Node 服务"]
    API[Express REST API]
    VE[ValidationEngine]
    AUTH[JWT 鉴权]
  end
  subgraph Data["数据层"]
    DB[(SQLite)]
  end
  UI --> API
  ED --> API
  API --> AUTH
  API --> VE
  API --> DB
```
---
## 操作逻辑
<img width="2738" height="2787" alt="exported_image (0)" src="https://github.com/user-attachments/assets/5f596049-7aa5-4ebe-8df5-4a92f83c9b4a" />

---

## 技术说明

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3、Vite、Tailwind CSS、Monaco Editor |
| 后端 | Node.js、Express |
| ORM / 数据库 | Sequelize、SQLite（sqlite3） |
| 校验 | 服务端 JSDOM + 正则 / 自定义关卡规则 |

---

## 配置说明

- **前端 API 地址**：`client` 侧可通过环境变量 `VITE_API_BASE` 指向后端（默认多为 `http://localhost:3000`）。
- **数据库**：首次运行 `start.js` 或执行数据库初始化脚本会创建表并写入关卡种子数据。
- **环境变量**：若项目使用 `.env`（如 JWT 密钥、端口），请放在项目约定目录，勿提交敏感信息。
- **管理员**：按项目约定创建或使用默认管理员账号（以 `server` 内登录/注册逻辑为准）。

---

## 运行方式

在项目根目录执行：

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


浏览器打开：：`http://localhost:5173`

---

## 运行截图
### 普通用户
登录
<img width="2115" height="1165" alt="屏幕截图 2026-03-22 145132" src="https://github.com/user-attachments/assets/e7746abf-44c4-4081-ab9a-cef1fda9d7d5" />

做题
<img width="2479" height="1286" alt="屏幕截图 2026-03-22 145154" src="https://github.com/user-attachments/assets/35dfda4c-11ad-4ac4-a27f-655eeb72e6d6" />
校验
<img width="2447" height="1260" alt="屏幕截图 2026-03-22 145223" src="https://github.com/user-attachments/assets/bda919db-8a27-4987-bccf-f888f03bdb76" />

地图
<img width="2009" height="1394" alt="屏幕截图 2026-03-22 145235" src="https://github.com/user-attachments/assets/813d9b68-ecc8-4300-870c-d2a6c40368e3" />

排行榜
<img width="591" height="1092" alt="屏幕截图 2026-03-22 145247" src="https://github.com/user-attachments/assets/269b10c2-22e2-49b3-a9ed-bdb007046f54" />

徽章
<img width="627" height="1045" alt="屏幕截图 2026-03-22 145251" src="https://github.com/user-attachments/assets/9e365662-0583-4b5d-b389-9291b7054f4f" />

双人协作
<img width="2419" height="1165" alt="屏幕截图 2026-03-22 145306" src="https://github.com/user-attachments/assets/b6cd3f3f-cab5-4c00-8f3c-244903075ee9" />

学习补强
<img width="600" height="802" alt="屏幕截图 2026-03-22 145259" src="https://github.com/user-attachments/assets/daff0c22-c3b4-44bd-a569-15cecfdab9fb" />

---

### 管理员
管理用户
<img width="2423" height="1291" alt="屏幕截图 2026-03-22 145325" src="https://github.com/user-attachments/assets/05fc62d9-97ba-4a1b-a264-fc9ddee694ee" />
<img width="2469" height="1251" alt="屏幕截图 2026-03-22 145330" src="https://github.com/user-attachments/assets/ff1a8c23-2c81-492f-a8b5-76660cec5201" />
<img width="2465" height="1324" alt="屏幕截图 2026-03-22 145335" src="https://github.com/user-attachments/assets/40809776-76e9-4103-9d58-af1edf6bc5d1" />
<img width="2453" height="1361" alt="屏幕截图 2026-03-22 145348" src="https://github.com/user-attachments/assets/df963497-efbb-41f8-a346-f238e1c1a73a" />


---


