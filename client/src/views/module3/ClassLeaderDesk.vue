<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    :title="`${currentRoleName}待评价任务`"
    description="首次评价和异议复评分开进入，避免不同处理规则的任务混在同一列表。"
    :back-path="workbenchPath"
    back-label="返回模块三工作台"
    :cards="menuCards"
  />

  <div v-else class="class-leader-desk">
    <button class="back-link" @click="router.push('/module3/class-leader')"><VIcon icon="mdi:arrow-left" />返回待评价任务</button>
    <div class="page-header">
      <h2>{{ view === 'objection' ? '异议复评任务' : '首次评价任务' }}</h2>
      <p class="page-desc">只显示明确分配给当前账号的{{ view === 'objection' ? '异议复评' : '首次评价' }}表单。</p>
    </div>

    <div class="stats-row">
      <div class="stat-card warning"><VIcon icon="mdi:clock-outline" class="stat-icon" /><div class="stat-num">{{ filteredPending.length }}</div><div class="stat-lbl">当前待处理</div></div>
      <div class="stat-card success"><VIcon icon="mdi:check-circle-outline" class="stat-icon" /><div class="stat-num">{{ stats?.approved || 0 }}</div><div class="stat-lbl">已认定通过</div></div>
      <div class="stat-card error"><VIcon icon="mdi:close-circle-outline" class="stat-icon" /><div class="stat-num">{{ (stats?.returned || 0) + (stats?.rejected || 0) }}</div><div class="stat-lbl">退回/不予认定</div></div>
    </div>

    <div class="review-list glass-card">
      <div class="panel-header"><h3><VIcon icon="mdi:clipboard-account-outline" />{{ view === 'objection' ? '异议复评' : '首次评价' }}列表</h3><span class="panel-badge">{{ filteredPending.length }} 份待处理</span></div>
      <div class="student-list">
        <div class="student-row" v-for="(form, i) in filteredPending" :key="form.id" :style="{ animationDelay: (i * 0.06) + 's' }" @click="goDetail(form.id)">
          <div class="student-main"><VIcon icon="mdi:account-circle-outline" class="student-icon" /><div><div class="student-name">{{ form.student_name }} <span class="review-stage" v-if="form.review_stage === 'objection'">异议复评</span></div><div class="student-meta">学号：{{ form.student_no }} · 学院：{{ form.college }} · 年级：{{ form.grade }} · 班级：{{ form.class_name }} · 综合分：{{ form.scores.total }}</div></div></div>
          <div class="student-status"><span>{{ form.status_label }}</span><VIcon icon="mdi:chevron-right" /></div>
        </div>
        <div class="empty-state" v-if="!filteredPending.length"><VIcon icon="mdi:check-all" /><span>{{ emptyText }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { getPendingReviews, getStatistics } from '../../api/module3';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/user';
import { ROLE_LABEL } from '../../utils/constants';

const props = defineProps({ view: { type: String, default: 'menu' } });
const view = computed(() => props.view || 'menu');
const router = useRouter();
const userStore = useUserStore();
const currentRoleName = computed(() => userStore.user?.is_assessment_member ? '评价小组' : (ROLE_LABEL[userStore.role] || '评价人员'));
const workbenchPath = computed(() => ({ admin: '/module3/admin', counselor: '/module3/counselor', student_affairs: '/module3/student-affairs', student: '/module3/student' }[userStore.role] || '/module3/student'));
const pending = ref([]);
const stats = ref(null);
const initialCount = computed(() => pending.value.filter(form => form.review_stage !== 'objection').length);
const objectionCount = computed(() => pending.value.filter(form => form.review_stage === 'objection').length);
const filteredPending = computed(() => view.value === 'objection' ? pending.value.filter(form => form.review_stage === 'objection') : pending.value.filter(form => form.review_stage !== 'objection'));
const menuCards = computed(() => [
  { title: '首次评价任务', description: '处理评价链当前环节首次分配给本账号的综测表', icon: 'mdi:clipboard-check-outline', to: '/module3/class-leader/initial', note: `${initialCount.value} 份待处理` },
  { title: '异议复评任务', description: '只处理学生统一提交异议后返回的异议项目', icon: 'mdi:message-question-outline', to: '/module3/class-leader/objection', note: `${objectionCount.value} 份待处理` },
]);
const emptyText = computed(() => userStore.role === 'student' && !userStore.user?.is_assessment_member ? '当前学生未被赋予评价小组身份' : `暂无分配给你的${view.value === 'objection' ? '异议复评' : '首次评价'}任务`);
async function load() {
  const pendingRes = await getPendingReviews(); if (pendingRes.code === 200) pending.value = pendingRes.data || [];
  const statRes = await getStatistics(); if (statRes.code === 200) stats.value = statRes.data;
}
function goDetail(id) { router.push(`/module3/review-detail/${id}`); }
onMounted(load);
</script>

<style scoped>
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
.class-leader-desk { display:flex; flex-direction:column; gap:24px; animation:fadeIn .4s var(--easing-decelerate); }.page-header h2 { font-size:22px; }.page-desc { font-size:14px; color:var(--color-text-secondary); margin-top:2px; }
.stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }.stat-card { padding:20px; border-radius:var(--radius-xl); background:var(--color-surface); border:1px solid var(--color-border); display:grid; grid-template-columns:auto 1fr; gap:6px 12px; align-items:center; }.stat-icon { grid-row:span 2; font-size:30px; }.stat-num { font-size:24px; font-weight:600; }.stat-lbl { color:var(--color-text-secondary); font-size:13px; }.warning .stat-icon { color:#f59e0b; }.success .stat-icon { color:#34a853; }.error .stat-icon { color:#ef4444; }
.review-list { padding:20px; border-radius:var(--radius-xl); }.panel-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }.panel-header h3 { display:flex; align-items:center; gap:8px; font-size:16px; }.panel-badge { font-size:13px; color:var(--color-primary); }.student-list { display:flex; flex-direction:column; gap:10px; }.student-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px; border-radius:var(--radius-lg); background:var(--color-bg); cursor:pointer; }.student-row:hover { transform:translateY(-1px); box-shadow:var(--shadow-level-1); }.student-main { display:flex; align-items:center; gap:12px; }.student-icon { font-size:28px; color:var(--color-primary); }.student-name { font-weight:600; display:flex; align-items:center; gap:8px; }.review-stage { padding:3px 8px; border-radius:var(--radius-full); background:rgba(245,158,11,.12); color:#d97706; font-size:11px; }.student-meta { color:var(--color-text-secondary); font-size:13px; margin-top:4px; }.student-status { display:flex; align-items:center; gap:8px; color:var(--color-primary); white-space:nowrap; }.empty-state { display:flex; flex-direction:column; align-items:center; gap:8px; padding:32px; color:var(--color-text-tertiary); }
@media (max-width:768px) { .stats-row { grid-template-columns:1fr; }.student-row { flex-direction:column; align-items:stretch; } }
</style>
