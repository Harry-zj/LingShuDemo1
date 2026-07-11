<template>
  <div class="class-leader-desk">
    <div class="page-header">
      <h2>{{ deskTitle }}</h2>
      <p class="page-desc">评测过程中只显示分配给当前账号的待评表单</p>
    </div>

    <div class="stats-row">
      <div class="stat-card warning">
        <VIcon icon="mdi:clock-outline" class="stat-icon" />
        <div class="stat-num">{{ pending.length }}</div>
        <div class="stat-lbl">我的待评价</div>
      </div>
      <div class="stat-card success">
        <VIcon icon="mdi:check-circle-outline" class="stat-icon" />
        <div class="stat-num">{{ stats?.approved || 0 }}</div>
        <div class="stat-lbl">已认定通过</div>
      </div>
      <div class="stat-card error">
        <VIcon icon="mdi:close-circle-outline" class="stat-icon" />
        <div class="stat-num">{{ (stats?.returned || 0) + (stats?.rejected || 0) }}</div>
        <div class="stat-lbl">退回/不予认定</div>
      </div>
    </div>

    <div class="review-list glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:clipboard-account-outline" />待评表单</h3>
        <span class="panel-badge">{{ pending.length }} 份待处理</span>
      </div>

      <div class="student-list">
        <div class="student-row" v-for="(form, i) in pending" :key="form.id"
          :style="{ animationDelay: (i * 0.06) + 's' }"
          @click="goDetail(form.id)">
          <div class="student-main">
            <VIcon icon="mdi:account-circle-outline" class="student-icon" />
            <div>
              <div class="student-name">{{ form.student_name }}</div>
              <div class="student-meta">
                学号：{{ form.student_no }} · 学院：{{ form.college }} · 年级：{{ form.grade }} · 班级：{{ form.class_name }} · 综合分：{{ form.scores.total }}
              </div>
            </div>
          </div>
          <div class="student-status">
            <span>{{ form.status_label }}</span>
            <VIcon icon="mdi:chevron-right" />
          </div>
        </div>

        <div class="empty-state" v-if="!pending.length">
          <VIcon icon="mdi:check-all" />
          <span>{{ emptyText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { getPendingReviews, getStatistics } from '../../api/module3';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/user';
import { ROLE_LABEL } from '../../utils/constants';

const router = useRouter();
const userStore = useUserStore();
const currentRoleName = computed(() => userStore.user?.is_assessment_member ? '综测成员' : (ROLE_LABEL[userStore.role] || '评价人员'));
const deskTitle = computed(() => `${currentRoleName.value}待评价表单`);
const emptyText = computed(() => userStore.role === 'student' && !userStore.user?.is_assessment_member ? '当前学生未被赋予综测成员身份' : '暂无分配给你的待评表单');
const pending = ref([]);
const stats = ref(null);

async function load() {
  const pendingRes = await getPendingReviews();
  if (pendingRes.code === 200) pending.value = pendingRes.data || [];
  const statRes = await getStatistics();
  if (statRes.code === 200) stats.value = statRes.data;
}

function goDetail(id) {
  router.push(`/module3/review-detail/${id}`);
}

onMounted(load);
</script>

<style scoped>
.class-leader-desk { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card { padding: 20px; border-radius: var(--radius-xl); background: var(--color-surface); border: 1px solid var(--color-border); display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; }
.stat-icon { grid-row: span 2; font-size: 30px; }
.stat-num { font-size: 24px; font-weight: var(--font-weight-semibold); }
.stat-lbl { color: var(--color-text-secondary); font-size: 13px; }
.warning .stat-icon { color: #f59e0b; }
.success .stat-icon { color: #34a853; }
.error .stat-icon { color: #ef4444; }
.review-list { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-badge { font-size: 13px; color: var(--color-primary); }
.student-list { display: flex; flex-direction: column; gap: 10px; }
.student-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); cursor: pointer; transition: all var(--duration-fast) var(--easing-standard); }
.student-row:hover { transform: translateY(-1px); box-shadow: var(--shadow-level-1); }
.student-main { display: flex; align-items: center; gap: 12px; }
.student-icon { font-size: 28px; color: var(--color-primary); }
.student-name { font-weight: var(--font-weight-semibold); }
.student-meta { color: var(--color-text-secondary); font-size: 13px; margin-top: 4px; }
.student-status { display: flex; align-items: center; gap: 8px; color: var(--color-primary); white-space: nowrap; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; }
  .student-row { flex-direction: column; align-items: stretch; }
}
</style>
