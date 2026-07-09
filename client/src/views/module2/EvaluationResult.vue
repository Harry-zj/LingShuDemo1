<template>
  <div class="evaluation">
    <h2>评定结果分析</h2>
    <div class="score-card">
      <div class="big-score">--</div>
      <div class="score-label">综测总分</div>
    </div>
    <div class="dimensions">
      <div class="dim-item" v-for="d in dimensions" :key="d.name">
        <span class="dim-label">{{ d.name }}</span>
        <div class="dim-bar"><div class="dim-fill" :style="dimStyle(d)"></div></div>
        <span class="dim-score">--</span>
      </div>
    </div>
  </div>
</template>
<script setup>
const dimensions = [
  { name: "智育", color: "var(--color-zhiyu)" },
  { name: "德育", color: "var(--color-deyu)" },
  { name: "体育", color: "var(--color-tiyu)" },
  { name: "美育", color: "var(--color-meiyu)" },
  { name: "劳育", color: "var(--color-laoyu)" },
];
function dimStyle(d) { return { width: "0%", background: d.color }; }
</script>
<style scoped>
.evaluation h2 { font-size: 24px; margin-bottom: 24px; }
.score-card { text-align: center; padding: 48px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); margin-bottom: 24px; }
.big-score { font-size: 64px; font-weight: 700; color: var(--color-primary); }
.score-label { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; }
.dimensions { display: flex; flex-direction: column; gap: 16px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); padding: 24px; }
.dim-item { display: flex; align-items: center; gap: 16px; }
.dim-label { width: 48px; font-size: 14px; font-weight: 500; }
.dim-bar { flex: 1; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; }
.dim-fill { height: 100%; border-radius: 5px; transition: width 0.5s; }
.dim-score { width: 40px; text-align: right; font-size: 14px; color: var(--color-text-secondary); }
</style>
