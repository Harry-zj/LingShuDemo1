<template>
  <div class="smart-fill">
    <div class="top-bar">
      <div class="top-bar-left">
        <h2>智能填表</h2>
        <p class="top-bar-desc">上传材料后刷新智能填表结果；正式提交请到“信息管理”页面底部完成</p>
      </div>
      <div class="actions">
        <button class="btn-upload" @click="triggerUpload">
          <VIcon icon="mdi:upload-outline" />
          上传支撑材料
        </button>
        <input type="file" ref="fileInput" multiple hidden @change="handleUpload" />
        <button class="btn-ai" @click="handleAiMatch">
          <VIcon icon="mdi:lightning-bolt-outline" />
          刷新智能填表结果
        </button>
      </div>
    </div>

    <div class="workspace">
      <section class="panel glass-panel material-panel">
        <div class="panel-header">
          <h3><VIcon icon="mdi:file-document-check-outline" />智能填表预览</h3>
          <span class="panel-count">{{ form?.status_label || '未加载' }}</span>
        </div>

        <div class="score-grid" v-if="form">
          <div class="score-card"><span>F1 基本素质</span><strong>{{ form.scores.f1_basic_quality }}</strong></div>
          <div class="score-card"><span>F2 课程学习</span><strong>{{ form.scores.f2_course_learning }}</strong></div>
          <div class="score-card"><span>F3 创新实践</span><strong>{{ form.scores.f3_innovation_practice }}</strong></div>
          <div class="score-card total"><span>综合分 / 等级</span><strong>{{ form.scores.total }} / {{ form.level }}</strong></div>
        </div>

        <div class="notice-card" v-if="form">
          智能填表结果会同步到“信息管理”页面。请在那里按 F1、F2、F3 分类检查支撑材料并提交。
        </div>

        <button class="btn-ai submit-btn" @click="$router.push('/module3/student')">
          <VIcon icon="mdi:arrow-right" />
          前往信息管理检查并提交
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { aiMatch, getSmartResult, uploadFile } from '../../api/module1';

const fileInput = ref(null);
const form = ref(null);

function triggerUpload() {
  fileInput.value?.click();
}

async function loadSmartResult() {
  const res = await getSmartResult();
  if (res.code === 200) form.value = res.data;
}

async function handleUpload(e) {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const data = new FormData();
    data.append('file', file);
    const res = await uploadFile(data);
    if (res.code === 200) form.value = res.data.form;
    else alert(res.msg);
  }
  e.target.value = '';
}

async function handleAiMatch() {
  const res = await aiMatch({});
  if (res.code === 200) {
    form.value = res.data;
    alert('已刷新智能填表结果');
  } else {
    alert(res.msg);
  }
}

onMounted(loadSmartResult);
</script>

<style scoped>
.smart-fill { display: flex; flex-direction: column; gap: 24px; }
.top-bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.top-bar-left h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.top-bar-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.actions { display: flex; gap: 12px; }
.btn-upload, .btn-ai {
  display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px;
  border-radius: var(--radius-full); border: none; cursor: pointer; font-weight: var(--font-weight-medium);
}
.btn-upload { background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); }
.btn-ai { background: var(--gradient-primary); color: white; box-shadow: 0 4px 16px rgba(95, 99, 242, 0.3); }
.workspace { display: grid; grid-template-columns: 1fr; gap: 24px; }
.panel { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.score-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.score-card { padding: 14px; border-radius: var(--radius-lg); background: var(--color-surface); border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 6px; }
.score-card span { font-size: 13px; color: var(--color-text-secondary); }
.score-card strong { font-size: 24px; }
.score-card.total strong { color: var(--color-primary); }
.notice-card { padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); color: var(--color-text-secondary); line-height: 1.7; }
.submit-btn { margin-top: 18px; }
@media (max-width: 768px) {
  .top-bar { flex-direction: column; }
  .score-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
