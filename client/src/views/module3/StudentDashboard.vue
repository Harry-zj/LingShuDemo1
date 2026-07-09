<template>
  <div class="student-db">
    <h2>我的综测</h2>
    <div class="deadline">距离截止：-- 天</div>
    <div class="my-materials">
      <h3>我的材料</h3>
      <div class="material-row" v-for="m in materials" :key="m.id">
        <span>{{ m.title }}</span>
        <span class="status-tag" :style="{ background: STATUS_MAP[m.status]?.bg, color: STATUS_MAP[m.status]?.color }">{{ STATUS_MAP[m.status]?.label }}</span>
      </div>
      <p v-if="!materials.length" class="empty">暂无提交材料</p>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { getMyMaterials } from "../../api/module3";
import { STATUS_MAP } from "../../utils/constants";
const materials = ref([]);
onMounted(async () => { const r = await getMyMaterials(); if (r.code === 200) materials.value = r.data || []; });
</script>
<style scoped>
.student-db h2 { font-size: 24px; margin-bottom: 16px; }
.deadline { padding: 12px 16px; background: var(--color-warning-bg); border-radius: var(--radius-sm); font-size: 14px; color: var(--color-warning); margin-bottom: 24px; }
.my-materials { background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.my-materials h3 { font-size: 16px; margin-bottom: 16px; }
.material-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--color-bg); }
.status-tag { font-size: 12px; padding: 2px 10px; border-radius: var(--radius-tag); }
.empty { color: var(--color-gray); font-size: 14px; text-align: center; padding: 24px; }
</style>
