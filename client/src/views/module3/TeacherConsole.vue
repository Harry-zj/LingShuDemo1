<template>
  <div class="teacher-console">
    <h2>总控中心</h2>
    <div class="filter-bar">
      <select v-model="currentBatch" @change="load"><option value="">选择批次</option><option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option></select>
      <button @click="goToBatchManage">管理批次</button>
      <button class="btn-export" @click="handleExport">导出汇总表</button>
    </div>
    <div class="progress-section" v-if="stats.length">
      <h3>审核进度</h3>
      <div class="progress-row" v-for="s in stats" :key="s.status">
        <span>{{ STATUS_MAP[s.status]?.label || s.status }}</span>
        <div class="progress-bar"><div class="fill" style="width: 0%"></div></div>
        <span>{{ s.count }} 人</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getBatches, getStatistics, exportExcel } from "../../api/module3";
import { STATUS_MAP } from "../../utils/constants";
const router = useRouter();
const batches = ref([]); const currentBatch = ref(""); const stats = ref([]);
async function load() { const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []; if (currentBatch.value) { const r2 = await getStatistics({ batch_id: currentBatch.value }); if (r2.code === 200) stats.value = r2.data || []; } }
async function handleExport() { await exportExcel({ batch_id: currentBatch.value }); alert("导出功能由组员实现"); }
function goToBatchManage() { router.push("/module3/batch-manage"); }
onMounted(load);
</script>
<style scoped>
.teacher-console h2 { font-size: 24px; margin-bottom: 24px; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 24px; }
.filter-bar select { padding: 10px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 14px; }
.filter-bar button { padding: 10px 20px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-white); cursor: pointer; }
.btn-export { background: var(--color-primary) !important; color: #fff !important; border: none !important; }
.progress-section { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.progress-section h3 { font-size: 16px; margin-bottom: 16px; }
.progress-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.progress-row > span:first-child { width: 100px; font-size: 14px; }
.progress-bar { flex: 1; height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden; }
.progress-bar .fill { height: 100%; background: var(--color-primary); border-radius: 4px; }
</style>
