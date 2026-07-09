<template>
  <div class="main-layout">
    <header class="top-nav">
      <div class="nav-left">
        <span class="logo">灵枢</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/home">首页</router-link>
        <router-link to="/zongce/smart-fill">智能填表</router-link>
        <router-link to="/module2/evaluation">个性评定</router-link>
        <router-link to="/module3/student">信息管理</router-link>
      </nav>
      <div class="nav-right" v-if="userStore.isLoggedIn">
        <span class="user-tag">{{ userStore.user?.real_name || userStore.user?.username }}</span>
        <button class="logout-btn" @click="handleLogout">退出登录</button>
      </div>
      <div class="nav-right" v-else>
        <router-link to="/login">登录</router-link>
      </div>
    </header>
    <main class="content"><slot /></main>
  </div>
</template>
<script setup>
import { useUserStore } from "../stores/user";
import { useRouter } from "vue-router";
const userStore = useUserStore();
const router = useRouter();
function handleLogout() { userStore.logout(); router.push("/login"); }
</script>
<style scoped>
.main-layout { min-height: 100vh; display: flex; flex-direction: column; }
.top-nav { height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: var(--color-white); box-shadow: var(--shadow-nav); position: sticky; top: 0; z-index: 100; }
.logo { font-size: 20px; font-weight: 700; color: var(--color-primary); letter-spacing: 2px; }
.nav-menu { display: flex; gap: 8px; }
.nav-menu a { padding: 8px 16px; border-radius: var(--radius-btn); color: var(--color-text-secondary); font-size: 14px; transition: all 0.2s; }
.nav-menu a:hover, .nav-menu a.router-link-active { background: var(--color-primary-light); color: var(--color-primary); }
.nav-right { display: flex; align-items: center; gap: 12px; }
.user-tag { font-size: 14px; color: var(--color-text-secondary); }
.logout-btn { padding: 6px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-white); cursor: pointer; font-size: 13px; }
.content { flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 24px; }
</style>
