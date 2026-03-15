const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

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

function run(command, options = {}) {
  console.log(`\n▶ ${command}`);
  execSync(command, { stdio: 'inherit', ...options });
}

function ensurePackageJson(dir, template) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify(template, null, 2), 'utf-8');
  }
}

async function main() {
  const rootDir = __dirname;
  const serverDir = path.join(rootDir, 'server');
  const clientDir = path.join(rootDir, 'client');
  loadEnvFromFile(path.join(rootDir, '.env'));

  cleanupStaleDevPorts();

  const clientPort = await pickAvailablePort(5173, 10);
  if (clientPort !== 5173) {
    console.log(`\n⚠️  端口 5173 被占用，前端将自动使用 ${clientPort}`);
  }

  // 1. 确保 server/client package.json 存在（简化模板，后续可再细化）
  ensurePackageJson(serverDir, {
    name: 'frontlearn-server',
    version: '1.0.0',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      'init-db': 'node init-db.js',
    },
  });

  ensurePackageJson(clientDir, {
    name: 'frontlearn-client',
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
  });

  // 2. 安装根依赖（用于 concurrently 等）
  const rootPkgPath = path.join(rootDir, 'package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  rootPkg.scripts = rootPkg.scripts || {};
  if (!rootPkg.scripts.start) {
    rootPkg.scripts.start = 'node start.js';
  }
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2), 'utf-8');

  console.log('\n📦 安装根依赖（concurrently）...');
  run('npm install concurrently', { cwd: rootDir });

  // 3. 安装 server 依赖
  console.log('\n📦 安装 server 依赖（express, sequelize, sqlite3, cors, jsdom, bcryptjs, jsonwebtoken, socket.io）...');
  run('npm install express sequelize sqlite3 cors jsdom bcryptjs jsonwebtoken socket.io', { cwd: serverDir });

  // 4. 安装 client 依赖（vue、vite、tailwind、monaco 等）
  console.log('\n📦 安装 client 依赖（vue, vite, tailwindcss, monaco-editor 等）...');
  run(
    'npm install vue vite @vitejs/plugin-vue tailwindcss@3.4.15 postcss autoprefixer monaco-editor canvas-confetti socket.io-client',
    {
      cwd: clientDir,
    }
  );

  // 5. 初始化数据库并执行种子（SeedData）
  console.log('\n🗄  初始化 SQLite 数据库并执行 Seeder...');
  await seedData(serverDir);

  // 6. 使用 concurrently 同时启动前后端（前后端 index.js / Vite 项目需后续补充）
  console.log('\n🚀 使用 concurrently 启动前后端（如需停止请按 Ctrl+C）...');
  console.log(`🌐 前端地址（首选）：http://localhost:${clientPort}（若占用会自动尝试 5174/5175...）`);
  console.log('🛰 后端地址：http://localhost:3000');
  const concurrentlyCmd =
    process.platform === 'win32'
      ? `npx concurrently "npm start --prefix server" "npm run dev --prefix client -- --port ${clientPort}"`
      : `npx concurrently "npm start --prefix server" "npm run dev --prefix client -- --port ${clientPort}"`;

  const child = spawn(concurrentlyCmd, {
    shell: true,
    cwd: rootDir,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function cleanupStaleDevPorts() {
  if (process.platform !== 'win32') return;
  const ports = [3000, 5173, 5174, 5175, 5176, 5177, 5178];
  for (const port of ports) {
    const pids = getPidsOnPort(port);
    for (const pid of pids) {
      if (pid === process.pid) continue;
      if (!isNodeProcess(pid)) continue;
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`🧹 已清理占用端口 ${port} 的旧进程 PID=${pid}`);
      } catch (e) {
        // ignore
      }
    }
  }
}

function getPidsOnPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    const lines = output
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch (e) {
    return [];
  }
}

function isNodeProcess(pid) {
  try {
    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf-8' }).trim();
    return output.toLowerCase().includes('node.exe');
  } catch (e) {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function pickAvailablePort(startPort, maxOffset = 10) {
  for (let i = 0; i <= maxOffset; i += 1) {
    const p = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(p);
    if (free) return p;
  }
  return startPort;
}

async function seedData(serverDir) {
  // 这里直接调用 server 的 init-db 脚本，
  // 内部会 sync() 并插入预置的 10 个关卡 + 用户进度档案
  run('npm run init-db', { cwd: serverDir });
}

main().catch((err) => {
  console.error('启动过程出现错误：', err);
  process.exit(1);
});

