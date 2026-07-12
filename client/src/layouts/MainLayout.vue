<template>
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
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item" active-class="active">
          <VIcon :icon="item.icon" class="nav-icon" />
          <span class="nav-text">{{ item.text }}</span>
        </router-link>
      </nav>

      <div class="nav-right" v-if="userStore.isLoggedIn">
        <ThemeToggle />
        <div
          class="user-menu"
          @click="showUserMenu = !showUserMenu"
          v-click-outside="() => showUserMenu = false"
        >
          <div class="user-avatar">
            {{ (userStore.user?.real_name || userStore.user?.username)?.[0] }}
          </div>

          <span class="user-name">
            {{ userStore.user?.real_name || userStore.user?.username }}
          </span>

          <VIcon
            icon="mdi:chevron-down"
            class="dropdown-icon"
            :class="{ rotated: showUserMenu }"
          />

          <transition name="fade">
            <div class="dropdown-menu glass-card" v-if="showUserMenu">
              <div class="dropdown-item" @click.stop="goProfile">
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
        <ThemeToggle />
        <router-link to="/login" class="login-link">
          <VIcon icon="mdi:login" />
          <span>登录</span>
        </router-link>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useUserStore } from '../stores/user';
import { useRouter } from 'vue-router';
import ThemeToggle from '../components/ThemeToggle.vue';

const userStore = useUserStore();
const router = useRouter();
const showUserMenu = ref(false);

const navItems = computed(() => {
  const role = userStore.userRole;
  const isMember = !!userStore.user?.is_assessment_member;
  if (role === 'admin') {
    return [
      { to: '/module3/admin', icon: 'mdi:view-dashboard-outline', text: '管理员工作台' },
      { to: '/module3/profile', icon: 'mdi:account-outline', text: '个人中心' },
    ];
  }
  if (role === 'counselor') {
    return [
      { to: '/module3/counselor', icon: 'mdi:view-dashboard-outline', text: '模块三工作台' },
      { to: '/module3/class-leader', icon: 'mdi:clipboard-account-outline', text: '待评价' },
      { to: '/module3/profile', icon: 'mdi:account-outline', text: '个人中心' },
    ];
  }
  if (role === 'student_affairs') {
    return [
      { to: '/module3/student-affairs', icon: 'mdi:view-dashboard-outline', text: '模块三工作台' },
      { to: '/module3/profile', icon: 'mdi:account-outline', text: '个人中心' },
    ];
  }
  const profileComplete = userStore.user?.profile_complete !== false;
  const items = [
    { to: '/home', icon: 'mdi:home-outline', text: '首页' },
    { to: '/zongce/smart-fill', icon: 'mdi:file-document-edit-outline', text: '智能填表' },
    { to: '/module2/evaluation', icon: 'mdi:chart-pie-outline', text: '个性评定' },
    ...(profileComplete ? [{ to: '/module3/student', icon: 'mdi:view-dashboard-outline', text: '综测评价' }] : []),
  ];
  if (isMember) items.push({ to: '/module3/class-leader', icon: 'mdi:clipboard-account-outline', text: '我的待评' });
  items.push({ to: '/module3/profile', icon: 'mdi:account-outline', text: '个人中心' });
  return items;
});

function goProfile() {
  showUserMenu.value = false;
  router.push('/module3/profile');
}

function goHome() {
  const role = userStore.userRole;
  if (role === 'admin') router.push('/module3/admin');
  else if (role === 'counselor') router.push('/module3/counselor');
  else if (role === 'student_affairs') router.push('/module3/student-affairs');
  else router.push('/home');
}

function handleLogout() {
  showUserMenu.value = false;
  userStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(circle at 12% 18%, rgba(99, 102, 241, 0.18), transparent 32%),
    radial-gradient(circle at 88% 12%, rgba(139, 92, 246, 0.16), transparent 30%),
    radial-gradient(circle at 70% 86%, rgba(6, 182, 212, 0.10), transparent 28%),
    linear-gradient(135deg, #f8f7ff 0%, #eef2ff 42%, #f8fafc 100%);
}

.main-layout::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(79, 70, 229, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 70, 229, 0.045) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.68), transparent 74%);
}

/* 背景光斑 */
.bg-atmosphere {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.bg-atmosphere .orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(118px);
  opacity: 0.62;
}

.bg-orb-1 {
  width: 560px;
  height: 560px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 62%);
  top: -240px;
  right: -120px;
}

.bg-orb-2 {
  width: 460px;
  height: 460px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.13) 0%, transparent 64%);
  bottom: -170px;
  left: -100px;
}

.bg-orb-3 {
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, transparent 64%);
  top: 58%;
  right: 11%;
}

/* 顶部导航 */
.top-nav {
  height: 84px;
  display: grid;
  grid-template-columns: 260px 1fr 260px;
  align-items: center;
  padding: 0 clamp(28px, 5vw, 76px);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 56px rgba(79, 70, 229, 0.09);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-left {
  justify-self: start;
  display: flex;
  align-items: center;
}

.nav-menu {
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 12px 34px rgba(79, 70, 229, 0.07);
}

.nav-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 38px;
  font-weight: 950;
  letter-spacing: 0.14em;
  cursor: pointer;
  background: linear-gradient(
    135deg,
    #1e1b4b 0%,
    #4338ca 36%,
    #7c3aed 68%,
    #06b6d4 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 12px 26px rgba(79, 70, 229, 0.24));
}

.logo-icon {
  font-size: 42px;
  color: #4f46e5;
  -webkit-text-fill-color: initial;
  filter:
    drop-shadow(0 0 16px rgba(99, 102, 241, 0.42))
    drop-shadow(0 8px 18px rgba(139, 92, 246, 0.22));
  transition: transform 0.25s ease;
}

.logo:hover .logo-icon {
  transform: rotate(-10deg) scale(1.08);
}

/* 导航项 */
.nav-item {
  min-width: 132px;
  height: 48px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 999px;
  color: var(--color-text-secondary, #64748b);
  font-size: 18px;
  font-weight: 800;
  text-decoration: none;
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;
}

.nav-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.16),
    rgba(139, 92, 246, 0.08)
  );
  border-radius: 999px;
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 0.25s ease;
}

.nav-item:hover::before {
  transform: scaleX(1);
}

.nav-item:hover {
  color: var(--color-primary, #4f46e5);
  transform: translateY(-1px);
}

.nav-item.active {
  color: var(--color-primary, #4f46e5);
  background: rgba(255, 255, 255, 0.86);
  box-shadow:
    inset 0 0 0 1px rgba(99, 102, 241, 0.18),
    0 12px 30px rgba(79, 70, 229, 0.11);
}

.nav-icon {
  font-size: 24px;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.nav-text {
  position: relative;
  z-index: 1;
  white-space: nowrap;
}

/* 登录按钮 */
.login-link {
  height: 46px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  color: var(--color-primary, #4f46e5);
  font-size: 17px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.76);
  text-decoration: none;
  transition: all 0.25s ease;
}

.login-link:hover {
  transform: translateY(-1px);
  background: rgba(238, 242, 255, 0.9);
}

/* 用户菜单 */
.user-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 15px 6px 6px;
  border-radius: 999px;
  cursor: pointer;
  position: relative;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255, 255, 255, 0.72);
}

.user-menu:hover {
  background: rgba(255, 255, 255, 0.76);
}

.user-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.22);
}

.user-name {
  font-size: 16px;
  color: var(--color-text, #1e293b);
  font-weight: 700;
}

.dropdown-icon {
  font-size: 18px;
  color: var(--color-text-secondary, #64748b);
  transition: transform 0.25s ease;
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  min-width: 190px;
  padding: 8px;
  border-radius: 18px;
  z-index: 200;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.62));
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow:
    0 24px 70px rgba(79, 70, 229, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  transform-origin: top right;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 650;
  color: var(--color-text, #1e293b);
  cursor: pointer;
  transition: background 0.2s ease;
}

.dropdown-item:hover {
  background: rgba(238, 242, 255, 0.78);
}

.dropdown-item.logout {
  color: var(--color-error, #dc2626);
}

.dropdown-item.logout:hover {
  background: rgba(254, 226, 226, 0.72);
}

.dropdown-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.22);
  margin: 5px 8px;
}

/* 内容区 */
.content {
  flex: 1;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 40px 76px;
  position: relative;
  z-index: 1;
  animation: fadeIn 0.5s ease;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 中等屏 */
@media (max-width: 1100px) {
  .top-nav {
    height: 78px;
    grid-template-columns: auto 1fr auto;
    padding: 0 22px;
  }

  .nav-menu {
    gap: 8px;
    padding: 8px;
  }

  .nav-item {
    min-width: auto;
    height: 44px;
    padding: 0 16px;
    font-size: 16px;
  }

  .nav-icon {
    font-size: 22px;
  }

  .logo {
    font-size: 32px;
  }

  .logo-icon {
    font-size: 36px;
  }
}

/* 小屏 */
@media (max-width: 760px) {
  .top-nav {
    height: 70px;
    grid-template-columns: auto 1fr auto;
    padding: 0 14px;
  }

  .logo {
    font-size: 25px;
    letter-spacing: 0.08em;
  }

  .logo-icon {
    font-size: 30px;
  }

  .nav-menu {
    justify-self: center;
    gap: 4px;
    padding: 5px;
  }

  .nav-item {
    width: 42px;
    height: 42px;
    min-width: 42px;
    padding: 0;
  }

  .nav-text {
    display: none;
  }

  .nav-icon {
    font-size: 22px;
  }

  .user-name {
    display: none;
  }

  .login-link span {
    display: none;
  }

  .login-link {
    width: 42px;
    height: 42px;
    padding: 0;
    justify-content: center;
  }

  .content {
    padding: 16px;
  }
}
</style>
