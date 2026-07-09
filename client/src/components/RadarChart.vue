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
  { key: "zhiyu", name: "智育", color: "#1A73E8" },
  { key: "deyu", name: "德育", color: "#EA8600" },
  { key: "tiyu", name: "体育", color: "#34A853" },
  { key: "meiyu", name: "美育", color: "#9C27B0" },
  { key: "laoyu", name: "劳育", color: "#FF6D00" },
]

function buildOption(dimensions) {
  const indicator = dimConfig.map(d => ({ name: d.name, max: 100 }))
  const values = dimConfig.map(d => dimensions?.[d.key] ?? 0)
  return {
    radar: {
      center: ["50%", "50%"],
      radius: "65%",
      indicator,
      axisName: { fontSize: 13, color: "#5F6368" },
      splitArea: { areaStyle: { color: ["#F8F9FA", "#FFFFFF"] } },
      splitLine: { lineStyle: { color: "#DADCE0" } },
    },
    series: [{
      type: "radar",
      data: [{ value: values, name: "我的评分", areaStyle: { color: "rgba(26,115,232,0.15)" }, lineStyle: { color: "#1A73E8", width: 2 }, itemStyle: { color: "#1A73E8" } }],
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

watch(() => props.dimensions, (val) => {
  if (chart) chart.setOption(buildOption(val))
}, { deep: true })

onMounted(initChart)
onUnmounted(() => {
  window.removeEventListener("resize", handleResize)
  chart?.dispose()
})
</script>
<style scoped>
.radar-chart-container { width: 100%; height: 100%; min-height: 280px; }
</style>
