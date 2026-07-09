<template>
  <div class="batch-manage">
    <div class="page-header">
      <div>
        <h2>综测批次管理</h2>
        <p class="page-desc">老师可创建、发布、关闭和归档综测批次，并设置提交时间、说明和材料要求</p>
      </div>
      <button class="btn-primary" @click="openCreate"><VIcon icon="mdi:plus" />新建批次</button>
    </div>

    <section class="form-card glass-card" v-if="showForm">
      <div class="panel-header">
        <h3><VIcon icon="mdi:layers-plus" />{{ form.id ? '编辑批次' : '新建综测批次' }}</h3>
        <button class="btn-text" @click="closeForm">关闭</button>
      </div>
      <div class="form-grid">
        <label>批次名称<input v-model="form.title" placeholder="如：2025-2026学年综合测评" /></label>
        <label>状态
          <select v-model="form.status">
            <option value="draft">草稿</option>
            <option value="published">发布</option>
            <option value="closed">关闭</option>
            <option value="archived">归档</option>
          </select>
        </label>
        <label>开始时间<input v-model="form.start_time" type="datetime-local" /></label>
        <label>截止时间<input v-model="form.end_time" type="datetime-local" /></label>
        <label class="span-2">批次说明<textarea v-model="form.description" rows="3" placeholder="说明本次综测范围、对象、流程"></textarea></label>
        <label class="span-2">材料要求<textarea v-model="form.requirements" rows="4" placeholder="填写加分申请、附件清晰度、证明材料格式等要求"></textarea></label>
      </div>
      <div class="form-actions">
        <button class="btn-outline" @click="closeForm">取消</button>
        <button class="btn-primary" @click="saveBatch">保存</button>
      </div>
    </section>

    <section class="batch-list glass-card">
      <div class="panel-header"><h3><VIcon icon="mdi:layers-outline" />批次列表</h3><span class="panel-count">{{ batches.length }} 个</span></div>
      <article class="batch-row" v-for="b in batches" :key="b.id">
        <div class="batch-main">
          <div class="batch-title"><strong>{{ b.title }}</strong><span class="status-tag" :style="batchStyle(b.status)">{{ BATCH_STATUS_MAP[b.status]?.label || b.status }}</span></div>
          <p>{{ b.description || '暂无说明' }}</p>
          <div class="meta-line"><span>开始：{{ b.start_time }}</span><span>截止：{{ b.end_time }}</span></div>
          <div class="requirements">{{ b.requirements || '暂无材料要求' }}</div>
        </div>
        <div class="row-actions">
          <button class="btn-outline small" @click="editBatch(b)">编辑</button>
          <button class="btn-outline small" v-if="b.status !== 'published'" @click="changeStatus(b, 'published')">发布</button>
          <button class="btn-outline small" v-if="b.status === 'published'" @click="changeStatus(b, 'closed')">关闭</button>
          <button class="btn-outline small" v-if="b.status !== 'archived'" @click="changeStatus(b, 'archived')">归档</button>
        </div>
      </article>
    </section>

    <section class="class-card glass-card">
      <div class="panel-header"><h3><VIcon icon="mdi:account-group-outline" />班级与班干部</h3></div>
      <article class="class-row" v-for="c in classes" :key="c.id">
        <div>
          <strong>{{ c.name }}</strong>
          <p>{{ c.grade }} · {{ c.major }} · {{ c.student_count }} 名学生 · 班干部：{{ c.leader_name || '未设置' }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { BATCH_STATUS_MAP } from '../../utils/constants';
import { createBatch, getBatches, getClasses, updateBatch, updateBatchStatus } from '../../api/module3';

const batches = ref([]);
const classes = ref([]);
const showForm = ref(false);
const form = reactive({ id: '', title: '', description: '', start_time: '', end_time: '', status: 'draft', requirements: '' });

function toInputDate(v) { return v ? String(v).replace(' ', 'T').slice(0, 16) : ''; }
function toServerDate(v) { return v ? String(v).replace('T', ' ') + ':00'.slice(String(v).length > 16 ? 3 : 0) : ''; }
function batchStyle(status) { const m = BATCH_STATUS_MAP[status]; return m ? { background: m.bg, color: m.color } : {}; }
function resetForm() { Object.assign(form, { id: '', title: '', description: '', start_time: '', end_time: '', status: 'draft', requirements: '' }); }
function openCreate() { resetForm(); showForm.value = true; }
function closeForm() { showForm.value = false; resetForm(); }
function editBatch(b) {
  Object.assign(form, { ...b, start_time: toInputDate(b.start_time), end_time: toInputDate(b.end_time) });
  showForm.value = true;
}
async function load() {
  const [bRes, cRes] = await Promise.all([getBatches(), getClasses()]);
  if (bRes.code === 200) batches.value = bRes.data || [];
  if (cRes.code === 200) classes.value = cRes.data || [];
}
async function saveBatch() {
  if (!form.title || !form.start_time || !form.end_time) return alert('请填写批次名称、开始时间和截止时间');
  const payload = { ...form, start_time: toServerDate(form.start_time), end_time: toServerDate(form.end_time) };
  const res = form.id ? await updateBatch(form.id, payload) : await createBatch(payload);
  alert(res.msg || '保存完成');
  if (res.code === 200) { closeForm(); await load(); }
}
async function changeStatus(b, status) {
  const res = await updateBatchStatus(b.id, { status });
  alert(res.msg || '状态已更新');
  await load();
}

onMounted(load);
</script>

<style scoped>
.batch-manage { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header, .panel-header, .batch-title, .meta-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.form-card, .batch-list, .class-card { border-radius: var(--radius-xl); padding: 24px; }
.panel-header { margin-bottom: 16px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: var(--font-weight-semibold); }
.panel-count, .meta-line, .class-row p { font-size: 12px; color: var(--color-text-secondary); }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--color-text-secondary); }
.span-2 { grid-column: span 2; }
input, select, textarea { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 12px; background: var(--color-white); color: var(--color-text); outline: none; }
textarea { resize: vertical; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.btn-primary, .btn-outline, .btn-text { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 18px; border-radius: var(--radius-full); font-size: 14px; font-weight: var(--font-weight-medium); cursor: pointer; transition: all var(--duration-fast) var(--easing-spring); }
.btn-primary { border: none; background: var(--color-primary-gradient); color: #fff; box-shadow: var(--shadow-level-1); }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-white); color: var(--color-text); }
.btn-text { border: none; background: transparent; color: var(--color-primary); padding: 6px 10px; }
.small { padding: 7px 12px; font-size: 12px; }
.batch-row, .class-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-white); margin-bottom: 10px; }
.batch-main { flex: 1; }
.batch-main p { margin: 8px 0; color: var(--color-text-secondary); font-size: 14px; }
.requirements { margin-top: 10px; padding: 10px; border-radius: var(--radius-md); background: var(--color-gray-bg); color: var(--color-text-secondary); font-size: 13px; }
.status-tag { font-size: 12px; padding: 3px 10px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.row-actions { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } .batch-row, .class-row { flex-direction: column; } }
</style>
