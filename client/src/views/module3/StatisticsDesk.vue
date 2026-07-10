<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1>统计总览</h1>
        <p>展示综测提交进度、三类评价主体待处理数量和班级完成情况。最终汇总表由管理员或学生工作处导出。</p>
      </div>
      <button @click="downloadCsv">导出汇总表</button>
    </header>

    <section v-if="stats" class="stat-grid">
      <div><span>学生总数</span><strong>{{ stats.total_students }}</strong></div>
      <div><span>已提交</span><strong>{{ stats.submitted }}</strong></div>
      <div><span>未提交</span><strong>{{ stats.unsubmitted }}</strong></div>
      <div><span>已认定通过</span><strong>{{ stats.approved }}</strong></div>
      <div><span>待班级测评小组</span><strong>{{ stats.pending_class_committee }}</strong></div>
      <div><span>待辅导员</span><strong>{{ stats.pending_counselor }}</strong></div>
      <div><span>待学生工作处</span><strong>{{ stats.pending_student_affairs }}</strong></div>
      <div><span>退回/不予认定</span><strong>{{ stats.returned + stats.rejected }}</strong></div>
    </section>

    <section v-if="stats" class="panel">
      <h2>评价表状态</h2>
      <table>
        <thead>
          <tr><th>学生</th><th>班级</th><th>综合分</th><th>状态</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in stats.status_rows" :key="row.id">
            <td>{{ row.student_name }}</td>
            <td>{{ row.class_name }}</td>
            <td>{{ row.total_score }}</td>
            <td>{{ row.status_label }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="stats" class="panel">
      <h2>班级进度</h2>
      <table>
        <thead>
          <tr><th>班级</th><th>学生数</th><th>已提交</th><th>已认定</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in stats.class_progress" :key="row.class_id">
            <td>{{ row.class_name }}</td>
            <td>{{ row.total }}</td>
            <td>{{ row.submitted }}</td>
            <td>{{ row.approved }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { exportExcel, getStatistics } from "../../api/module3";

const stats = ref(null);

async function load() {
  const res = await getStatistics();
  if (res.code === 200) stats.value = res.data;
}

async function downloadCsv() {
  const blob = await exportExcel({});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "综测汇总表.csv";
  a.click();
  window.URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<style scoped>
.page { display: grid; gap: 20px; }
.page-head { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
h1, h2 { margin: 0; color: #111827; }
.page-head p { margin: 8px 0 0; color: #6b7280; line-height: 1.7; }
button { border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer; background: #2563eb; color: #fff; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.stat-grid div, .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; }
.stat-grid div { display: grid; gap: 8px; }
.stat-grid span { color: #6b7280; font-size: 13px; }
.stat-grid strong { font-size: 24px; color: #111827; }
.panel { display: grid; gap: 14px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 12px; }
th { color: #374151; background: #f9fafb; }
td { color: #4b5563; }
@media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
