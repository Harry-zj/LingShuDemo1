<template>
  <div class="student-db">
    <div class="page-header">
      <h2>我的综测</h2>
      <p class="page-desc">查看通知、提交材料、追踪审核状态</p>
    </div>
    <div class="deadline-card">
      <VIcon icon="mdi:clock-outline" class="deadline-icon" />
      <div class="deadline-info">
        <span class="deadline-label">距离截止</span>
        <span class="deadline-value">-- 天</span>
      </div>
    </div>
    <div class="my-materials glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:file-document-outline" />我的材料</h3>
        <span class="panel-count">{{ materials.length }} 项</span>
      </div>
      <div class="material-list">
        <div class="material-row" v-for="(m, i) in materials" :key="m.id"
          :style="{ animationDelay: (i * 0.06) + 's' }">
          <div class="row-left">
            <VIcon icon="mdi:file-document-outline" class="row-icon" />
            <span>{{ m.title }}</span>
          </div>
          <span class="status-tag" :style="{ background: STATUS_MAP[m.status]?.bg, color: STATUS_MAP[m.status]?.color }">{{ STATUS_MAP[m.status]?.label }}</span>
        </div>
        <div class="empty-state" v-if="!materials.length">
          <VIcon icon="mdi:inbox-outline" class="empty-icon" />
          <p>暂无提交材料</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getMyMaterials } from '../../api/module3';
import { STATUS_MAP } from '../../utils/constants';
const materials = ref([]);
onMounted(async () => { const r = await getMyMaterials(); if (r.code === 200) materials.value = r.data || []; });
</script>

<style scoped>
.student-db { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.deadline-card {
  display: flex; align-items: center; gap: 14px; padding: 16px 20px;
  background: var(--color-warning-bg); border-radius: var(--radius-lg);
  border: 1px solid rgba(217,119,6,0.15);
  animation: fadeInUp 0.5s var(--easing-spring) both;
}
.deadline-icon { font-size: 24px; color: var(--color-warning); }
.deadline-info { display: flex; flex-direction: column; gap: 2px; }
.deadline-label { font-size: 13px; color: var(--color-warning); }
.deadline-value { font-size: 18px; font-weight: var(--font-weight-bold); color: var(--color-warning); }

.my-materials {
  border-radius: var(--radius-xl); padding: 24px;
  animation: fadeInUp 0.5s var(--easing-spring) 0.1s both;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header h3 { font-size: 16px; font-weight: var(--font-weight-semibold); display: flex; align-items: center; gap: 8px; }
.panel-header h3 VIcon { color: var(--color-primary); font-size: 20px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); background: var(--color-gray-bg); padding: 2px 10px; border-radius: var(--radius-full); }

.material-list { display: flex; flex-direction: column; }
.material-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 8px; border-bottom: 1px solid var(--color-gray-bg);
  opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards;
  transition: background var(--duration-fast) var(--easing-standard);
  border-radius: var(--radius-sm); margin: 0 -8px;
}
.material-row:hover { background: var(--color-surface-variant); }
.material-row:last-child { border-bottom: none; }
.row-left { display: flex; align-items: center; gap: 10px; }
.row-left span { font-size: 14px; color: var(--color-text); }
.row-icon { font-size: 18px; color: var(--color-text-tertiary); }
.status-tag { font-size: 12px; padding: 4px 12px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); flex-shrink: 0; }
.empty-state { text-align: center; padding: 40px 16px; color: var(--color-text-tertiary); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }
.empty-state p { font-size: 14px; }
</style>
