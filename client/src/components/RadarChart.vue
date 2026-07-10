<template>
  <div class="radar-chart-container" ref="chartRef"></div>
</template>
<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue"
import * as echarts from "echarts"
import { DIMENSION_CONFIG } from "../utils/scoreHelper"

const props = defineProps({
  data: { type: Object, default: () => ({}) },          // { de: 85, zhi: 90, ... }
  dimensions: { type: Array, default: () => DIMENSION_CONFIG }, // [{ key, name, color }]
  maxScore: { type: Number, default: 100 },
  size: { type: Number, default: 320 },
})

const chartRef = ref(null)
let chart = null

function buildOption() {
  const indicator = props.dimensions.map(d => ({ name: d.name, max: props.maxScore }))
  const values = props.dimensions.map(d => props.data?.[d.key] ?? 0)
  const primaryColor = props.dimensions[1]?.color || "#4F46E5"

  // 主系列（五边形面）+ 每个维度一个独立点位（用于悬停单独提示）
  const dimSeries = props.dimensions.map((d, idx) => {
    const arr = new Array(props.dimensions.length).fill(null)
    arr[idx] = values[idx]
    return {
      type: "radar",
      data: [{ value: arr, name: d.name }],
      symbol: "circle", symbolSize: 7,
      itemStyle: { color: d.color },
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { formatter: () => d.name + "：" + (values[idx] || 0) + " 分" },
    }
  })

  return {
    tooltip: { trigger: "item" },
    radar: {
      center: ["50%", "50%"],
      radius: "65%",
      indicator,
      axisName: { fontSize: 13, color: "rgba(8,6,20,0.56)" },
      splitArea: { areaStyle: { color: ["rgba(99,102,241,0.02)", "rgba(255,255,255,0)"] } },
      splitLine: { lineStyle: { color: "rgba(15,10,30,0.06)" } },
    },
    series: [
      // 主面积系列（不可见、不交互，纯展示）
      {
        type: "radar",
        data: [{ value: values, name: "得分" }],
        symbol: "none",
        silent: true,
        areaStyle: { color: "rgba(79,70,229,0.10)" },
        lineStyle: { color: primaryColor, width: 2 },
        itemStyle: { opacity: 0 },
      },
      // 每个维度独立的悬停点
      ...dimSeries,
    ]
  }
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(buildOption())
  window.addEventListener("resize", handleResize)
}

function handleResize() { chart?.resize() }

watch(() => [props.data, props.dimensions], () => {
  if (chart) chart.setOption(buildOption())
}, { deep: true })

onMounted(initChart)
onUnmounted(() => { window.removeEventListener("resize", handleResize); chart?.dispose() })
</script>
<style scoped>
.radar-chart-container { width: 100%; height: 100%; min-height: 280px; }
</style>
