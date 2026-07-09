<template>
  <div class="dim-item">
    <div class="dim-head">
      <span class="dim-dot" :style="{ background: color }"></span>
      <span class="dim-label">{{ name }}</span>
      <span class="dim-score" v-if="showScore">{{ displayScore }}</span>
    </div>
    <div class="dim-bar-track">
      <div class="dim-bar-fill" :style="fillStyle"></div>
    </div>
  </div>
</template>
<script setup>
import { computed } from "vue"
const props = defineProps({
  name: String,
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 100 },
  color: { type: String, default: "var(--color-primary)" },
  showScore: { type: Boolean, default: true },
})
const displayScore = computed(() => props.score != null ? `${props.score}分` : "--")
const fillStyle = computed(() => ({
  width: Math.min((props.score / props.maxScore) * 100, 100) + "%",
  background: props.color,
}))
</script>
<style scoped>
.dim-item { opacity: 0; }  /* 由父级 animation 控制显示 */
.dim-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.dim-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dim-label { font-size: 14px; color: var(--color-text); flex: 1; }
.dim-score { font-size: 14px; font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.dim-bar-track { height: 8px; background: var(--color-surface-variant); border-radius: 4px; overflow: hidden; }
.dim-bar-fill { height: 100%; border-radius: 4px; transition: width 0.8s var(--easing-spring); }
</style>
