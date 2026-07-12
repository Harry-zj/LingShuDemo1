<template>
  <Module3FeatureMenu
    v-if="view === 'menu'"
    title="组织结构管理"
    description="学院、专业和班级分开维护。进入详情页后只显示当前层级的创建和列表操作。"
    back-path="/module3/admin"
    back-label="返回管理员工作台"
    :cards="menuCards"
  />

  <div v-else class="org-page">
    <button class="back-link" @click="$router.push('/module3/org-manage')"><VIcon icon="mdi:arrow-left" />返回组织结构管理</button>
    <div class="page-header">
      <h2>{{ pageTitle }}</h2>
      <p class="page-desc">{{ pageDescription }}</p>
    </div>

    <section class="panel glass-card" v-if="view === 'college'">
      <div class="panel-header"><h3><VIcon icon="mdi:domain-plus" />创建学院</h3></div>
      <div class="create-row">
        <input v-model="collegeName" placeholder="学院名称" />
        <button class="btn-primary" @click="saveCollege">保存学院</button>
      </div>
    </section>
    <section class="panel glass-card" v-if="view === 'college'">
      <div class="panel-header"><h3><VIcon icon="mdi:domain" />学院列表</h3><span>{{ org.colleges.length }} 个</span></div>
      <div class="tag-list">
        <div class="tag-row" v-for="c in org.colleges" :key="c.id" :class="{ inactive: !c.is_active }">
          <strong>{{ c.name }}</strong><span>{{ c.is_active ? '启用' : '已停用' }}</span>
          <button class="link-danger" @click="removeCollege(c)">删除/停用</button>
        </div>
      </div>
    </section>

    <section class="panel glass-card" v-if="view === 'major'">
      <div class="panel-header"><h3><VIcon icon="mdi:school-outline" />创建专业</h3></div>
      <div class="form-grid">
        <select v-model="majorForm.college_id">
          <option value="">请选择学院</option>
          <option v-for="c in activeColleges" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <input v-model="majorForm.name" placeholder="专业名称" />
      </div>
      <button class="btn-primary" @click="saveMajor">保存专业</button>
    </section>
    <section class="panel glass-card" v-if="view === 'major'">
      <div class="panel-header"><h3><VIcon icon="mdi:school" />专业列表</h3><span>{{ org.majors.length }} 个</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>学院</th><th>专业</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="m in org.majors" :key="m.id" :class="{ inactive: !m.is_active }">
              <td>{{ m.college_name }}</td><td>{{ m.name }}</td><td>{{ m.is_active ? '启用' : '已停用' }}</td>
              <td><button class="link-danger" @click="removeMajor(m)">删除/停用</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel glass-card" v-if="view === 'class'">
      <div class="panel-header"><h3><VIcon icon="mdi:google-classroom" />创建班级</h3></div>
      <div class="form-grid">
        <select v-model="classForm.college_id">
          <option value="">请选择学院</option>
          <option v-for="c in activeColleges" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="classForm.major_id">
          <option value="">请选择专业</option>
          <option v-for="m in activeMajorsForClass" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <input v-model="classForm.grade" placeholder="年级，如：2024级" />
        <input v-model="classForm.name" placeholder="班级名称，如：计科2401班" />
      </div>
      <button class="btn-primary" @click="saveClass">保存班级</button>
    </section>
    <section class="panel glass-card" v-if="view === 'class'">
      <div class="panel-header"><h3><VIcon icon="mdi:google-classroom" />班级列表</h3><span>{{ org.classes.length }} 个</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>学院</th><th>专业</th><th>年级</th><th>班级</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="c in org.classes" :key="c.id" :class="{ inactive: c.status === 'inactive' }">
              <td>{{ c.college }}</td><td>{{ c.major || '-' }}</td><td>{{ c.grade }}</td><td>{{ c.name }}</td><td>{{ c.status === 'inactive' ? '已停用' : '启用' }}</td>
              <td><button class="link-danger" @click="removeClass(c)">删除/停用</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import Module3FeatureMenu from './Module3FeatureMenu.vue';
import { createCollege, createMajor, createOrgClass, deleteCollege, deleteMajor, deleteOrgClass, getOrganizations } from '../../api/module3';

const props = defineProps({ view: { type: String, default: 'menu' } });
const view = computed(() => props.view || 'menu');
const menuCards = [
  { title: '学院管理', description: '创建学院并查看启用或停用状态', icon: 'mdi:domain', to: '/module3/org-manage/college' },
  { title: '专业管理', description: '在指定学院下创建专业并维护专业列表', icon: 'mdi:school-outline', to: '/module3/org-manage/major' },
  { title: '班级管理', description: '按学院、专业和年级创建班级并维护班级列表', icon: 'mdi:google-classroom', to: '/module3/org-manage/class' },
];
const pageMeta = {
  college: ['学院管理', '创建学院并维护学院状态。已有历史引用的数据会停用而不是破坏历史记录。'],
  major: ['专业管理', '专业必须隶属于学院，创建和列表维护集中在本页。'],
  class: ['班级管理', '班级必须关联学院、专业和年级，创建和列表维护集中在本页。'],
};
const pageTitle = computed(() => pageMeta[view.value]?.[0] || '组织结构管理');
const pageDescription = computed(() => pageMeta[view.value]?.[1] || '');

const org = ref({ colleges: [], majors: [], classes: [] });
const collegeName = ref('');
const majorForm = ref({ college_id: '', name: '' });
const classForm = ref({ college_id: '', major_id: '', grade: '', name: '' });
const activeColleges = computed(() => org.value.colleges.filter(c => c.is_active));
const activeMajorsForClass = computed(() => org.value.majors.filter(m => m.is_active && Number(m.college_id) === Number(classForm.value.college_id)));
watch(() => classForm.value.college_id, () => { classForm.value.major_id = ''; });

async function loadOrg() {
  const res = await getOrganizations();
  if (res.code === 200) org.value = res.data || { colleges: [], majors: [], classes: [] };
  else alert(res.msg || '加载组织数据失败');
}
async function saveCollege() {
  const res = await createCollege({ name: collegeName.value });
  if (res.code === 200) { org.value = res.data; collegeName.value = ''; } else alert(res.msg || '保存失败');
}
async function saveMajor() {
  const res = await createMajor(majorForm.value);
  if (res.code === 200) { org.value = res.data; majorForm.value = { college_id: '', name: '' }; } else alert(res.msg || '保存失败');
}
async function saveClass() {
  const res = await createOrgClass(classForm.value);
  if (res.code === 200) { org.value = res.data; classForm.value = { college_id: '', major_id: '', grade: '', name: '' }; } else alert(res.msg || '保存失败');
}
async function removeCollege(c) {
  if (!confirm(`确认删除或停用学院“${c.name}”？`)) return;
  const res = await deleteCollege(c.id);
  if (res.code === 200) org.value = res.data; else alert(res.msg || '操作失败');
}
async function removeMajor(m) {
  if (!confirm(`确认删除或停用专业“${m.name}”？`)) return;
  const res = await deleteMajor(m.id);
  if (res.code === 200) org.value = res.data; else alert(res.msg || '操作失败');
}
async function removeClass(c) {
  if (!confirm(`确认删除或停用班级“${c.name}”？`)) return;
  const res = await deleteOrgClass(c.id);
  if (res.code === 200) org.value = res.data; else alert(res.msg || '操作失败');
}

onMounted(loadOrg);
</script>

<style scoped>
.org-page { display:flex; flex-direction:column; gap:22px; animation:fadeIn .35s var(--easing-decelerate); }
.page-header h2 { font-size:22px; font-weight:var(--font-weight-semibold); }
.page-desc { margin-top:4px; color:var(--color-text-secondary); font-size:13px; }
.panel { padding:22px; border-radius:var(--radius-xl); }
.panel-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px; }
.panel-header h3 { display:flex; align-items:center; gap:8px; font-size:16px; }
.panel-header span { color:var(--color-text-secondary); font-size:13px; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.create-row { display:flex; gap:10px; }
.create-row input { flex:1; }
input, select { width:100%; height:40px; padding:0 12px; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text-primary); outline:none; }
.btn-primary { display:inline-flex; align-items:center; justify-content:center; height:40px; padding:0 16px; margin-top:14px; border:0; border-radius:var(--radius-full); background:var(--gradient-primary); color:#fff; cursor:pointer; }
.create-row .btn-primary { margin-top:0; }
.tag-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
.tag-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-radius:var(--radius-md); background:var(--color-bg); }
.tag-row span { color:var(--color-text-secondary); font-size:12px; }
.table-wrap { overflow:auto; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th,td { padding:10px; border-bottom:1px solid var(--color-border); text-align:left; white-space:nowrap; }
th { color:var(--color-text-secondary); font-weight:600; }
.inactive { opacity:.55; }
.link-danger { border:0; background:transparent; color:#dc2626; cursor:pointer; }
.back-link { display:inline-flex; align-items:center; gap:6px; width:fit-content; border:0; padding:0; background:transparent; color:var(--color-primary); cursor:pointer; }
@media (max-width:800px) { .form-grid, .tag-list { grid-template-columns:1fr; } .create-row { flex-direction:column; } }
</style>
