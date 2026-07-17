<template>
  <div class="f2-root">
    <div class="f2-card">
      <div class="f2-card-header">
        <div class="f2-header-left">
          <span class="f2-icon">📚</span>
          <div>
            <h4>F2 课程学习成绩 <span class="f2-weight">权重 65%</span></h4>
          </div>
        </div>
        <button v-if="!props.readonly" class="btn-complete" :class="{ done: isCompleted }" @click="handleComplete">
          <span v-if="isCompleted">✓ 已完成</span>
          <span v-else>完成填写</span>
        </button>
      </div>

      <div class="course-table">
        <div class="course-header"><span>课程名称</span><span>学分</span><span>成绩</span><span></span></div>
        <div v-for="(c, i) in store.f2Courses" :key="i" class="course-row">
          <input class="course-inp name" v-model="c.name" placeholder="如：高等数学" :disabled="props.readonly" />
          <input class="course-inp credit" type="number" v-model.number="c.credit" min="0" max="10" step="0.5" :disabled="props.readonly" />
          <input class="course-inp score" type="number" v-model.number="c.score" min="0" :max="courseLimit" @input="clampCourse(c)" :disabled="props.readonly" />
          <button v-if="!props.readonly" class="btn-del" @click="removeCourse(i)" title="删除">×</button>
        </div>
      </div>

      <button v-if="!props.readonly" class="btn-add" @click="addCourse"><span class="add-icon">+</span> 添加课程</button>

      <div class="f2-summary">
        <div class="summary-item">
          <span class="summary-label">加权平均分</span>
          <span class="summary-value">{{ Number(weightedAvg).toFixed(2) }}</span>
        </div>
        <div class="summary-item accent">
          <span class="summary-label">加权得分</span>
          <span class="summary-value">{{ weightedScore }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">已录入</span>
          <span class="summary-value">{{ store.validCourseCount }} 门</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useSmartFillStore } from '@/stores/smartFill'
import * as api from '@/api/zongce'

const emit = defineEmits(['saved', 'complete'])
const store = useSmartFillStore()
const isCompleted = ref(false)
const props = defineProps({
  scorePolicy: { type: Object, default: () => ({}) },
  ruleSetId: { type: Number, default: 0 },
  batchId: { type: [Number, String], default: null },
  readonly: { type: Boolean, default: false },
  readonlyReason: { type: String, default: '' },
})
const courseLimit = computed(() => Number(props.scorePolicy?.scoreLimits?.COURSE ?? 100))
const sectionLimit = computed(() => Number(props.scorePolicy?.scoreLimits?.F2 ?? 100))
const weightedAvg = computed(() => Math.min(Number(store.f2WeightedAvg || 0), sectionLimit.value))
const weightedScore = computed(() => Number((weightedAvg.value * 0.65).toFixed(2)))

function clampCourse(course) {
  const value = Number(course.score || 0)
  course.score = Number(Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), courseLimit.value).toFixed(2))
}

watch(courseLimit, () => store.f2Courses.forEach(clampCourse), { immediate: true })

let saveTimer = null
watch(() => store.f2Courses.map(c => ({ name: c.name, credit: c.credit, score: c.score })), () => {
  if (props.readonly) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const items = store.f2Courses.filter(c => c.name).map(c => ({ section: 'F2', item_key: 'COURSE', score: 0, description: '', extra_data: [c], rule_set_id: props.ruleSetId || 0 }))
    if (items.length) api.saveFillData(items, props.batchId).catch(() => {})
  }, 800)
}, { deep: true })

onBeforeUnmount(() => {
  if (props.readonly) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const items = store.f2Courses.filter(c => c.name).map(c => ({ section: 'F2', item_key: 'COURSE', score: 0, description: '', extra_data: [c], rule_set_id: props.ruleSetId || 0 }))
  if (items.length) api.saveFillData(items, props.batchId).catch(() => {})
})

function addCourse() { store.f2Courses.push({ name: '', credit: 2, score: 0 }) }
function removeCourse(i) { store.f2Courses.splice(i, 1) }

function handleComplete() {
  if (store.f2Courses.length === 0) store.f2Courses.push({ name: '', credit: 2, score: 0 })
  isCompleted.value = true
  emit('saved')
  emit('complete')
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const validCourses = store.f2Courses.filter(c => c.name)
  if (validCourses.length) {
    api.saveFillData([{ section: 'F2', item_key: 'COURSE', score: 0, description: '', extra_data: validCourses, rule_set_id: props.ruleSetId || 0 }], props.batchId).catch(() => {})
  }
}
</script>

<style scoped>
.f2-root { width: 100%; }
.readonly-notice { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 16px; background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; font-size: 13px; color: #d97706; }
.readonly-notice .hint { color: var(--color-text-tertiary); font-size: 12px; margin-left: auto; }
.f2-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; overflow: hidden;
}
.f2-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 22px; background: rgba(196,168,130,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.f2-header-left { display: flex; align-items: center; gap: 10px; }
.f2-icon { font-size: 22px; }
.f2-card-header h4 { font-size: 17px; margin: 0; color: var(--color-text); font-weight: 700; }
.f2-weight { font-size: 11px; color: #c4a882; font-weight: 500; margin-left: 8px; background: rgba(196,168,130,0.10); padding: 2px 8px; border-radius: 6px; }

.course-table { padding: 0 22px; }
.course-header, .course-row {
  display: grid; grid-template-columns: 1fr 80px 80px 36px; gap: 12px; align-items: center;
}
.course-header { padding: 12px 0 8px; border-bottom: 1.5px solid rgba(255,255,255,0.06); }
.course-header span { font-size: 11px; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
.course-row { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }

.course-inp {
  padding: 8px 12px; border: 1.5px solid rgba(255,255,255,0.10);
  border-radius: 10px; font-size: 14px; font-family: inherit;
  background: rgba(255,255,255,0.04); color: var(--color-text);
  transition: border-color 0.2s;
}
.course-inp:focus { outline: none; border-color: #c4a882; box-shadow: 0 0 0 3px rgba(196,168,130,0.10); }
.course-inp.name { }
.course-inp.credit, .course-inp.score { text-align: center; }
.course-inp::placeholder { color: var(--color-text-tertiary); }

.btn-del {
  width: 30px; height: 30px; border: none; border-radius: 50%;
  background: transparent; color: rgba(255,255,255,0.2); cursor: pointer;
  font-size: 16px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.btn-del:hover { background: rgba(220,80,80,0.20); color: #d44; }

.btn-add {
  display: block; margin: 12px 22px; padding: 8px 18px;
  border: 1.5px dashed rgba(196,168,130,0.25); border-radius: 10px;
  background: rgba(196,168,130,0.04); color: #c4a882;
  font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all 0.2s;
}
.btn-add:hover { background: rgba(196,168,130,0.12); border-color: rgba(196,168,130,0.45); }
.add-icon { font-size: 16px; margin-right: 4px; }

.f2-summary { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(255,255,255,0.06); }
.summary-item { padding: 16px 22px; text-align: center; border-right: 1px solid rgba(255,255,255,0.04); }
.summary-item:last-child { border-right: none; }
.summary-item.accent { background: rgba(196,168,130,0.04); }
.summary-label { display: block; font-size: 11px; color: var(--color-text-tertiary); margin-bottom: 4px; }
.summary-value { font-size: 22px; font-weight: 700; color: var(--color-text); }
.summary-item.accent .summary-value { color: #c4a882; }

.btn-complete { padding: 8px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; background: rgba(125,155,118,0.18); color: #7d9b76; transition: all .2s; }
.btn-complete:hover { background: rgba(125,155,118,0.30); transform: translateY(-1px); }
.btn-complete.done { background: rgba(125,155,118,0.25); }
</style>
