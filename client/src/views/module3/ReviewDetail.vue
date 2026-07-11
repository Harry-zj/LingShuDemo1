<template>
  <div class="review-detail">
    <div class="page-header">
      <button class="btn-outline" @click="$router.push('/module3/class-leader')">
        <VIcon icon="mdi:arrow-left" />返回待评列表
      </button>
      <div>
        <h2>综测表评价详情</h2>
        <p class="page-desc">只能查看和处理分配给当前账号的待评表单</p>
      </div>
    </div>

    <div class="assignment-card glass-card" v-if="visibleTasks.length">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-switch-outline" />我的评测分配信息</h3>
      </div>
      <div class="task-list">
        <span v-for="task in visibleTasks" :key="task.id">
          {{ task.target_class_name }} → {{ task.reviewer_class_name }}：{{ task.reviewer_name }}（{{ task.status === 'pending' ? '待评' : '已处理' }}）
        </span>
      </div>
    </div>

    <AssessmentFormPanel v-if="form" :form="form" />

    <div class="review-box glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:clipboard-check-outline" />{{ currentRoleName }}评价</h3>
        <span class="panel-count">自动等级：{{ form.auto_level }}</span>
      </div>

      <div class="level-row" v-if="canAdjustLevel">
        <label>测评等级</label>
        <div class="level-options">
          <button v-for="g in levels" :key="g" :class="{ active: level === g }" @click="level = g">{{ g }}</button>
        </div>
        <p class="level-tip">默认按分数自动确认，也可以在评价时手动调整。</p>
      </div>

      <textarea v-model="comment" placeholder="填写评价意见"></textarea>

      <div class="actions">
        <button class="btn-pass" @click="handleReview('approve')">
          <VIcon icon="mdi:check" />材料无误，通过
        </button>
        <button class="btn-return" @click="handleReview('return')">
          <VIcon icon="mdi:undo" />退回修改
        </button>
        <button class="btn-reject" @click="handleReview('reject')">
          <VIcon icon="mdi:close" />不予认定
        </button>
      </div>
    </div>

    <div class="empty-state" v-if="!form">
      <VIcon icon="mdi:loading" />
      <span>正在加载详情</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFormDetail, reviewMaterial } from '../../api/module3';
import { useUserStore } from '../../stores/user';
import { ROLE_LABEL } from '../../utils/constants';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const form = ref(null);
const comment = ref('');
const level = ref('');
const levels = ['优', '良', '合格', '不合格'];
const currentRoleName = computed(() => userStore.user?.is_assessment_member ? '综测成员' : (ROLE_LABEL[userStore.role] || '评价人员'));
const canAdjustLevel = computed(() => (userStore.role === 'student' && userStore.user?.is_assessment_member) || userStore.role === 'counselor');
const visibleTasks = computed(() => {
  const tasks = form.value?.review_tasks || [];
  if (userStore.role === 'student' && form.value?.student_id !== userStore.user?.id) {
    return tasks.filter(task => Number(task.reviewer_id) === Number(userStore.user?.id));
  }
  return tasks;
});

async function load() {
  const res = await getFormDetail(route.params.id);
  if (res.code === 200) {
    form.value = res.data;
    level.value = res.data.level || res.data.auto_level;
  } else {
    alert(res.msg);
    router.push('/module3/class-leader');
  }
}

async function handleReview(action) {
  const res = await reviewMaterial(route.params.id, {
    action,
    comment: comment.value,
    level: canAdjustLevel.value ? level.value : ''
  });
  if (res.code === 200) {
    alert('评价处理完成');
    router.push('/module3/class-leader');
  } else {
    alert(res.msg);
  }
}

onMounted(load);
</script>

<style scoped>
.review-detail { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header { display: flex; align-items: center; gap: 16px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.btn-outline { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
.assignment-card, .review-box { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.task-list { display: flex; flex-wrap: wrap; gap: 8px; }
.task-list span { padding: 6px 10px; border-radius: var(--radius-full); background: var(--color-bg); font-size: 13px; color: var(--color-text-secondary); }
.level-row { padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); margin-bottom: 14px; }
.level-row label { display: block; font-weight: var(--font-weight-semibold); margin-bottom: 10px; }
.level-options { display: flex; gap: 10px; flex-wrap: wrap; }
.level-options button { height: 34px; padding: 0 14px; border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
.level-options button.active { color: white; background: var(--gradient-primary); border: none; }
.level-tip { margin-top: 10px; color: var(--color-text-secondary); font-size: 12px; }
textarea { width: 100%; min-height: 96px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); color: var(--color-text-primary); padding: 12px; resize: vertical; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.actions button { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: var(--radius-full); border: none; color: white; cursor: pointer; }
.btn-pass { background: #34a853; }
.btn-return { background: #f59e0b; }
.btn-reject { background: #ef4444; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) { .page-header { flex-direction: column; align-items: stretch; } }
</style>
