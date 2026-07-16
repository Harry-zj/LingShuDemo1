<template>
  <div class="assessment-wrapper" v-if="form">
    <section class="assessment-document glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:file-word-outline" />综测表</h3>
        <span class="panel-count">{{ form.word_document ? '来自智能填表' : '尚未生成' }}</span>
      </div>
      <div class="student-grid" v-if="showStudentInfo">
        <span>学号：{{ form.student_no }}</span>
        <span>姓名：{{ form.student_name }}</span>
        <span>学院：{{ form.college }}</span>
        <span>班级：{{ form.class_name }}</span>
        <span>年级：{{ form.enrollment_grade || form.grade }}</span>
        <span>专业：{{ form.major }}</span>
      </div>
      <div class="score-summary">
        <div><span>F1 基本素质</span><strong>{{ displayScores.f1_basic_quality }}</strong><small>/ {{ form.score_limits?.F1 ?? 100 }}</small></div>
        <div><span>F2 课程成绩</span><strong>{{ displayScores.f2_course_learning }}</strong><small>/ {{ form.score_limits?.F2 ?? 100 }}</small></div>
        <div><span>F3 创新实践</span><strong>{{ displayScores.f3_innovation_practice }}</strong><small>/ {{ form.score_limits?.F3 ?? 100 }}</small></div>
        <div class="total"><span>综合总分</span><strong>{{ displayScores.total }}</strong><small>{{ displayLevel }}</small></div>
      </div>
      <p class="score-formula">综合总分 = F1 × 10% + F2 × 65% + F3 × 25%，等级由计算结果自动认定。</p>
      <WordPreviewWindow :form-id="form.id" :document="form.word_document" />
    </section>

    <section class="assessment-materials">
      <div class="materials-header">
        <div>
          <h3><VIcon icon="mdi:format-list-bulleted-square" />F1 / F2 / F3 综测明细</h3>
          <p>先通过概览卡片了解各大项状态，再展开需要填写或核对的详细内容。</p>
        </div>
        <span class="panel-count">明细数据来自智能填表数据库</span>
      </div>

      <div v-if="editable" class="edit-tip">
        卡片会实时显示项目数量、填写进度与当前得分。未保存的输入在展开和收起时不会丢失。
      </div>

      <div class="section-overview-toolbar">
        <span>点击卡片切换大项，同时仅展开一个大项</span>
        <button type="button" :disabled="!expandedSections.size" @click="collapseAllSections"><VIcon icon="mdi:unfold-less-horizontal" />收起当前</button>
      </div>

      <div class="section-overview-grid">
        <button
          type="button"
          class="section-overview-card glass-card"
          :class="[`section-${section.key.toLowerCase()}`, { active: isSectionExpanded(section.key), warning: sectionNeedsAttention(section) }]"
          v-for="section in localGrouped"
          :key="`overview-${section.key}`"
          :aria-expanded="isSectionExpanded(section.key)"
          @click="toggleSection(section.key)"
        >
          <div class="overview-card-top">
            <span class="section-code">{{ section.key }}</span>
            <span class="overview-status" :class="{ warning: sectionNeedsAttention(section) }">{{ sectionStatusLabel(section) }}</span>
          </div>
          <div class="overview-copy">
            <h3>{{ section.shortTitle }}</h3>
            <p>{{ section.description }}</p>
          </div>
          <div class="overview-stats">
            <span><strong>{{ sectionItemCount(section) }}</strong><small>项目</small></span>
            <span><strong>{{ sectionEvidenceCount(section) }}</strong><small>材料</small></span>
            <span><strong>{{ sectionDisplayScore(section.key) }}</strong><small>/ {{ form.score_limits?.[section.key] ?? 100 }} 分</small></span>
          </div>
          <div class="overview-progress" :aria-label="sectionProgressLabel(section)">
            <span><i :style="{ width: `${sectionCompletionPercent(section)}%` }"></i></span>
            <small>{{ sectionProgressLabel(section) }}</small>
          </div>
          <div class="overview-action">
            <span>{{ isSectionExpanded(section.key) ? '收起详细内容' : (editable ? '展开填写' : '查看详细内容') }}</span>
            <VIcon :icon="isSectionExpanded(section.key) ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          </div>
        </button>
      </div>

      <div class="section-detail-list">
        <section
          v-for="section in localGrouped"
          v-show="isSectionExpanded(section.key)"
          :key="`detail-${section.key}`"
          class="section-block glass-card"
          :class="`section-${section.key.toLowerCase()}`"
        >
          <div class="section-heading">
            <span class="section-code">{{ section.key }}</span>
            <div class="section-heading-copy">
              <h3 class="section-title">{{ section.title }}</h3>
              <small>{{ section.weight }}</small>
            </div>
            <div class="section-score">
              <span>当前得分</span>
              <strong>{{ sectionDisplayScore(section.key) }}</strong>
              <small>/ {{ form.score_limits?.[section.key] ?? 100 }}</small>
            </div>
            <button type="button" class="section-close-btn" title="收起该大项" @click="toggleSection(section.key)">
              <VIcon icon="mdi:chevron-up" />
            </button>
          </div>

          <div class="sub-block" v-for="child in section.children" :key="child.key">
            <div class="sub-head">
              <div class="sub-identity">
                <span class="sub-code">{{ child.key }}</span>
                <div>
                  <div class="sub-title">{{ child.title }}</div>
                  <small>{{ child.items.length }} 个项目 · 每个项目独立展示</small>
                </div>
              </div>
              <button v-if="editable" class="mini-btn" @click="addItem(section.key, child.key)">
                <VIcon icon="mdi:plus" />新增项目
              </button>
            </div>

            <div v-if="child.items.length" class="item-list">
              <div class="item-card" v-for="(item, itemIndex) in child.items" :key="item.id">
                <div class="item-location-head">
                  <span class="item-order">{{ itemIndex + 1 }}</span>
                  <span class="item-location-copy">
                    <strong>第 {{ itemIndex + 1 }} 项</strong>
                    <small>{{ child.key }} · {{ child.title }}</small>
                  </span>
                  <button v-if="editable" class="danger-btn" @click="removeItem(item)">
                    <VIcon icon="mdi:trash-can-outline" />删除
                  </button>
                </div>

                <template v-if="editable">

                  <label class="field-label">项目名称</label>
                  <input v-model="item.title" class="item-input" placeholder="请输入加分项目名称" />

                  <label class="field-label">计分理由 / 内容说明</label>
                  <textarea v-model="item.reason" class="item-textarea" placeholder="请输入计分理由或内容说明"></textarea>

                  <div class="edit-row">
                    <label>分值
                      <input type="number" min="0" :max="editableScoreMax(item)" step="0.1" v-model.number="item.score" @input="clampEditableScore(item)" />
                      <small class="score-limit-hint">本分类剩余上限 {{ editableScoreMax(item) }} 分</small>
                    </label>
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
        </section>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { uploadStudentSupportMaterials } from '../../api/module3';
import { FORM_STRUCTURE } from '../../utils/constants';
import { calculateFormScores, calculateLevel, scoreLimitForItem } from '../../utils/scorePolicy';
import WordPreviewWindow from './WordPreviewWindow.vue';

const props = defineProps({
  form: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  objectionMode: { type: Boolean, default: false },
  canRaiseObjection: { type: Boolean, default: false },
  objectionSubmitted: { type: Boolean, default: false },
  objectionSelections: { type: Object, default: () => ({}) },
  objectionReasons: { type: Object, default: () => ({}) },
  showStudentInfo: { type: Boolean, default: true },
  startCollapsed: { type: Boolean, default: false },
});

const emit = defineEmits(['update-objection-selection', 'update-objection-reason']);

const structure = FORM_STRUCTURE;
const uploadingEvidence = reactive({});
const evidenceNotices = reactive({});
const expandedSections = ref(new Set());
let expandedContext = '';

const SECTION_META = {
  F1: {
    shortTitle: '基本素质',
    weight: '占综合总分 10%',
    description: '思想政治、道德修养、学习作风、纪律与身心素质',
  },
  F2: {
    shortTitle: '课程成绩',
    weight: '占综合总分 65%',
    description: '课程学习成绩及相关认定结果',
  },
  F3: {
    shortTitle: '创新实践',
    weight: '占综合总分 25%',
    description: '技能竞赛、科研学术、社会实践、文体劳育等',
  },
};

const displayScores = computed(() => props.editable
  ? calculateFormScores(props.form.items || [], props.form.score_limits)
  : (props.form.scores || calculateFormScores(props.form.items || [], props.form.score_limits)));
const displayLevel = computed(() => calculateLevel(displayScores.value.total, props.form.grade_rules));

function sectionDisplayScore(sectionKey) {
  const keyMap = {
    F1: 'f1_basic_quality',
    F2: 'f2_course_learning',
    F3: 'f3_innovation_practice',
  };
  return displayScores.value?.[keyMap[sectionKey]] ?? 0;
}

const localGrouped = computed(() => {
  const groupedSource = props.form.grouped_items || [];
  const oldItems = groupedSource
    .flatMap(section => section.children || [])
    .flatMap(child => child.items || []);

  return structure.map(section => {
    const sourceSection = groupedSource.find(current => current.key === section.key) || {};
    return {
      ...section,
      ...SECTION_META[section.key],
      title: sourceSection.title || section.title,
      children: section.children.map(child => {
        const sourceChild = (sourceSection.children || []).find(current => current.key === child.key) || {};
        const items = props.editable
          ? (props.form.items || [])
              .filter(item => item.section === section.key && item.subKey === child.key)
              .map(item => {
                item.evidence_files = oldItems.find(old => old.id === item.id)?.evidence_files || item.evidence_files || [];
                item.evidence_ids = item.evidence_ids || item.evidence_files.map(file => file.id);
                return item;
              })
          : (sourceChild.items || []);
        return { ...child, ...sourceChild, title: sourceChild.title || child.title, items };
      }),
    };
  });
});

watch(localGrouped, groups => {
  const context = `${props.form?.id ?? 'form'}:${props.editable}:${props.objectionMode}:${props.startCollapsed}`;
  if (context === expandedContext) return;
  expandedContext = context;
  if (props.startCollapsed) {
    expandedSections.value = new Set();
    return;
  }
  const objectionSection = props.objectionMode
    ? groups.find(section => sectionItems(section).some(item => item.objection || props.objectionSelections[item.id]))
    : null;
  const incompleteSection = props.editable
    ? groups.find(section => sectionItemCount(section) > sectionCompletedCount(section))
    : null;
  const firstWithItems = groups.find(section => sectionItemCount(section) > 0);
  const initial = objectionSection || incompleteSection || firstWithItems || groups[0];
  expandedSections.value = new Set(initial ? [initial.key] : []);
}, { immediate: true });


function sectionItems(section) {
  return (section.children || []).flatMap(child => child.items || []);
}

function sectionItemCount(section) {
  return sectionItems(section).length;
}

function sectionEvidenceCount(section) {
  return sectionItems(section).reduce((sum, item) => sum + (item.evidence_files?.length || 0), 0);
}

function itemIsComplete(item) {
  if (!props.editable) return true;
  const score = Number(item.score);
  return Boolean(
    String(item.title || '').trim()
    && String(item.reason || '').trim()
    && item.section
    && item.subKey
    && Number.isFinite(score)
    && score >= 0
  );
}

function sectionCompletedCount(section) {
  return sectionItems(section).filter(itemIsComplete).length;
}

function sectionCompletionPercent(section) {
  const total = sectionItemCount(section);
  if (!total) return 0;
  return Math.round((sectionCompletedCount(section) / total) * 100);
}

function sectionNeedsAttention(section) {
  return props.editable && sectionItemCount(section) > sectionCompletedCount(section);
}

function sectionStatusLabel(section) {
  const total = sectionItemCount(section);
  if (!total) return '暂无项目';
  if (sectionNeedsAttention(section)) return `待完善 ${total - sectionCompletedCount(section)} 项`;
  if (props.objectionMode) {
    const count = sectionItems(section).filter(item => item.objection || props.objectionSelections[item.id]).length;
    if (count) return `${count} 项异议`;
  }
  return props.editable ? '填写完整' : `共 ${total} 项`;
}

function sectionProgressLabel(section) {
  const total = sectionItemCount(section);
  if (!total) return '尚未添加项目';
  if (!props.editable) return `${total} 个项目`;
  return `已填写 ${sectionCompletedCount(section)} / ${total} 项`;
}

function isSectionExpanded(sectionKey) {
  return expandedSections.value.has(sectionKey);
}

function toggleSection(sectionKey) {
  expandedSections.value = expandedSections.value.has(sectionKey)
    ? new Set()
    : new Set([sectionKey]);
}

function collapseAllSections() {
  expandedSections.value = new Set();
}


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

function editableScoreMax(item) {
  const groupLimit = scoreLimitForItem(item.section, item.subKey, props.form.score_limits);
  const otherTotal = (props.form.items || [])
    .filter(current => current !== item && current.section === item.section && current.subKey === item.subKey)
    .reduce((sum, current) => sum + Math.max(Number(current.score || 0), 0), 0);
  return Number(Math.max(groupLimit - otherTotal, 0).toFixed(2));
}

function clampEditableScore(item) {
  const max = editableScoreMax(item);
  const value = Number(item.score || 0);
  item.score = Number(Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), max).toFixed(2));
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
.assessment-document, .section-block { padding: 20px; border-radius: 8px !important; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { font-size: 13px; color: var(--color-text-secondary); }
.assessment-materials { display: flex; flex-direction: column; gap: 16px; }
.materials-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 0 2px; }
.materials-header h3 { display: flex; align-items: center; gap: 8px; font-size: 17px; }
.materials-header p { margin-top: 5px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.student-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.student-grid span { padding: 8px 10px; border-radius: 8px !important; background: var(--color-bg); font-size: 13px; }
.score-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.score-summary > div { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 4px 8px; padding: 12px; background: var(--color-bg); }
.score-summary span { grid-column: 1 / -1; color: var(--color-text-secondary); font-size: 12px; }
.score-summary strong { font-size: 22px; color: var(--color-primary); }
.score-summary small { color: var(--color-text-tertiary); }
.score-summary .total { background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg)); }
.score-formula { margin: -6px 0 16px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; }
.edit-tip { padding: 12px 14px; border-radius: 8px !important; background: var(--color-bg); color: var(--color-text-secondary); line-height: 1.6; font-size: 13px; }
.section-overview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--color-text-secondary); font-size: 12px; }
.section-overview-toolbar button, .section-close-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 34px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
.section-overview-toolbar button:hover, .section-close-btn:hover { color: var(--color-primary); border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border)); }
.section-overview-toolbar button:disabled { opacity: .45; cursor: not-allowed; }
.section-overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.section-overview-card { --section-accent: var(--color-primary); position: relative; display: flex; flex-direction: column; min-width: 0; padding: 18px; overflow: hidden; border: 1px solid var(--color-border); border-top: 3px solid var(--section-accent); text-align: left; color: var(--color-text-primary); cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.section-overview-card.section-f1 { --section-accent: #2563eb; }
.section-overview-card.section-f2 { --section-accent: #059669; }
.section-overview-card.section-f3 { --section-accent: #d97706; }
.section-overview-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--section-accent) 40%, var(--color-border)); box-shadow: 0 10px 24px rgba(15, 23, 42, .08); }
.section-overview-card.active { border-color: color-mix(in srgb, var(--section-accent) 58%, var(--color-border)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--section-accent) 12%, transparent); }
.section-overview-card.warning::after { content: ''; position: absolute; right: 0; top: 0; width: 7px; height: 7px; border-radius: 50% !important; margin: 10px; background: #f59e0b; }
.overview-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.overview-status { max-width: 62%; padding: 4px 8px; border-radius: 999px !important; background: color-mix(in srgb, var(--section-accent) 10%, var(--color-bg)); color: var(--section-accent); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.overview-status.warning { background: rgba(245, 158, 11, .12); color: #b45309; }
.overview-copy { min-height: 78px; margin-top: 14px; }
.overview-copy h3 { font-size: 18px; }
.overview-copy p { margin-top: 6px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.55; }
.overview-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
.overview-stats span { display: flex; flex-direction: column; min-width: 0; }
.overview-stats strong { color: var(--section-accent); font-size: 18px; line-height: 1.2; }
.overview-stats small { margin-top: 3px; color: var(--color-text-tertiary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.overview-progress { display: grid; gap: 6px; margin-top: 12px; }
.overview-progress > span { height: 5px; overflow: hidden; border-radius: 999px !important; background: var(--color-bg); }
.overview-progress i { display: block; height: 100%; border-radius: inherit !important; background: var(--section-accent); transition: width .2s ease; }
.overview-progress small { color: var(--color-text-secondary); font-size: 11px; }
.overview-action { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 12px; color: var(--section-accent); font-size: 12px; font-weight: 600; }
.section-detail-list { display: flex; flex-direction: column; gap: 16px; }
.section-block { --section-accent: var(--color-primary); position: relative; overflow: hidden; border-top: 3px solid var(--section-accent); }
.section-block.section-f1 { --section-accent: #2563eb; }
.section-block.section-f2 { --section-accent: #059669; }
.section-block.section-f3 { --section-accent: #d97706; }
.section-heading { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; margin-bottom: 14px; border-bottom: 1px solid var(--color-border); }
.section-close-btn { flex: 0 0 auto; width: 34px; padding: 0; }
.section-code { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px !important; background: color-mix(in srgb, var(--section-accent) 12%, var(--color-surface)); color: var(--section-accent); font-weight: 800; letter-spacing: .04em; flex: 0 0 auto; }
.section-heading-copy { min-width: 0; flex: 1; }
.section-title { font-size: 18px; line-height: 1.4; }
.section-heading-copy small { display: block; margin-top: 3px; color: var(--color-text-secondary); font-size: 13px; }
.section-score { display: grid; grid-template-columns: auto auto auto; align-items: baseline; gap: 4px; color: var(--color-text-secondary); font-size: 12px; }
.section-score span { grid-column: 1 / -1; text-align: right; }
.section-score strong { color: var(--section-accent); font-size: 22px; }
.section-score small { color: var(--color-text-tertiary); }
.sub-block { margin-bottom: 20px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--section-accent) 24%, var(--color-border)); border-radius: 10px !important; background: var(--color-surface); box-shadow: 0 8px 20px rgba(15, 23, 42, .055); }
.sub-block:last-child { margin-bottom: 0; }
.sub-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 15px 16px; margin-bottom: 0; border-bottom: 1px solid color-mix(in srgb, var(--section-accent) 18%, var(--color-border)); background: color-mix(in srgb, var(--section-accent) 7%, var(--color-surface)); }
.sub-identity { display: flex; align-items: center; gap: 11px; min-width: 0; }
.sub-code { display: grid; place-items: center; min-width: 42px; height: 34px; padding: 0 8px; border-radius: 7px !important; background: var(--section-accent); color: #fff; font-size: 13px; font-weight: 900; letter-spacing: .05em; }
.sub-title { font-weight: 800; line-height: 1.4; }
.sub-identity small { display: block; margin-top: 3px; color: var(--color-text-secondary); font-size: 11px; }
.item-list { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: color-mix(in srgb, var(--color-bg) 74%, transparent); }
.item-card { position: relative; padding: 16px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--section-accent) 20%, var(--color-border)); border-left: 4px solid var(--section-accent); border-radius: 9px !important; background: var(--color-surface); box-shadow: 0 5px 14px rgba(15, 23, 42, .05); }
.item-card + .item-card { margin-top: 2px; }
.item-location-head { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; margin-bottom: 14px; border-bottom: 1px dashed color-mix(in srgb, var(--section-accent) 24%, var(--color-border)); }
.item-order { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50% !important; background: color-mix(in srgb, var(--section-accent) 14%, var(--color-bg)); color: var(--section-accent); font-size: 13px; font-weight: 900; }
.item-location-copy { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.item-location-copy strong { font-size: 13px; }
.item-location-copy small { color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.field-label { display: block; margin: 10px 0 6px; font-size: 12px; color: var(--color-text-secondary); }
.item-title { font-weight: var(--font-weight-semibold); }
.item-title span { color: var(--color-primary); }
.item-reason { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin-top: 6px; }
.item-review-result, .item-objection { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding: 10px; border-radius: 8px !important; background: var(--color-bg); font-size: 12px; }
.item-review-result > div { display: grid; gap: 4px; }
.item-review-result span, .item-review-result p, .item-objection p { color: var(--color-text-secondary); line-height: 1.5; }
.item-objection { background: rgba(245,158,11,.10); }

.evidence-editor { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border); }
.evidence-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.evidence-editor-head > div { display: flex; flex-direction: column; gap: 3px; }
.evidence-editor-head strong { font-size: 13px; }
.evidence-editor-head small, .evidence-notice { color: var(--color-text-tertiary); font-size: 12px; line-height: 1.5; }
.evidence-notice { margin-top: 8px; color: var(--color-primary); }
.evidence-upload-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-primary); font-size: 12px; cursor: pointer; white-space: nowrap; }
.evidence-upload-btn input { display: none; }
.evidence-upload-btn.disabled { opacity: .55; cursor: not-allowed; }
.evidence-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.evidence-chip { display: inline-flex; align-items: center; min-width: 0; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-bg); overflow: hidden; }
.evidence-chip a, .evidence-file-name { display: inline-flex; align-items: center; gap: 5px; min-width: 0; padding: 5px 9px; color: var(--color-text-secondary); font-size: 12px; text-decoration: none; }
.evidence-chip a:hover { color: var(--color-primary); }
.evidence-chip a span { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evidence-chip a small { color: var(--color-text-tertiary); }
.evidence-remove { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; border: 0; border-left: 1px solid var(--color-border); background: transparent; color: var(--color-text-tertiary); cursor: pointer; }
.evidence-remove:hover { color: #ef4444; background: rgba(239,68,68,.08); }
.evidence-empty { color: var(--color-text-tertiary); font-size: 12px; }
.empty-sub { display: flex; align-items: center; justify-content: center; min-height: 76px; padding: 18px 16px; color: var(--color-text-tertiary); background: color-mix(in srgb, var(--color-bg) 74%, transparent); font-size: 13px; text-align: center; }
.item-input, .item-textarea, .edit-row input, .edit-row select {
  border: 1px solid var(--color-border); border-radius: 8px !important;
  background: var(--color-bg); color: var(--color-text-primary); padding: 8px; width: 100%;
}
.item-textarea { min-height: 72px; resize: vertical; }
.edit-row { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px; margin-top: 8px; }
.edit-row label { font-size: 12px; color: var(--color-text-secondary); }
.score-limit-hint { display: block; margin-top: 4px; color: var(--color-text-tertiary); line-height: 1.4; }
.mini-btn, .danger-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 30px; padding: 0 10px; border-radius: 8px !important; cursor: pointer; white-space: nowrap; }
.mini-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-primary); }
.danger-btn { border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); color: #ef4444; }
@media (max-width: 960px) { .section-overview-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .student-grid, .score-summary, .edit-row { grid-template-columns: 1fr; }
  .score-table { font-size: 12px; }
  .materials-header, .section-heading, .sub-head, .empty-sub, .evidence-editor-head { flex-direction: column; align-items: stretch; }
  .section-score { align-self: flex-start; }
  .section-score span { text-align: left; }
  .evidence-upload-btn { width: fit-content; }
}

.item-objection { margin-top: 12px; padding: 12px; border-radius: 8px !important; background: color-mix(in srgb, #f59e0b 9%, var(--color-surface)); border: 1px solid color-mix(in srgb, #f59e0b 25%, var(--color-border)); }
.item-objection strong { color: #d97706; font-size: 13px; }
.item-objection p { margin-top: 6px; color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; }
.objection-check { display: inline-flex; align-items: center; gap: 8px; color: var(--color-text-primary); font-size: 13px; font-weight: 600; cursor: pointer; }
.objection-check.disabled { color: var(--color-text-tertiary); cursor: not-allowed; }
.objection-check input { width: 16px; height: 16px; accent-color: var(--color-primary); }
.objection-reason { width: 100%; min-height: 82px; margin-top: 10px; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); resize: vertical; }
.item-objection small, .objection-not-selected { display: block; margin-top: 7px; color: var(--color-text-tertiary); font-size: 12px; }

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
