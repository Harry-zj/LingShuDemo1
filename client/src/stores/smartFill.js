import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 智能填表共享数据 Store
 * - F1/F2 编辑组件写入，自动填表页面读取
 * - 纯客户端内存传递，不走后端 API
 */
export const useSmartFillStore = defineStore('smartFill', () => {
  // ========== F1 基本素质 ==========
  const f1Items = ref([
    { key: 'A1', label: '思想政治表现', score: 20, base: 20, detail: '' },
    { key: 'A2', label: '道德品质修养', score: 20, base: 20, detail: '' },
    { key: 'A3', label: '学习态度作风', score: 20, base: 20, detail: '' },
    { key: 'A4', label: '组织纪律观念', score: 20, base: 20, detail: '' },
    { key: 'A5', label: '身心健康素质', score: 20, base: 20, detail: '' },
  ])

  const f1Total = computed(() => f1Items.value.reduce((s, a) => s + a.score, 0))
  const f1Weighted = computed(() => parseFloat((f1Total.value * 0.1).toFixed(1)))

  // ========== F2 课程成绩 ==========
  const f2Courses = ref([{ name: '', credit: 2, score: 0 }])

  const f2WeightedAvg = computed(() => {
    let sum = 0, credits = 0
    for (const c of f2Courses.value) {
      if (c.credit > 0 && c.score > 0) { sum += c.score * c.credit; credits += Number(c.credit) }
    }
    return credits > 0 ? parseFloat((sum / credits).toFixed(2)) : 0
  })
  const f2Weighted = computed(() => parseFloat((f2WeightedAvg.value * 0.65).toFixed(1)))

  const validCourseCount = computed(() => f2Courses.value.filter(c => c.name && c.credit > 0 && c.score > 0).length)

  // ★ 重置为默认值（批次切换时调用）
  function resetToDefaults() {
    f1Items.value = [
      { key: 'A1', label: '思想政治表现', score: 20, base: 20, detail: '' },
      { key: 'A2', label: '道德品质修养', score: 20, base: 20, detail: '' },
      { key: 'A3', label: '学习态度作风', score: 20, base: 20, detail: '' },
      { key: 'A4', label: '组织纪律观念', score: 20, base: 20, detail: '' },
      { key: 'A5', label: '身心健康素质', score: 20, base: 20, detail: '' },
    ]
    f2Courses.value = [{ name: '', credit: 2, score: 0 }]
  }

  return {
    f1Items, f1Total, f1Weighted,
    f2Courses, f2WeightedAvg, f2Weighted, validCourseCount,
    resetToDefaults,
  }
})
