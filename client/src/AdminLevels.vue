<template>
  <div class="min-h-screen bg-slate-950 p-6 text-slate-100">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-sky-200">管理员后台</h1>
        <div class="text-[11px] text-slate-400">当前模式：管理模式</div>
      </div>
      <a href="/" class="text-xs text-sky-300 hover:text-sky-200">返回学习页</a>
    </div>

    <div class="mb-4 flex gap-2">
      <button
        class="rounded border px-3 py-1 text-xs"
        :class="activeTab === 'users' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-700 text-slate-300'"
        @click="activeTab = 'users'"
      >
        管理用户
      </button>
      <button
        class="rounded border px-3 py-1 text-xs"
        :class="activeTab === 'levels' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-700 text-slate-300'"
        @click="activeTab = 'levels'"
      >
        管理题库
      </button>
      <button
        class="rounded border px-3 py-1 text-xs"
        :class="activeTab === 'insight' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-700 text-slate-300'"
        @click="activeTab = 'insight'"
      >
        查看分析
      </button>
    </div>

    <div v-if="error" class="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{{ error }}</div>

    <div v-if="activeTab === 'users'" class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div class="mb-2 text-xs text-slate-300">用户列表（积分 / 等级 / 进度）</div>
      <div class="max-h-[72vh] overflow-y-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-400">
            <tr class="border-b border-slate-800">
              <th class="px-2 py-2 text-left">用户名</th>
              <th class="px-2 py-2 text-left">角色</th>
              <th class="px-2 py-2 text-left">EXP</th>
              <th class="px-2 py-2 text-left">等级</th>
              <th class="px-2 py-2 text-left">已通关</th>
              <th class="px-2 py-2 text-left">当前关卡</th>
              <th class="px-2 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-b border-slate-900/80">
              <td class="px-2 py-2">{{ u.username }}</td>
              <td class="px-2 py-2">
                <span
                  class="rounded px-2 py-0.5"
                  :class="u.role === 'admin' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'"
                >
                  {{ u.role }}
                </span>
              </td>
              <td class="px-2 py-2">{{ u.profile?.totalExp ?? 0 }}</td>
              <td class="px-2 py-2">{{ u.profile?.level ?? 1 }}</td>
              <td class="px-2 py-2">{{ u.profile?.totalSolved ?? 0 }}</td>
              <td class="px-2 py-2">{{ u.profile?.currentLevelKey || '-' }}</td>
              <td class="px-2 py-2">
                <button
                  class="rounded border border-sky-500/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/10"
                  @click="openAnalytics(u)"
                >
                  查看
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="activeTab === 'levels'" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div
          v-for="l in levels"
          :key="l.key"
          class="mb-2 cursor-pointer rounded border px-3 py-2 text-xs"
          :class="selected?.key === l.key ? 'border-sky-400/60 bg-sky-500/10' : 'border-slate-700 hover:border-slate-500'"
          @click="selectLevel(l)"
        >
          第{{ l.chapter }}章-{{ l.order }} {{ l.title }}
        </div>
      </div>
      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div v-if="!selected" class="text-xs text-slate-400">请选择左侧关卡进行编辑</div>
        <div v-else class="space-y-2">
          <div class="text-xs text-slate-300">当前：{{ selected.title }}</div>
          <label class="text-xs text-slate-300">任务说明 taskMarkdown</label>
          <textarea v-model="form.taskMarkdown" class="h-24 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" />
          <label class="text-xs text-slate-300">初始化代码 initCode.html</label>
          <textarea v-model="form.html" class="h-20 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" />
          <label class="text-xs text-slate-300">初始化代码 initCode.css</label>
          <textarea v-model="form.css" class="h-20 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" />
          <label class="text-xs text-slate-300">初始化代码 initCode.js</label>
          <textarea v-model="form.js" class="h-20 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" />
          <label class="text-xs text-slate-300">校验规则 validationRules (JSON)</label>
          <textarea v-model="form.validationRulesText" class="h-24 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" />
          <button class="w-full rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600" @click="save">
            保存修改
          </button>
        </div>
      </div>
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
        <div v-if="!selectedUser">请先在「管理用户」里点击某个用户的“查看”。</div>
        <div v-else class="flex items-center justify-between">
          <div>
            <div class="text-sm text-sky-200">学习分析：{{ selectedUser.username }}</div>
            <div class="text-[11px] text-slate-400">更关注学习趋势与突破点，便于你做个性化辅导</div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/40"
              @click="backToManageView"
            >
              返回管理界面
            </button>
            <button
              class="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/40"
              @click="reloadAnalytics"
            >
              刷新数据
            </button>
          </div>
        </div>
      </div>

      <div v-if="analyticsLoading" class="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
        正在分析中...
      </div>

      <template v-else-if="analyticsData">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div class="mb-2 text-xs text-slate-300">用户完成率柱状图</div>
            <div class="space-y-2">
              <div v-for="item in analyticsData.completionBars" :key="item.label" class="space-y-1">
                <div class="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{{ item.label }}</span>
                  <span>{{ item.solved }}/{{ item.total }} ({{ item.rate }}%)</span>
                </div>
                <div class="h-2 rounded bg-slate-800">
                  <div class="h-2 rounded bg-emerald-400" :style="{ width: `${item.rate}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div class="mb-2 text-xs text-slate-300">章节卡关热力图</div>
            <div class="grid grid-cols-1 gap-2">
              <div
                v-for="item in analyticsData.chapterHeat"
                :key="item.label"
                class="rounded border px-3 py-2 text-[11px]"
                :class="heatClass(item.level)"
              >
                <div class="flex items-center justify-between">
                  <span>{{ item.label }}</span>
                  <span>卡关热度 {{ item.stuckScore }}%</span>
                </div>
                <div class="mt-1 text-[10px] opacity-85">{{ item.note }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div class="mb-2 text-xs text-slate-300">提示调用前后通过率对比图</div>
            <div class="space-y-3">
              <div>
                <div class="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                  <span>未使用提示</span>
                  <span>{{ analyticsData.aiCompare.withoutAiPassRate }}%</span>
                </div>
                <div class="h-2 rounded bg-slate-800">
                  <div class="h-2 rounded bg-slate-400" :style="{ width: `${analyticsData.aiCompare.withoutAiPassRate}%` }"></div>
                </div>
              </div>
              <div>
                <div class="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                  <span>使用提示后</span>
                  <span>{{ analyticsData.aiCompare.withAiPassRate }}%</span>
                </div>
                <div class="h-2 rounded bg-slate-800">
                  <div class="h-2 rounded bg-sky-400" :style="{ width: `${analyticsData.aiCompare.withAiPassRate}%` }"></div>
                </div>
              </div>
              <div class="text-[10px] text-slate-400">
                已调用提示 {{ analyticsData.aiCompare.aiHintCount }} 次，提示后通关 {{ analyticsData.aiCompare.aiHelpedPassCount }} 次
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div class="mb-2 text-xs text-slate-300">协作参与与通关率漏斗图</div>
            <div class="space-y-2">
              <div v-for="(item, idx) in analyticsData.collabFunnel" :key="item.label">
                <div class="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                  <span>{{ item.label }}</span>
                  <span>{{ item.achieved ? '达成' : '未达成' }}</span>
                </div>
                <div v-if="item.detail" class="mb-1 text-[10px] text-slate-400">{{ item.detail }}</div>
                <div class="h-2 rounded bg-slate-800">
                  <div
                    class="h-2 rounded"
                    :class="item.progress > 0 ? 'bg-amber-400' : 'bg-slate-600'"
                    :style="{ width: `${funnelWidth(item.progress, idx)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div class="mb-2 text-xs text-slate-300">学习观察</div>
          <p class="text-sm leading-6 text-slate-100">{{ analyticsData.aiNarrative }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  token: { type: String, required: true },
});

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const activeTab = ref('users');
const users = ref([]);
const levels = ref([]);
const selected = ref(null);
const error = ref('');
const selectedUser = ref(null);
const analyticsData = ref(null);
const analyticsLoading = ref(false);
const form = ref({
  taskMarkdown: '',
  html: '',
  css: '',
  js: '',
  validationRulesText: '{}',
});

async function loadUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: { Authorization: `Bearer ${props.token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || '加载用户失败';
    return;
  }
  users.value = data;
}

async function loadLevels() {
  const res = await fetch(`${API_BASE}/api/admin/levels`, {
    headers: { Authorization: `Bearer ${props.token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || '加载题库失败';
    return;
  }
  levels.value = data;
}

async function loadAnalytics(userId) {
  analyticsLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/analytics`, {
      headers: { Authorization: `Bearer ${props.token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || '加载分析失败';
      return;
    }
    analyticsData.value = data.analytics;
  } finally {
    analyticsLoading.value = false;
  }
}

async function openAnalytics(user) {
  selectedUser.value = user;
  analyticsData.value = null;
  activeTab.value = 'insight';
  await loadAnalytics(user.id);
}

async function reloadAnalytics() {
  if (!selectedUser.value) return;
  await loadAnalytics(selectedUser.value.id);
}

function backToManageView() {
  activeTab.value = 'users';
}

function selectLevel(level) {
  selected.value = level;
  form.value = {
    taskMarkdown: level.taskMarkdown || '',
    html: level.starterHtml || '',
    css: level.starterCss || '',
    js: level.starterJs || '',
    validationRulesText: level.validatorConfig || '{}',
  };
}

async function save() {
  if (!selected.value) return;
  let validationRules = {};
  try {
    validationRules = JSON.parse(form.value.validationRulesText || '{}');
  } catch (e) {
    error.value = 'validationRules 不是合法 JSON';
    return;
  }
  const res = await fetch(`${API_BASE}/api/admin/levels/${selected.value.key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${props.token}`,
    },
    body: JSON.stringify({
      taskMarkdown: form.value.taskMarkdown,
      initCode: { html: form.value.html, css: form.value.css, js: form.value.js },
      validationRules,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || '保存失败';
    return;
  }
  await loadLevels();
  const updated = levels.value.find((x) => x.key === selected.value.key);
  if (updated) selectLevel(updated);
}

function heatClass(level) {
  if (level === 'high') return 'border-rose-500/40 bg-rose-500/15 text-rose-100';
  if (level === 'mid') return 'border-amber-500/40 bg-amber-500/15 text-amber-100';
  return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100';
}

function funnelWidth(progress, idx) {
  const p = Number(progress || 0);
  if (p <= 0) return 0;
  const stageCap = Math.max(100 - idx * 18, 20);
  return Number(((p / 100) * stageCap).toFixed(1));
}

onMounted(async () => {
  error.value = '';
  await Promise.all([loadUsers(), loadLevels()]);
});
</script>

