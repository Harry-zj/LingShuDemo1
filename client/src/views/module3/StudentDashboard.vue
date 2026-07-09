<template>
  <div class="student-db">
    <div class="page-header">
      <div>
        <h2>我的综测</h2>
        <p class="page-desc">查看通知、提交材料、追踪审核状态，处理被退回材料</p>
      </div>
      <button class="btn-primary" @click="openCreate" :disabled="!activeBatch">
        <VIcon icon="mdi:plus" /> 新增加分申请
      </button>
    </div>

    <section class="summary-grid">
      <div class="deadline-card">
        <VIcon icon="mdi:clock-outline" class="deadline-icon" />
        <div class="deadline-info">
          <span class="deadline-label">当前批次</span>
          <strong>{{ activeBatch?.title || '暂无已发布批次' }}</strong>
          <span class="deadline-value">{{ deadlineText }}</span>
        </div>
      </div>
      <div class="notice-card glass-card">
        <div class="notice-title"><VIcon icon="mdi:bell-outline" /> 最新通知</div>
        <p v-if="notifications[0]">{{ notifications[0].content }}</p>
        <p v-else>暂无通知</p>
      </div>
    </section>

    <section class="form-card glass-card" v-if="showForm">
      <div class="panel-header">
        <h3><VIcon icon="mdi:file-edit-outline" />{{ form.id ? '修改材料' : '保存材料草稿' }}</h3>
        <button class="btn-text" @click="cancelEdit">关闭</button>
      </div>
      <div class="form-grid">
        <label>综测批次
          <select v-model="form.batch_id" :disabled="!!form.id">
            <option v-for="b in publishedBatches" :key="b.id" :value="b.id">{{ b.title }}</option>
          </select>
        </label>
        <label>材料类别
          <input v-model="form.category" placeholder="如：竞赛获奖、社会实践、荣誉称号" />
        </label>
        <label>材料标题
          <input v-model="form.title" placeholder="请输入加分申请标题" />
        </label>
        <label>申请分值
          <input v-model.number="form.score" type="number" min="0" step="0.1" />
        </label>
        <label class="span-2">申请说明
          <textarea v-model="form.application_text" rows="4" placeholder="说明获奖、活动、证明材料等情况"></textarea>
        </label>
        <label class="span-2">证明附件
          <input type="file" multiple @change="onFilesChange" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
          <span class="help-text">支持图片、PDF、Word、Excel；保存草稿后会自动上传选择的附件。</span>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-outline" @click="saveDraft">保存草稿</button>
        <button class="btn-primary" @click="saveAndSubmit">正式提交</button>
      </div>
    </section>

    <section class="my-materials glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:file-document-outline" />我的材料</h3>
        <span class="panel-count">{{ materials.length }} 项</span>
      </div>
      <div class="material-list">
        <article class="material-row" v-for="(m, i) in materials" :key="m.id" :style="{ animationDelay: (i * 0.04) + 's' }">
          <div class="row-main">
            <div class="row-title">
              <VIcon icon="mdi:file-document-outline" class="row-icon" />
              <strong>{{ m.title }}</strong>
              <span class="status-tag" :style="statusStyle(m.status)">{{ STATUS_MAP[m.status]?.label || m.status }}</span>
            </div>
            <p>{{ m.application_text || '暂无说明' }}</p>
            <div class="row-meta">
              <span>类别：{{ m.category || '未分类' }}</span>
              <span>分值：{{ m.score || 0 }}</span>
              <span>附件：{{ m.attachments?.length || 0 }} 个</span>
              <span v-if="m.submit_time">提交：{{ m.submit_time }}</span>
            </div>
            <div class="review-line" v-if="m.review_records?.length">
              最新意见：{{ m.review_records[0].comment || '无' }}
            </div>
          </div>
          <div class="row-actions">
            <button class="btn-outline small" v-if="canEdit(m)" @click="editMaterial(m)">修改</button>
            <button class="btn-primary small" v-if="canSubmit(m)" @click="submitExisting(m)">提交</button>
          </div>
        </article>
        <div class="empty-state" v-if="!materials.length">
          <VIcon icon="mdi:inbox-outline" class="empty-icon" />
          <p>暂无提交材料</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { getBatches, getMyMaterials, getNotifications } from '../../api/module3';
import { createMaterial, updateMaterial, submitMaterial, uploadFile } from '../../api/module1';
import { STATUS_MAP, statusStyle } from '../../utils/constants';

const batches = ref([]);
const materials = ref([]);
const notifications = ref([]);
const showForm = ref(false);
const pendingFiles = ref([]);
const form = reactive({ id: '', batch_id: '', title: '', category: '', score: 0, application_text: '' });

const publishedBatches = computed(() => batches.value.filter((b) => b.status === 'published'));
const activeBatch = computed(() => publishedBatches.value[0] || null);
const deadlineText = computed(() => {
  if (!activeBatch.value?.end_time) return '请等待老师发布综测批次';
  const days = Math.ceil((new Date(activeBatch.value.end_time) - new Date()) / 86400000);
  return days >= 0 ? `距离截止 ${days} 天` : '已超过截止时间';
});

function resetForm() {
  form.id = '';
  form.batch_id = activeBatch.value?.id || '';
  form.title = '';
  form.category = '';
  form.score = 0;
  form.application_text = '';
  pendingFiles.value = [];
}
function openCreate() { resetForm(); showForm.value = true; }
function cancelEdit() { showForm.value = false; resetForm(); }
function canEdit(m) { return ['draft', 'returned_by_class_leader', 'returned_by_teacher'].includes(m.status); }
function canSubmit(m) { return ['draft', 'returned_by_class_leader', 'returned_by_teacher'].includes(m.status); }
function onFilesChange(e) { pendingFiles.value = Array.from(e.target.files || []); }
function editMaterial(m) {
  form.id = m.id;
  form.batch_id = m.batch_id;
  form.title = m.title;
  form.category = m.category;
  form.score = Number(m.score || 0);
  form.application_text = m.application_text || '';
  pendingFiles.value = [];
  showForm.value = true;
}
async function load() {
  const [bRes, mRes, nRes] = await Promise.all([getBatches(), getMyMaterials(), getNotifications()]);
  if (bRes.code === 200) batches.value = bRes.data || [];
  if (mRes.code === 200) materials.value = mRes.data || [];
  if (nRes.code === 200) notifications.value = nRes.data || [];
  if (!form.batch_id) form.batch_id = activeBatch.value?.id || '';
}
async function uploadPendingFiles(materialId) {
  for (const file of pendingFiles.value) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('material_id', materialId);
    await uploadFile(fd);
  }
  pendingFiles.value = [];
}
async function persistMaterial() {
  if (!form.title || !form.batch_id) {
    alert('请填写批次和材料标题');
    return null;
  }
  const payload = { batch_id: form.batch_id, title: form.title, category: form.category, score: form.score, application_text: form.application_text };
  const res = form.id ? await updateMaterial(form.id, payload) : await createMaterial(payload);
  if (res.code !== 200) { alert(res.msg); return null; }
  await uploadPendingFiles(res.data.id);
  return res.data;
}
async function saveDraft() {
  const saved = await persistMaterial();
  if (!saved) return;
  alert('草稿已保存');
  showForm.value = false;
  await load();
}
async function saveAndSubmit() {
  const saved = await persistMaterial();
  if (!saved) return;
  const res = await submitMaterial(saved.id);
  alert(res.msg || '提交完成');
  showForm.value = false;
  await load();
}
async function submitExisting(m) {
  const res = await submitMaterial(m.id);
  alert(res.msg || '提交完成');
  await load();
}

onMounted(load);
</script>

<style scoped>
.student-db { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header, .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.summary-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
.deadline-card, .notice-card, .form-card, .my-materials { border-radius: var(--radius-xl); padding: 24px; }
.deadline-card { display: flex; align-items: center; gap: 14px; background: var(--color-warning-bg); border: 1px solid rgba(217,119,6,0.15); }
.deadline-icon { font-size: 28px; color: var(--color-warning); }
.deadline-info { display: flex; flex-direction: column; gap: 4px; }
.deadline-label, .deadline-value, .help-text { font-size: 13px; color: var(--color-text-secondary); }
.notice-title, .panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.notice-card p { margin-top: 10px; color: var(--color-text-secondary); font-size: 14px; }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 16px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
.span-2 { grid-column: span 2; }
input, select, textarea { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 12px; background: var(--color-white); color: var(--color-text); outline: none; }
textarea { resize: vertical; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.btn-primary, .btn-outline, .btn-text { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 18px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-spring); }
.btn-primary { border: none; background: var(--color-primary-gradient); color: #fff; box-shadow: var(--shadow-level-1); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-white); color: var(--color-text); }
.btn-text { border: none; background: transparent; color: var(--color-primary); padding: 6px 10px; }
.small { padding: 7px 12px; font-size: 12px; }
.material-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.material-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-white); opacity: 0; animation: fadeInUp 0.4s var(--easing-spring) forwards; }
.row-main { flex: 1; }
.row-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.row-icon { color: var(--color-primary); }
.status-tag { font-size: 12px; padding: 3px 10px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.row-main p { margin: 8px 0; font-size: 14px; color: var(--color-text-secondary); }
.row-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--color-text-tertiary); }
.review-line { margin-top: 8px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-warning-bg); color: var(--color-warning); font-size: 13px; }
.row-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.empty-state { text-align: center; padding: 40px 16px; color: var(--color-text-tertiary); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }
@media (max-width: 768px) { .summary-grid, .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } .material-row { flex-direction: column; } .row-actions { justify-content: flex-end; } }
</style>
