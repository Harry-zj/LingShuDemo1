<template>
  <div class="radar-chart-container" ref="chartRef"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue"
import * as echarts from "echarts"
import { DIMENSION_CONFIG } from "../utils/scoreHelper"

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  dimensions: { type: Array, default: () => DIMENSION_CONFIG },
  maxScore: { type: Number, default: 100 },
  size: { type: Number, default: 320 },
  activeDimension: { type: String, default: null },  // 'de' | 'zhi' | 'ti' | 'mei' | 'lao'
})

const chartRef = ref(null)
let chart = null
let themeObserver = null

function getThemeColors() {
  const isLight = document.documentElement.dataset.theme === "light"

  if (isLight) {
    return {
      axisName: "rgba(48, 53, 47, 0.82)",
      axisLine: "rgba(71, 76, 68, 0.38)",
      splitLine: "rgba(71, 76, 68, 0.17)",
      splitArea: [
        "rgba(102, 123, 109, 0.07)",
        "rgba(102, 123, 109, 0.025)",
      ],
      area: "rgba(79, 70, 229, 0.16)",
      pointBorder: "#fffaf2",
      tooltipBg: "rgba(255, 250, 242, 0.96)",
      tooltipBorder: "rgba(74, 69, 58, 0.14)",
      tooltipText: "#30352f",
    }
  }

  return {
    axisName: "rgba(246, 242, 232, 0.9)",
    axisLine: "rgba(255, 255, 255, 0.46)",
    splitLine: "rgba(255, 255, 255, 0.16)",
    splitArea: [
      "rgba(99, 102, 241, 0.16)",
      "rgba(255, 255, 255, 0.025)",
    ],
    area: "rgba(79, 70, 229, 0.26)",
    pointBorder: "rgba(255, 255, 255, 0.92)",
    tooltipBg: "rgba(18, 20, 28, 0.96)",
    tooltipBorder: "rgba(255, 255, 255, 0.12)",
    tooltipText: "#f8f5ef",
  }
}

function buildOption() {
  const indicator = props.dimensions.map(d => {
    const isActive = props.activeDimension && d.key === props.activeDimension
    return {
      name: d.name,
      max: props.maxScore,
      axisName: {
        fontSize: isActive ? 16 : 13,
        color: isActive ? d.color : "rgba(8,6,20,0.56)",
        fontWeight: isActive ? 700 : 400,
      },
    }
  })
  const values = props.dimensions.map(d => props.data?.[d.key] ?? 0)
  const primaryColor = props.dimensions[1]?.color || "#4F46E5"

  // 每个维度的独立悬停点
  const dimSeries = props.dimensions.map((d, idx) => {
    const isActive = props.activeDimension && d.key === props.activeDimension
    const arr = new Array(props.dimensions.length).fill(null)
    arr[idx] = values[idx]
    return {
      type: "radar",
      data: [{ value: arr, name: d.name }],
      symbol: "circle",
      symbolSize: isActive ? 12 : 7,
      itemStyle: { color: d.color, borderColor: isActive ? "#fff" : "transparent", borderWidth: isActive ? 2 : 0 },
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { formatter: () => d.name + "：" + (values[idx] || 0) + " 分" },
    }
  })

  // 活跃维度高亮边：一条从中心到该维度值的醒目连线 + 大点
  const highlightSeries = []
  if (props.activeDimension) {
    const activeIdx = props.dimensions.findIndex(d => d.key === props.activeDimension)
    if (activeIdx >= 0) {
      const activeColor = props.dimensions[activeIdx]?.color || primaryColor
      const hlArr = new Array(props.dimensions.length).fill(null)
      hlArr[activeIdx] = values[activeIdx]
      highlightSeries.push({
        type: "radar",
        data: [{ value: hlArr, name: props.dimensions[activeIdx].name + "（当前）" }],
        symbol: "circle",
        symbolSize: 14,
        itemStyle: { color: activeColor, borderColor: "#fff", borderWidth: 3, shadowBlur: 8, shadowColor: activeColor },
        lineStyle: { color: activeColor, width: 3, shadowBlur: 6, shadowColor: activeColor },
        areaStyle: { color: "rgba(0,0,0,0)" },
        tooltip: { formatter: () => props.dimensions[activeIdx].name + "：" + (values[activeIdx] || 0) + " 分" },
      })
    }
  }

  return {
    animationDuration: 500,

    tooltip: {
      trigger: "item",
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: theme.tooltipText,
        fontSize: 13,
      },
    },

    radar: {
      center: ["50%", "52%"],
      radius: props.activeDimension ? "58%" : "65%",
      indicator,
      splitArea: { areaStyle: { color: ["rgba(99,102,241,0.02)", "rgba(255,255,255,0)"] } },
      splitLine: { lineStyle: { color: "rgba(15,10,30,0.06)" } },
      axisLine: { lineStyle: { color: "rgba(15,10,30,0.08)" } },
    },

    series: [
      // 主面积
      {
        type: "radar",
        data: [
          {
            value: values,
            name: "得分",
          },
        ],
        symbol: "none",
        silent: true,
        areaStyle: { color: "rgba(79,70,229,0.10)" },
        lineStyle: { color: primaryColor, width: 2, opacity: props.activeDimension ? 0.4 : 1 },
        itemStyle: { opacity: 0 },
      },
      ...dimSeries,
      ...highlightSeries,
    ]
  }
}

function renderChart() {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  renderChart()

  window.addEventListener("resize", handleResize)
}

function handleResize() {
  chart?.resize()
}

watch(() => [props.data, props.dimensions, props.activeDimension], () => {
  if (chart) chart.setOption(buildOption(), true)
}, { deep: true })

onMounted(initChart)
onUnmounted(() => { window.removeEventListener("resize", handleResize); chart?.dispose() })
</script>

<style scoped>
.radar-chart-container {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
