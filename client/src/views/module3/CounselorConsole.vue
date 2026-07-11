<template>
  <div class="counselor-console">
    <div class="page-header">
      <h2>辅导员工作台</h2>
      <p class="page-desc">设置管辖范围、查看学生完整信息，并动态赋予或撤销综测成员身份</p>
    </div>

    <div class="panel-card glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:map-marker-radius-outline" />管辖范围设置</h3>
        <span class="panel-count">学院和年级必选，班级可多选；不选班级默认全部班级</span>
      </div>
      <div class="form-grid">
        <select v-model="draftScope.college">
          <option value="">选择学院</option>
          <option v-for="college in options.colleges" :key="college" :value="college">{{ college }}</option>
        </select>
        <select v-model="draftScope.grade">
          <option value="">选择年级</option>
          <option v-for="grade in options.grades" :key="grade" :value="grade">{{ grade }}</option>
        </select>
        <select v-model="draftScope.class_ids" multiple>
          <option v-for="cls in scopeClasses" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
        </select>
      </div>
      <div class="scope-actions">
        <button class="btn-primary" @click="confirmScopeChange"><VIcon icon="mdi:check-circle-outline" />确定修改</button>
        <span class="scope-tip">选择学院、年级或班级后，点击“确定修改”才会生效。</span>
      </div>
    </div>

    <div class="panel-card glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:account-group-outline" />管辖范围内学生</h3>
        <span class="panel-count">{{ filteredStudents.length }} / {{ students.length }} 人</span>
      </div>
      <div class="search-bar">
        <VIcon icon="mdi:magnify" />
        <input v-model.trim="studentKeyword" placeholder="按姓名、学号、班级模糊搜索" />
      </div>
      <table>
        <thead>
          <tr>
            <th>学号</th><th>姓名</th><th>学院</th><th>年级</th><th>班级</th><th>综测成员</th><th>综测状态</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in filteredStudents" :key="student.id">
            <td>{{ student.student_no }}</td>
            <td>{{ student.real_name }}</td>
            <td>{{ student.college }}</td>
            <td>{{ student.enrollment_grade || student.grade }}</td>
            <td>{{ student.class_name }}</td>
            <td><span class="tag" :class="{ active: student.is_assessment_member }">{{ student.is_assessment_member ? '是' : '否' }}</span></td>
            <td>{{ student.latest_status_label }}</td>
            <td>
              <button class="btn-outline small" @click="toggleMember(student)">
                {{ student.is_assessment_member ? '撤销身份' : '设为综测成员' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-line" v-if="!students.length">暂无学生，请先检查管辖范围设置。</div>
      <div class="empty-line" v-else-if="!filteredStudents.length">没有匹配的学生，请更换搜索关键词。</div>
    </div>

    <div class="panel-card glass-card">
      <div class="panel-header">
        <h3><VIcon icon="mdi:swap-horizontal-bold" />批次跨班互评配置</h3>
        <span class="panel-count">辅导员可为管辖范围内批次指定哪个班评哪个班</span>
      </div>
      <div class="batch-config" v-for="batch in batches" :key="batch.id">
        <div class="batch-title">
          <strong>{{ batch.title }}</strong>
          <span>{{ batch.college }} · {{ batch.grade }} · {{ statusText(batch.status) }}</span>
        </div>
        <div class="assignment-row" v-for="(item, index) in batch.review_assignments" :key="item.id || index">
          <select v-model.number="item.target_class_id" @change="syncClassName(item, 'target')">
            <option value="">被评班级</option>
            <option v-for="cls in batchClasses(batch)" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
          </select>
          <select v-model.number="item.reviewer_class_id" @change="syncClassName(item, 'reviewer')">
            <option value="">评测班级</option>
            <option v-for="cls in batchClasses(batch)" :key="cls.id" :value="cls.id" :disabled="Number(cls.id) === Number(item.target_class_id)">{{ cls.name }}</option>
          </select>
          <select v-model="item.reviewer_ids" multiple>
            <option v-for="member in membersByClass(item.reviewer_class_id)" :key="member.id" :value="member.id">{{ member.real_name }}（{{ member.student_no }}）</option>
          </select>
          <button class="danger small" @click="batch.review_assignments.splice(index, 1)">删除</button>
        </div>
        <div class="config-actions">
          <button class="btn-outline" @click="addAssignment(batch)"><VIcon icon="mdi:plus" />新增关系</button>
          <button class="btn-primary" @click="saveBatch(batch)"><VIcon icon="mdi:content-save-outline" />保存配置</button>
        </div>
      </div>
      <div class="empty-line" v-if="!batches.length">暂无与你管辖范围匹配的批次。</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { getBatches, getScopeOptions, getStudents, setAssessmentMember, updateBatch, updateCounselorScope } from '../../api/module3';
import { useUserStore } from '../../stores/user';

const userStore = useUserStore();
const options = ref({ colleges: [], grades: [], classes: [], members: [] });
const students = ref([]);
const batches = ref([]);
const draftScope = ref({ college: '', grade: '', class_ids: [] });
const studentKeyword = ref('');

const scopeClasses = computed(() => options.value.classes.filter(cls => (!draftScope.value.college || cls.college === draftScope.value.college) && (!draftScope.value.grade || cls.grade === draftScope.value.grade)));
const filteredStudents = computed(() => {
  const keyword = studentKeyword.value.trim().toLowerCase();
  if (!keyword) return students.value;
  return students.value.filter(student => [student.real_name, student.student_no, student.class_name]
    .some(value => String(value || '').toLowerCase().includes(keyword)));
});

function statusText(status) {
  return ({ draft: '草稿', published: '已发布', closed: '已关闭', archived: '已归档' }[status] || status);
}

function batchClasses(batch) {
  return options.value.classes.filter(cls => cls.college === batch.college && cls.grade === batch.grade);
}

function membersByClass(classId) {
  return options.value.members.filter(member => Number(member.class_id) === Number(classId));
}

function syncClassName(item, type) {
  const key = type === 'target' ? 'target_class_id' : 'reviewer_class_id';
  const nameKey = type === 'target' ? 'target_class_name' : 'reviewer_class_name';
  const cls = options.value.classes.find(c => Number(c.id) === Number(item[key]));
  item[nameKey] = cls?.name || '';
  if (type === 'reviewer') item.reviewer_ids = [];
}

async function load() {
  const [optionRes, studentRes, batchRes] = await Promise.all([getScopeOptions(), getStudents(), getBatches()]);
  if (optionRes.code === 200) options.value = optionRes.data;
  if (studentRes.code === 200) students.value = studentRes.data || [];
  if (batchRes.code === 200) batches.value = (batchRes.data || []).filter(batch => ['draft', 'published'].includes(batch.status));
  const savedScope = userStore.user?.scope;
  if (savedScope) draftScope.value = { college: savedScope.college || '', grade: savedScope.grade || '', class_ids: savedScope.class_ids || [] };
}

async function confirmScopeChange() {
  if (!draftScope.value.college) return alert('请选择学院');
  if (!draftScope.value.grade) return alert('请选择年级');
  const res = await updateCounselorScope(draftScope.value);
  if (res.code === 200) {
    userStore.setAuth(userStore.token, res.data);
    alert('管辖范围修改已生效');
    await load();
  } else alert(res.msg);
}

async function toggleMember(student) {
  const res = await setAssessmentMember(student.id, { enabled: !student.is_assessment_member });
  if (res.code === 200) {
    alert('综测成员身份已更新');
    await load();
  } else alert(res.msg);
}

function addAssignment(batch) {
  if (!batch.review_assignments) batch.review_assignments = [];
  batch.review_assignments.push({ id: `tmp-${Date.now()}`, target_class_id: '', target_class_name: '', reviewer_class_id: '', reviewer_class_name: '', reviewer_ids: [] });
}

async function saveBatch(batch) {
  const payload = JSON.parse(JSON.stringify(batch));
  payload.review_assignments = (payload.review_assignments || []).map(item => ({ ...item, id: String(item.id).startsWith('tmp-') ? 0 : item.id }));
  const res = await updateBatch(batch.id, payload);
  if (res.code === 200) {
    alert('互评配置已保存');
    await load();
  } else alert(res.msg);
}

onMounted(load);
</script>

<style scoped>
.counselor-console { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.4s var(--easing-decelerate); }
.page-header h2 { font-size: 22px; font-weight: var(--font-weight-semibold); }
.page-desc { font-size: 14px; color: var(--color-text-secondary); margin-top: 2px; }
.panel-card { padding: 24px; border-radius: var(--radius-xl); display: flex; flex-direction: column; gap: 14px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel-header h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.panel-count { color: var(--color-text-secondary); font-size: 13px; }
.form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.scope-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.scope-tip { color: var(--color-text-secondary); font-size: 13px; }
.search-bar { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-bg); }
.search-bar input { flex: 1; border: none; background: transparent; padding: 0; min-height: auto; }
input, select { min-height: 40px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; background: var(--color-bg); color: var(--color-text-primary); }
select[multiple] { min-height: 88px; }
.btn-primary, .btn-outline, .danger { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: var(--radius-full); cursor: pointer; }
.btn-primary { border: none; background: var(--gradient-primary); color: white; }
.btn-outline { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.danger { border: 1px solid rgba(239,68,68,0.35); color: #ef4444; background: rgba(239,68,68,0.08); }
.small { min-height: 32px; font-size: 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--color-border); font-size: 13px; }
th { color: var(--color-text-secondary); font-weight: var(--font-weight-medium); }
.tag { padding: 4px 10px; border-radius: var(--radius-full); background: var(--color-bg); color: var(--color-text-secondary); }
.tag.active { background: rgba(52,168,83,0.12); color: #34a853; }
.batch-config { padding: 14px; border-radius: var(--radius-lg); background: var(--color-bg); display: flex; flex-direction: column; gap: 12px; }
.batch-title { display: flex; justify-content: space-between; gap: 12px; }
.batch-title span { color: var(--color-text-secondary); }
.assignment-row { display: grid; grid-template-columns: 1fr 1fr 1.2fr auto; gap: 10px; align-items: start; }
.config-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.empty-line { padding: 24px; text-align: center; color: var(--color-text-tertiary); }
@media (max-width: 768px) {
  .form-grid, .assignment-row { grid-template-columns: 1fr; }
  .batch-title { flex-direction: column; }
}
</style>
