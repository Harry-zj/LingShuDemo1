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
  const theme = getThemeColors()

  const indicator = props.dimensions.map(d => ({
    name: d.name,
    max: props.maxScore,
  }))

  const values = props.dimensions.map(
    d => props.data?.[d.key] ?? 0
  )

  const primaryColor =
    props.dimensions[1]?.color || "#4F46E5"

  const dimSeries = props.dimensions.map((dimension, index) => {
    const pointValues =
      new Array(props.dimensions.length).fill(null)

    pointValues[index] = values[index]

    return {
      type: "radar",
      data: [
        {
          value: pointValues,
          name: dimension.name,
        },
      ],
      symbol: "circle",
      symbolSize: 9,
      z: 3,
      itemStyle: {
        color: dimension.color,
        borderColor: theme.pointBorder,
        borderWidth: 2,
        shadowBlur: 8,
        shadowColor: dimension.color,
      },
      lineStyle: {
        opacity: 0,
      },
      areaStyle: {
        opacity: 0,
      },
      tooltip: {
        formatter: () =>
          `${dimension.name}：${values[index] || 0} 分`,
      },
    }
  })

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
      center: ["50%", "53%"],
      radius: "65%",
      indicator,

      axisName: {
        fontSize: 15,
        fontWeight: 700,
        color: theme.axisName,
      },

      axisLine: {
        lineStyle: {
          color: theme.axisLine,
          width: 1.5,
        },
      },

      splitLine: {
        lineStyle: {
          color: theme.splitLine,
          width: 1.2,
        },
      },

      splitArea: {
        areaStyle: {
          color: theme.splitArea,
        },
      },
    },

    series: [
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
        z: 2,

        areaStyle: {
          color: theme.area,
        },

        lineStyle: {
          color: primaryColor,
          width: 3,
          shadowBlur: 10,
          shadowColor: primaryColor,
        },

        itemStyle: {
          opacity: 0,
        },
      },

      ...dimSeries,
    ],
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

watch(
  () => [
    props.data,
    props.dimensions,
    props.maxScore,
  ],
  renderChart,
  {
    deep: true,
  }
)

onMounted(() => {
  initChart()

  themeObserver = new MutationObserver(renderChart)

  themeObserver.observe(
    document.documentElement,
    {
      attributes: true,
      attributeFilter: ["data-theme"],
    }
  )
})

onUnmounted(() => {
  window.removeEventListener(
    "resize",
    handleResize
  )

  themeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.radar-chart-container {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
