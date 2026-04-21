<template>
  <div
    class="relative w-full overflow-hidden rounded-xl border border-sky-300/50 bg-slate-900/85 px-6 py-5 shadow-xl"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <div class="pointer-events-none absolute inset-0">
      <div class="hover-light" :style="hoverLightStyle"></div>
      <div class="mist-ring"></div>
    </div>

    <div class="relative z-10 mb-4 text-center">
      <h2 class="title-glow text-2xl font-bold tracking-[0.18em] text-sky-100">前端探险家</h2>
      <p class="mt-1 text-[11px] text-sky-300/90">点亮每一关，提升你的前端能力</p>
    </div>

    <div class="relative z-10 mb-4 flex items-center gap-3">
      <div class="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 via-ocean-400 to-amber-300 shadow-lg" />
      <div>
        <div class="text-xs font-semibold tracking-wide text-sky-200 uppercase">
          冒险者登录
        </div>
      </div>
    </div>

    <form class="relative z-10 space-y-3" @submit.prevent="handleSubmit">
      <div class="space-y-1.5">
        <label class="text-xs text-sky-100 font-semibold">用户名</label>
        <input
          v-model="username"
          class="w-full rounded-md border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-300/50"
          placeholder="例如：arcane-mage"
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
          autocomplete="current-password"
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
        <span v-if="loading">登录中…</span>
        <span v-else>登录</span>
      </button>
    </form>

    <div class="relative z-10 mt-3 flex items-center justify-between text-[12px] text-sky-100">
      <span>还没有冒险档案？</span>
      <button class="rounded-md border border-sky-300 bg-white px-3 py-1 font-semibold text-sky-700 hover:bg-sky-100" @click="$emit('switch-to-register')">
        去注册
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const emit = defineEmits(['authenticated', 'switch-to-register']);

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const hoverX = ref(0);
const hoverY = ref(0);
const hoverActive = ref(false);
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const hoverLightStyle = computed(() => {
  if (!hoverActive.value) return { opacity: 0 };
  return {
    opacity: 1,
    background: `radial-gradient(170px circle at ${hoverX.value}px ${hoverY.value}px, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.08) 35%, rgba(125, 211, 252, 0) 72%)`,
  };
});

function handleMouseMove(event) {
  const rect = event.currentTarget?.getBoundingClientRect?.();
  if (!rect) return;
  hoverX.value = event.clientX - rect.left;
  hoverY.value = event.clientY - rect.top;
  hoverActive.value = true;
}

function handleMouseLeave() {
  hoverActive.value = false;
}

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || '登录失败，请检查用户名和密码';
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

<style scoped>
.title-glow {
  text-shadow: 0 0 14px rgba(125, 211, 252, 0.5);
}

.hover-light {
  position: absolute;
  inset: 0;
  transition: opacity 180ms ease-out;
}

.mist-ring {
  position: absolute;
  left: 50%;
  top: -110px;
  width: 360px;
  height: 260px;
  transform: translateX(-50%);
  background: radial-gradient(
    ellipse at center,
    rgba(56, 189, 248, 0.18) 0%,
    rgba(56, 189, 248, 0.08) 40%,
    rgba(56, 189, 248, 0) 75%
  );
  animation: pulseAura 2.2s ease-in-out infinite;
}

@keyframes pulseAura {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
</style>
