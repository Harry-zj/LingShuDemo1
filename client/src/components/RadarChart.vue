<template>
  <div class="radar-chart-container" ref="chartRef"></div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue"
import * as echarts from "echarts"

const props = defineProps({
  dimensions: { type: Object, default: () => ({}) },
  size: { type: Number, default: 320 }
})

const chartRef = ref(null)
let chart = null

const dimConfig = [
  { key: "zhiyu", name: "智育", color: "#4F46E5" },
  { key: "deyu", name: "德育", color: "#D97706" },
  { key: "tiyu", name: "体育", color: "#059669" },
  { key: "meiyu", name: "美育", color: "#7C3AED" },
  { key: "laoyu", name: "劳育", color: "#EA580C" },
]

function buildOption(dimensions) {
  const indicator = dimConfig.map(d => ({ name: d.name, max: 100 }))
  const values = dimConfig.map(d => dimensions?.[d.key] ?? 0)
  return {
    radar: {
      center: ["50%", "50%"],
      radius: "65%",
      indicator,
      axisName: { fontSize: 13, color: "rgba(8,6,20,0.56)" },
      splitArea: { areaStyle: { color: ["rgba(99,102,241,0.02)", "rgba(255,255,255,0)"] } },
      splitLine: { lineStyle: { color: "rgba(15,10,30,0.06)" } },
    },
    series: [{
      type: "radar",
      data: [{ value: values, name: "我的评分", areaStyle: { color: "rgba(79,70,229,0.12)" }, lineStyle: { color: "#4F46E5", width: 2 }, itemStyle: { color: "#4F46E5" } }],
      symbol: "circle",
      symbolSize: 6,
    }]
  }
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(buildOption(props.dimensions))
  window.addEventListener("resize", handleResize)
}

function handleResize() { chart?.resize() }

watch(() => props.dimensions, (val) => { if (chart) chart.setOption(buildOption(val)) }, { deep: true })

onMounted(initChart)
onUnmounted(() => { window.removeEventListener("resize", handleResize); chart?.dispose() })
</script>
<style scoped>
.radar-chart-container { width: 100%; height: 100%; min-height: 280px; }
</style>
