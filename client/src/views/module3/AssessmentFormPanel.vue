<template>
  <div class="assessment-wrapper" v-if="form">
    <section class="assessment-table glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:table-large" />综测表</h3>
        <span class="panel-count">{{ form.status_label }}</span>
      </div>

      <div class="student-grid" v-if="showStudentInfo">
        <span>学号：{{ form.student_no }}</span>
        <span>姓名：{{ form.student_name }}</span>
        <span>学院：{{ form.college }}</span>
        <span>班级：{{ form.class_name }}</span>
        <span>年级：{{ form.enrollment_grade || form.grade }}</span>
        <span>专业：{{ form.major }}</span>
      </div>

      <div class="summary-card">
        <div class="summary-title">个人综测说明</div>
        <textarea
          v-if="editable"
          v-model="form.personal_summary"
          class="summary-textarea"
          placeholder="请输入个人综测说明"
        ></textarea>
        <p v-else class="summary-text">{{ form.personal_summary || '暂无个人综测说明' }}</p>
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

      <div v-if="editable" class="edit-tip">
        可以逐项修改项目名称、计分理由、分值、分类和子目录，也可以新增项目并为每个项目手动添加支撑材料。
      </div>

      <div class="section-block" v-for="section in localGrouped" :key="section.key">
        <h3 class="section-title">{{ section.title }} <small>{{ section.weight }}</small></h3>

        <div class="sub-block" v-for="child in section.children" :key="child.key">
          <div class="sub-head">
            <div class="sub-title">{{ child.title }}</div>
            <button v-if="editable" class="mini-btn" @click="addItem(section.key, child.key)">
              <VIcon icon="mdi:plus" />新增项目
            </button>
          </div>

          <div v-if="child.items.length" class="item-list">
            <div class="item-card" v-for="item in child.items" :key="item.id">
              <template v-if="editable">
                <div class="item-edit-head">
                  <span>项目内容</span>
                  <button class="danger-btn" @click="removeItem(item)">
                    <VIcon icon="mdi:trash-can-outline" />删除
                  </button>
                </div>

                <label class="field-label">项目名称</label>
                <input v-model="item.title" class="item-input" placeholder="请输入加分项目名称" />

                <label class="field-label">计分理由 / 内容说明</label>
                <textarea v-model="item.reason" class="item-textarea" placeholder="请输入计分理由或内容说明"></textarea>

                <div class="edit-row">
                  <label>分值 <input type="number" min="0" step="0.1" v-model.number="item.score" /></label>
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
                <div class="item-review-result" v-if="item.reviews?.length">
                  <div v-for="review in item.reviews" :key="review.id">
                    <strong>{{ review.reviewer_role === 'assessment_member' ? '评价小组' : review.reviewer_role === 'counselor' ? '辅导员' : '学生工作处' }}</strong>
                    <span>{{ review.action === 'approve' ? '符合' : review.action === 'return' ? '需修改' : '不符合' }} · 复核分值 {{ review.reviewed_score }}</span>
                    <p>{{ review.reason || '未填写逐项评测理由' }}</p>
                  </div>
                </div>
              </template>

              <div class="evidence-editor" v-if="editable">
                <div class="evidence-editor-head">
                  <div>
                    <strong>支撑材料</strong>
                    <small>支持图片、PDF、Word、Excel；单个项目最多 10 个文件。</small>
                  </div>
                  <label class="evidence-upload-btn" :class="{ disabled: uploadingEvidence[item.id] }">
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                      :disabled="uploadingEvidence[item.id]"
                      @change="handleEvidenceUpload(item, $event)"
                    />
                    <VIcon :icon="uploadingEvidence[item.id] ? 'mdi:loading' : 'mdi:paperclip-plus'" :class="{ spin: uploadingEvidence[item.id] }" />
                    {{ uploadingEvidence[item.id] ? '上传中...' : '添加支撑材料' }}
                  </label>
                </div>
                <p class="evidence-notice" v-if="evidenceNotices[item.id]">{{ evidenceNotices[item.id] }}</p>
              </div>

              <div class="evidence-list" :class="{ editable: editable }">
                <div class="evidence-chip" v-for="file in item.evidence_files" :key="file.id">
                  <a v-if="file.url" :href="file.url" target="_blank" rel="noopener noreferrer" :title="file.name">
                    <VIcon icon="mdi:paperclip" />
                    <span>{{ file.name }}</span>
                    <small v-if="file.size">{{ formatFileSize(file.size) }}</small>
                  </a>
                  <span v-else class="evidence-file-name">
                    <VIcon icon="mdi:paperclip" />{{ file.name }}
                  </span>
                  <button v-if="editable" type="button" class="evidence-remove" title="从当前项目移除" @click="removeEvidence(item, file)">
                    <VIcon icon="mdi:close" />
                  </button>
                </div>
                <span class="evidence-empty" v-if="!item.evidence_files?.length">暂无支撑材料</span>
              </div>

              <div class="item-objection" v-if="!editable && objectionMode">
                <template v-if="item.objection">
                  <strong>学生异议（{{ item.objection.status === 'pending' ? '待复评' : '已处理' }}）</strong>
                  <p>异议理由：{{ item.objection.reason }}</p>
                  <p v-if="item.objection.resolution">处理说明：{{ item.objection.resolution }}</p>
                </template>
                <template v-else-if="!objectionSubmitted">
                  <label class="objection-check" :class="{ disabled: !canRaiseObjection }">
                    <input
                      type="checkbox"
                      :checked="!!objectionSelections[item.id]"
                      :disabled="!canRaiseObjection"
                      @change="toggleObjection(item.id, $event.target.checked)"
                    />
                    <span>标记有异议</span>
                  </label>
                  <textarea
                    v-if="objectionSelections[item.id]"
                    class="objection-reason"
                    :value="objectionReasons[item.id] || ''"
                    placeholder="请填写该项异议理由（必填）"
                    @input="updateObjectionReason(item.id, $event.target.value)"
                  ></textarea>
                  <small v-else-if="!canRaiseObjection">当前不在可提交异议的时间范围内</small>
                </template>
                <span v-else class="objection-not-selected">本次异议申请未包含该项</span>
              </div>
            </div>
          </div>

          <div v-else class="empty-sub">
            <span>该子目录暂无加分项目或支撑材料</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { uploadStudentSupportMaterials } from '../../api/module3';
import { FORM_STRUCTURE } from '../../utils/constants';

const props = defineProps({
  form: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  objectionMode: { type: Boolean, default: false },
  canRaiseObjection: { type: Boolean, default: false },
  objectionSubmitted: { type: Boolean, default: false },
  objectionSelections: { type: Object, default: () => ({}) },
  objectionReasons: { type: Object, default: () => ({}) },
  showStudentInfo: { type: Boolean, default: true },
});

const emit = defineEmits(['update-objection-selection', 'update-objection-reason']);

const structure = FORM_STRUCTURE;
const uploadingEvidence = reactive({});
const evidenceNotices = reactive({});

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
          item.evidence_ids = item.evidence_ids || item.evidence_files.map(file => file.id);
          return item;
        })
    }))
  }));
});


function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function handleEvidenceUpload(item, event) {
  const input = event?.target;
  const files = Array.from(input?.files || []);
  if (input) input.value = '';
  if (!files.length) return;

  item.evidence_files = Array.isArray(item.evidence_files) ? item.evidence_files : [];
  item.evidence_ids = Array.isArray(item.evidence_ids) ? item.evidence_ids : item.evidence_files.map(file => file.id).filter(Boolean);
  const remaining = Math.max(0, 10 - item.evidence_files.length);
  if (!remaining) {
    evidenceNotices[item.id] = '每个综测项目最多添加 10 个支撑材料。';
    return;
  }
  if (files.length > remaining) {
    evidenceNotices[item.id] = `当前还可以添加 ${remaining} 个支撑材料，请重新选择。`;
    return;
  }

  const formData = new FormData();
  formData.append('batch_id', props.form.batch_id);
  files.forEach(file => formData.append('files', file));
  uploadingEvidence[item.id] = true;
  evidenceNotices[item.id] = '';
  try {
    const res = await uploadStudentSupportMaterials(formData);
    if (res.code !== 200) throw new Error(res.msg || '支撑材料上传失败');
    const uploaded = Array.isArray(res.data?.files) ? res.data.files : [];
    const knownIds = new Set(item.evidence_ids.map(Number));
    for (const file of uploaded) {
      if (knownIds.has(Number(file.id))) continue;
      item.evidence_files.push(file);
      item.evidence_ids.push(Number(file.id));
      knownIds.add(Number(file.id));
    }
    evidenceNotices[item.id] = `已添加 ${uploaded.length} 个支撑材料，请点击页面底部“保存修改”完成项目绑定。`;
  } catch (error) {
    evidenceNotices[item.id] = error?.response?.data?.msg || error?.message || '支撑材料上传失败';
  } finally {
    uploadingEvidence[item.id] = false;
  }
}

function removeEvidence(item, file) {
  item.evidence_files = (item.evidence_files || []).filter(current => Number(current.id) !== Number(file.id));
  item.evidence_ids = (item.evidence_ids || []).filter(id => Number(id) !== Number(file.id));
  evidenceNotices[item.id] = '已从当前项目移除该支撑材料，请保存修改。';
}

function toggleObjection(itemId, selected) {
  emit('update-objection-selection', { itemId, selected });
}

function updateObjectionReason(itemId, reason) {
  emit('update-objection-reason', { itemId, reason });
}

function childrenOf(sectionKey) {
  return structure.find(s => s.key === sectionKey)?.children || [];
}

function ensureSubKey(item) {
  const children = childrenOf(item.section);
  if (!children.some(child => child.key === item.subKey)) item.subKey = children[0]?.key || '';
}

function addItem(sectionKey, subKey) {
  if (!Array.isArray(props.form.items)) props.form.items = [];
  props.form.items.push({
    id: `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    section: sectionKey,
    subKey,
    title: '',
    reason: '',
    score: 0,
    evidence_ids: [],
    evidence_files: [],
    editable: true,
  });
}

function removeItem(item) {
  if (!Array.isArray(props.form.items)) return;
  const ok = window.confirm(`确定删除“${item.title || '未命名项目'}”吗？`);
  if (!ok) return;
  const index = props.form.items.findIndex(current => current.id === item.id);
  if (index >= 0) props.form.items.splice(index, 1);
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
.summary-card { padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); margin-bottom: 16px; }
.summary-title { font-weight: var(--font-weight-semibold); margin-bottom: 8px; }
.summary-text { color: var(--color-text-secondary); line-height: 1.7; }
.summary-textarea { width: 100%; min-height: 88px; resize: vertical; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary); padding: 10px; line-height: 1.6; }
.score-table { width: 100%; border-collapse: collapse; }
.score-table th, .score-table td { padding: 10px; border: 1px solid var(--color-border); text-align: left; font-size: 13px; }
.score-table th { color: var(--color-text-secondary); background: var(--color-bg); }
.total-row td { font-weight: var(--font-weight-semibold); }
.edit-tip { padding: 12px 14px; border-radius: var(--radius-lg); background: var(--color-bg); color: var(--color-text-secondary); line-height: 1.6; font-size: 13px; margin-bottom: 16px; }
.section-block { margin-top: 18px; }
.section-title { display: flex; align-items: baseline; gap: 8px; font-size: 18px; margin-bottom: 12px; }
.section-title small { color: var(--color-text-secondary); font-size: 13px; }
.sub-block { padding: 14px; margin-bottom: 12px; border-radius: var(--radius-lg); background: var(--color-bg); }
.sub-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
.sub-title { font-weight: var(--font-weight-semibold); }
.item-list { display: flex; flex-direction: column; gap: 10px; }
.item-card { padding: 12px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border); }
.item-edit-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; font-weight: var(--font-weight-semibold); }
.field-label { display: block; margin: 10px 0 6px; font-size: 12px; color: var(--color-text-secondary); }
.item-title { font-weight: var(--font-weight-semibold); }
.item-title span { color: var(--color-primary); }
.item-reason { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin-top: 6px; }
.item-review-result, .item-objection { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding: 10px; border-radius: var(--radius-md); background: var(--color-bg); font-size: 12px; }
.item-review-result > div { display: grid; gap: 4px; }
.item-review-result span, .item-review-result p, .item-objection p { color: var(--color-text-secondary); line-height: 1.5; }
.item-objection { background: rgba(245,158,11,.10); }

.evidence-editor { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border); }
.evidence-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.evidence-editor-head > div { display: flex; flex-direction: column; gap: 3px; }
.evidence-editor-head strong { font-size: 13px; }
.evidence-editor-head small, .evidence-notice { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.5; }
.evidence-notice { margin-top: 8px; color: var(--color-primary); }
.evidence-upload-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-surface); color: var(--color-primary); font-size: 12px; cursor: pointer; white-space: nowrap; }
.evidence-upload-btn input { display: none; }
.evidence-upload-btn.disabled { opacity: .55; cursor: not-allowed; }
.evidence-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.evidence-chip { display: inline-flex; align-items: center; min-width: 0; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-bg); overflow: hidden; }
.evidence-chip a, .evidence-file-name { display: inline-flex; align-items: center; gap: 5px; min-width: 0; padding: 5px 9px; color: var(--color-text-secondary); font-size: 12px; text-decoration: none; }
.evidence-chip a:hover { color: var(--color-primary); }
.evidence-chip a span { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evidence-chip a small { color: var(--color-text-tertiary); }
.evidence-remove { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; border: 0; border-left: 1px solid var(--color-border); background: transparent; color: var(--color-text-tertiary); cursor: pointer; }
.evidence-remove:hover { color: #ef4444; background: rgba(239,68,68,.08); }
.evidence-empty { color: var(--color-text-tertiary); font-size: 12px; }
.empty-sub { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--color-text-tertiary); font-size: 13px; }
.item-input, .item-textarea, .edit-row input, .edit-row select {
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg); color: var(--color-text-primary); padding: 8px; width: 100%;
}
.item-textarea { min-height: 72px; resize: vertical; }
.edit-row { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px; margin-top: 8px; }
.edit-row label { font-size: 12px; color: var(--color-text-secondary); }
.mini-btn, .danger-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; padding: 0 10px; border-radius: var(--radius-full); cursor: pointer; white-space: nowrap; }
.mini-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-primary); }
.danger-btn { border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); color: #ef4444; }
@media (max-width: 768px) {
  .student-grid, .edit-row { grid-template-columns: 1fr; }
  .score-table { font-size: 12px; }
  .sub-head, .empty-sub, .evidence-editor-head { flex-direction: column; align-items: stretch; }
  .evidence-upload-btn { width: fit-content; }
}

.item-objection { margin-top: 12px; padding: 12px; border-radius: var(--radius-lg); background: color-mix(in srgb, #f59e0b 9%, var(--color-surface)); border: 1px solid color-mix(in srgb, #f59e0b 25%, var(--color-border)); }
.item-objection strong { color: #d97706; font-size: 13px; }
.item-objection p { margin-top: 6px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; }
.objection-check { display: inline-flex; align-items: center; gap: 8px; color: var(--color-text-primary); font-size: 13px; font-weight: 600; cursor: pointer; }
.objection-check.disabled { color: var(--color-text-tertiary); cursor: not-allowed; }
.objection-check input { width: 16px; height: 16px; accent-color: var(--color-primary); }
.objection-reason { width: 100%; min-height: 82px; margin-top: 10px; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary); resize: vertical; }
.item-objection small, .objection-not-selected { display: block; margin-top: 7px; color: var(--color-text-tertiary); font-size: 12px; }
</style>
