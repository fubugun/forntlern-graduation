<template>
  <div
    class="w-full rounded-xl border border-sky-300/50 bg-slate-900/85 px-6 py-5 shadow-xl"
  >
    <div class="flex items-center gap-3 mb-4">
      <div class="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 via-emerald-400 to-ocean-400 shadow-lg" />
      <div>
        <div class="text-xs font-semibold tracking-wide text-sky-200 uppercase">
          创建冒险档案
        </div>
      </div>
    </div>

    <form class="space-y-3" @submit.prevent="handleSubmit">
      <div class="space-y-1.5">
        <label class="text-xs text-sky-100 font-semibold">用户名</label>
        <input
          v-model="username"
          class="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50"
          placeholder="例如：mana-novice"
          autocomplete="username"
        />
      </div>

      <div class="space-y-1.5">
        <label class="text-xs text-sky-100 font-semibold">密码</label>
        <input
          v-model="password"
          type="password"
          class="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50"
          placeholder="至少 6 位"
          autocomplete="new-password"
        />
      </div>

      <div v-if="error" class="text-[11px] text-amber-300">
        {{ error }}
      </div>

      <button
        type="submit"
        class="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
        :disabled="loading"
      >
        <span v-if="loading">召唤冒险档案中…</span>
        <span v-else>注册并登录</span>
      </button>
    </form>

    <div class="mt-3 text-[12px] text-sky-100 flex items-center justify-between">
      <span>已经拥有档案？</span>
      <button class="rounded-md border border-sky-300 bg-white px-3 py-1 font-semibold text-sky-700 hover:bg-sky-100" @click="$emit('switch-to-login')">
        去登录
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['authenticated', 'switch-to-login']);

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || '注册失败，请稍后再试';
      return;
    }
    emit('authenticated', data);
  } catch (e) {
    error.value = `网络异常：${e?.message || '请稍后再试'}`;
  } finally {
    loading.value = false;
  }
}
</script>

