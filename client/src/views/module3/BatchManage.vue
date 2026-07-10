<template>
  <div class="stub-page">
    <div class="page-header">
      <h2>管理员批次与规则设置</h2>
      <p class="page-desc">发布批次、设置截止时间、分级标准和流程选项</p>
    </div>

    <div class="stub-card">
      <h3>发布批次</h3>
      <div class="form-grid">
        <input v-model="form.title" placeholder="批次名称" />
        <input v-model="form.start_time" placeholder="开始时间，例如 2026-07-01 08:00:00" />
        <input v-model="form.end_time" placeholder="截止时间，例如 2026-07-25 23:59:59" />
        <select v-model="form.status">
          <option value="draft">草稿</option>
          <option value="published">发布</option>
          <option value="closed">关闭</option>
          <option value="archived">归档</option>
        </select>
        <textarea v-model="form.description" placeholder="批次说明"></textarea>
        <textarea v-model="form.requirements" placeholder="材料要求"></textarea>
      </div>
      <button class="btn-primary" @click="handleCreate">创建/发布批次</button>
    </div>

    <div class="stub-card" v-if="settings">
      <h3>截止时间与流程选项</h3>
      <div class="form-grid">
        <input v-model="settings.submitDeadline" placeholder="提交截止时间" />
        <input v-model="settings.publishNotice" placeholder="发布通知说明" />
        <label class="check-row">
          <input type="checkbox" v-model="settings.allowStudentEdit" /> 允许学生修改智能填表结果
        </label>
        <label class="check-row">
          <input type="checkbox" v-model="settings.allowReturnEdit" /> 允许退回后重新提交
        </label>
        <label class="check-row">
          <input type="checkbox" v-model="settings.requireReviewerComment" /> 评价时必须填写意见
        </label>
      </div>

      <h3>等级规则</h3>
      <p class="hint">默认：85以上为优，75以上为良，60以上为合格，60以下为不合格。管理员可修改。</p>
      <div class="grade-rules">
        <div class="grade-row" v-for="rule in settings.gradeRules" :key="rule.grade">
          <span>{{ rule.grade }}</span>
          <input type="number" v-model.number="rule.min" />
          <small>分及以上</small>
        </div>
      </div>

      <button class="btn-primary" @click="saveSettings">保存设置</button>
    </div>

    <div class="stub-card">
      <h3>批次列表</h3>
      <div class="batch-row" v-for="batch in batches" :key="batch.id">
        <div>
          <strong>{{ batch.title }}</strong>
          <p>{{ batch.description }}</p>
          <small>{{ batch.start_time }} 至 {{ batch.end_time }} · {{ statusText(batch.status) }}</small>
        </div>
        <div class="actions">
          <button @click="setStatus(batch.id, 'published')">发布</button>
          <button @click="setStatus(batch.id, 'closed')">关闭</button>
          <button @click="setStatus(batch.id, 'archived')">归档</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { createBatch, getBatches, getSettings, updateBatchStatus, updateSettings } from '../../api/module3';

const batches = ref([]);
const settings = ref(null);
const form = ref({
  title: '新学年本科学生综合素质测评',
  start_time: '2026-07-01 08:00:00',
  end_time: '2026-07-25 23:59:59',
  status: 'published',
  description: '管理员发布的综测批次',
  requirements: '学生上传支撑材料后，由智能填表结果进入三方评价流程',
});

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

async function load() {
  const [batchRes, settingRes] = await Promise.all([getBatches(), getSettings()]);
  if (batchRes.code === 200) batches.value = batchRes.data;
  if (settingRes.code === 200) settings.value = settingRes.data;
}

async function handleCreate() {
  const res = await createBatch(form.value);
  if (res.code === 200) {
    alert('批次已创建');
    await load();
  } else {
    alert(res.msg);
  }
}

async function setStatus(id, status) {
  const res = await updateBatchStatus(id, { status });
  if (res.code === 200) await load();
  else alert(res.msg);
}

async function saveSettings() {
  const res = await updateSettings(settings.value);
  if (res.code === 200) {
    settings.value = res.data;
    alert('设置已保存');
    await load();
  } else {
    alert(res.msg);
  }
}

onMounted(load);
</script>

<style scoped>
.stub-page { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.stub-card {
  display: flex; flex-direction: column; gap: 14px;
  padding: 24px; background: var(--color-surface);
  border-radius: var(--radius-xl); border: 1px solid var(--color-border);
}
.stub-card h3 { font-size: 16px; font-weight: var(--font-weight-semibold); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
input, select, textarea { min-height: 40px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; background: var(--color-bg); color: var(--color-text-primary); }
textarea { grid-column: span 2; min-height: 80px; resize: vertical; }
.check-row { display: flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 14px; }
.check-row input { width: auto; min-height: auto; }
.hint { color: var(--color-text-secondary); font-size: 13px; }
.grade-rules { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grade-row { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: var(--radius-md); background: var(--color-bg); }
.grade-row input { width: 70px; }
.grade-row span { font-weight: var(--font-weight-semibold); }
.grade-row small { color: var(--color-text-secondary); }
.btn-primary, .actions button {
  display: inline-flex; align-items: center; justify-content: center;
  height: 36px; padding: 0 14px; border: none; border-radius: var(--radius-full);
  background: var(--gradient-primary); color: white; cursor: pointer;
}
.batch-row { display: flex; justify-content: space-between; gap: 16px; padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); }
.batch-row p, .batch-row small { color: var(--color-text-secondary); margin-top: 4px; }
.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.actions button { background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); }
@media (max-width: 768px) {
  .form-grid, .batch-row, .grade-rules { grid-template-columns: 1fr; flex-direction: column; }
  textarea { grid-column: span 1; }
}
</style>
