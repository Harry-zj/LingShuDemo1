<template>
  <div class="teacher-console">
    <div class="page-header">
      <h2>统计总览</h2>
      <p class="page-desc">查看批次、评测任务和综测进度状态，并导出汇总表</p>
    </div>

    <div class="filter-bar">
      <div class="select-wrapper">
        <VIcon icon="mdi:filter-variant" class="select-icon" />
        <select v-model="currentBatch" @change="load">
          <option value="">全部批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
      <button class="btn-outline" @click="$router.push('/module3/batch-manage')" v-if="userStore.role === 'admin'">
        <VIcon icon="mdi:cog-outline" />返回批次设置
      </button>
      <button class="btn-primary" @click="handleExport">
        <VIcon icon="mdi:file-export-outline" />导出汇总表
      </button>
    </div>

    <div class="progress-section glass-card" v-if="stats">
      <div class="panel-header">
        <h3><VIcon icon="mdi:chart-timeline-variant" />评价进度</h3>
        <span class="panel-count">共 {{ stats.rows.length }} 份评价表</span>
      </div>
      <div class="progress-list">
        <div class="progress-row" v-for="row in progressRows" :key="row.label">
          <span class="status-label">{{ row.label }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: percent(row.value) + '%' }"></div></div>
          <span class="count">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <div class="data-table glass-card" v-if="stats">
      <div class="panel-header">
        <h3><VIcon icon="mdi:table" />评价表状态</h3>
      </div>
      <table>
        <thead>
          <tr><th>批次</th><th>学生</th><th>学号</th><th>班级</th><th>评测人</th><th>综合分</th><th>等级</th><th>当前状态</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in stats.rows" :key="row.id">
            <td>{{ row.batch_title }}</td>
            <td>{{ row.student_name }}</td>
            <td>{{ row.student_no }}</td>
            <td>{{ row.class_name }}</td>
            <td>{{ row.reviewer_names }}</td>
            <td>{{ row.total_score }}</td>
            <td>{{ row.level }}</td>
            <td>{{ row.status_label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { exportExcel, getBatches, getStatistics } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const batches = ref([]);
const stats = ref(null);
const currentBatch = ref('');

const progressRows = computed(() => stats.value ? [
  { label: '已提交', value: stats.value.submitted },
  { label: '待综测成员', value: stats.value.pending_class_committee },
  { label: '待辅导员', value: stats.value.pending_counselor },
  { label: '待学工办', value: stats.value.pending_student_affairs },
  { label: '已认定通过', value: stats.value.approved },
] : []);

function percent(value) {
  const total = Math.max(stats.value?.rows?.length || 1, 1);
  return Math.round((value / total) * 100);
}

async function load() {
  const [batchRes, statRes] = await Promise.all([getBatches(), getStatistics({ batch_id: currentBatch.value })]);
  if (batchRes.code === 200) batches.value = batchRes.data;
  if (statRes.code === 200) stats.value = statRes.data;
}

async function handleExport() {
  const blob = await exportExcel({ batch_id: currentBatch.value });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '综测汇总表.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style scoped>
.teacher-console { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.filter-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.select-wrapper { position: relative; }
.select-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary); }
select { height: 40px; padding: 0 16px 0 42px; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-surface); color: var(--color-text-primary); }
.btn-outline, .btn-primary { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: var(--radius-full); cursor: pointer; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.btn-primary { border: none; background: var(--gradient-primary); color: white; }
.progress-section, .data-table { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.progress-list { display: flex; flex-direction: column; gap: 14px; }
.progress-row { display: grid; grid-template-columns: 140px 1fr 50px; gap: 12px; align-items: center; }
.status-label { font-size: 14px; }
.progress-bar { height: 8px; background: var(--color-bg); border-radius: var(--radius-full); overflow: hidden; }
.progress-fill { height: 100%; background: var(--gradient-primary); border-radius: var(--radius-full); transition: width 0.5s var(--easing-decelerate); }
.count { text-align: right; font-weight: var(--font-weight-semibold); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--color-border); font-size: 14px; }
th { color: var(--color-text-secondary); font-weight: var(--font-weight-medium); }
@media (max-width: 768px) {
  .progress-row { grid-template-columns: 1fr; }
}
</style>
