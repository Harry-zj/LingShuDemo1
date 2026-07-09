<<<<<<< HEAD
﻿<template>
  <div class="main-layout">
    <!-- 全局底层光斑氛围 -->
    <div class="bg-atmosphere">
      <div class="orb bg-orb-1"></div>
      <div class="orb bg-orb-2"></div>
      <div class="orb bg-orb-3"></div>
    </div>

    <header class="top-nav">
      <div class="nav-left">
        <span class="logo" @click="goHome">
          <VIcon icon="mdi:brain" class="logo-icon" />
          灵枢
        </span>
      </div>
      <nav class="nav-menu">
        <router-link to="/home" class="nav-item" active-class="active">
          <VIcon icon="mdi:home-outline" class="nav-icon" />
          <span class="nav-text">首页</span>
        </router-link>
        <router-link to="/module1/smart-fill" class="nav-item" active-class="active">
          <VIcon icon="mdi:file-document-edit-outline" class="nav-icon" />
          <span class="nav-text">智能填表</span>
        </router-link>
        <router-link to="/module2/evaluation" class="nav-item" active-class="active">
          <VIcon icon="mdi:chart-pie-outline" class="nav-icon" />
          <span class="nav-text">个性评定</span>
        </router-link>
        <router-link to="/module3/student" class="nav-item" active-class="active">
          <VIcon icon="mdi:account-group-outline" class="nav-icon" />
          <span class="nav-text">信息管理</span>
        </router-link>
      </nav>
      <div class="nav-right" v-if="userStore.isLoggedIn">
        <div class="user-menu" @click="showUserMenu = !showUserMenu" v-click-outside="() => showUserMenu = false">
          <div class="user-avatar">{{ (userStore.user?.real_name || userStore.user?.username)?.[0] }}</div>
          <span class="user-name">{{ userStore.user?.real_name || userStore.user?.username }}</span>
          <VIcon icon="mdi:chevron-down" class="dropdown-icon" :class="{ rotated: showUserMenu }" />
          <transition name="fade">
            <div class="dropdown-menu glass-card" v-if="showUserMenu">
              <div class="dropdown-item">
                <VIcon icon="mdi:account-outline" />
                <span>个人中心</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item logout" @click.stop="handleLogout">
                <VIcon icon="mdi:logout" />
                <span>退出登录</span>
              </div>
            </div>
          </transition>
        </div>
      </div>
      <div class="nav-right" v-else>
        <router-link to="/login" class="login-link">
          <VIcon icon="mdi:login" />
          <span>登录</span>
        </router-link>
      </div>
    </header>

    <main class="content"><slot /></main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '../stores/user';
import { useRouter } from 'vue-router';
const userStore = useUserStore();
const router = useRouter();
const showUserMenu = ref(false);
function goHome() { router.push('/home'); }
function handleLogout() { showUserMenu.value = false; userStore.logout(); router.push('/login'); }
</script>

<style scoped>
.main-layout {
  min-height: 100vh; display: flex; flex-direction: column;
  position: relative; isolation: isolate;
}

/* ═══════ 全局光斑背景 ═══════ */
.bg-atmosphere {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.bg-atmosphere .orb {
  position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.5;
}
.bg-orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%);
  top: -200px; right: -100px;
  animation: orbDrift1 20s ease-in-out infinite;
}
.bg-orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%);
  bottom: -150px; left: -80px;
  animation: orbDrift2 22s ease-in-out infinite reverse;
}
.bg-orb-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 60%);
  top: 60%; right: 10%;
  animation: orbDrift3 18s ease-in-out infinite 5s;
}

/* ═══════ 导航栏 ═══════ */
.top-nav {
  height: 64px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 32px;
  background: var(--glass-nav-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.4);
  position: sticky; top: 0; z-index: 100;
  transition: box-shadow var(--duration-normal) var(--easing-standard);
}
.top-nav:hover { box-shadow: var(--shadow-level-2); }

.logo {
  display: flex; align-items: center; gap: 6px;
  font-size: 20px; font-weight: var(--font-weight-bold);
  color: var(--color-primary); letter-spacing: var(--letter-spacing-wider);
  cursor: pointer;
  animation: breathe 4s var(--easing-breathe) infinite;
  transform-origin: left center;
}
.logo-icon { font-size: 28px; color: var(--color-primary); transition: transform var(--duration-normal) var(--easing-spring); }
.logo:hover .logo-icon { transform: rotate(-10deg) scale(1.1); }

/* 导航项 */
.nav-menu { display: flex; gap: 4px; align-items: center; }
.nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-full);
  color: var(--color-text-secondary); font-size: var(--font-scale-body-sm);
  font-weight: var(--font-weight-medium); text-decoration: none;
  position: relative; overflow: hidden;
  transition: all var(--duration-fast) var(--easing-standard);
}
.nav-item::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.04));
  border-radius: var(--radius-full);
  transform: scaleX(0); transform-origin: center;
  transition: transform var(--duration-normal) var(--easing-standard);
}
.nav-item:hover::before { transform: scaleX(1); }
.nav-item:hover { color: var(--color-primary); }
.nav-item.active {
  color: var(--color-primary);
  background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05));
  box-shadow: inset 0 0 0 1px rgba(99,102,241,0.12);
}
.nav-icon { font-size: 18px; position: relative; z-index: 1; transition: transform var(--duration-fast) var(--easing-spring); }
.nav-item:hover .nav-icon { transform: translateY(-1px); }
.nav-text { position: relative; z-index: 1; }

.login-link {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 16px; border-radius: var(--radius-full);
  color: var(--color-primary); font-size: var(--font-scale-body-sm);
  font-weight: var(--font-weight-medium);
  transition: all var(--duration-fast) var(--easing-standard); text-decoration: none;
}
.login-link:hover { background: var(--color-primary-light); }

/* 用户菜单 */
.user-menu {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 12px 4px 4px; border-radius: var(--radius-full);
  cursor: pointer; position: relative;
  transition: background var(--duration-fast) var(--easing-standard);
}
.user-menu:hover { background: var(--color-surface-variant); }
.user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--color-primary-gradient-bright); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: var(--font-weight-semibold);
}
.user-name { font-size: 14px; color: var(--color-text); font-weight: var(--font-weight-medium); }
.dropdown-icon { font-size: 16px; color: var(--color-text-secondary); transition: transform var(--duration-fast) var(--easing-standard); }
.dropdown-icon.rotated { transform: rotate(180deg); }

.dropdown-menu {
  position: absolute; top: calc(100% + 8px); right: 0;
  min-width: 180px; padding: 8px;
  border-radius: var(--radius-lg);
  z-index: 200; transform-origin: top right;
}
.dropdown-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 14px; color: var(--color-text);
  cursor: pointer; transition: background var(--duration-fast) var(--easing-standard);
}
.dropdown-item:hover { background: var(--color-surface-variant); }
.dropdown-item.logout { color: var(--color-error); }
.dropdown-item.logout:hover { background: var(--color-error-bg); }
.dropdown-divider { height: 1px; background: var(--color-border); margin: 4px 8px; }

/* ═══════ 内容区 ═══════ */
.content {
  flex: 1; max-width: 1200px; width: 100%;
  margin: 0 auto; padding: 32px 24px;
  position: relative; z-index: 1;
  animation: fadeIn 0.5s var(--easing-decelerate);
}

@media (max-width: 768px) {
  .top-nav { padding: 0 16px; }
  .nav-text { display: none; }
  .nav-item { padding: 10px; }
  .content { padding: 16px; }
}
=======
<template>
  <div class="main-layout">
    <header class="top-nav">
      <div class="nav-left">
        <span class="logo">灵枢</span>
      </div>
      <nav class="nav-menu">
        <router-link to="/home">首页</router-link>
        <router-link to="/module1/smart-fill">智能填表</router-link>
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
>>>>>>> origin/main
</style>
