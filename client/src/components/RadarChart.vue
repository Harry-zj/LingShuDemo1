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
      data: [{
        value: values, name: "得分",
        areaStyle: { color: "rgba(79,70,229,0.12)" },
        lineStyle: { color: primaryColor, width: 2 },
        itemStyle: { color: primaryColor },
      }],
      symbol: "circle",
      symbolSize: 5,
    }]
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
