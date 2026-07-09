<template>
  <div class="teacher-console">
    <div class="page-header">
      <div>
        <h2>老师总控中心</h2>
        <p class="page-desc">发布批次、复核材料、查看进度、导出汇总与追踪日志</p>
      </div>
      <button class="btn-outline" @click="goToBatchManage"><VIcon icon="mdi:cog-outline" />管理批次</button>
    </div>

    <div class="filter-bar">
      <div class="select-wrapper">
        <VIcon icon="mdi:filter-variant" class="select-icon" />
        <select v-model="currentBatch" @change="load">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
      <button class="btn-primary" @click="handleExport" :disabled="!currentBatch"><VIcon icon="mdi:file-export-outline" />导出汇总表</button>
    </div>

    <section class="stats-grid" v-if="stats.batch_id">
      <div class="stat-card"><strong>{{ stats.total_students || 0 }}</strong><span>学生总数</span></div>
      <div class="stat-card"><strong>{{ stats.submitted_students || 0 }}</strong><span>已提交人数</span></div>
      <div class="stat-card"><strong>{{ stats.pending_count || 0 }}</strong><span>待审核材料</span></div>
      <div class="stat-card"><strong>{{ stats.approved_count || 0 }}</strong><span>已通过</span></div>
      <div class="stat-card"><strong>{{ stats.returned_count || 0 }}</strong><span>已退回</span></div>
    </section>

    <section class="progress-section glass-card" v-if="stats.status_counts?.length">
      <div class="panel-header">
        <h3><VIcon icon="mdi:chart-timeline-variant" />审核进度</h3>
        <span class="panel-count">{{ stats.status_counts.length }} 个状态</span>
      </div>
      <div class="progress-list">
        <div class="progress-row" v-for="s in stats.status_counts" :key="s.status">
          <span class="status-label">{{ STATUS_MAP[s.status]?.label || s.status }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: progressWidth(s.count) }"></div></div>
          <span class="progress-count">{{ s.count }} 项</span>
        </div>
      </div>
    </section>

    <section class="review-list glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:clipboard-check-outline" />待老师复核</h3>
        <span class="panel-count">{{ pending.length }} 项</span>
      </div>
      <article class="review-row" v-for="m in pending" :key="m.id">
        <div class="row-main">
          <div class="row-title"><strong>{{ m.title }}</strong><span>{{ m.student_name }} · {{ m.class_name }}</span></div>
          <p>{{ m.application_text || '暂无说明' }}</p>
          <div class="meta-line"><span>类别：{{ m.category }}</span><span>分值：{{ m.score }}</span><span>附件：{{ m.attachments?.length || 0 }} 个</span></div>
          <textarea v-model="comments[m.id]" rows="2" placeholder="填写复核意见"></textarea>
        </div>
        <div class="btns">
          <button class="btn-approve" @click="doReview(m.id, 'approve')">通过</button>
          <button class="btn-return" @click="doReview(m.id, 'return')">退回</button>
          <button class="btn-reject" @click="doReview(m.id, 'reject')">驳回</button>
        </div>
      </article>
      <div class="empty-card" v-if="!pending.length"><VIcon icon="mdi:check-circle-outline" />暂无待老师复核材料</div>
    </section>

    <section class="two-col">
      <div class="glass-card mini-panel">
        <div class="panel-header"><h3><VIcon icon="mdi:account-group-outline" />班级进度</h3></div>
        <div class="class-row" v-for="c in stats.class_progress" :key="c.class_id">
          <span>{{ c.class_name }}</span>
          <small>提交 {{ c.submitted_count }}/{{ c.student_count }}，待审 {{ c.pending_count }}，通过 {{ c.approved_count }}</small>
        </div>
      </div>
      <div class="glass-card mini-panel">
        <div class="panel-header"><h3><VIcon icon="mdi:history" />关键操作日志</h3></div>
        <div class="log-row" v-for="log in logs.slice(0, 6)" :key="log.id">
          <strong>{{ log.user_name }}</strong><span>{{ log.detail }}</span><small>{{ log.created_at }}</small>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { exportExcel, getBatches, getLogs, getPendingReviews, getStatistics, reviewMaterial } from '../../api/module3';
import { STATUS_MAP } from '../../utils/constants';

const router = useRouter();
const batches = ref([]);
const currentBatch = ref('');
const stats = ref({});
const pending = ref([]);
const logs = ref([]);
const comments = reactive({});

function progressWidth(count) {
  const total = (stats.value.status_counts || []).reduce((sum, item) => sum + item.count, 0) || 1;
  return `${Math.max(Math.round((count / total) * 100), 4)}%`;
}
async function load() {
  const params = currentBatch.value ? { batch_id: currentBatch.value } : {};
  const [bRes, sRes, pRes, lRes] = await Promise.all([getBatches(), getStatistics(params), getPendingReviews(params), getLogs()]);
  if (bRes.code === 200) {
    batches.value = bRes.data || [];
    if (!currentBatch.value && batches.value[0]) currentBatch.value = batches.value[0].id;
  }
  if (sRes.code === 200) stats.value = sRes.data || {};
  if (pRes.code === 200) pending.value = pRes.data || [];
  if (lRes.code === 200) logs.value = lRes.data || [];
}
async function doReview(id, action) {
  const res = await reviewMaterial(id, { action, comment: comments[id] || '' });
  alert(res.msg || '复核完成');
  comments[id] = '';
  await load();
}
async function handleExport() {
  const res = await exportExcel({ batch_id: currentBatch.value });
  if (res.code !== 200) return alert(res.msg);
  const blob = new Blob([res.data.content], { type: res.data.mimeType || 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = res.data.fileName || '综测汇总表.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
function goToBatchManage() { router.push('/module3/batch-manage'); }
onMounted(load);
</script>

<style scoped>
.teacher-console { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header, .panel-header, .filter-bar, .row-title, .meta-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.filter-bar { justify-content: flex-start; flex-wrap: wrap; }
.select-wrapper { display: flex; align-items: center; gap: 8px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); min-width: 260px; }
.select-wrapper select, textarea { flex: 1; padding: 10px 0; border: none; background: transparent; font-size: 14px; color: var(--color-text); outline: none; }
textarea { width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 9px 12px; resize: vertical; margin-top: 8px; }
.btn-outline, .btn-primary, .btn-approve, .btn-return, .btn-reject { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-spring); }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-white); color: var(--color-text); }
.btn-primary { border: none; background: var(--color-primary-gradient); color: white; box-shadow: var(--shadow-level-1); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat-card { padding: 20px; border-radius: var(--radius-lg); background: var(--color-white); border: 1px solid var(--color-border); text-align: center; box-shadow: var(--shadow-level-1); }
.stat-card strong { display: block; font-size: 28px; color: var(--color-primary); }
.stat-card span, .panel-count, .meta-line, .row-title span, .class-row small, .log-row small { font-size: 12px; color: var(--color-text-secondary); }
.progress-section, .review-list, .mini-panel { border-radius: var(--radius-xl); padding: 24px; }
.panel-header { margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.progress-list { display: flex; flex-direction: column; gap: 8px; }
.progress-row { display: flex; align-items: center; gap: 16px; }
.status-label { width: 120px; font-size: 14px; }
.progress-bar { flex: 1; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary-gradient); border-radius: 5px; }
.progress-count { width: 60px; text-align: right; font-size: 13px; color: var(--color-text-secondary); }
.review-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-white); margin-bottom: 10px; }
.row-main { flex: 1; }
.row-main p { color: var(--color-text-secondary); font-size: 14px; margin: 8px 0; }
.btns { display: flex; flex-direction: column; gap: 8px; }
.btn-approve { border: none; background: var(--color-success); color: #fff; }
.btn-return { border: 1px solid var(--color-warning); background: #fff; color: var(--color-warning); }
.btn-reject { border: 1px solid var(--color-error); background: #fff; color: var(--color-error); }
.empty-card { padding: 36px; text-align: center; color: var(--color-text-tertiary); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.class-row, .log-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--color-gray-bg); }
.log-row span { font-size: 13px; color: var(--color-text-secondary); }
@media (max-width: 900px) { .stats-grid, .two-col { grid-template-columns: 1fr; } .review-row { flex-direction: column; } .btns { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; } }
</style>
