<template>
  <div class="reviewer-audit-detail">
    <div class="page-header">
      <button class="btn-back" @click="router.back()">
        <VIcon icon="mdi:arrow-left" />返回学生列表
      </button>
      <div>
        <h2>材料审查详情</h2>
        <p class="page-desc">先核查综测表，再按 F1、F2、F3 分类检查支撑材料</p>
      </div>
    </div>

    <AssessmentFormPanel v-if="form" :form="form" />

    <div class="review-box glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:medal-outline" />等级确认</h3>
        <span class="panel-badge">系统根据综合分自动建议，可手动修改</span>
      </div>

      <div class="grade-row">
        <div>
          <span>综合分</span>
          <strong>{{ form.scores.total }}</strong>
        </div>
        <div>
          <span>自动等级</span>
          <strong>{{ form.auto_grade }}</strong>
        </div>
        <div>
          <span>确认等级</span>
          <select v-model="grade">
            <option value="优">优</option>
            <option value="良">良</option>
            <option value="合格">合格</option>
            <option value="不合格">不合格</option>
          </select>
        </div>
      </div>

      <textarea v-model="comment" placeholder="填写评价意见，例如：材料齐全，分值无误，建议通过。"></textarea>

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
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { getFormDetail, reviewMaterial } from '../../api/module3';
import { useRoute, useRouter } from 'vue-router';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const route = useRoute();
const router = useRouter();
const form = ref(null);
const grade = ref('');
const comment = ref('');

async function load() {
  const res = await getFormDetail(route.params.id);
  if (res.code === 200) {
    form.value = res.data;
    grade.value = res.data.grade || res.data.auto_grade;
  } else {
    alert(res.msg);
  }
}

async function handleReview(action) {
  const res = await reviewMaterial(route.params.id, {
    action,
    comment: comment.value,
    grade: grade.value,
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
.reviewer-audit-detail { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header { display: flex; align-items: center; gap: 16px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.btn-back { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--radius-full); border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
.review-box { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-badge { padding: 4px 10px; border-radius: var(--radius-full); background: var(--color-bg); font-size: 13px; color: var(--color-text-secondary); }
.grade-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
.grade-row > div { padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); display: flex; flex-direction: column; gap: 6px; }
.grade-row span { font-size: 13px; color: var(--color-text-secondary); }
.grade-row strong { font-size: 24px; color: var(--color-primary); }
select, textarea { width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
textarea { min-height: 90px; resize: vertical; margin-bottom: 14px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.actions button { display: inline-flex; align-items: center; gap: 4px; padding: 10px 16px; border: none; border-radius: var(--radius-full); cursor: pointer; color: white; }
.btn-pass { background: #34A853; }
.btn-return { background: #E37400; }
.btn-reject { background: #D93025; }
@media (max-width: 768px) {
  .page-header { flex-direction: column; align-items: flex-start; }
  .grade-row { grid-template-columns: 1fr; }
}
</style>
