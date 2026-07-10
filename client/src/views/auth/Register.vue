<template>
  <div class="login-wrapper">
    <div class="login-brand">
      <VIcon icon="mdi:brain" class="brand-icon" />
      <h1 class="brand-title">灵枢</h1>
      <p class="brand-desc">高校综测智能填写与决策平台</p>
    </div>
    <div class="login-card glass-card">
      <h2 class="login-title">注册账号</h2>
      <p class="login-subtitle">创建您的灵枢账号</p>
      <form @submit.prevent="handleRegister" class="login-form">
        <div class="field-group">
          <label class="field-label">用户名 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:account-outline" class="input-icon" />
            <input v-model="form.username" placeholder="请输入用户名" required />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">密码 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:lock-outline" class="input-icon" />
            <input v-model="form.password" type="password" placeholder="请输入密码" required />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">角色 *</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:shield-account-outline" class="input-icon" />
            <select v-model="form.role" required class="role-select">
              <option value="" disabled>请选择角色</option>
              <option v-for="(label, key) in ROLE_OPTIONS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">真实姓名</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:card-account-details-outline" class="input-icon" />
            <input v-model="form.real_name" placeholder="请输入真实姓名" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">学号</label>
          <div class="input-wrapper">
            <VIcon icon="mdi:identifier" class="input-icon" />
            <input v-model="form.student_no" placeholder="请输入学号" />
          </div>
        </div>
        <div class="field-row">
          <div class="field-group half">
            <label class="field-label">学院</label>
            <input v-model="form.college" placeholder="如：信息科学与工程学院" />
          </div>
          <div class="field-group half">
            <label class="field-label">专业</label>
            <input v-model="form.major" placeholder="如：计算机科学与技术" />
          </div>
        </div>
        <div class="field-row">
          <div class="field-group half">
            <label class="field-label">年级</label>
            <input v-model="form.grade" placeholder="如：2024级" />
          </div>
          <div class="field-group half">
            <label class="field-label">班级</label>
            <input v-model="form.class_name" placeholder="如：计科2401班" />
          </div>
        </div>
        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="!loading">注册</span>
          <span v-else class="btn-loading"><VIcon icon="mdi:loading" class="spin" />注册中...</span>
        </button>
      </form>
      <p class="login-tip">已有账号？<router-link to="/login">立即登录</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { register } from '../../api/auth';
import { useRouter } from 'vue-router';

const router = useRouter();
const form = ref({ username: '', password: '', role: '', real_name: '', student_no: '', college: '', major: '', grade: '', class_name: '' });
const loading = ref(false);

const ROLE_OPTIONS = {
  student: '学生',
  class_committee: '班级测评小组',
  counselor: '辅导员',
  student_affairs: '学生工作处',
  admin: '管理员',
};

async function handleRegister() {
  loading.value = true;
  try {
    const res = await register(form.value);
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
</script>

<style scoped>
.login-wrapper { display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%; max-width: 480px; animation: fadeInUp 0.6s var(--easing-spring); }
.login-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.brand-icon { font-size: 48px; color: var(--color-primary); filter: drop-shadow(0 0 16px rgba(99,102,241,0.4)); animation: float 4s ease-in-out infinite; }
.brand-title { font-size: 28px; font-weight: var(--font-weight-bold); color: var(--color-text); }
.brand-desc { font-size: 14px; color: var(--color-text-secondary); }
.login-card { width: 100%; padding: 40px 32px; border-radius: var(--radius-xl); animation: scaleIn 0.5s var(--easing-spring) 0.1s both; }
.login-title { font-size: 22px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 4px; }
.login-subtitle { font-size: 14px; color: var(--color-text-secondary); margin-bottom: 28px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 13px; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); padding-left: 4px; }
.input-wrapper { display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); transition: all var(--duration-fast) var(--easing-standard); }
.input-wrapper:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
.input-icon { font-size: 20px; color: var(--color-text-tertiary); flex-shrink: 0; }
.input-wrapper input, .input-wrapper select { width: 100%; padding: 12px 0; border: none; background: transparent; font-size: 15px; color: var(--color-text); outline: none; font-family: inherit; }
.input-wrapper select { cursor: pointer; }
.role-select { appearance: none; -webkit-appearance: none; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23999' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E") no-repeat right center; padding-right: 24px; }
.input-wrapper input::placeholder { color: var(--color-text-tertiary); }
.field-row { display: flex; gap: 12px; }
.field-row .half { flex: 1; }
.field-row .half input { width: 100%; padding: 10px 12px; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-white); font-size: 14px; color: var(--color-text); outline: none; font-family: inherit; transition: border-color var(--duration-fast); }
.field-row .half input:focus { border-color: var(--color-primary); }
.btn-login { width: 100%; padding: 14px; background: var(--color-primary-gradient-bright); color: white; border: none; border-radius: var(--radius-full); font-size: 16px; font-weight: var(--font-weight-semibold); cursor: pointer; margin-top: 4px; box-shadow: 0 4px 20px rgba(99,102,241,0.3); }
.btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-loading { display: flex; align-items: center; justify-content: center; gap: 8px; }
.spin { animation: spin 0.8s linear infinite; font-size: 18px; }
.login-tip { margin-top: 20px; font-size: 12px; color: var(--color-text-tertiary); text-align: center; }
.login-tip a { color: var(--color-primary); text-decoration: none; font-weight: var(--font-weight-medium); }
@media (max-width: 480px) { .login-card { padding: 32px 24px; } .field-row { flex-direction: column; gap: 16px; } }
</style>