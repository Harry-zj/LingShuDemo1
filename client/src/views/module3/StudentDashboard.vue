<template>
  <div class="student-db">
    <div class="page-header">
      <h2>信息管理</h2>
      <p class="page-desc">顶部展示综测表，下面按 F1、F2、F3 及子目录管理支撑材料</p>
    </div>

    <div class="deadline-card" v-if="form">
      <VIcon icon="mdi:clipboard-check-outline" class="deadline-icon" />
      <div class="deadline-info">
        <span class="deadline-label">当前状态</span>
        <span class="deadline-value">{{ form.status_label }}</span>
      </div>
    </div>

    <AssessmentFormPanel v-if="form" :form="form" editable />

    <div class="submit-panel glass-card" v-if="form">
      <div>
        <h3>提交确认</h3>
        <p>请确认综测表、F1/F2/F3 分类、子目录、加分项目和支撑材料无误后提交。</p>
      </div>
      <div class="submit-actions">
        <button class="btn-outline" @click="saveEdit">
          <VIcon icon="mdi:content-save-outline" />保存修改
        </button>
        <button class="btn-primary" @click="submit">
          <VIcon icon="mdi:send-outline" />提交给班级测评小组
        </button>
      </div>
    </div>

    <div class="my-materials glass-card" v-if="form">
      <div class="panel-header">
        <h3><VIcon icon="mdi:history" />评价记录</h3>
        <span class="panel-count">{{ form.review_records.length }} 条</span>
      </div>
      <div class="material-list">
        <div class="material-row" v-for="record in form.review_records" :key="record.id">
          <div class="row-left">
            <VIcon icon="mdi:account-check-outline" class="row-icon" />
            <div>
              <span>{{ record.reviewer_name }}：{{ record.action_label }}（{{ record.level || form.level }}）</span>
              <p class="row-desc">{{ record.comment || '无评价意见' }}</p>
            </div>
          </div>
          <span class="status-tag">{{ record.created_at }}</span>
        </div>
        <div class="empty-state" v-if="!form.review_records.length">
          <VIcon icon="mdi:inbox-outline" />
          <span>暂无评价记录</span>
        </div>
      </div>
    </div>

    <div class="empty-state" v-if="!form">
      <VIcon icon="mdi:inbox-outline" />
      <span>暂无智能填表结果</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { getSmartResult, submitSmartResult, updateSmartResult } from '../../api/module1';
import AssessmentFormPanel from './AssessmentFormPanel.vue';

const form = ref(null);

async function load() {
  const res = await getSmartResult();
  if (res.code === 200) form.value = res.data;
}

async function saveEdit() {
  const res = await updateSmartResult({
    personal_summary: form.value.personal_summary,
    items: form.value.items
  });
  if (res.code === 200) {
    form.value = res.data;
    alert('修改已保存');
  } else {
    alert(res.msg);
  }
}

async function submit() {
  await saveEdit();
  const res = await submitSmartResult();
  if (res.code === 200) {
    form.value = res.data;
    alert('已提交给班级测评小组评价');
  } else {
    alert(res.msg);
  }
}

onMounted(load);
</script>

<style scoped>
.student-db { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.deadline-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--gradient-primary); border-radius: var(--radius-xl); color: white; }
.deadline-icon { font-size: 32px; opacity: 0.9; }
.deadline-info { display: flex; flex-direction: column; }
.deadline-label { font-size: 13px; opacity: 0.8; }
.deadline-value { font-size: 24px; font-weight: var(--font-weight-semibold); }
.submit-panel { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 20px; border-radius: var(--radius-xl); }
.submit-panel h3 { font-size: 16px; margin-bottom: 6px; }
.submit-panel p { color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.submit-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn-outline, .btn-primary { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: var(--radius-full); cursor: pointer; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.btn-primary { border: none; background: var(--gradient-primary); color: white; }
.my-materials { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.material-list { display: flex; flex-direction: column; gap: 10px; }
.material-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); }
.row-left { display: flex; align-items: flex-start; gap: 12px; }
.row-icon { font-size: 22px; color: var(--color-primary); }
.row-desc { margin-top: 4px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
.status-tag { padding: 4px 10px; border-radius: var(--radius-full); font-size: 12px; white-space: nowrap; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--color-text-tertiary); }
.empty-state .v-icon { font-size: 40px; }
@media (max-width: 768px) {
  .submit-panel { flex-direction: column; align-items: stretch; }
}
</style>
