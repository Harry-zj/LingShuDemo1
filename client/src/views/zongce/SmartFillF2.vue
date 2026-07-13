<template>
  <div class="f2-root">
    <div class="f2-card">
      <div class="f2-card-header">
        <div class="f2-header-left">
          <span class="f2-icon">📚</span>
          <div>
            <h4>F2 课程学习成绩</h4>
            <span class="f2-weight-badge">权重 65%</span>
          </div>
        </div>
        <button class="btn-complete" :class="{ done: isCompleted }" @click="handleComplete">
          <span v-if="isCompleted">✓ 已完成</span>
          <span v-else>完成填写</span>
        </button>
      </div>
      <div class="course-table">
        <div class="course-header"><span>课程名称</span><span>学分</span><span>成绩</span><span></span></div>
        <div v-for="(c, i) in store.f2Courses" :key="i" class="course-row">
          <input class="course-inp name" v-model="c.name" placeholder="如：高等数学" />
          <input class="course-inp credit" type="number" v-model.number="c.credit" min="0" max="10" step="0.5" />
          <input class="course-inp score" type="number" v-model.number="c.score" min="0" max="100" />
          <button class="btn-del" @click="removeCourse(i)" title="删除">×</button>
        </div>
      </div>
      <button class="btn-add" @click="addCourse"><span class="add-icon">+</span> 添加课程</button>
      <div class="f2-summary">
        <div class="summary-item"><span class="summary-label">加权平均分</span><span class="summary-value">{{ Number(store.f2WeightedAvg).toFixed(2) }}</span></div>
        <div class="summary-item"><span class="summary-label">加权得分</span><span class="summary-value accent">{{ store.f2Weighted }}</span></div>
        <div class="summary-item"><span class="summary-label">已录入</span><span class="summary-value">{{ store.validCourseCount }} 门</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSmartFillStore } from '@/stores/smartFill'

const emit = defineEmits(['saved'])
const store = useSmartFillStore()
const isCompleted = ref(false)

function handleComplete() {
  // 至少保证有一行空行
  if (store.f2Courses.length === 0) store.f2Courses.push({ name: '', credit: 2, score: 0 })
  isCompleted.value = true
  emit('saved')
  setTimeout(() => { isCompleted.value = false }, 2000)
}

function addCourse() { store.f2Courses.push({ name: '', credit: 2, score: 0 }) }
function removeCourse(i) {
  store.f2Courses.splice(i, 1)
  if (store.f2Courses.length === 0) store.f2Courses.push({ name: '', credit: 2, score: 0 })
}
</script>

<style scoped>
.f2-root { max-width: 720px; }
.f2-card { background: #fff; border: 1px solid #e8ecf1; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
.f2-card-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; background: linear-gradient(135deg, #f8faff, #f0f4ff); border-bottom: 1px solid #e0e6f0; }
.f2-header-left { display: flex; align-items: center; gap: 12px; }
.f2-icon { font-size: 28px; }
.f2-card-header h4 { font-size: 17px; margin: 0; color: #1a1a2e; }
.f2-weight-badge { font-size: 12px; padding: 2px 10px; border-radius: 20px; background: #e8f0fe; color: #1a73e8; font-weight: 600; }
.btn-complete { padding: 9px 22px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; background: #1a73e8; color: #fff; transition: all .2s; }
.btn-complete:hover { background: #1557b0; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(26,115,232,.3); }
.btn-complete.done { background: #34A853; }
.btn-complete.done:hover { background: #2d9249; }
.course-table { padding: 4px 16px; }
.course-header, .course-row { display: grid; grid-template-columns: 2fr 90px 90px 40px; gap: 10px; padding: 10px 12px; align-items: center; }
.course-header { font-size: 12px; font-weight: 700; color: #8892a0; text-transform: uppercase; letter-spacing: .5px; border-bottom: 2px solid #e8ecf1; margin-bottom: 2px; }
.course-row { border-bottom: 1px solid #f5f6f8; }
.course-row:last-child { border-bottom: none; }
.course-inp { border: 1.5px solid #e0e4ea; border-radius: 6px; padding: 7px 10px; font-size: 13px; font-family: inherit; transition: border-color .2s; background: #fafbfc; width: 100%; box-sizing: border-box; }
.course-inp.credit, .course-inp.score { text-align: center; }
.course-inp:focus { outline: none; border-color: #1a73e8; background: #fff; box-shadow: 0 0 0 3px rgba(26,115,232,.08); }
.btn-del { background: none; border: none; color: #d93025; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 4px; line-height: 1; opacity: 0.5; transition: all .15s; }
.btn-del:hover { opacity: 1; background: #fce8e6; }
.btn-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: calc(100% - 32px); margin: 8px 16px 12px; padding: 10px; font-size: 13px; font-family: inherit; font-weight: 500; border: 2px dashed #d0d8e0; border-radius: 8px; background: #fafbfd; cursor: pointer; color: #1a73e8; transition: all .2s; }
.btn-add:hover { border-color: #1a73e8; background: #f5f9ff; }
.add-icon { font-size: 16px; font-weight: 700; }
.f2-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid #e8ecf1; }
.summary-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 12px; border-right: 1px solid #f0f2f5; }
.summary-item:last-child { border-right: none; }
.summary-label { font-size: 11px; color: #8892a0; text-transform: uppercase; letter-spacing: .3px; }
.summary-value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
.summary-value.accent { color: #1a73e8; }
@media (max-width: 600px) { .course-header, .course-row { grid-template-columns: 1fr 60px 60px 30px; gap: 6px; } .f2-summary { grid-template-columns: 1fr; } .summary-item { border-right: none; border-bottom: 1px solid #f0f2f5; } }
</style>