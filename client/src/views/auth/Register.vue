<template>
  <div class="login-wrapper">
    <div class="login-brand">
      <VIcon icon="mdi:brain" class="brand-icon" />
      <h1 class="brand-title">灵枢</h1>
      <p class="brand-desc">高校综测智能填写与决策平台</p>
    </div>
    <div class="login-card glass-card">
      <h2 class="login-title">注册账号</h2>
      <p class="login-subtitle">仅学生可自主注册；学院、年级、专业和班级从管理员维护的组织数据中选择</p>
      <div class="closed-tip" v-if="optionsLoaded && !allowStudentRegister">
        当前系统已关闭学生自主注册，请联系管理员创建账号。
      </div>
      <form @submit.prevent="handleRegister" class="login-form">
        <div class="field-group">
          <label class="field-label">学号 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:identifier" class="input-icon" />
            <input v-model.trim="form.student_no" placeholder="请输入学号，登录时也使用该学号" required :disabled="!allowStudentRegister" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">密码 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:lock-outline" class="input-icon" />
            <input v-model="form.password" type="password" placeholder="请输入密码" required :disabled="!allowStudentRegister" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">真实姓名 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:card-account-details-outline" class="input-icon" />
            <input v-model.trim="form.real_name" placeholder="请输入真实姓名" required :disabled="!allowStudentRegister" />
          </div>
        </div>

        <div class="field-row">
          <div class="field-group half">
            <label class="field-label">学院 *</label>
            <select v-model="form.college" required @change="onCollegeChange" :disabled="!allowStudentRegister">
              <option value="">请选择学院</option>
              <option v-for="college in org.colleges" :key="college.name" :value="college.name">{{ college.name }}</option>
            </select>
          </div>
          <div class="field-group half">
            <label class="field-label">年级 *</label>
            <select v-model="form.grade" required @change="onGradeChange" :disabled="!allowStudentRegister || !form.college">
              <option value="">请选择年级</option>
              <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field-group half">
            <label class="field-label">专业 *</label>
            <select v-model="form.major" required @change="onMajorChange" :disabled="!allowStudentRegister || !form.college">
              <option value="">请选择专业</option>
              <option v-for="major in majorOptions" :key="major.name" :value="major.name">{{ major.name }}</option>
            </select>
          </div>
          <div class="field-group half">
            <label class="field-label">班级 *</label>
            <select v-model="form.class_name" required :disabled="!allowStudentRegister || !form.college || !form.major || !form.grade">
              <option value="">请选择班级</option>
              <option v-for="cls in classOptions" :key="cls.id" :value="cls.name">{{ cls.name }}</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn-login" :disabled="loading || !allowStudentRegister">
          <span v-if="!loading">注册</span>
          <span v-else class="btn-loading"><VIcon icon="mdi:loading" class="spin" />注册中...</span>
        </button>
      </form>
      <p class="login-tip">已有账号？<router-link to="/login">立即登录</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { register, getRegisterOptions } from '../../api/auth';
import { useRouter } from 'vue-router';

const router = useRouter();
const form = ref({ password: '', real_name: '', student_no: '', college: '', major: '', grade: '', class_name: '' });
const loading = ref(false);
const optionsLoaded = ref(false);
const allowStudentRegister = ref(true);
const org = ref({ colleges: [], majors: [], classes: [], grades: [] });

const selectedCollege = computed(() => org.value.colleges.find(item => item.name === form.value.college));
const majorOptions = computed(() => org.value.majors.filter(item => !selectedCollege.value || Number(item.college_id) === Number(selectedCollege.value.id)));
const gradeOptions = computed(() => [...new Set(org.value.classes
  .filter(cls => !form.value.college || cls.college === form.value.college)
  .map(cls => cls.grade)
  .filter(Boolean))].sort().reverse());
const classOptions = computed(() => org.value.classes.filter(cls => cls.college === form.value.college && cls.major === form.value.major && cls.grade === form.value.grade));

function onCollegeChange() {
  form.value.major = '';
  form.value.grade = '';
  form.value.class_name = '';
}
function onMajorChange() {
  form.value.class_name = '';
}
function onGradeChange() {
  form.value.class_name = '';
}

async function loadOptions() {
  const res = await getRegisterOptions();
  optionsLoaded.value = true;
  if (res.code === 200) {
    allowStudentRegister.value = res.data.allowStudentRegister !== false;
    org.value = {
      colleges: res.data.colleges || [],
      majors: res.data.majors || [],
      classes: res.data.classes || [],
      grades: res.data.grades || [],
    };
  }
}

async function handleRegister() {
  if (!allowStudentRegister.value) return alert('当前系统已关闭学生自主注册');
  if (!form.value.college || !form.value.grade || !form.value.major || !form.value.class_name) return alert('请选择学院、年级、专业和班级');
  loading.value = true;
  try {
    const res = await register({ ...form.value, role: 'student' });
    if (res.code === 200) {
      alert('注册成功，请登录');
      router.push('/login');
    } else {
      alert(res.msg);
    }
  } catch (e) {
    alert('注册失败，请检查网络连接');
  } finally {
    loading.value = false;
  }
}

onMounted(loadOptions);
</script>

<style scoped>
.login-wrapper { display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%; max-width: 520px; animation: fadeInUp 0.6s var(--easing-spring); }
.login-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.brand-icon { font-size: 48px; color: var(--color-primary); filter: drop-shadow(0 0 16px rgba(99,102,241,0.4)); animation: float 4s ease-in-out infinite; }
.brand-title { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); }
.brand-desc { font-size: 14px; color: var(--color-text-secondary); }
.login-card { width: 100%; padding: 40px 32px; border-radius: var(--radius-xl); animation: scaleIn 0.5s var(--easing-spring) 0.1s both; }
.login-title { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 4px; }
.login-subtitle { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 20px; }
.closed-tip { padding: 12px 14px; border-radius: var(--radius-md); background: rgba(239,68,68,0.08); color: #ef4444; font-size: 13px; margin-bottom: 16px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); padding-left: 4px; }
.input-wrapper { display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); transition: all var(--duration-fast) var(--easing-standard); }
.input-wrapper:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
.input-icon { font-size: 20px; color: var(--color-text-tertiary); flex-shrink: 0; }
.input-wrapper input { width: 100%; padding: 12px 0; border: none; background: transparent; font-size: 15px; color: var(--color-text); outline: none; font-family: inherit; }
.input-wrapper input::placeholder { color: var(--color-text-tertiary); }
.field-row { display: flex; gap: 12px; }
.field-row .half { flex: 1; }
.field-row select { width: 100%; padding: 10px 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); font-size: 14px; color: var(--color-text); outline: none; font-family: inherit; transition: border-color var(--duration-fast); min-height: 42px; }
.field-row select:focus { border-color: var(--color-primary); }
.btn-login { width: 100%; padding: 14px; background: var(--color-primary-gradient-bright); color: white; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; margin-top: 4px; box-shadow: 0 4px 20px rgba(99,102,241,0.3); }
.btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-loading { display: flex; align-items: center; justify-content: center; gap: 8px; }
.spin { animation: spin 0.8s linear infinite; font-size: 18px; }
.login-tip { margin-top: 20px; font-size: 12px; color: var(--color-text-tertiary); text-align: center; }
.login-tip a { color: var(--color-primary); text-decoration: none; font-weight: var(--font-weight-medium); }
@media (max-width: 520px) { .login-card { padding: 32px 24px; } .field-row { flex-direction: column; gap: 16px; } }
</style>
