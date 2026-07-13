<template>
  <div class="reviewer-student-list">
    <div class="page-header">
      <h2>{{ roleName }}待评价学生</h2>
      <p class="page-desc">先选择某一个学生，再进入详细材料审查界面</p>
    </div>

    <div class="stats-row">
      <div class="stat-card warning">
        <VIcon icon="mdi:account-clock-outline" class="stat-icon" />
        <div class="stat-num">{{ students.length }}</div>
        <div class="stat-lbl">待评价学生</div>
      </div>
      <div class="stat-card success">
        <VIcon icon="mdi:check-circle-outline" class="stat-icon" />
        <div class="stat-num">{{ stats?.approved || 0 }}</div>
        <div class="stat-lbl">已认定通过</div>
      </div>
      <div class="stat-card error">
        <VIcon icon="mdi:undo" class="stat-icon" />
        <div class="stat-num">{{ stats?.returned || 0 }}</div>
        <div class="stat-lbl">已退回</div>
      </div>
    </div>

    <div class="review-list glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-search-outline" />学生列表</h3>
        <span class="panel-badge">点击学生进入详情审查</span>
      </div>

      <div class="student-list">
        <div class="student-row" v-for="(student, i) in students" :key="student.id"
          :style="{ animationDelay: (i * 0.06) + 's' }"
          @click="goDetail(student.id)">
          <div class="student-info">
            <div class="student-name">{{ student.student_name }}</div>
            <div class="student-meta">学号：{{ student.student_no }} · 班级：{{ student.class_name }}</div>
            <div class="student-meta">{{ student.batch_title }}</div>
          </div>
          <div class="student-score">
            <strong>{{ student.total_score }}</strong>
            <span>{{ student.grade || student.auto_grade }}</span>
          </div>
          <VIcon icon="mdi:chevron-right" class="go-icon" />
        </div>

        <div class="empty-state" v-if="!students.length">
          <VIcon icon="mdi:check-all" />
          <span>暂无待评价学生</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { getPendingReviews, getStatistics } from '../../api/module3';
import { ROLE_LABEL } from '../../utils/constants';
import { useUserStore } from '../../stores/user';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStore = useUserStore();
const roleName = computed(() => ROLE_LABEL[userStore.role] || '评价人员');
const students = ref([]);
const stats = ref(null);

async function load() {
  const [pendingRes, statRes] = await Promise.all([getPendingReviews(), getStatistics()]);
  if (pendingRes.code === 200) students.value = pendingRes.data;
  if (statRes.code === 200) stats.value = statRes.data;
}

function goDetail(id) {
  router.push(`/module3/review-detail/${id}`);
}

onMounted(load);
</script>

<style scoped>
.reviewer-student-list { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card { padding: 20px; border-radius: 8px !important; background: var(--color-surface); display: flex; align-items: center; gap: 16px; border: 1px solid var(--color-border); }
.stat-card .stat-icon { font-size: 32px; }
.stat-card.warning .stat-icon { color: #E37400; }
.stat-card.success .stat-icon { color: #34A853; }
.stat-card.error .stat-icon { color: #D93025; }
.stat-num { font-size: 24px; font-weight: var(--font-weight-semibold); }
.stat-lbl { font-size: 13px; color: var(--color-text-secondary); }
.review-list { padding: 20px; border-radius: 8px !important; }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-badge { padding: 4px 10px; border-radius: 8px !important; background: var(--color-bg); font-size: 13px; color: var(--color-text-secondary); }
.student-list { display: flex; flex-direction: column; gap: 12px; }
.student-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 16px; padding: 16px; border-radius: 8px !important; background: var(--color-bg); cursor: pointer; animation: slideInUp 0.4s var(--easing-decelerate) both; }
.student-row:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.student-name { font-weight: var(--font-weight-semibold); margin-bottom: 4px; }
.student-meta { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }
.student-score { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.student-score strong { font-size: 24px; color: var(--color-primary); }
.student-score span { font-size: 12px; color: var(--color-text-secondary); }
.go-icon { font-size: 24px; color: var(--color-text-tertiary); }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; }
  .student-row { grid-template-columns: 1fr; }
}

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
