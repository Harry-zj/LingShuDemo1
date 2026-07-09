<<<<<<< HEAD
﻿<template>
  <div class="evaluation">
    <div class="page-header">
      <h2>评定结果分析</h2>
      <p class="page-desc">五维综合素质评分详情</p>
    </div>
    <div class="score-card glass-card">
      <div class="big-score animate-score">--</div>
      <div class="score-label">综测总分</div>
    </div>
    <div class="dimensions glass-card">
      <h3><VIcon icon="mdi:layers-triple-outline" />五维评分</h3>
      <div class="dim-item" v-for="(d, i) in dimensions" :key="d.name"
        :style="{ animationDelay: (0.2 + i * 0.1) + 's' }">
        <span class="dim-label" :style="{ color: d.color }">{{ d.name }}</span>
=======
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
>>>>>>> origin/main
        <div class="dim-bar"><div class="dim-fill" :style="dimStyle(d)"></div></div>
        <span class="dim-score">--</span>
      </div>
    </div>
  </div>
</template>
<<<<<<< HEAD

<script setup>
const dimensions = [
  { name: '智育', color: 'var(--color-zhiyu)' },
  { name: '德育', color: 'var(--color-deyu)' },
  { name: '体育', color: 'var(--color-tiyu)' },
  { name: '美育', color: 'var(--color-meiyu)' },
  { name: '劳育', color: 'var(--color-laoyu)' },
];
function dimStyle(d) { return { width: '0%', background: d.color }; }
</script>

<style scoped>
.evaluation { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }

.score-card {
  text-align: center; padding: 48px 24px; position: relative;
  animation: fadeInUp 0.5s var(--easing-spring) both; overflow: hidden;
}
.score-card::before {
  content: ''; position: absolute;
  width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 60%);
  top: -100px; right: -80px; pointer-events: none;
}
.big-score { font-size: 64px; font-weight: var(--font-weight-bold); color: var(--color-primary); line-height: 1; }
.big-score.animate-score { animation: fadeInUp 0.6s var(--easing-spring) 0.2s both; }
.score-label { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; }

.dimensions {
  border-radius: var(--radius-xl); padding: 24px;
  animation: fadeInUp 0.5s var(--easing-spring) 0.1s both;
}
.dimensions h3 { font-size: 16px; font-weight: var(--font-weight-semibold); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.dimensions h3 VIcon { color: var(--color-primary); font-size: 20px; }

.dim-item { display: flex; align-items: center; gap: 16px; padding: 10px 0; opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards; }
.dim-item + .dim-item { border-top: 1px solid var(--color-gray-bg); }
.dim-label { width: 48px; font-size: 14px; font-weight: var(--font-weight-semibold); flex-shrink: 0; }
.dim-bar { flex: 1; height: 10px; background: var(--color-bg); border-radius: 5px; overflow: hidden; }
.dim-fill { height: 100%; border-radius: 5px; transition: width 0.8s var(--easing-spring); }
.dim-score { width: 40px; text-align: right; font-size: 14px; color: var(--color-text-secondary); font-weight: var(--font-weight-medium); }
=======
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
>>>>>>> origin/main
</style>
