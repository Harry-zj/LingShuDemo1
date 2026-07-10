<template>
  <div class="teacher-console">
    <div class="page-header">
      <h2>总控中心</h2>
      <p class="page-desc">发布批次、复核材料、统计导出</p>
    </div>
    <div class="filter-bar">
      <div class="select-wrapper">
        <VIcon icon="mdi:filter-variant" class="select-icon" />
        <select v-model="currentBatch" @change="load">
          <option value="">选择批次</option>
          <option v-for="b in batches" :key="b.id" :value="b.id">{{ b.title }}</option>
        </select>
      </div>
      <button class="btn-outline" @click="goToBatchManage">
        <VIcon icon="mdi:cog-outline" />管理批次
      </button>
      <button class="btn-primary" @click="handleExport">
        <VIcon icon="mdi:file-export-outline" />导出汇总表
      </button>
    </div>
    <div class="progress-section glass-card" v-if="stats.length">
      <div class="panel-header">
        <h3><VIcon icon="mdi:chart-timeline-variant" />审核进度</h3>
        <span class="panel-count">{{ stats.length }} 个状态</span>
      </div>
      <div class="progress-list">
        <div class="progress-row" v-for="(s, i) in stats" :key="s.status"
          :style="{ animationDelay: (0.2 + i * 0.08) + 's' }">
          <span class="status-label">{{ STATUS_MAP[s.status]?.label || s.status }}</span>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: '0%' }"></div></div>
          <span class="progress-count">{{ s.count }} 人</span>
        </div>
      </div>
    </div>
    <div class="empty-card glass-card" v-else>
      <VIcon icon="mdi:inbox-outline" class="empty-icon" />
      <p>请选择一个批次查看审核进度</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getBatches, getStatistics, exportExcel } from '../../api/module3';
import { STATUS_MAP } from '../../utils/constants';
const router = useRouter();
const batches = ref([]); const currentBatch = ref(''); const stats = ref([]);
async function load() { const r1 = await getBatches(); if (r1.code === 200) batches.value = r1.data || []; if (currentBatch.value) { const r2 = await getStatistics({ batch_id: currentBatch.value }); if (r2.code === 200) stats.value = r2.data || []; } }
async function handleExport() { await exportExcel({ batch_id: currentBatch.value }); alert('导出功能由组员实现'); }
function goToBatchManage() { router.push('/module3/batch-manage'); }
onMounted(load);
</script>

<style scoped>
.teacher-console { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.filter-bar { display: flex; gap: 12px; flex-wrap: wrap; animation: fadeInUp 0.5s var(--easing-spring) both; }
.select-wrapper {
  display: flex; align-items: center; gap: 8px; padding: 0 14px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-white); transition: all var(--duration-fast) var(--easing-standard); min-width: 200px;
}
.select-wrapper:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
.select-icon { font-size: 18px; color: var(--color-text-tertiary); flex-shrink: 0; }
.select-wrapper select { flex: 1; padding: 10px 0; border: none; background: transparent; font-size: 14px; color: var(--color-text); outline: none; cursor: pointer; }

.btn-outline, .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-spring); }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-white); color: var(--color-text); }
.btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); box-shadow: var(--shadow-level-2); }
.btn-primary { border: none; background: var(--color-primary-gradient); color: white; box-shadow: var(--shadow-level-1); }
.btn-primary:hover { box-shadow: var(--shadow-elevated); transform: translateY(-1px); }
.btn-primary:active { transform: translateY(0) scale(0.97); }

.progress-section { border-radius: var(--radius-xl); padding: 24px; animation: fadeInUp 0.5s var(--easing-spring) 0.1s both; }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.panel-header h3 { font-size: 16px; font-weight: var(--font-weight-semibold); display: flex; align-items: center; gap: 8px; }
.panel-header h3 VIcon { color: var(--color-primary); font-size: 20px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); background: var(--color-gray-bg); padding: 2px 10px; border-radius: var(--radius-full); }

.progress-list { display: flex; flex-direction: column; gap: 4px; }
.progress-row { display: flex; align-items: center; gap: 16px; padding: 12px 8px; border-radius: var(--radius-sm); opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards; transition: background var(--duration-fast) var(--easing-standard); }
.progress-row:hover { background: var(--color-surface-variant); }
.status-label { width: 100px; font-size: 14px; color: var(--color-text); flex-shrink: 0; }
.progress-bar { flex: 1; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary-gradient); border-radius: 5px; transition: width 0.8s var(--easing-spring); }
.progress-count { width: 60px; text-align: right; font-size: 14px; color: var(--color-text-secondary); font-weight: var(--font-weight-medium); flex-shrink: 0; }

.empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 24px; border-radius: var(--radius-xl); animation: fadeInUp 0.5s var(--easing-spring) 0.1s both; }
.empty-icon { font-size: 48px; color: var(--color-text-tertiary); }
.empty-card p { font-size: 14px; color: var(--color-text-secondary); }

@media (max-width: 768px) { .filter-bar { flex-direction: column; } .select-wrapper { min-width: auto; width: 100%; } }
</style>
