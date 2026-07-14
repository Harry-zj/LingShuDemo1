<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    title="评价统计"
    description="评价进度和评价明细分开查看，避免图表、表格和导出操作集中在同一页面。"
    :back-path="workbenchPath"
    back-label="返回管理员工作台"
    :cards="menuCards"
  />

  <div v-else class="teacher-console">
    <button class="back-link" @click="$router.push('/module3/teacher')"><VIcon icon="mdi:arrow-left" />返回评价统计</button>
    <div class="page-header">
      <h2>{{ view === 'progress' ? '评价进度' : '评价明细' }}</h2>
      <p class="page-desc">{{ view === 'progress' ? '按批次查看各评价阶段的数量和完成进度。' : '按批次查询每份综测表的负责人、分数、等级和状态。' }}</p>
    </div>

    <div class="filter-bar">
      <div class="select-wrapper">
        <VIcon icon="mdi:filter-variant" class="select-icon" />
        <select v-model="currentBatch" @change="load">
          <option value="">全部批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
      <button class="btn-primary" @click="handleExport" v-if="view === 'records' && ['admin', 'student_affairs'].includes(userStore.role)">
        <VIcon icon="mdi:file-export-outline" />导出汇总表
      </button>
    </div>

    <div class="progress-section glass-card" v-if="view === 'progress' && stats">
      <div class="panel-header"><h3><VIcon icon="mdi:chart-timeline-variant" />评价进度</h3><span class="panel-count">共 {{ stats.rows.length }} 份评价表</span></div>
      <div class="progress-list">
        <div class="progress-row" v-for="row in progressRows" :key="row.label">
          <span class="status-label">{{ row.label }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: percent(row.value) + '%' }"></div></div>
          <span class="count">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <div class="data-table glass-card" v-if="view === 'records' && stats">
      <div class="panel-header"><h3><VIcon icon="mdi:table" />评价表状态</h3><span class="panel-count">{{ stats.rows.length }} 条</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>批次</th><th>学生</th><th>学号</th><th>班级</th><th>评测人</th><th>综合分</th><th>等级</th><th>当前状态</th></tr></thead>
          <tbody>
            <tr v-for="row in stats.rows" :key="row.id">
              <td>{{ row.batch_title }}</td><td>{{ row.student_name }}</td><td>{{ row.student_no }}</td><td>{{ row.class_name }}</td><td>{{ row.reviewer_names }}</td><td>{{ row.total_score }}</td><td>{{ row.level }}</td><td>{{ row.status_label }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { exportExcel, getBatches, getStatistics } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const props = defineProps({ view: { type: String, default: 'menu' } });
const view = computed(() => props.view || 'menu');
const userStore = useUserStore();
const batches = ref([]);
const stats = ref(null);
const currentBatch = ref('');
const workbenchPath = computed(() => ({ admin: '/module3/admin', counselor: '/module3/counselor', student_affairs: '/module3/student-affairs' }[userStore.role] || '/module3/admin'));
const menuCards = [
  { title: '评价进度', description: '用进度条查看各评价阶段的表单数量和完成情况', icon: 'mdi:chart-timeline-variant', to: '/module3/teacher/progress' },
  { title: '评价明细与导出', description: '查询每份综测表的负责人、分数、等级和当前状态', icon: 'mdi:table-large', to: '/module3/teacher/records' },
];
const progressRows = computed(() => stats.value ? [
  { label: '已提交', value: stats.value.submitted },
  { label: '待评价小组', value: stats.value.pending_class_committee },
  { label: '待辅导员', value: stats.value.pending_counselor },
  { label: '待学生工作处', value: stats.value.pending_student_affairs },
  { label: '待异议复评', value: stats.value.pending_objection_review || 0 },
  { label: '已认定通过', value: stats.value.approved },
] : []);
function percent(value) { const total = Math.max(stats.value?.rows?.length || 1, 1); return Math.round((value / total) * 100); }
async function load() {
  const [batchRes, statRes] = await Promise.all([getBatches(), getStatistics({ batch_id: currentBatch.value })]);
  if (batchRes.code === 200) batches.value = batchRes.data;
  if (statRes.code === 200) stats.value = statRes.data;
}
async function handleExport() {
  const blob = await exportExcel({ batch_id: currentBatch.value });
  const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = '综测汇总表.csv'; a.click(); window.URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<style scoped>
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
.teacher-console { display:flex; flex-direction:column; gap:24px; animation:fadeIn .4s var(--easing-decelerate); }
.page-header h2 { font-size:22px; font-weight:var(--font-weight-semibold); }
.page-desc { font-size:14px; color:var(--color-text-secondary); margin-top:2px; }
.filter-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.select-wrapper { position:relative; }.select-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--color-text-tertiary); }
select { height:40px; padding:0 16px 0 42px; border:1px solid var(--color-border); border-radius: 8px !important; background:var(--color-surface); color:var(--color-text-primary); }
.btn-primary { display:inline-flex; align-items:center; gap:6px; height:40px; padding:0 16px; border:0; border-radius: 8px !important; background:var(--gradient-primary); color:#fff; cursor:pointer; }
.progress-section,.data-table { padding:20px; border-radius: 8px !important; }.panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }.panel-header h3 { display:flex; align-items:center; gap:8px; font-size:16px; }.panel-count { font-size:13px; color:var(--color-text-secondary); }
.progress-list { display:flex; flex-direction:column; gap:14px; }.progress-row { display:grid; grid-template-columns:140px 1fr 50px; gap:12px; align-items:center; }.progress-bar { height:8px; background:var(--color-bg); border-radius: 8px !important; overflow:hidden; }.progress-fill { height:100%; background:var(--gradient-primary); border-radius: 8px !important; }.count { text-align:right; font-weight:600; }
.table-wrap { overflow:auto; }table { width:100%; border-collapse:collapse; }th,td { text-align:left; padding:12px; border-bottom:1px solid var(--color-border); font-size:14px; white-space:nowrap; }th { color:var(--color-text-secondary); font-weight:500; }
@media (max-width:768px) { .progress-row { grid-template-columns:1fr; } }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
