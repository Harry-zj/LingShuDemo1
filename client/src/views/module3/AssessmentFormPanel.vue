<template>
  <div class="assessment-wrapper" v-if="form">
    <section class="assessment-table glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:table-large" />综测表</h3>
        <span class="panel-count">{{ form.status_label }}</span>
      </div>

      <div class="student-grid">
        <span>姓名：{{ form.student_name }}</span>
        <span>学号：{{ form.student_no }}</span>
        <span>学院：{{ form.college }}</span>
        <span>专业：{{ form.major }}</span>
        <span>年级：{{ form.grade }}</span>
        <span>班级：{{ form.class_name }}</span>
      </div>

      <table class="score-table">
        <thead>
          <tr>
            <th>测评项</th>
            <th>子项</th>
            <th>分值</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>F1 基本素质评分</td>
            <td>A1-A5</td>
            <td>{{ form.scores.f1_basic_quality }}</td>
            <td>占比 10%，含思想政治、道德品质、学习态度、组织纪律、身心健康</td>
          </tr>
          <tr>
            <td>F2 课程学习成绩评分</td>
            <td>课程成绩</td>
            <td>{{ form.scores.f2_course_learning }}</td>
            <td>占比 65%，依据课程学分与成绩自动计算</td>
          </tr>
          <tr>
            <td>F3 创新素质与实践能力评分</td>
            <td>B1-B8</td>
            <td>{{ form.scores.f3_innovation_practice }}</td>
            <td>占比 25%，含职业技能、学科竞赛、科研学术、社会工作、社会实践等</td>
          </tr>
          <tr class="total-row">
            <td>综合素质最后得分</td>
            <td>自动等级：{{ form.auto_level }}</td>
            <td>{{ form.scores.total }}</td>
            <td>当前等级：{{ form.level }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="assessment-materials glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:folder-multiple-outline" />分类支撑材料</h3>
        <span class="panel-count">按 F1 / F2 / F3 和表内子目录归档</span>
      </div>

      <div class="section-block" v-for="section in localGrouped" :key="section.key">
        <h3 class="section-title">{{ section.title }} <small>{{ section.weight }}</small></h3>

        <div class="sub-block" v-for="child in section.children" :key="child.key">
          <div class="sub-title">{{ child.title }}</div>

          <div v-if="child.items.length" class="item-list">
            <div class="item-card" v-for="item in child.items" :key="item.id">
              <template v-if="editable">
                <input v-model="item.title" class="item-input" placeholder="加分项目" />
                <textarea v-model="item.reason" class="item-textarea" placeholder="计分理由"></textarea>
                <div class="edit-row">
                  <label>分值 <input type="number" v-model.number="item.score" /></label>
                  <label>分类
                    <select v-model="item.section" @change="ensureSubKey(item)">
                      <option v-for="s in structure" :key="s.key" :value="s.key">{{ s.key }}</option>
                    </select>
                  </label>
                  <label>子目录
                    <select v-model="item.subKey">
                      <option v-for="c in childrenOf(item.section)" :key="c.key" :value="c.key">{{ c.title }}</option>
                    </select>
                  </label>
                </div>
              </template>

              <template v-else>
                <div class="item-title">{{ item.title }} <span>+{{ item.score }}分</span></div>
                <p class="item-reason">{{ item.reason }}</p>
              </template>

              <div class="evidence-list">
                <span v-for="file in item.evidence_files" :key="file.id">
                  <VIcon icon="mdi:paperclip" />{{ file.name }}
                </span>
                <span v-if="!item.evidence_files?.length">暂无支撑材料</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-sub">该子目录暂无加分项目或支撑材料</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FORM_STRUCTURE } from '../../utils/constants';

const props = defineProps({
  form: { type: Object, required: true },
  editable: { type: Boolean, default: false }
});

const structure = FORM_STRUCTURE;

const localGrouped = computed(() => {
  if (!props.editable) return props.form.grouped_items || [];
  const oldItems = (props.form.grouped_items || [])
    .flatMap(section => section.children || [])
    .flatMap(child => child.items || []);
  return structure.map(section => ({
    ...section,
    children: section.children.map(child => ({
      ...child,
      items: (props.form.items || [])
        .filter(item => item.section === section.key && item.subKey === child.key)
        .map(item => {
          item.evidence_files = oldItems.find(old => old.id === item.id)?.evidence_files || item.evidence_files || [];
          return item;
        })
    }))
  }));
});

function childrenOf(sectionKey) {
  return structure.find(s => s.key === sectionKey)?.children || [];
}

function ensureSubKey(item) {
  const children = childrenOf(item.section);
  if (!children.some(child => child.key === item.subKey)) item.subKey = children[0]?.key || '';
}
</script>

<style scoped>
.assessment-wrapper { display: flex; flex-direction: column; gap: 20px; }
.assessment-table, .assessment-materials { padding: 20px; border-radius: var(--radius-xl); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.student-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.student-grid span { padding: 8px 10px; border-radius: var(--radius-md); background: var(--color-bg); font-size: 13px; }
.score-table { width: 100%; border-collapse: collapse; }
.score-table th, .score-table td { padding: 10px; border: 1px solid var(--color-border); text-align: left; font-size: 13px; }
.score-table th { color: var(--color-text-secondary); background: var(--color-bg); }
.total-row td { font-weight: var(--font-weight-semibold); }
.section-block { margin-top: 18px; }
.section-title { display: flex; align-items: baseline; gap: 8px; font-size: 18px; margin-bottom: 12px; }
.section-title small { color: var(--color-text-secondary); font-size: 13px; }
.sub-block { padding: 14px; margin-bottom: 12px; border-radius: var(--radius-lg); background: var(--color-bg); }
.sub-title { font-weight: var(--font-weight-semibold); margin-bottom: 10px; }
.item-list { display: flex; flex-direction: column; gap: 10px; }
.item-card { padding: 12px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border); }
.item-title { font-weight: var(--font-weight-semibold); }
.item-title span { color: var(--color-primary); }
.item-reason { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin-top: 6px; }
.evidence-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.evidence-list span { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--radius-full); background: var(--color-bg); font-size: 12px; }
.empty-sub { color: var(--color-text-tertiary); font-size: 13px; }
.item-input, .item-textarea, .edit-row input, .edit-row select {
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg); color: var(--color-text-primary); padding: 8px; width: 100%;
}
.item-textarea { min-height: 62px; margin-top: 8px; resize: vertical; }
.edit-row { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px; margin-top: 8px; }
.edit-row label { font-size: 12px; color: var(--color-text-secondary); }
@media (max-width: 768px) {
  .student-grid, .edit-row { grid-template-columns: 1fr; }
  .score-table { font-size: 12px; }
}
</style>
