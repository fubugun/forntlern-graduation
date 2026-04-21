<template>
  <div class="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-slate-100 text-slate-800">
    <AdminLevels
      v-if="isAdminRoute && authToken && currentUser?.role === 'admin'"
      :token="authToken"
    />
    <div v-else-if="isAdminRoute && authToken" class="min-h-screen flex items-center justify-center text-slate-200 text-sm">
      当前账号无管理员权限，无法访问 /admin/levels
    </div>
    <div v-else-if="isCollabRoute && authToken" class="min-h-screen">
      <header class="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur px-6 py-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-emerald-300">双人协作通关</div>
            <div class="text-xs text-slate-400">五道分工挑战 · 必须双人都提交通过</div>
          </div>
          <button class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-sky-400" @click="goLearningPage">
            返回学习界面
          </button>
        </div>
      </header>

      <main class="px-4 py-4 lg:px-6">
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <section class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
            <div class="flex items-center gap-2">
              <button
                class="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left"
                @click="showCollabMapModal = true"
              >
                <div class="text-xs text-amber-200">协作星图（点击放大）</div>
                <div class="mt-1 text-[11px] text-amber-100/90">已点亮：{{ collabSolvedCount }}/5</div>
                <div class="mt-1 flex items-center gap-1 text-lg">
                  <span
                    v-for="c in collabChallenges"
                    :key="`mini-star-${c.id}`"
                    :class="isCollabChallengeSolved(c.id) ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]' : 'text-slate-600'"
                  >★</span>
                </div>
              </button>
              <button
                class="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200 hover:bg-sky-500/20"
                @click="showCollabHistoryModal = true"
              >
                📜<br />记录
              </button>
            </div>
            <div class="mt-5 text-xs text-slate-300">协作关卡列表</div>
            <div class="mt-2 space-y-2">
              <button
                v-for="item in collabChallenges"
                :key="item.id"
                class="w-full rounded border px-2 py-2 text-left text-xs"
                :class="selectedCollabChallengeId === item.id ? 'border-sky-400/60 bg-sky-500/10 text-sky-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'"
                @click="selectedCollabChallengeId = item.id"
              >
                <div class="font-semibold">{{ item.title }}</div>
                <div class="mt-0.5 text-[11px] text-slate-400">{{ item.description }}</div>
              </button>
            </div>
            <div class="mt-3 text-xs text-slate-300">房间与队伍</div>
            <div class="mt-2 flex gap-2">
              <button class="rounded border border-fuchsia-500/50 px-2 py-1 text-xs text-fuchsia-200" @click="createRandomRoomAndJoin">
                随机创建房间
              </button>
              <input
                v-model="collabRoomIdInput"
                class="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                placeholder="输入房间号后加入"
              />
              <button class="rounded border border-sky-500/50 px-2 py-1 text-xs text-sky-200" @click="joinCollabRoom">加入房间</button>
              <button class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300" @click="leaveCollabRoom">休息一下</button>
            </div>
            <div v-if="collabState" class="mt-3 rounded border border-slate-700 p-2 text-xs">
              <div class="text-slate-400">
                房间：{{ collabState.roomId }} · 人数：{{ collabMemberCount }}/2 · 进度：第 {{ Number(collabState.challengeIndex || 0) + 1 }}/{{ collabState.totalChallenges || 5 }} 题
              </div>
              <div class="mt-1 text-slate-400">
                队伍：{{ collabMembersDisplay || '暂无' }}
              </div>
              <div class="mt-2">
                <button class="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-sky-400" @click="copyRoomCode">
                  复制房间号
                </button>
              </div>
            </div>
            <div v-else class="mt-3 text-xs text-slate-500">先选择协作关卡，再创建房间或输入房间号加入。</div>
          </section>

          <section class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 xl:col-span-2">
            <div v-if="!collabState" class="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
              <div class="flex items-center gap-2">
                <span class="loading-dot" />
                <span class="loading-dot" />
                <span class="loading-dot" />
                <span class="text-slate-400">等待加入房间...</span>
              </div>
            </div>
            <div v-else-if="!collabReady" class="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <div class="flex items-center gap-2">
                <span class="loading-dot loading-dot-amber" />
                <span class="loading-dot loading-dot-amber" />
                <span class="loading-dot loading-dot-amber" />
                <span>已进入房间，等待另一位队友加入后开始挑战。</span>
              </div>
            </div>
            <div v-else-if="collabState.challenge" class="space-y-3">
              <div class="rounded border border-slate-700 bg-slate-900/70 p-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-sm text-sky-200">{{ collabState.challenge.title }}</div>
                  <button class="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-rose-400" @click="leaveCollabRoom">
                    退出房间
                  </button>
                </div>
                <div class="mt-1 text-xs text-slate-400">{{ collabState.challenge.description }}</div>
              </div>
              <div class="rounded border border-slate-700 bg-slate-900/70 p-3">
                <div class="text-sm text-emerald-200">你的分工：{{ collabMyPart }}</div>
                <div class="mt-1 text-xs text-slate-300">{{ collabMyPartInfo?.title }}</div>
                <div class="text-xs text-slate-400">{{ collabMyPartInfo?.instruction }}</div>
              </div>
              <textarea
                v-model="collabMyCode"
                class="h-56 w-full rounded border border-slate-700 bg-slate-950 p-3 text-xs"
                :placeholder="collabMyPartInfo?.starterCode || '在这里写你的分工代码...'"
              />
              <div class="flex gap-2">
                <button class="rounded border border-emerald-500/50 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10" @click="submitCollabPart">
                  提交我的部分
                </button>
              </div>
              <div v-if="collabSubmitFeedback.length" class="rounded border border-slate-700 p-3 text-xs">
                <div :class="collabLastSubmitPass ? 'text-emerald-300' : 'text-amber-300'">
                  {{ collabLastSubmitPass ? '你的部分已通过校验' : '你的部分未通过，请按提示修改' }}
                </div>
                <div v-for="(tip, idx) in collabSubmitFeedback" :key="`collab-tip-full-${idx}`" class="mt-1 text-slate-300">
                  - {{ tip }}
                </div>
              </div>
              <div class="rounded border border-slate-700 p-3 text-xs text-slate-300">
                A 部分：{{ collabState.submissions?.A?.passed ? `✅ ${collabState.submissions?.A?.by || ''}` : '⏳ 未通过' }}<br />
                B 部分：{{ collabState.submissions?.B?.passed ? `✅ ${collabState.submissions?.B?.by || ''}` : '⏳ 未通过' }}
              </div>
              <div v-if="collabState.status === 'challenge_completed'" class="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                本关协作已通关！每人 +20 EXP。
                <div v-if="collabState.lastRewards?.length" class="mt-1 text-emerald-100">
                  <div v-for="r in collabState.lastRewards" :key="`reward-${r.userId}`">
                    {{ r.username }}：{{ r.awardedExp > 0 ? `+${r.awardedExp} EXP` : '本关奖励已领取' }}
                    <span v-if="r.newlyAwardedBadges?.length"> · 新徽章：{{ r.newlyAwardedBadges.map((b) => b.name).join('、') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div v-if="showCollabMapModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" @click.self="showCollabMapModal = false">
        <div class="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-amber-200">协作五角星地图 · 已点亮 {{ collabSolvedCount }}/5</div>
            <button class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200" @click="showCollabMapModal = false">关闭</button>
          </div>
          <div class="rounded border border-slate-800 bg-slate-950/70 p-3">
            <svg viewBox="0 0 420 320" class="h-[280px] w-full">
              <path d="M210 40 L345 130 L295 280 L125 280 L75 130 Z" fill="none" stroke="#334155" stroke-width="2" />
              <path d="M210 40 L295 280 L75 130 L345 130 L125 280 Z" fill="none" stroke="#1f2937" stroke-width="1.5" stroke-dasharray="4 4" />
              <g
                v-for="(c, idx) in collabChallenges"
                :key="`big-star-node-${c.id}`"
              >
                <circle
                  :cx="[210,345,295,125,75][idx] || 210"
                  :cy="[40,130,280,280,130][idx] || 160"
                  r="18"
                  :fill="isCollabChallengeSolved(c.id) ? '#f59e0b' : '#334155'"
                  :stroke="selectedCollabChallengeId === c.id ? '#38bdf8' : '#94a3b8'"
                  stroke-width="2"
                />
                <text
                  :x="[210,345,295,125,75][idx] || 210"
                  :y="([40,130,280,280,130][idx] || 160) + 4"
                  text-anchor="middle"
                  font-size="11"
                  fill="#0f172a"
                  font-weight="700"
                >
                  {{ idx + 1 }}
                </text>
                <text
                  :x="[210,345,295,125,75][idx] || 210"
                  :y="([40,130,280,280,130][idx] || 160) + 34"
                  text-anchor="middle"
                  font-size="10"
                  fill="#cbd5e1"
                >
                  {{ c.title.slice(0, 6) }}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div v-if="showCollabHistoryModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" @click.self="showCollabHistoryModal = false">
        <div class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-sky-200">协作记录</div>
            <button class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200" @click="showCollabHistoryModal = false">关闭</button>
          </div>
          <div class="space-y-2">
            <div
              v-for="item in collabHistoryItems"
              :key="`history-${item.id}`"
              class="rounded border px-3 py-2 text-xs"
              :class="item.solved ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-300'"
            >
              {{ item.solved ? '✅' : '⬜' }} {{ item.title }} - {{ item.solved ? '已通关' : '未通关' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template v-else>
    <!-- 未登录：显示登录 / 注册卡片 -->
    <div
      v-if="!authToken"
      class="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-sky-100 via-blue-50 to-slate-100"
    >
      <div class="w-full max-w-md">
        <div class="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-sky-300/40 bg-slate-900/80 p-1.5">
          <button
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="authMode === 'login' ? 'bg-sky-500/20 text-sky-100 border border-sky-500/40' : 'text-slate-300 border border-transparent hover:bg-slate-800/80'"
            @click="authMode = 'login'"
          >
            登录
          </button>
          <button
            class="rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="authMode === 'register' ? 'bg-sky-500/20 text-sky-100 border border-sky-500/40' : 'text-slate-300 border border-transparent hover:bg-slate-800/80'"
            @click="authMode = 'register'"
          >
            注册
          </button>
        </div>
        <Login
          v-if="authMode === 'login'"
          @switch-to-register="authMode = 'register'"
          @authenticated="handleAuthenticated"
        />
        <Register
          v-else
          @switch-to-login="authMode = 'login'"
          @authenticated="handleAuthenticated"
        />
      </div>
      <div
        v-if="globalError"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-slate-900/90 px-3 py-2 text-xs text-amber-200"
      >
        {{ globalError }}
      </div>
    </div>

    <!-- 已登录：显示完整世界地图 + 工作台 -->
    <div v-else class="min-h-screen">
    <div
      v-if="showAdminEntryGate"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 px-4"
    >
      <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4">
        <div class="text-sm font-semibold text-sky-200">管理员入口</div>
        <div class="mt-2 text-xs text-slate-400">请选择要进入的界面。</div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="rounded border border-emerald-500/50 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10" @click="enterLearnMode">
            学习界面
          </button>
          <button class="rounded border border-sky-500/50 px-3 py-2 text-xs text-sky-200 hover:bg-sky-500/10" @click="goAdminLevels">
            管理界面
          </button>
        </div>
      </div>
    </div>
    <header
      class="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-6 py-3"
    >
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 via-ocean-400 to-amber-300 shadow-lg shadow-emerald-500/40" />
        <div>
          <div class="text-sm font-semibold tracking-wide text-emerald-300 uppercase">
            游戏化前端学习
          </div>
          <div class="text-xs text-slate-400">
            HTML · CSS · JS · DOM 学习平台
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-emerald-400" />
          <span>当前关卡：{{ level?.title || '加载中…' }}</span>
        </div>
        <span class="hidden md:inline-block h-4 w-px bg-slate-700" />
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-amber-400" />
          <span>核心知识点：{{ level?.coreConcept || '——' }}</span>
        </div>
        <span class="hidden md:inline-block h-4 w-px bg-slate-700" />
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-ocean-400" />
          <span>EXP：{{ profile?.exp ?? 0 }} · Level：{{ profile?.level ?? 1 }}</span>
        </div>
        <span class="hidden md:inline-block h-4 w-px bg-slate-700" />
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-fuchsia-400" />
          <span>用户：{{ currentUser?.username || '未知' }}</span>
        </div>
        <span class="hidden md:inline-block h-4 w-px bg-slate-700" />
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-sky-400" />
          <span>当前模式：{{ currentModeLabel }}</span>
        </div>
        <button
          v-if="currentUser?.role === 'admin'"
          class="rounded-full border border-sky-500/50 px-2 py-0.5 text-[11px] text-sky-200 hover:bg-sky-500/10"
          @click="goAdminLevels"
        >
          管理后台
        </button>
        <button
          class="ml-auto rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-amber-300 hover:text-amber-200 transition"
          @click="logout"
        >
          退出登录
        </button>
      </div>
    </header>

    <div
      v-if="globalError"
      class="mx-4 mt-3 rounded-lg border border-amber-400/40 bg-slate-900/90 px-3 py-2 text-xs text-amber-200"
    >
      {{ globalError }}
    </div>
      <div
        v-if="rewardModalVisible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
        @click.self="closeRewardModal"
      >
        <div class="w-full max-w-md rounded-2xl border border-emerald-400/40 bg-slate-900 p-4 shadow-2xl">
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold text-emerald-200">通关奖励</div>
            <button class="text-slate-300 hover:text-white" @click.stop="closeRewardModal">✕</button>
          </div>
          <div class="mt-2 text-xs leading-6 text-slate-200 whitespace-pre-line">{{ rewardModalText }}</div>
          <button
            class="mt-4 w-full rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            @click.stop="closeRewardModal"
          >
            我知道了
          </button>
        </div>
      </div>

    <!-- 进度卡片 -->
    <section class="px-4 lg:px-6 pt-3">
      <div class="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 shadow-lg shadow-emerald-500/10">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-slate-300">
            当前进度卡片
          </div>
          <button class="text-[11px] rounded border border-slate-600 px-2 py-1 hover:border-sky-400" @click="showMapModal = true">查看完整探险地图</button>
        </div>
        <div class="text-sm text-emerald-200 font-semibold">{{ level?.title || '加载中...' }}</div>
        <div class="mt-2 h-2 rounded bg-slate-800">
          <div class="h-2 rounded bg-emerald-400" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <div class="mt-1 text-[11px] text-slate-400">总进度：{{ progressPercent }}%</div>
      </div>
    </section>

    <section v-if="false" class="px-4 lg:px-6 pt-3">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
          <div class="text-xs text-amber-300 uppercase tracking-wide mb-2">徽章系统</div>
          <div class="space-y-1 max-h-[180px] overflow-y-auto scrollbar-thin">
            <div
              v-for="b in badges"
              :key="b.key"
              class="rounded-lg border px-2 py-1 text-[11px]"
              :class="b.earned ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-900/80 text-slate-400'"
            >
              {{ b.earned ? '🏅' : '🔒' }} {{ b.name }} · {{ b.description }}
            </div>
            <div v-if="badges.length === 0" class="text-[11px] text-slate-500">暂无徽章数据</div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
          <div class="text-xs text-ocean-300 uppercase tracking-wide mb-2">排行榜 Top 5</div>
          <div class="space-y-1">
            <div
              v-for="row in leaderboard.slice(0, 5)"
              :key="`${row.rank}-${row.username}`"
              class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px]"
            >
              <span>#{{ row.rank }} {{ row.username }}</span>
              <span class="text-slate-400">Lv{{ row.level }} · {{ row.totalExp }}EXP</span>
            </div>
            <div v-if="leaderboard.length === 0" class="text-[11px] text-slate-500">暂无排行数据</div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
          <div class="text-xs text-emerald-300 uppercase tracking-wide mb-2">学习建议</div>
          <div class="space-y-1 max-h-[180px] overflow-y-auto scrollbar-thin">
            <div
              v-for="(item, idx) in learningSuggestions"
              :key="idx"
              class="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200"
            >
              {{ item }}
            </div>
            <div v-if="learningSuggestions.length === 0" class="text-[11px] text-slate-500">暂无建议，继续学习即可</div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="false" class="px-4 lg:px-6 pt-3">
      <div class="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-fuchsia-300 uppercase tracking-wide">补强练习</div>
          <div class="text-[10px] text-slate-500">根据你的薄弱点自动推荐</div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div class="rounded-lg border border-slate-700 bg-slate-900/80 p-2">
            <div class="text-[11px] text-slate-300 mb-1">推荐练习关卡</div>
            <div v-if="recommendedLevels.length === 0" class="text-[11px] text-slate-500">暂无推荐</div>
            <button
              v-for="x in recommendedLevels"
              :key="x.key"
              class="mb-1 w-full rounded border border-slate-600 px-2 py-1 text-left text-[11px] text-slate-200 hover:border-emerald-400/50"
              @click="handleSelectLevel(x)"
            >
              第{{ x.chapter }}章 · {{ x.title }}
            </button>
          </div>
          <div class="rounded-lg border border-slate-700 bg-slate-900/80 p-2">
            <div class="text-[11px] text-slate-300 mb-1">生成补强题</div>
            <div v-if="remedialExercises.length === 0" class="text-[11px] text-slate-500">暂无补强题</div>
            <button
              v-for="ex in remedialExercises"
              :key="ex.id"
              class="mb-1 w-full rounded border border-slate-600 px-2 py-1 text-left text-[11px] text-amber-100 hover:border-amber-400/60"
              @click="applyRemedialExercise(ex)"
            >
              {{ ex.title }} · {{ ex.goal }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <main class="p-4 lg:p-6 pt-3">
      <div class="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1.5fr)_minmax(0,1.2fr)] gap-4 lg:gap-5">
        <!-- 左侧：学习提示 + 任务书 -->
        <section class="space-y-3">
          <div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-emerald-500/10">
            <div class="flex items-center gap-3 mb-2">
              <div class="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-ocean-400 shadow-md shadow-emerald-500/40" />
              <div>
                <div class="text-xs font-semibold tracking-wide text-emerald-300 uppercase">
                  学习向导
                </div>
                <div class="text-xs text-slate-400">
                  会根据进度给出学习提示
                </div>
              </div>
            </div>
            <div class="relative">
              <div
                class="rounded-2xl border border-emerald-500/30 bg-slate-950/80 px-3 py-3 text-xs leading-relaxed text-emerald-100 shadow-inner shadow-emerald-500/20 min-h-[80px]"
              >
                <div v-if="typingText">
                  {{ typingText }}
                </div>
                <div v-else class="text-slate-500">
                  正在分析你的代码输入……
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-lg shadow-emerald-500/10">
            <div class="flex items-center justify-between mb-3">
              <div class="text-xs font-semibold tracking-wide text-amber-300 uppercase">
                任务书 · Quest Log
              </div>
              <div class="text-[10px] text-slate-500">
                使用 HTML/CSS/JS 完成下面的目标
              </div>
            </div>
            <pre
              class="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200 max-h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/60"
            >{{ level?.taskMarkdown }}</pre>
            <div class="mt-3 rounded-xl border border-sky-500/30 bg-slate-950/80 p-3">
              <div class="text-[11px] uppercase tracking-wide text-sky-300 mb-1">Code Example</div>
              <pre class="whitespace-pre-wrap text-[11px] text-sky-100">{{ level?.codeExample || '// 暂无示例' }}</pre>
            </div>
            <div
              v-if="currentUser?.role === 'admin' && level?.adminAnswer"
              class="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3"
            >
              <div class="mb-1 text-[11px] uppercase tracking-wide text-rose-300">管理员参考答案</div>
              <pre class="whitespace-pre-wrap text-[11px] text-rose-300">{{ level?.adminAnswer }}</pre>
            </div>
          </div>
        </section>

        <!-- 中间：编辑器 -->
        <section
          class="rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-2xl shadow-emerald-500/20 flex flex-col overflow-hidden"
        >
          <div class="flex items-center justify-between border-b border-slate-800/70 px-4 py-2">
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>学习工作台 · 代码编辑区（流畅模式）</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition"
                :class="autoPreview ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-500/50 bg-slate-700/30 text-slate-200'"
                @click="autoPreview = !autoPreview"
              >
                <span>{{ autoPreview ? '自动预览开' : '自动预览关' }}</span>
              </button>
              <button
                class="inline-flex items-center gap-1 rounded-full border border-slate-500/50 bg-slate-700/30 px-3 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700/50 transition"
                @click="refreshPreviewNow"
              >
                <span>手动刷新预览</span>
              </button>
              <button
                v-if="!useMonaco"
                class="inline-flex items-center gap-1 rounded-full border border-slate-500/50 bg-slate-700/30 px-3 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700/50 transition"
                @click="enableMonaco"
              >
                <span>启用高级编辑器</span>
              </button>
              <button
                class="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 transition"
                @click="runValidation"
              >
                <span>校验代码</span>
              </button>
              <button
                class="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 transition"
                @click="requestAiSolveHint"
              >
                <span>解题提示</span>
              </button>
              <button
                v-if="currentUser?.role === 'admin' && level?.adminAnswer"
                class="inline-flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/20 transition"
                @click="fillAdminAnswerToEditor"
              >
                <span>一键填入答案</span>
              </button>
              <button
                class="inline-flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/20 transition"
                @click="redoCurrentLevel"
              >
                <span>重做</span>
              </button>
              <button
                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition"
                :class="autoAiHint ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200' : 'border-slate-500/50 bg-slate-700/30 text-slate-200'"
                @click="autoAiHint = !autoAiHint"
              >
                <span>{{ autoAiHint ? '自动提示开' : '自动提示关' }}</span>
              </button>
            </div>
          </div>
          <div v-if="!useMonaco || editorInitError" class="flex-1 min-h-[280px] p-3">
            <div class="mb-2 text-[11px] text-amber-300">
              {{ editorInitError ? 'Monaco 初始化失败，已切换为轻量文本框' : '当前为流畅模式，输入响应更快' }}
            </div>
            <textarea
              v-model="codeValue"
              class="h-[320px] w-full rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-100 outline-none"
              @input="schedulePreviewUpdate(); scheduleAiHintUpdate()"
            />
          </div>
          <div v-else ref="editorContainer" class="flex-1 min-h-[280px]" />
          <div
            v-if="validationResult"
            class="border-t border-slate-800/70 bg-slate-950/90 px-4 py-2 text-[11px] flex items-center justify-between"
          >
            <div v-if="validationResult.pass" class="text-emerald-300">
              ✅ 校验通过！可以继续前进。
            </div>
            <div v-else class="text-amber-300">
              ⚠ 还差一点点：根据左侧提示再试试。
            </div>
            <div class="text-slate-500">
              规则检查：{{ validationResult.errors.length === 0 ? '全部通过' : validationResult.errors.length + ' 处未通过' }}
            </div>
          </div>
          <div v-if="aiSolveHint" class="border-t border-slate-800/70 bg-slate-900/80 px-4 py-2 text-[11px] text-amber-200">
            <div class="flex items-center justify-between gap-2">
                <span>{{ aiSolveHint }}</span>
              <span v-if="aiHintLoading" class="text-[10px] text-slate-400">正在分析...</span>
            </div>
            <div v-if="aiChecklist.length > 0" class="mt-1 text-[10px] text-amber-100/90">
              <span v-for="(item, idx) in aiChecklist" :key="idx" class="mr-2">- {{ item }}</span>
            </div>
          </div>
        </section>

        <!-- 右侧：Iframe 预览 -->
        <section
          class="rounded-2xl border border-slate-800/80 bg-slate-950/80 shadow-2xl shadow-amber-500/15 flex flex-col overflow-hidden"
        >
          <div class="flex items-center justify-between border-b border-slate-800/70 px-4 py-2">
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span class="h-2 w-2 rounded-full bg-amber-400" />
              <span>代码预览 · 实时预览</span>
            </div>
            <div class="text-[10px] text-slate-500">
              默认手动刷新，避免输入卡顿
            </div>
          </div>
          <iframe
            class="flex-1 min-h-[260px] bg-white"
            :srcdoc="previewHtml"
            sandbox="allow-scripts allow-same-origin"
          />
        </section>
      </div>
    </main>

    <!-- 右侧悬浮工具栏 -->
    <div class="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
      <button class="h-10 w-10 rounded-full border border-slate-600 bg-slate-900/90 text-xs" @click="openPanel('leaderboard')">🏆</button>
      <button class="h-10 w-10 rounded-full border border-slate-600 bg-slate-900/90 text-xs" @click="openPanel('badges')">🎖️</button>
      <button class="h-10 w-10 rounded-full border border-slate-600 bg-slate-900/90 text-xs" @click="goCollabPage">🤝</button>
      <button class="relative h-10 w-10 rounded-full border border-slate-600 bg-slate-900/90 text-xs" @click="openPanel('ai')">
        📘
        <span v-if="showAiRedDot" class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500"></span>
      </button>
    </div>

    <!-- 面板抽屉 -->
    <div v-if="activePanel" class="fixed inset-0 z-40 bg-slate-950/60" @click.self="closePanel()">
      <div class="absolute right-0 top-0 h-full w-full max-w-sm border-l border-slate-700 bg-slate-950 p-4 overflow-y-auto">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm text-slate-200">
            {{
              activePanel === 'leaderboard'
                ? '排行榜'
                : activePanel === 'badges'
                ? '徽章墙'
                : '学习辅助'
            }}
          </div>
          <button class="text-slate-400 hover:text-white" @click="closePanel()">✕</button>
        </div>
        <div v-if="activePanel === 'leaderboard'" class="space-y-1">
          <div v-for="row in leaderboard" :key="`${row.rank}-${row.username}`" class="rounded border border-slate-700 px-2 py-1 text-xs">
            #{{ row.rank }} {{ row.username === currentUser?.username ? '🚀 ' : '' }}{{ row.username }} · Lv{{ row.level }} · {{ row.totalExp }}EXP
          </div>
        </div>
        <div v-else-if="activePanel === 'badges'" class="space-y-3">
          <div
            v-if="badgeRecentlyEarnedKeys.length"
            class="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100"
          >
            <div class="font-semibold text-amber-200">离开徽章墙期间获得的新徽章</div>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <span
                v-for="key in badgeRecentlyEarnedKeys"
                :key="`recent-badge-${key}`"
                class="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5"
              >
                {{ badgeNameByKey(key) }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="b in badges"
              :key="b.key"
              class="badge-wall-card"
              :class="badgeCardClass(b)"
              :style="badgeCardStyle(b)"
            >
              <div class="flex items-start gap-2">
                <div class="text-xl leading-none">{{ badgeIcon(b) }}</div>
                <div class="min-w-0">
                  <div class="truncate text-[12px] font-semibold">{{ b.name }}</div>
                  <div class="mt-1 text-[10px] leading-4 text-slate-300/90">{{ b.description }}</div>
                </div>
              </div>
              <div class="mt-2 text-[10px]" :class="b.earned ? 'text-emerald-200' : 'text-slate-500'">
                {{ b.earned ? '已获得' : '未解锁' }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="space-y-2">
          <div class="text-xs text-slate-300">弱项强化练习</div>
          <button
            v-for="(ex, idx) in remedialExercises"
            :key="ex.id"
            class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-left hover:border-fuchsia-400/60 hover:bg-slate-900"
            @click="applyRemedialExercise(ex)"
          >
            <div class="text-xs font-semibold text-slate-100">{{ ex.title }}</div>
            <div class="mt-1 text-[11px] text-slate-300 leading-5">{{ ex.goal }}</div>
            <div class="mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-100">
              <span class="font-semibold text-sky-200">推荐依据：</span>{{ buildExerciseReasonText(idx) }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 全屏地图（SVG 路径） -->
    <div v-if="showMapModal" class="fixed inset-0 z-40 overflow-y-auto bg-slate-950/90 p-4">
      <div class="mx-auto w-full max-w-5xl py-4">
        <div class="mb-3 flex items-center justify-end">
          <button class="rounded border border-slate-600 px-2 py-1 text-xs" @click="showMapModal = false">关闭</button>
        </div>
        <div class="max-h-[82vh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <svg
            :viewBox="`0 0 ${svgMapWidth} ${svgMapHeight}`"
            :width="svgMapWidth"
            :height="svgMapHeight"
            class="min-w-[900px]"
          >
            <path
              v-for="(seg, idx) in svgPathSegments"
              :key="`path-${idx}`"
              :d="seg.d"
              fill="none"
              stroke="#334155"
              stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="6 6"
            />
            <g
              v-for="(node, idx) in svgMapNodes"
              :key="node.level.key"
              :transform="`translate(${node.x}, ${node.y})`"
              class="cursor-pointer"
              @click="node.level.status !== 'locked' ? (handleSelectLevel(node.level), showMapModal = false) : null"
            >
              <circle
                r="22"
                :fill="
                  node.level.status === 'completed'
                    ? '#10b981'
                    : node.level.status === 'current'
                    ? '#f59e0b'
                    : '#334155'
                "
                :stroke="node.level.status === 'locked' ? '#475569' : '#94a3b8'"
                stroke-width="2"
              />
              <text x="0" y="4" text-anchor="middle" font-size="11" fill="#0f172a" font-weight="700">
                {{ idx + 1 }}
              </text>
              <text x="0" y="40" text-anchor="middle" font-size="10" fill="#cbd5e1">
                {{ node.level.title.slice(0, 8) }}
              </text>
              <text x="0" y="-30" text-anchor="middle" font-size="10" fill="#94a3b8">
                {{ node.level.status === 'completed' ? '已通关' : node.level.status === 'current' ? '当前' : '锁定' }}
              </text>
            </g>
          </svg>
        </div>
        <div class="mt-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <div class="mb-2 text-xs text-slate-300">关卡学习入口（每关可查看通关知识点）</div>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div
              v-for="x in mapLevels"
              :key="`study-row-${x.key}`"
              class="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate text-xs text-slate-200">
                    第{{ x.chapter }}-{{ x.order }}关 · {{ x.title }}
                  </div>
                  <div class="text-[10px]" :class="x.status === 'completed' ? 'text-emerald-300' : x.status === 'current' ? 'text-amber-300' : 'text-slate-500'">
                    {{ x.status === 'completed' ? '已通关' : x.status === 'current' ? '当前挑战' : '未解锁' }}
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    class="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400"
                    :disabled="x.status === 'locked'"
                    :class="x.status === 'locked' ? 'cursor-not-allowed opacity-50' : ''"
                    @click="handleSelectLevel(x); showMapModal = false"
                  >
                    挑战
                  </button>
                  <button
                    class="rounded border border-sky-500/60 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-500/20"
                    @click="openStudyGuide(x)"
                  >
                    学习
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="showStudyGuideModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4"
      @click.self="showStudyGuideModal = false"
    >
      <div class="w-full max-w-2xl rounded-2xl border border-sky-500/30 bg-slate-900 p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-sky-200">{{ studyGuideLevel?.title || '关卡学习指南' }}</div>
            <div class="text-[11px] text-slate-400">
              通关知识点清单
            </div>
          </div>
          <button class="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200" @click="showStudyGuideModal = false">关闭</button>
        </div>
        <div class="mt-3 space-y-2">
          <div
            v-for="(item, idx) in studyGuideItems"
            :key="`study-item-${idx}`"
            class="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100"
            v-html="formatStudyItem(item)"
          ></div>
        </div>
      </div>
    </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import Login from './Login.vue';
import Register from './Register.vue';
import AdminLevels from './AdminLevels.vue';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';

const level = ref(null);
const mapLevels = ref([]);
const profile = ref(null);
const currentUser = ref(null);
const currentLevelKey = ref(null);
const editorContainer = ref(null);
const editorInstance = ref(null);
const codeValue = ref('');
const previewHtml = ref('');
const validationResult = ref(null);
const editorInitError = ref('');
const globalError = ref('');
const useMonaco = ref(false);
const badges = ref([]);
const leaderboard = ref([]);
const learningSuggestions = ref([]);
const aiSolveHint = ref('');
const aiChecklist = ref([]);
const remedialExercises = ref([]);
const recommendedLevels = ref([]);
const remedialWeakTopics = ref([]);
const autoPreview = ref(true);
const autoAiHint = ref(true);
const aiHintLoading = ref(false);
const rewardModalVisible = ref(false);
const rewardModalText = ref('');
const activePanel = ref('');
const badgeRecentlyEarnedKeys = ref([]);
const badgeAnimatingKey = ref('');
const badgeRevealDoneKeys = ref([]);
const badgeAnimTimers = [];
const showStudyGuideModal = ref(false);
const studyGuideLevel = ref(null);
const showMapModal = ref(false);
const levelStartMs = ref(Date.now());
const nowMs = ref(Date.now());
const isCurrentLevelPassed = ref(false);
const collabRoomIdInput = ref('');
const collabState = ref(null);
const collabMyCode = ref('');
const collabSubmitFeedback = ref([]);
const collabLastSubmitPass = ref(false);
const collabChallenges = ref([]);
const selectedCollabChallengeId = ref('');
const showCollabMapModal = ref(false);
const showCollabHistoryModal = ref(false);
const collabRewardHandledKey = ref('');
const studyGuideItems = computed(() => getStudyKnowledgePoints(studyGuideLevel.value));

function getInitialAuthToken() {
  if (typeof window === 'undefined') return '';
  const sessionToken = window.sessionStorage.getItem('auth_token') || '';
  if (sessionToken) return sessionToken;
  const legacyToken = window.localStorage.getItem('auth_token') || '';
  if (legacyToken) {
    // 迁移到 sessionStorage，避免多标签页账号串号
    window.sessionStorage.setItem('auth_token', legacyToken);
    window.localStorage.removeItem('auth_token');
  }
  return legacyToken;
}

const authToken = ref(getInitialAuthToken());
const authMode = ref('login');
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const isAdminRoute = ref(typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/levels'));
const isCollabRoute = ref(typeof window !== 'undefined' && window.location.pathname.startsWith('/collab'));
const adminEntryPending = ref(false);

function getAdminModePreference() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem('admin_mode') || '';
}

function setAdminModePreference(mode) {
  if (typeof window === 'undefined') return;
  if (!mode) {
    window.sessionStorage.removeItem('admin_mode');
    adminMode.value = '';
    return;
  }
  window.sessionStorage.setItem('admin_mode', mode);
  adminMode.value = mode;
}
const adminMode = ref(getAdminModePreference());
const progressPercent = computed(() => {
  if (!mapLevels.value.length) return 0;
  const completed = mapLevels.value.filter((x) => x.status === 'completed').length;
  return Math.round((completed / mapLevels.value.length) * 100);
});
const showAiRedDot = computed(() => {
  if (isCurrentLevelPassed.value) return false;
  return nowMs.value - levelStartMs.value > 15 * 60 * 1000;
});
const collabMyMember = computed(() => {
  const members = collabState.value?.members || [];
  const myId = currentUser.value?.id;
  return members.find((m) => Number(m.userId) === Number(myId)) || null;
});
const collabMemberCount = computed(() => (collabState.value?.members || []).length);
const collabMembersDisplay = computed(() => {
  const members = collabState.value?.members || [];
  const aUser = members.find((m) => m.part === 'A')?.username || '待加入';
  const bUser = members.find((m) => m.part === 'B')?.username || '待加入';
  return `A位：${aUser}，B位：${bUser}`;
});
const collabMyPart = computed(() => collabMyMember.value?.part || 'A');
const collabReady = computed(() => (collabState.value?.members || []).length >= 2);
const collabMyPartInfo = computed(() => {
  const challenge = collabState.value?.challenge;
  if (!challenge) return null;
  return challenge.parts?.[collabMyPart.value] || null;
});
const collabSolvedSet = computed(() => {
  try {
    const arr = profile.value?.collabSolvedKeys ? JSON.parse(profile.value.collabSolvedKeys) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
});
const collabSolvedCount = computed(() => collabSolvedSet.value.size);
const collabHistoryItems = computed(() =>
  (collabChallenges.value || []).map((c) => ({
    id: c.id,
    title: c.title,
    solved: collabSolvedSet.value.has(c.id),
  }))
);
const showAdminEntryGate = computed(
  () =>
    Boolean(authToken.value) &&
    currentUser.value?.role === 'admin' &&
    !isAdminRoute.value &&
    !isCollabRoute.value &&
    adminEntryPending.value
);
const currentModeLabel = computed(() => {
  if (isAdminRoute.value) return '管理模式';
  if (isCollabRoute.value) return '协作模式';
  if (currentUser.value?.role === 'admin') {
    return adminMode.value === 'manage' ? '管理模式' : '学习模式';
  }
  return '学习模式';
});
const svgMapNodes = computed(() => {
  const cols = 6;
  const gapX = 150;
  const gapY = 120;
  const startX = 80;
  const startY = 90;
  return mapLevels.value.map((levelItem, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const visualCol = row % 2 === 0 ? col : cols - 1 - col;
    return {
      level: levelItem,
      x: startX + visualCol * gapX,
      y: startY + row * gapY,
    };
  });
});
const svgPathSegments = computed(() => {
  const nodes = svgMapNodes.value;
  const segs = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2 - 18;
    segs.push({
      d: `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`,
    });
  }
  return segs;
});
const svgMapWidth = computed(() => {
  const nodes = svgMapNodes.value;
  if (!nodes.length) return 980;
  const maxX = Math.max(...nodes.map((n) => n.x));
  return Math.max(980, maxX + 120);
});
const svgMapHeight = computed(() => {
  const nodes = svgMapNodes.value;
  if (!nodes.length) return 520;
  const maxY = Math.max(...nodes.map((n) => n.y));
  return Math.max(520, maxY + 120);
});

const typingText = ref('');
let typingIndex = 0;
let typingTimer = null;

function startTyping(text) {
  clearInterval(typingTimer);
  typingText.value = '';
  typingIndex = 0;
  const content = text || '';
  typingTimer = setInterval(() => {
    typingText.value = content.slice(0, typingIndex);
    typingIndex += 1;
    if (typingIndex > content.length) {
      clearInterval(typingTimer);
    }
  }, 25);
}

let previewTimer = null;
let aiHintTimer = null;
let lastPreviewSource = '';
let rewardAutoCloseTimer = null;
let nowTimer = null;
let collabSocket = null;
function schedulePreviewUpdate() {
  if (!autoPreview.value) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const raw = codeValue.value || '';
    if (raw === lastPreviewSource) return;
    lastPreviewSource = raw;
    previewHtml.value = buildPreviewDocument(raw);
  }, 300);
}

function refreshPreviewNow() {
  const raw = codeValue.value || '';
  previewHtml.value = buildPreviewDocument(raw);
}

function inferCodeType(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'html';
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return 'html';
  if (/(@media|@keyframes|display\s*:|justify-content\s*:|font-size\s*:|color\s*:|{[\s\S]*})/i.test(text)) {
    return 'css';
  }
  if (/(const|let|var|function|=>|querySelector|addEventListener|fetch|await|\bif\s*\()/i.test(text)) {
    return 'js';
  }
  return 'html';
}

function buildPreviewDocument(raw) {
  const source = String(raw || '');
  if (source.includes('<html')) {
    return source;
  }

  const starterHtml = String(level.value?.starterHtml || '').trim();
  const starterCss = String(level.value?.starterCss || '').trim();
  const starterJs = String(level.value?.starterJs || '').trim();
  const baseBody =
    starterHtml ||
    '<div class="title">预览示例标题</div><div class="bridge"><span>A</span><span>B</span><span>C</span></div><button id="magicBtn">点击按钮</button><p id="result">等待触发</p>';

  const codeType = inferCodeType(source);
  const body = codeType === 'html' ? source : baseBody;
  const mergedCss = codeType === 'css' ? `${starterCss}\n${source}`.trim() : starterCss;
  const mergedJs = codeType === 'js' ? `${starterJs}\n${source}`.trim() : starterJs;

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>关卡预览</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px; }
${mergedCss}
    </style>
  </head>
  <body>
${body}
    <script>
${mergedJs}
    <\/script>
  </body>
</html>`;
}

function scheduleAiHintUpdate() {
  if (!autoAiHint.value || !level.value?.key) return;
  clearTimeout(aiHintTimer);
  aiHintTimer = setTimeout(async () => {
    if ((codeValue.value || '').trim().length < 8) return;
    await requestAiSolveHint(true);
  }, 1800);
}

async function loadMap(options = {}) {
  const keepCurrentSelection = Boolean(options.keepCurrentSelection);
  try {
    const headers = {};
    if (authToken.value) {
      headers.Authorization = `Bearer ${authToken.value}`;
    }

    const res = await fetch(`${API_BASE}/api/map`, { headers });
    if (res.status === 401) {
      // Token 失效，退回登录
      logout();
      return;
    }
    if (!res.ok) {
      globalError.value = `地图加载失败（${res.status}）`;
      return;
    }

    const data = await res.json();
    mapLevels.value = data.levels || [];
    profile.value = data.profile || null;
    globalError.value = '';
    await Promise.all([loadBadges(), loadLeaderboard(), loadLearningPath(), loadRemedialPlan()]);

    const current = mapLevels.value.find((l) => l.status === 'current');
    const firstUnlocked = mapLevels.value.find((l) => l.status !== 'locked');
    const fallback = mapLevels.value[0];
    const nextKey = (current || firstUnlocked || fallback || {}).key;
    const currentStillExists = mapLevels.value.some((l) => l.key === currentLevelKey.value);
    const hasLoadedCurrentLevel = Boolean(level.value?.key) && level.value.key === currentLevelKey.value;
    if (keepCurrentSelection && currentStillExists && hasLoadedCurrentLevel) {
      return;
    }

    const keyToLoad = (() => {
      // 1) 优先保留当前选中（仅当它仍存在）
      if (currentStillExists && currentLevelKey.value) return currentLevelKey.value;
      // 2) 其次加载地图标记为 current 的关卡
      if (nextKey) return nextKey;
      return '';
    })();

    if (!keyToLoad) return;
    currentLevelKey.value = keyToLoad;
    await loadLevelByKey(keyToLoad);

    // 若首次自动加载失败（仍是“加载中”），再兜底尝试第一个可挑战关卡
    if (!level.value?.key) {
      const fallbackKey = (firstUnlocked || fallback || {}).key;
      if (fallbackKey && fallbackKey !== keyToLoad) {
        currentLevelKey.value = fallbackKey;
        await loadLevelByKey(fallbackKey);
      }
    }
  } catch (e) {
    // 请求失败时切回登录，避免停在“空白主界面”
    logout();
    globalError.value = `无法连接后端：${e?.message || '请稍后重试'}`;
  }
}

async function loadMe() {
  if (!authToken.value) return;
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { Authorization: `Bearer ${authToken.value}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  currentUser.value = data.user;
}

async function loadLevelByKey(key) {
  try {
    const headers = {};
    if (authToken.value) {
      headers.Authorization = `Bearer ${authToken.value}`;
    }

    const res = await fetch(`${API_BASE}/api/levels/${key}`, { headers });
    if (!res.ok) {
      globalError.value = `关卡加载失败（${res.status}）`;
      return;
    }
    const data = await res.json();
    applyLevelData(data);
    aiSolveHint.value = '';
    aiChecklist.value = [];
    globalError.value = '';
  } catch (e) {
    globalError.value = `关卡请求失败：${e?.message || '请稍后重试'}`;
  }
}

async function runValidation() {
  if (!level.value) return;
  const previousLevelKey = level.value.key;
  const payload = {
    // 为了兼容当前后端校验逻辑，将同一份代码同时作为 html/css/js 源（正则同样可以匹配）
    html: codeValue.value,
    css: codeValue.value,
    js: codeValue.value,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (authToken.value) {
    headers.Authorization = `Bearer ${authToken.value}`;
  }

  const res = await fetch(`${API_BASE}/api/levels/${level.value.key}/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    logout();
    return;
  }
  if (!res.ok) {
    globalError.value = `校验失败（${res.status}）`;
    return;
  }

  const data = await res.json();
  validationResult.value = data;
  aiSolveHint.value = '';
  closeRewardModal();

  if (data.profile) {
    profile.value = data.profile;
  }
  await loadBadges();

  if (Array.isArray(data.newlyAwardedBadges) && data.newlyAwardedBadges.length > 0) {
    const names = data.newlyAwardedBadges.map((x) => x.name).join('、');
    startTyping(`【系统】恭喜你解锁新徽章：${names}！继续冒险吧。`);
  }

  if (!data.pass && Array.isArray(data.npcHints) && data.npcHints.length > 0) {
    isCurrentLevelPassed.value = false;
    startTyping(data.npcHints[0]);
  } else if (data.pass) {
    isCurrentLevelPassed.value = true;
    const badgeNames = Array.isArray(data.newlyAwardedBadges) && data.newlyAwardedBadges.length > 0
      ? data.newlyAwardedBadges.map((x) => x.name).join('、')
      : '暂无新徽章';
    rewardModalText.value = `+30 EXP\n${badgeNames === '暂无新徽章' ? '本次未解锁新徽章' : `新徽章：${badgeNames}`}`;
    rewardModalVisible.value = true;
    clearTimeout(rewardAutoCloseTimer);
    rewardAutoCloseTimer = setTimeout(() => {
      closeRewardModal();
    }, 4000);
    startTyping('【系统】本次提交已通过，继续下一步学习。');

    // 通关烟花特效：在屏幕中心喷洒五彩纸屑
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { x: 0.5, y: 0.3 },
      colors: ['#22c55e', '#0ea5e9', '#facc15', '#f97316'],
      ticks: 200,
    });

    // 轻微再补一小波，营造持续感
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 90,
        scalar: 0.9,
        origin: { x: 0.2, y: 0.4 },
        colors: ['#22c55e', '#0ea5e9', '#facc15'],
      });
      confetti({
        particleCount: 60,
        spread: 90,
        scalar: 0.9,
        origin: { x: 0.8, y: 0.4 },
        colors: ['#22c55e', '#0ea5e9', '#f97316'],
      });
    }, 250);

    // 先给用户看到撒花与奖励反馈，再询问是否跳下一题
    await new Promise((resolve) => setTimeout(resolve, 1300));

    const fallbackNextLevelKey = getNextLevelKeyFromMap(previousLevelKey);
    const targetNextLevelKey = data.nextLevelKey || fallbackNextLevelKey;
    const shouldGoNext = targetNextLevelKey && targetNextLevelKey !== previousLevelKey
      ? (typeof window !== 'undefined'
        ? window.confirm('是否进行下一关挑战？')
        : true)
      : false;

    if (shouldGoNext) {
      await loadLevelByKey(targetNextLevelKey);
      markCurrentLevelInMap(targetNextLevelKey, previousLevelKey);
      await loadMap();
      return;
    }

    await loadMap({ keepCurrentSelection: true });
    return;
  }
  await loadMap({ keepCurrentSelection: true });
}

function getNextLevelKeyFromMap(currentKey) {
  const idx = mapLevels.value.findIndex((x) => x.key === currentKey);
  if (idx >= 0 && idx + 1 < mapLevels.value.length) {
    return mapLevels.value[idx + 1].key;
  }
  return null;
}

function markCurrentLevelInMap(currentKey, previousKey) {
  mapLevels.value = mapLevels.value.map((x) => {
    if (x.key === currentKey) return { ...x, status: 'current' };
    if (x.key === previousKey) return { ...x, status: 'completed' };
    return x;
  });
}

async function requestAiSolveHint(silent = false) {
  if (!level.value?.key) return;
  const headers = { 'Content-Type': 'application/json' };
  if (authToken.value) {
    headers.Authorization = `Bearer ${authToken.value}`;
  }
  try {
    if (!silent) aiHintLoading.value = true;
    const res = await fetch(`${API_BASE}/api/ai/solve-hint`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        levelKey: level.value.key,
        html: codeValue.value,
        css: codeValue.value,
        js: codeValue.value,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    aiSolveHint.value = data.hint || '';
    aiChecklist.value = data.checklist || [];
  } finally {
    if (!silent) aiHintLoading.value = false;
  }
}

async function loadBadges() {
  const headers = {};
  if (authToken.value) headers.Authorization = `Bearer ${authToken.value}`;
  const res = await fetch(`${API_BASE}/api/rewards/badges`, { headers });
  if (!res.ok) return;
  badges.value = await res.json();
}

async function loadLeaderboard() {
  const headers = {};
  if (authToken.value) headers.Authorization = `Bearer ${authToken.value}`;
  const res = await fetch(`${API_BASE}/api/leaderboard`, { headers });
  if (!res.ok) return;
  leaderboard.value = await res.json();
}

async function loadLearningPath() {
  const headers = {};
  if (authToken.value) headers.Authorization = `Bearer ${authToken.value}`;
  const res = await fetch(`${API_BASE}/api/ai/learning-path`, { headers });
  if (!res.ok) return;
  const data = await res.json();
  learningSuggestions.value = data.suggestions || [];
  remedialExercises.value = data.remedial || [];
}

async function loadRemedialPlan() {
  const headers = {};
  if (authToken.value) headers.Authorization = `Bearer ${authToken.value}`;
  const res = await fetch(`${API_BASE}/api/ai/remedial-plan`, { headers });
  if (!res.ok) return;
  const data = await res.json();
  const nextWeakTopics = Array.isArray(data.weakTopics) ? data.weakTopics : [];
  const nextRecommendedLevels = data.recommendedLevels || [];
  const rawExercises = data.generatedExercises || remedialExercises.value || [];
  remedialExercises.value = (rawExercises || []).map((ex, idx) => {
    const weakTopic = nextWeakTopics[idx]?.topic || nextWeakTopics[0]?.topic || '';
    const inferredTopic = inferExerciseTopic(ex, weakTopic);
    const relatedLevel = nextRecommendedLevels.length
      ? nextRecommendedLevels[idx % nextRecommendedLevels.length]
      : null;
    return {
      ...ex,
      _topic: inferredTopic,
      _relatedLevel: relatedLevel,
    };
  });
  recommendedLevels.value = nextRecommendedLevels;
  remedialWeakTopics.value = nextWeakTopics;
}

function applyRemedialExercise(exercise) {
  const topic = inferExerciseTopic(exercise, exercise?._topic || '');
  const topicText = topicLabel(topic);
  const coreConceptText = buildRemedialCoreConcept(topic, exercise?._relatedLevel);
  const sourceRef = exercise?._relatedLevel ? `（关联${formatLevelRef(exercise._relatedLevel)}）` : '';
  const cleanTitle = String(exercise.title || '补强练习').replace(/^补强题[:：]\s*/, '');

  level.value = {
    key: exercise.id,
    title: `${topicText}补强：${cleanTitle}${sourceRef}`,
    coreConcept: coreConceptText,
    taskMarkdown: `# ${exercise.title}\n\n对应知识点：${topicText}\n\n核心能力：${coreConceptText}\n\n目标：${exercise.goal}\n\n提示：${exercise.hint}\n\n- ${exercise.checklist.join('\n- ')}`,
  };
  codeValue.value = exercise.starterCode || '';
  refreshPreviewNow();
  startTyping(`【学习助手】先做这道补强题：${exercise.title}`);
  aiSolveHint.value = exercise.hint || '';
  aiChecklist.value = exercise.checklist || [];
}

function formatLevelRef(level) {
  if (!level) return '';
  return `第${level.chapter}-${level.order}关《${level.title}》`;
}

const LEVEL_STUDY_GUIDE = {
  'html-foundation': [
    '掌握 **h1** 与 **p** 的语义用法，并确保结构清晰。',
    '理解标签层级：标题在前，说明段落在后。',
    '避免把正文内容全部写进同一个标签。'
  ],
  'html-password-form': [
    '会使用 **input[type="password"]** 创建密码输入框。',
    '掌握 **button[type="submit"]** 的提交语义。',
    '理解表单最小结构：输入 + 提交。'
  ],
  'css-color-and-font': [
    '能正确设置 **color** 与 **font-size**。',
    '理解选择器命中元素后样式才生效。',
    '避免单位遗漏（如 font-size 建议写 px/rem）。'
  ],
  'css-flex-bridge': [
    '父容器必须写 **display: flex**。',
    '会使用 **justify-content: space-around** 控制水平分布。',
    '理解 Flex 属性写在父元素而非子元素。'
  ],
  'js-variable-power': [
    '掌握变量声明：**let power = 100**。',
    '理解变量名、赋值符和数值的基本语法。',
    '避免把 let 写成字符串或注释内容。'
  ],
  'js-if-gate': [
    '会写基础条件分支：**if (mana > 50)**。',
    '理解布尔判断与代码块执行关系。',
    '建议同时补充 else 分支提升完整性。'
  ],
  'js-dom-query': [
    '会用 **querySelector** 获取页面元素。',
    '能按 id/class 精确选择目标节点。',
    '拿到元素后再进行文本或样式操作。'
  ],
  'js-click-event': [
    '会绑定点击事件：**addEventListener("click")**。',
    '点击后正确更新内容（textContent/innerText）。',
    '确认事件绑定对象和被修改对象是同一个流程。'
  ],
  'project-todo-app': [
    '搭建最小 Todo 结构：**input + ul**。',
    '输入、添加、展示三步流程要打通。',
    '保持结构语义化，便于后续扩展。'
  ],
  'project-localstorage': [
    '会使用 **localStorage.setItem/getItem** 持久化。',
    '理解对象存储需要 JSON.stringify/parse。',
    '刷新页面后能恢复数据才算通过。'
  ],
  'css-responsive-layout': [
    '掌握响应式断点与布局切换思路。',
    '优先保证移动端可读，再增强桌面端。',
    '关键属性：宽度约束、换行、间距。'
  ],
  'css-animation-orb': [
    '会定义 **@keyframes** 并绑定 animation。',
    '控制动画时长、节奏与循环。',
    '动画效果要服务交互，不宜过度。'
  ],
  'js-array-map': [
    '掌握 **array.map()** 返回新数组。',
    '理解回调参数与返回值关系。',
    '避免在 map 中遗漏 return。'
  ],
  'js-async-await': [
    '掌握 **async/await** 串联异步流程。',
    '理解 await 只能在 async 函数中使用。',
    '必要时加入 try/catch 处理异常。'
  ],
  'js-fetch-api': [
    '会用 **fetch** 请求接口并解析 JSON。',
    '理解请求-响应-渲染三步链路。',
    '注意异步结果拿到后再更新页面。'
  ],
  'dom-form-validate': [
    '掌握表单校验触发时机（提交前）。',
    '能判断空值、长度、格式等基础条件。',
    '校验失败时给出清晰提示信息。'
  ],
  'dom-event-delegation': [
    '理解事件委托：父元素统一监听子元素行为。',
    '会通过事件对象定位触发目标。',
    '适用于动态列表，减少重复绑定。'
  ],
  'project-timer-app': [
    '实现计时器启动、暂停、重置完整流程。',
    '处理好时间状态与 UI 同步更新。',
    '优先保证逻辑正确，再做样式增强。'
  ],
};

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatStudyItem(text) {
  const safe = escapeHtml(text);
  const bolded = safe.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-200 font-semibold">$1</strong>');
  return `• ${bolded}`;
}

function getStudyKnowledgePoints(levelObj) {
  if (!levelObj?.key) {
    return ['先选择一个关卡，再查看该关卡的知识点要点。'];
  }
  const byKey = LEVEL_STUDY_GUIDE[levelObj.key];
  if (Array.isArray(byKey) && byKey.length > 0) return byKey;
  const concept = levelObj.coreConcept || '基础前端能力';
  return [
    `理解本关核心能力：**${concept}**。`,
    '先做最小可运行版本，再逐步补齐细节。',
    '结合报错与提示反复自测，直到稳定通过。'
  ];
}

function openStudyGuide(levelObj) {
  studyGuideLevel.value = levelObj;
  showStudyGuideModal.value = true;
}

function topicLabel(topic) {
  const map = {
    html: 'HTML 结构',
    css: 'CSS 样式',
    dom: 'DOM 与事件',
    async: '异步与接口',
    project: '项目综合',
    javascript: 'JavaScript 逻辑',
  };
  return map[topic] || '当前章节';
}

function inferExerciseTopic(exercise, fallbackTopic = '') {
  const text = `${exercise?.title || ''} ${exercise?.goal || ''} ${exercise?.hint || ''} ${exercise?.id || ''}`.toLowerCase();
  if (text.includes('html') || text.includes('标签') || text.includes('header') || text.includes('main') || text.includes('footer')) return 'html';
  if (text.includes('css') || text.includes('flex') || text.includes('响应式') || text.includes('动画') || text.includes('布局')) return 'css';
  if (text.includes('dom') || text.includes('queryselector') || text.includes('addeventlistener') || text.includes('事件') || text.includes('点击')) return 'dom';
  if (text.includes('async') || text.includes('await') || text.includes('fetch') || text.includes('接口')) return 'async';
  if (text.includes('todo') || text.includes('storage') || text.includes('项目')) return 'project';
  if (fallbackTopic) return fallbackTopic;
  return 'javascript';
}

function buildRemedialCoreConcept(topic, relatedLevel) {
  if (relatedLevel?.coreConcept) return relatedLevel.coreConcept;
  const map = {
    html: '语义化结构与基础标签组织',
    css: '布局与样式表达（含 Flex/响应式）',
    dom: 'DOM 查询、事件绑定与交互更新',
    async: '异步流程控制与接口数据处理',
    project: '综合实战与状态持久化',
    javascript: '变量、条件、逻辑表达与基础语法',
  };
  return map[topic] || '前端基础综合能力';
}

function buildExerciseReasonText(idx) {
  const reasons = [];
  const weak = Array.isArray(remedialWeakTopics.value) && remedialWeakTopics.value.length > 0
    ? remedialWeakTopics.value[Math.min(idx, remedialWeakTopics.value.length - 1)]
    : null;
  const level = Array.isArray(recommendedLevels.value) && recommendedLevels.value.length > 0
    ? recommendedLevels.value[idx % recommendedLevels.value.length]
    : null;

  if (weak?.fail >= 3) {
    reasons.push(`${topicLabel(weak.topic)}错误次数过多（近期 ${weak.fail} 次）`);
  } else if (weak?.score >= 2) {
    reasons.push(`${topicLabel(weak.topic)}这一章内容错得比较集中`);
  }

  if (showAiRedDot.value) {
    reasons.push('当前关卡做题时间偏长（超过 15 分钟）');
  }

  const refText = formatLevelRef(level);
  if (refText) {
    reasons.push(`在${refText}的答题表现波动较大`);
  }

  if (reasons.length === 0) {
    return '根据近期答题表现，建议先做这道题把薄弱点补起来。';
  }
  return `因为你${reasons.join('，')}。`;
}

async function handleSelectLevel(l) {
  if (!authToken.value) return;
  const mapNode = mapLevels.value.find((x) => x.key === l.key);
  const status = l.status || mapNode?.status || 'locked';
  if (status === 'locked') {
    globalError.value = '该关卡尚未解锁，请先完成前一关。';
    return;
  }
  globalError.value = '';
  currentLevelKey.value = l.key;
  await loadLevelByKey(l.key);
}

function applyLevelData(data) {
  if (currentLevelKey.value !== data.key) {
    levelStartMs.value = Date.now();
    isCurrentLevelPassed.value = false;
  }
  level.value = data;
  currentLevelKey.value = data.key;

  const loadedCode = typeof data.savedCode === 'string' && data.savedCode.trim()
    ? data.savedCode
    : (data.starterHtml || '');
  codeValue.value = loadedCode;
  refreshPreviewNow();
  lastPreviewSource = loadedCode;
  const firstHint = Array.isArray(data.npcDialogues) && data.npcDialogues.length > 0 ? data.npcDialogues[0] : '';
  startTyping(firstHint);

  if (editorInstance.value) {
    editorInstance.value.setValue(codeValue.value);
  }
}

async function redoCurrentLevel() {
  if (!level.value?.key) return;
  const ok = typeof window !== 'undefined'
    ? window.confirm('是否要重新挑战？')
    : true;
  if (!ok) return;
  const headers = { 'Content-Type': 'application/json' };
  if (authToken.value) {
    headers.Authorization = `Bearer ${authToken.value}`;
  }
  const res = await fetch(`${API_BASE}/api/levels/${level.value.key}/reset-submission`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    globalError.value = `重置失败（${res.status}）`;
    return;
  }
  const data = await res.json();
  const starter = data.starterHtml || '';
  codeValue.value = starter;
  validationResult.value = null;
  aiSolveHint.value = '';
  aiChecklist.value = [];
  isCurrentLevelPassed.value = false;
  levelStartMs.value = Date.now();
  refreshPreviewNow();
  if (editorInstance.value) {
    editorInstance.value.setValue(starter);
  }
  if (level.value) {
    level.value = {
      ...level.value,
      savedCode: '',
      hasSavedSubmission: false,
    };
  }
  startTyping('【系统】已重置本关代码，请重新挑战。');
}

function fillAdminAnswerToEditor() {
  const answer = String(level.value?.adminAnswer || '').trim();
  if (!answer) return;
  codeValue.value = answer;
  validationResult.value = null;
  refreshPreviewNow();
  lastPreviewSource = answer;
  if (editorInstance.value) {
    editorInstance.value.setValue(answer);
  }
  startTyping('【管理员工具】已一键填入参考答案。');
}

function openPanel(panelKey) {
  if (activePanel.value === 'badges' && panelKey !== 'badges') {
    markBadgeWallSeen();
    resetBadgeWallAnimation();
  }
  activePanel.value = panelKey;
  if (panelKey === 'badges') {
    setupBadgeWallAnimation();
  }
}

function closePanel() {
  if (activePanel.value === 'badges') {
    markBadgeWallSeen();
    resetBadgeWallAnimation();
  }
  activePanel.value = '';
}

function getBadgeWallSeenStorageKey() {
  const userId = Number(currentUser.value?.id || 0);
  if (!userId || typeof window === 'undefined') return '';
  return `badge_wall_seen_earned_keys_${userId}`;
}

function readBadgeWallSeenKeys() {
  try {
    const key = getBadgeWallSeenStorageKey();
    if (!key) return [];
    const raw = window.localStorage.getItem(key) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
}

function writeBadgeWallSeenKeys(keys) {
  const key = getBadgeWallSeenStorageKey();
  if (!key || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(keys));
}

function markBadgeWallSeen() {
  const earnedKeys = badges.value.filter((b) => b.earned).map((b) => b.key);
  writeBadgeWallSeenKeys(earnedKeys);
}

function clearBadgeAnimTimers() {
  while (badgeAnimTimers.length) {
    const timer = badgeAnimTimers.pop();
    clearTimeout(timer);
  }
}

function resetBadgeWallAnimation() {
  clearBadgeAnimTimers();
  badgeRecentlyEarnedKeys.value = [];
  badgeAnimatingKey.value = '';
  badgeRevealDoneKeys.value = [];
}

async function setupBadgeWallAnimation() {
  await loadBadges();
  clearBadgeAnimTimers();
  badgeAnimatingKey.value = '';
  badgeRevealDoneKeys.value = [];

  const earnedKeys = badges.value.filter((b) => b.earned).map((b) => b.key);
  const seenKeys = readBadgeWallSeenKeys();
  const recentKeys = earnedKeys.filter((k) => !seenKeys.includes(k));
  badgeRecentlyEarnedKeys.value = recentKeys;

  if (!recentKeys.length) return;
  recentKeys.forEach((key, idx) => {
    const timer = setTimeout(() => {
      badgeAnimatingKey.value = key;
      badgeRevealDoneKeys.value = [...new Set([...badgeRevealDoneKeys.value, key])];
    }, idx * 620);
    badgeAnimTimers.push(timer);
  });

  const finishTimer = setTimeout(() => {
    badgeAnimatingKey.value = '';
    markBadgeWallSeen();
  }, recentKeys.length * 620 + 900);
  badgeAnimTimers.push(finishTimer);
}

function badgeNameByKey(key) {
  const badge = badges.value.find((b) => b.key === key);
  return badge?.name || key;
}

function badgeIcon(badge) {
  const iconMap = {
    'newcomer': '🧭',
    'html-master': '🏛️',
    'css-magician': '🎨',
    'js-awaken': '⚡',
    'consistent-learner': '🔥',
    'all-round-explorer': '🌌',
    'collab-master': '🤝',
  };
  return iconMap[badge.key] || (badge.earned ? '🏅' : '🔒');
}

function badgeGlowColor(badge) {
  const colorMap = {
    'newcomer': 'rgba(56, 189, 248, 0.65)',
    'html-master': 'rgba(16, 185, 129, 0.7)',
    'css-magician': 'rgba(236, 72, 153, 0.72)',
    'js-awaken': 'rgba(250, 204, 21, 0.72)',
    'consistent-learner': 'rgba(249, 115, 22, 0.72)',
    'all-round-explorer': 'rgba(147, 51, 234, 0.72)',
    'collab-master': 'rgba(34, 197, 94, 0.72)',
  };
  return colorMap[badge.key] || 'rgba(16, 185, 129, 0.65)';
}

function badgeCardStyle(badge) {
  return {
    '--badge-glow': badgeGlowColor(badge),
  };
}

function badgeCardClass(badge) {
  const isRecent = badgeRecentlyEarnedKeys.value.includes(badge.key);
  const isAnimating = badgeAnimatingKey.value === badge.key;
  const revealed = badgeRevealDoneKeys.value.includes(badge.key);
  return {
    'is-earned': badge.earned,
    'is-locked': !badge.earned,
    'is-recent': isRecent,
    'is-hidden-before-reveal': isRecent && !revealed && !isAnimating,
    'is-entering': isAnimating,
  };
}

function goAdminLevels() {
  if (typeof window === 'undefined') return;
  setAdminModePreference('manage');
  adminEntryPending.value = false;
  window.location.href = '/admin/levels';
}

function goLearningPage() {
  if (typeof window === 'undefined') return;
  setAdminModePreference('learn');
  adminEntryPending.value = false;
  window.location.href = '/';
}

function goCollabPage() {
  if (typeof window === 'undefined') return;
  window.location.href = '/collab';
}

function enterLearnMode() {
  setAdminModePreference('learn');
  adminEntryPending.value = false;
}

function initCollabSocket() {
  if (!authToken.value) return;
  if (collabSocket) {
    collabSocket.disconnect();
    collabSocket = null;
  }
  collabSocket = io(API_BASE, {
    transports: ['websocket'],
    auth: { token: authToken.value },
  });
  collabSocket.on('collab:state', (state) => {
    collabState.value = state;
    if (state?.challenge?.id) {
      selectedCollabChallengeId.value = state.challenge.id;
    }
    if (state?.status === 'in_progress' && !collabMyCode.value) {
      const part = collabMyMember.value?.part || 'A';
      collabMyCode.value = state?.challenge?.parts?.[part]?.starterCode || '';
    }
    const myReward = Array.isArray(state?.lastRewards)
      ? state.lastRewards.find((r) => Number(r.userId) === Number(currentUser.value?.id))
      : null;
    if (myReward) {
      const rewardKey = `${state.roomId}:${state.challenge?.id || ''}:${myReward.awardedExp}:${myReward.collabSolvedCount}`;
      if (collabRewardHandledKey.value !== rewardKey) {
        collabRewardHandledKey.value = rewardKey;
        loadMe();
        loadBadges();
        loadLeaderboard();
      }
    }
  });
  collabSocket.on('collab:submit-result', (result) => {
    collabLastSubmitPass.value = Boolean(result?.pass);
    collabSubmitFeedback.value = Array.isArray(result?.feedback) ? result.feedback : [];
  });
  collabSocket.on('collab:error', (err) => {
    globalError.value = err?.message || '协作连接异常';
  });
}

function joinCollabRoom() {
  if (!collabSocket) initCollabSocket();
  const roomId = (collabRoomIdInput.value || '').trim();
  if (!roomId) return;
  const challengeId = (selectedCollabChallengeId.value || '').trim();
  collabMyCode.value = '';
  collabSubmitFeedback.value = [];
  collabLastSubmitPass.value = false;
  collabSocket.emit('collab:join-game', { roomId, challengeId });
}

function leaveCollabRoom() {
  if (!collabSocket) return;
  collabSocket.emit('collab:leave-game');
  collabState.value = null;
  collabMyCode.value = '';
  collabSubmitFeedback.value = [];
  collabLastSubmitPass.value = false;
  collabRewardHandledKey.value = '';
}

function submitCollabPart() {
  if (!collabSocket || !collabState.value?.roomId) return;
  collabSocket.emit('collab:submit-part', {
    roomId: collabState.value.roomId,
    code: collabMyCode.value,
  });
}

async function loadCollabChallenges() {
  if (!authToken.value) return;
  const res = await fetch(`${API_BASE}/api/collab/challenges`, {
    headers: { Authorization: `Bearer ${authToken.value}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  collabChallenges.value = Array.isArray(data) ? data : [];
  if (!selectedCollabChallengeId.value && collabChallenges.value.length > 0) {
    selectedCollabChallengeId.value = collabChallenges.value[0].id;
  }
}

async function createRandomRoomAndJoin() {
  if (!authToken.value) return;
  if (!selectedCollabChallengeId.value) {
    globalError.value = '请先选择一个协作关卡';
    return;
  }
  const res = await fetch(`${API_BASE}/api/collab/room-code`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken.value}` },
  });
  if (!res.ok) {
    globalError.value = '创建房间失败';
    return;
  }
  const data = await res.json();
  collabRoomIdInput.value = data.roomId || '';
  joinCollabRoom();
}

async function copyRoomCode() {
  const roomId = collabState.value?.roomId || collabRoomIdInput.value;
  if (!roomId || typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(roomId);
    startTyping('【协作】房间号已复制，发送给队友即可加入。');
  } catch (e) {
    globalError.value = '复制失败，请手动复制房间号';
  }
}

function isCollabChallengeSolved(challengeId) {
  return collabSolvedSet.value.has(challengeId);
}

function handleAuthenticated(payload) {
  authToken.value = payload.token;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('auth_token', payload.token);
    window.localStorage.removeItem('auth_token');
  }
  currentUser.value = payload.user;
  profile.value = payload.profile;
  authMode.value = 'login';
  globalError.value = '';
  isCurrentLevelPassed.value = false;
  levelStartMs.value = Date.now();
  if (payload?.user?.role !== 'admin') {
    setAdminModePreference('');
  }
  const modePref = getAdminModePreference();
  adminEntryPending.value = payload?.user?.role === 'admin' && !modePref;
  // 登录/注册成功后，先加载地图；默认不自动启用 Monaco，避免卡顿
  nextTick(async () => {
    editorInitError.value = '';
    useMonaco.value = false;
    initCollabSocket();
    await loadMe();
    await loadCollabChallenges();
    await loadMap();
  });
}

function logout() {
  authToken.value = '';
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('auth_token');
    window.localStorage.removeItem('auth_token');
  }
  currentUser.value = null;
  mapLevels.value = [];
  profile.value = null;
  level.value = null;
  currentLevelKey.value = null;
  validationResult.value = null;
  badges.value = [];
  resetBadgeWallAnimation();
  leaderboard.value = [];
  learningSuggestions.value = [];
  aiSolveHint.value = '';
  aiChecklist.value = [];
  remedialExercises.value = [];
  recommendedLevels.value = [];
  closeRewardModal();
  setAdminModePreference('');
  adminEntryPending.value = false;
  leaveCollabRoom();
  if (collabSocket) {
    collabSocket.disconnect();
    collabSocket = null;
  }
  useMonaco.value = false;
  if (editorInstance.value) {
    editorInstance.value.dispose();
    editorInstance.value = null;
  }
}

function closeRewardModal() {
  rewardModalVisible.value = false;
  rewardModalText.value = '';
  clearTimeout(rewardAutoCloseTimer);
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') {
    closeRewardModal();
  }
}

async function initEditorIfNeeded() {
  if (editorInstance.value || !editorContainer.value || !useMonaco.value) {
    return;
  }
  try {
    const monacoModule = await import('monaco-editor');
    const monacoApi = monacoModule.default || monacoModule;
    editorInstance.value = monacoApi.editor.create(editorContainer.value, {
      value: codeValue.value,
      language: 'html',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
    });
    editorInstance.value.onDidChangeModelContent(() => {
      codeValue.value = editorInstance.value.getValue();
      schedulePreviewUpdate();
      scheduleAiHintUpdate();
    });
    editorInitError.value = '';
  } catch (e) {
    // 编辑器失败时保底，不影响地图/任务加载
    editorInitError.value = e?.message || 'Monaco 初始化失败';
    console.error('Monaco init failed:', e);
  }
}

async function enableMonaco() {
  useMonaco.value = true;
  await nextTick();
  await initEditorIfNeeded();
}

onMounted(async () => {
  if (authToken.value) {
    // 有本地 Token 时尝试直接加载地图
    await nextTick();
    initCollabSocket();
    await loadMe();
    await loadCollabChallenges();
    const modePref = getAdminModePreference();
    if (currentUser.value?.role === 'admin' && isAdminRoute.value && !modePref) {
      setAdminModePreference('manage');
    }
    adminEntryPending.value = currentUser.value?.role === 'admin' && !modePref;
    await loadMap();
  }

  refreshPreviewNow();
  window.addEventListener('keydown', handleGlobalKeydown);
  nowTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 15000);
});

onBeforeUnmount(() => {
  if (editorInstance.value) {
    editorInstance.value.dispose();
  }
  clearInterval(typingTimer);
  clearTimeout(previewTimer);
  clearTimeout(aiHintTimer);
  clearTimeout(rewardAutoCloseTimer);
  clearBadgeAnimTimers();
  clearInterval(nowTimer);
  if (collabSocket) {
    collabSocket.disconnect();
    collabSocket = null;
  }
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.6);
  border-radius: 999px;
}
.badge-wall-card {
  border: 1px solid rgba(71, 85, 105, 0.8);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.75);
  padding: 10px;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, opacity 220ms ease;
}
.badge-wall-card.is-earned {
  border-color: color-mix(in srgb, var(--badge-glow) 68%, #e2e8f0 32%);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--badge-glow) 38%, transparent),
    0 0 16px color-mix(in srgb, var(--badge-glow) 45%, transparent);
}
.badge-wall-card.is-locked {
  opacity: 0.58;
  filter: grayscale(0.2);
}
.badge-wall-card.is-recent.is-hidden-before-reveal {
  opacity: 0.22;
  transform: translateY(8px) scale(0.95);
}
.badge-wall-card.is-entering {
  animation: badgeDropIn 620ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
@keyframes badgeDropIn {
  0% {
    transform: translateY(16px) scale(0.86);
    opacity: 0.2;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--badge-glow) 70%, transparent);
  }
  48% {
    transform: translateY(-2px) scale(1.04);
    opacity: 1;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--badge-glow) 55%, transparent),
      0 0 28px color-mix(in srgb, var(--badge-glow) 78%, transparent);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--badge-glow) 38%, transparent),
      0 0 16px color-mix(in srgb, var(--badge-glow) 45%, transparent);
  }
}
.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #94a3b8;
  animation: dotPulse 1.2s ease-in-out infinite;
}
.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}
.loading-dot-amber {
  background: #f59e0b;
}
@keyframes dotPulse {
  0%, 80%, 100% {
    transform: scale(0.75);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>

