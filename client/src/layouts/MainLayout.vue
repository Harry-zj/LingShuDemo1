<template>
  <div
    class="main-layout"
    :class="[`nav-${navMode}`, { 'mobile-menu-open': mobileMenuOpen }]"
  >
    <!-- 背景 -->
    <div class="bg-atmosphere">
      <div class="orb orb-one"></div>
      <div class="orb orb-two"></div>
    </div>

    <!-- =========================
         顶部导航
    ========================== -->
    <header
      v-if="navMode === 'top'"
      class="top-nav"
    >
      <button
        type="button"
        class="logo"
        @click="goHome"
      >
        <VIcon icon="mdi:brain" />
        <span>灵枢</span>
      </button>

      <nav class="top-menu">
        <router-link
          v-for="item in navItems"
          :key="item.key"
          :to="item.path"
          class="nav-item"
          :class="{ active: isNavActive(item) }"
        >
          <VIcon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="top-actions">
        <!-- 切换为左侧导航 -->
        <button
          type="button"
          class="layout-switch"
          title="切换为左侧导航"
          aria-label="切换为左侧导航"
          @click="setNavMode('left')"
        >
          <VIcon icon="mdi:dock-left" />
          <span>左侧导航</span>
        </button>

        <ThemeToggle />

        <div
          v-if="userStore.isLoggedIn"
          v-click-outside="closeUserMenu"
          class="user-menu"
        >
          <button
            type="button"
            class="user-trigger"
            @click="showUserMenu = !showUserMenu"
          >
            <VIcon icon="mdi:account-circle-outline" />
            <span>{{ displayName }}</span>
            <VIcon
              icon="mdi:chevron-down"
              class="user-arrow"
              :class="{ rotated: showUserMenu }"
            />
          </button>

          <transition name="dropdown">
            <div
              v-if="showUserMenu"
              class="user-dropdown"
            >
              <button
                type="button"
                class="dropdown-item logout"
                @click="handleLogout"
              >
                <VIcon icon="mdi:logout" />
                <span>退出登录</span>
              </button>
            </div>
          </transition>
        </div>

        <router-link
          v-else
          to="/login"
          class="login-entry top-login-entry"
        >
          <VIcon icon="mdi:login" />
          <span>登录</span>
        </router-link>
      </div>
    </header>

    <!-- =========================
         左侧导航
    ========================== -->
    <aside
      v-if="navMode === 'left'"
      class="side-nav"
    >
      <div class="side-header">
        <button
          type="button"
          class="side-logo"
          @click="goHome"
        >
          <VIcon icon="mdi:brain" />
          <span>灵枢</span>
        </button>

        <!-- 切换为顶部导航 -->
        <button
          type="button"
          class="side-layout-switch"
          title="切换为顶部导航"
          aria-label="切换为顶部导航"
          @click="setNavMode('top')"
        >
          <VIcon icon="mdi:dock-top" />
        </button>
      </div>

      <nav class="side-menu">
        <router-link
          v-for="item in navItems"
          :key="item.key"
          :to="item.path"
          class="side-item"
          :class="{ active: isNavActive(item) }"
        >
          <span class="side-item-icon">
            <VIcon :icon="item.icon" />
          </span>

          <span>{{ item.label }}</span>

          <span class="active-marker"></span>
        </router-link>
      </nav>

      <div class="side-footer">
        <button
          type="button"
          class="nav-mode-card"
          @click="setNavMode('top')"
        >
          <VIcon icon="mdi:dock-top" />

          <span>
            <strong>顶部导航</strong>
            <small>切换布局</small>
          </span>
        </button>

        <ThemeToggle class="side-theme-toggle" />

        <div
          v-if="userStore.isLoggedIn"
          v-click-outside="closeUserMenu"
          class="side-user-menu"
        >
          <button
            type="button"
            class="side-user-trigger"
            @click="showUserMenu = !showUserMenu"
          >
            <VIcon
              icon="mdi:account-circle-outline"
              class="side-avatar"
            />

            <span class="side-user-info">
              <strong>{{ displayName }}</strong>
              <small>{{ roleName }}</small>
            </span>

            <VIcon
              icon="mdi:chevron-up"
              class="user-arrow"
              :class="{ rotated: showUserMenu }"
            />
          </button>

          <transition name="dropdown">
            <div
              v-if="showUserMenu"
              class="side-user-dropdown"
            >
              <button
                type="button"
                class="dropdown-item logout"
                @click="handleLogout"
              >
                <VIcon icon="mdi:logout" />
                <span>退出登录</span>
              </button>
            </div>
          </transition>
        </div>

        <router-link
          v-else
          to="/login"
          class="login-entry side-login-entry"
        >
          <VIcon icon="mdi:login" />
          <span>登录</span>
        </router-link>
      </div>
    </aside>

    <!-- 移动端顶部栏 -->
    <header class="mobile-header">
      <button
        type="button"
        class="mobile-menu-button"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <VIcon :icon="mobileMenuOpen ? 'mdi:close' : 'mdi:menu'" />
      </button>

      <button
        type="button"
        class="mobile-logo"
        @click="goHome"
      >
        <VIcon icon="mdi:brain" />
        <span>灵枢</span>
      </button>

      <button
        type="button"
        class="mobile-layout-button"
        @click="toggleNavMode"
      >
        <VIcon
          :icon="navMode === 'top'
            ? 'mdi:dock-left'
            : 'mdi:dock-top'"
        />
      </button>
    </header>

    <!-- 移动端菜单 -->
    <transition name="mobile-menu">
      <div
        v-if="mobileMenuOpen"
        class="mobile-menu-panel"
      >
        <router-link
          v-for="item in navItems"
          :key="item.key"
          :to="item.path"
          class="mobile-nav-item"
          :class="{ active: isNavActive(item) }"
          @click="mobileMenuOpen = false"
        >
          <VIcon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>

        <button
          type="button"
          class="mobile-nav-item"
          @click="toggleNavMode"
        >
          <VIcon
            :icon="navMode === 'top'
              ? 'mdi:dock-left'
              : 'mdi:dock-top'"
          />

          <span>
            切换为{{ navMode === 'top' ? '左侧' : '顶部' }}导航
          </span>
        </button>

        <router-link
          v-if="!userStore.isLoggedIn"
          to="/login"
          class="mobile-nav-item mobile-login-entry"
          @click="mobileMenuOpen = false"
        >
          <VIcon icon="mdi:login" />
          <span>登录</span>
        </router-link>

        <button
          v-else
          type="button"
          class="mobile-nav-item mobile-logout-entry"
          @click="handleLogout"
        >
          <VIcon icon="mdi:logout" />
          <span>退出登录</span>
        </button>
      </div>
    </transition>

    <!-- 页面内容 -->
    <div
      ref="pageShell"
      class="page-shell"
    >
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const showUserMenu = ref(false)
const mobileMenuOpen = ref(false)

const navMode = ref(getSavedNavMode())
const pageShell = ref(null)

const NAV_SWITCH_DURATION = 320

let navResizeFrame = 0
let navLayoutAnimation = null

function getSavedNavMode() {
  try {
    const savedMode = localStorage.getItem('lingshu-nav-mode')

    return savedMode === 'left'
      ? 'left'
      : 'top'
  } catch {
    return 'top'
  }
}

function shouldReduceMotion() {
  return window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches
}

function notifyLayoutResize() {
  cancelAnimationFrame(navResizeFrame)

  navResizeFrame = requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function animatePageShell(previousRect) {
  const shell = pageShell.value

  if (
    !shell ||
    !previousRect ||
    shouldReduceMotion() ||
    typeof shell.animate !== 'function'
  ) {
    return null
  }

  const currentRect = shell.getBoundingClientRect()
  const deltaX = previousRect.left - currentRect.left
  const deltaY = previousRect.top - currentRect.top

  navLayoutAnimation?.cancel()

  /*
   * FLIP：
   * 布局只计算一次，然后仅使用 transform / opacity 做动画。
   * 不再逐帧修改 margin-left、padding-top，避免页面反复重排。
   */
  navLayoutAnimation = shell.animate(
    [
      {
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
        opacity: 0.975,
      },
      {
        transform: 'translate3d(0, 0, 0)',
        opacity: 1,
      },
    ],
    {
      duration: NAV_SWITCH_DURATION,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    }
  )

  return navLayoutAnimation
}

async function setNavMode(mode) {
  if (navMode.value === mode) return

  const previousRect =
    pageShell.value?.getBoundingClientRect()

  navMode.value = mode
  showUserMenu.value = false
  mobileMenuOpen.value = false

  try {
    localStorage.setItem(
      'lingshu-nav-mode',
      mode
    )
  } catch {
    // 本地存储不可用时，仍允许当前页面切换
  }

  await nextTick()

  const animation = animatePageShell(previousRect)

  /*
   * 图表 resize 放到动画结束后执行，
   * 避免 ECharts 重算尺寸和导航动画挤在同一帧。
   */
  if (animation) {
    animation.finished
      .then(() => {
        navLayoutAnimation = null
        notifyLayoutResize()
      })
      .catch(() => {
        // 快速连续切换时旧动画会被取消，由新动画负责 resize
      })
  } else {
    notifyLayoutResize()
  }
}

function toggleNavMode() {
  setNavMode(
    navMode.value === 'top'
      ? 'left'
      : 'top'
  )
}

const displayName = computed(() =>
  userStore.user?.real_name ||
  userStore.user?.username ||
  '用户'
)

const ROLE_NAMES = {
  student: '学生',
  admin: '管理员',
  class_committee: '班委',
  counselor: '辅导员',
  student_affairs: '学工老师',
}

const roleName = computed(() =>
  ROLE_NAMES[userStore.userRole] ||
  '已登录'
)

const MANAGEMENT_HOME_BY_ROLE = {
  student: '/module3/student',
  admin: '/module3/batch-manage',
  class_committee: '/module3/class-leader',
  counselor: '/module3/class-leader',
  student_affairs: '/module3/teacher',
}

const managementHome = computed(() =>
  MANAGEMENT_HOME_BY_ROLE[userStore.userRole] ||
  '/module3/student'
)

const navItems = computed(() => {
  const items = []

  if (!userStore.isLoggedIn || userStore.userRole === 'student') {
    items.push(
      {
        key: 'home',
        label: '首页',
        path: '/home',
        section: '/home',
        icon: 'mdi:home-outline',
      },
      {
        key: 'smart-fill',
        label: '智能填表',
        path: '/zongce/smart-fill',
        section: '/zongce',
        icon: 'mdi:file-document-edit-outline',
      },
      {
        key: 'evaluation',
        label: '个性评定',
        path: '/module2/evaluation',
        section: '/module2',
        icon: 'mdi:chart-pie-outline',
      }
    )
  }

  if (userStore.userRole === 'admin') {
    items.push({
      key: 'workbench',
      label: '工作台',
      path: '/module3/admin',
      section: '/module3/admin',
      icon: 'mdi:view-dashboard-outline',
    })
  }

  if (userStore.userRole === 'counselor') {
    items.push({
      key: 'workbench',
      label: '工作台',
      path: '/module3/counselor',
      section: '/module3/counselor',
      icon: 'mdi:view-dashboard-outline',
    })
  }

  if (userStore.userRole === 'student_affairs') {
    items.push({
      key: 'workbench',
      label: '工作台',
      path: '/module3/student-affairs',
      section: '/module3/student-affairs',
      icon: 'mdi:view-dashboard-outline',
    })
  }

  if (userStore.userRole !== 'student_affairs' && userStore.userRole !== 'admin') {
    items.push({
      key: 'management',
      label: userStore.userRole === 'counselor' ? '评价管理' : '信息管理',
      path: managementHome.value,
      section: '/module3',
      icon: 'mdi:account-group-outline',
    })
  }

  if (userStore.isLoggedIn) {
    items.push({
      key: 'profile',
      label: '个人中心',
      path: '/module3/profile',
      section: '/module3/profile',
      icon: 'mdi:account-circle-outline',
    })
  }

  return items
})

function isNavActive(item) {
  if (item.key === 'home') {
    return route.path === '/home'
  }

  if (item.key === 'management') {
    const isWorkbench =
      (userStore.userRole === 'counselor' && route.path.startsWith('/module3/counselor')) ||
      (userStore.userRole === 'student_affairs' && route.path.startsWith('/module3/student-affairs'))

    return route.path.startsWith('/module3') &&
      !route.path.startsWith('/module3/profile') &&
      !isWorkbench
  }

  return route.path.startsWith(item.section)
}

function closeUserMenu() {
  showUserMenu.value = false
}

function goHome() {
  router.push('/home')
}

function handleLogout() {
  showUserMenu.value = false
  userStore.logout()
  router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    showUserMenu.value = false
    mobileMenuOpen.value = false
  }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(navResizeFrame)
  navLayoutAnimation?.cancel()
})
</script>

<style scoped>
.main-layout {
  --nav-height: 76px;
  --side-width: 250px;

  min-height: 100vh;
  position: relative;
  isolation: isolate;
  background: var(--gradient-cosmos, #0c0d13);
}

/* 背景 */

.bg-atmosphere {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(110px);
  opacity: 0.28;
}

.orb-one {
  width: 520px;
  height: 520px;
  top: -220px;
  right: -130px;
  background: rgba(99, 102, 241, 0.28);
}

.orb-two {
  width: 430px;
  height: 430px;
  bottom: -190px;
  left: 12%;
  background: rgba(139, 92, 246, 0.16);
}

/* =========================
   顶部导航
========================= */

.top-nav {
  height: var(--nav-height);
  padding: 0 34px;
  display: flex;
  align-items: center;
  gap: 34px;
  position: fixed;
  inset: 0 0 auto;
  z-index: 120;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  background: rgba(14, 15, 22, 0.87);
  backdrop-filter: blur(26px);
  -webkit-backdrop-filter: blur(26px);
}

.logo {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  color: #ffffff;
  background: transparent;
  font-size: 25px;
  font-weight: 950;
  cursor: pointer;
}

.logo svg {
  color: #f4b847;
  font-size: 30px;
}

.top-menu {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.nav-item {
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 13px;
  color: rgba(246, 242, 232, 0.65);
  font-size: 14px;
  font-weight: 750;
  text-decoration: none;
  transition:
    color 180ms ease,
    background 180ms ease;
}

.nav-item:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
}

.nav-item.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
}

.nav-item.active svg {
  color: #f4b847;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.layout-switch {
  height: 42px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 13px;
  color: rgba(246, 242, 232, 0.72);
  background: rgba(255, 255, 255, 0.055);
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition:
    color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.layout-switch:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
  transform: translateY(-1px);
}

/* =========================
   左侧导航
========================= */

.side-nav {
  width: var(--side-width);
  height: 100vh;
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 120;
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  background:
    linear-gradient(
      180deg,
      rgba(18, 19, 27, 0.96),
      rgba(11, 12, 18, 0.93)
    );
  box-shadow: 18px 0 60px rgba(0, 0, 0, 0.14);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
}

.side-header {
  height: 58px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.side-logo {
  min-width: 0;
  height: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  border: 0;
  border-radius: 15px;
  color: #ffffff;
  background: transparent;
  font-size: 25px;
  font-weight: 950;
  cursor: pointer;
}

.side-logo:hover {
  background: rgba(255, 255, 255, 0.055);
}

.side-logo svg {
  color: #f4b847;
  font-size: 30px;
}

.side-layout-switch {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 12px;
  color: rgba(246, 242, 232, 0.72);
  background: rgba(255, 255, 255, 0.055);
  font-size: 21px;
  cursor: pointer;
}

.side-layout-switch:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
}

.side-menu {
  margin-top: 26px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.side-item {
  height: 53px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  gap: 13px;
  position: relative;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 15px;
  color: rgba(246, 242, 232, 0.67);
  font-size: 15px;
  font-weight: 750;
  text-decoration: none;
  transition:
    color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.side-item:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
  transform: translateX(2px);
}

.side-item.active {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.09);
  background: rgba(255, 255, 255, 0.075);
}

.side-item-icon {
  width: 24px;
  display: flex;
  justify-content: center;
  font-size: 23px;
}

.side-item.active .side-item-icon {
  color: #f4b847;
}

.active-marker {
  width: 3px;
  height: 24px;
  position: absolute;
  right: 5px;
  top: 50%;
  border-radius: 999px;
  background: #f4b847;
  opacity: 0;
  transform: translateY(-50%) scaleY(0.4);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.side-item.active .active-marker {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.side-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nav-mode-card {
  min-height: 55px;
  padding: 8px 11px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  color: rgba(246, 242, 232, 0.72);
  background: rgba(255, 255, 255, 0.055);
  text-align: left;
  cursor: pointer;
}

.nav-mode-card:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
}

.nav-mode-card > svg {
  font-size: 23px;
  color: #f4b847;
}

.nav-mode-card > span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-mode-card strong {
  color: inherit;
  font-size: 13px;
}

.nav-mode-card small {
  color: rgba(246, 242, 232, 0.43);
  font-size: 11px;
}

/* 用户菜单 */

.user-menu,
.side-user-menu {
  position: relative;
}

.user-trigger {
  height: 42px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 13px;
  color: rgba(246, 242, 232, 0.76);
  background: rgba(255, 255, 255, 0.055);
  cursor: pointer;
}

.user-trigger > svg:first-child {
  color: #f4b847;
  font-size: 23px;
}

.user-arrow {
  transition: transform 180ms ease;
}

.user-arrow.rotated {
  transform: rotate(180deg);
}

.user-dropdown {
  min-width: 170px;
  padding: 8px;
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 14px;
  background: rgba(17, 18, 26, 0.96);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.side-user-trigger {
  width: 100%;
  min-height: 58px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  color: rgba(246, 242, 232, 0.72);
  background: rgba(255, 255, 255, 0.055);
  cursor: pointer;
}

.side-avatar {
  color: #f4b847;
  font-size: 30px;
}

.side-user-info {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.side-user-info strong {
  max-width: 130px;
  overflow: hidden;
  color: #ffffff;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-user-info small {
  color: rgba(246, 242, 232, 0.43);
  font-size: 11px;
}

.side-user-dropdown {
  min-width: 180px;
  padding: 8px;
  position: absolute;
  left: calc(100% + 12px);
  bottom: 0;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 14px;
  background: rgba(17, 18, 26, 0.96);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  color: rgba(246, 242, 232, 0.72);
  background: transparent;
  cursor: pointer;
}

.dropdown-item:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.07);
}

.dropdown-item.logout {
  color: #ef7777;
}

/* 页面区域 */

.page-shell {
  min-height: 100vh;
  position: relative;
  z-index: 1;

  /*
   * 布局属性只更新一次，视觉移动由 FLIP 的 transform 完成。
   * 避免逐帧修改 margin-left / padding-top 引发重排。
   */
  transform-origin: top left;
  backface-visibility: hidden;
  transition: none;
}

.nav-top .page-shell {
  margin-left: 0;
  padding-top: var(--nav-height);
}

.nav-left .page-shell {
  margin-left: var(--side-width);
  padding-top: 0;
}

.content {
  width: 100%;
  max-width: 1500px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 34px 40px 70px;
}

/* ==================================================
   导航布局切换动画
   只动画 transform / opacity，不动画布局属性
================================================== */

.top-nav,
.side-nav {
  backface-visibility: hidden;
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: no-preference) {
  .top-nav {
    animation: top-nav-smooth-enter 280ms
      cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .side-nav {
    animation: side-nav-smooth-enter 300ms
      cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}

@keyframes top-nav-smooth-enter {
  from {
    opacity: 0.72;
    transform: translate3d(0, -8px, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes side-nav-smooth-enter {
  from {
    opacity: 0.72;
    transform: translate3d(-9px, 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* 浅色主题 */

:global(html[data-theme='light']) .top-nav,
:global(html[data-theme='light']) .side-nav {
  border-color: rgba(74, 69, 58, 0.13);
  background:
    linear-gradient(
      180deg,
      rgba(255, 251, 244, 0.96),
      rgba(244, 238, 228, 0.94)
    );
}

:global(html[data-theme='light']) .logo,
:global(html[data-theme='light']) .side-logo {
  color: #30352f;
}

:global(html[data-theme='light']) .nav-item,
:global(html[data-theme='light']) .side-item {
  color: #686c65;
}

:global(html[data-theme='light']) .nav-item:hover,
:global(html[data-theme='light']) .nav-item.active,
:global(html[data-theme='light']) .side-item:hover,
:global(html[data-theme='light']) .side-item.active {
  color: #30352f;
  background: rgba(102, 123, 109, 0.1);
}

:global(html[data-theme='light']) .layout-switch,
:global(html[data-theme='light']) .side-layout-switch,
:global(html[data-theme='light']) .nav-mode-card,
:global(html[data-theme='light']) .side-user-trigger,
:global(html[data-theme='light']) .user-trigger {
  color: #686c65;
  border-color: rgba(74, 69, 58, 0.13);
  background: rgba(102, 123, 109, 0.07);
}

:global(html[data-theme='light']) .side-user-info strong {
  color: #30352f;
}

/* 移动端 */

.mobile-header,
.mobile-menu-panel {
  display: none;
}

@media (max-width: 900px) {
  .top-nav,
  .side-nav {
    display: none;
  }

  .mobile-header {
    height: 64px;
    padding: 0 15px;
    display: flex;
    align-items: center;
    position: fixed;
    inset: 0 0 auto;
    z-index: 130;
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(14, 15, 22, 0.93);
    backdrop-filter: blur(24px);
  }

  .mobile-menu-button,
  .mobile-layout-button {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 12px;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
    font-size: 22px;
  }

  .mobile-logo {
    margin-left: 10px;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    border: 0;
    color: #ffffff;
    background: transparent;
    font-size: 20px;
    font-weight: 900;
  }

  .mobile-logo svg {
    color: #f4b847;
    font-size: 26px;
  }

  .mobile-menu-panel {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: fixed;
    inset: 64px 12px auto;
    z-index: 125;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    background: rgba(17, 18, 26, 0.97);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
  }

  .mobile-nav-item {
    min-height: 48px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: 12px;
    color: rgba(246, 242, 232, 0.72);
    background: transparent;
    font-size: 14px;
    font-weight: 750;
    text-decoration: none;
  }

  .mobile-nav-item.active,
  .mobile-nav-item:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .nav-top .page-shell,
  .nav-left .page-shell {
    margin-left: 0;
    padding-top: 64px;
  }

  .content {
    padding: 22px 16px 55px;
  }
}

/* 动画 */

.dropdown-enter-active,
.dropdown-leave-active,
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .top-nav,
  .side-nav,
  .page-shell {
    animation: none !important;
    transition-duration: 1ms !important;
  }
}

/* ==================================================
   仅修复登录元素：入口、用户名、退出登录可读性
================================================== */

.main-layout .top-actions > .user-menu {
  width: auto !important;
  min-width: 0 !important;
  height: auto !important;
  padding: 0 !important;
  display: block !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.login-entry {
  min-height: 42px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 13px;
  color: #f6f2e8;
  background: rgba(255, 255, 255, 0.07);
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.login-entry svg {
  color: #f4b847;
  font-size: 20px;
}

.login-entry:hover {
  color: #ffffff;
  border-color: rgba(244, 184, 71, 0.36);
  background: rgba(255, 255, 255, 0.11);
  transform: translateY(-1px);
}

.side-login-entry {
  width: 100%;
  min-height: 54px;
}

.main-layout.nav-top .user-trigger > span,
.main-layout.nav-left .side-user-info strong {
  color: #ffffff !important;
  opacity: 1 !important;
  font-weight: 800;
}

.main-layout .user-dropdown,
.main-layout .side-user-dropdown {
  color: #ffffff;
  background: rgba(21, 22, 29, 0.98) !important;
  border-color: rgba(255, 255, 255, 0.13) !important;
}

.main-layout .user-dropdown .dropdown-item.logout,
.main-layout .side-user-dropdown .dropdown-item.logout {
  color: #ffffff !important;
  opacity: 1 !important;
}

.main-layout .user-dropdown .dropdown-item.logout svg,
.main-layout .side-user-dropdown .dropdown-item.logout svg {
  color: #ffffff !important;
}

.main-layout .user-dropdown .dropdown-item.logout:hover,
.main-layout .side-user-dropdown .dropdown-item.logout:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .user-trigger {
  color: #252a26 !important;
  background: rgba(255, 252, 246, 0.9) !important;
  border-color: rgba(74, 69, 58, 0.18) !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .user-trigger > span {
  color: #202420 !important;
  opacity: 1 !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .user-trigger > svg:first-child {
  color: #c98a18 !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .user-trigger
  .user-arrow {
  color: #59615a !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .top-login-entry {
  color: #30352f;
  background: rgba(255, 252, 246, 0.9);
  border-color: rgba(74, 69, 58, 0.18);
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .top-login-entry:hover {
  color: #202420;
  background: #fffaf2;
  border-color: rgba(102, 123, 109, 0.38);
}

:global(html[data-theme='light'])
  .main-layout.nav-top
  .user-dropdown {
  color: #ffffff !important;
  background: rgba(21, 22, 29, 0.98) !important;
  border-color: rgba(255, 255, 255, 0.13) !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-left
  .side-user-info strong {
  color: #30352f !important;
}

:global(html[data-theme='light'])
  .main-layout.nav-left
  .side-login-entry {
  color: #30352f;
  background: rgba(102, 123, 109, 0.08);
  border-color: rgba(74, 69, 58, 0.16);
}

:global(html[data-theme='light'])
  .main-layout.nav-left
  .side-login-entry:hover {
  color: #202420;
  background: rgba(102, 123, 109, 0.13);
  border-color: rgba(102, 123, 109, 0.34);
}

.mobile-login-entry {
  color: #ffffff;
}

.mobile-login-entry svg {
  color: #f4b847;
}

.mobile-logout-entry,
.mobile-logout-entry svg {
  color: #ffffff;
}

</style>

<style>
/* FINAL_LOGIN_AND_LEFT_NAV_THEME_FIX */

/* ==================================================
   顶部导航 + 米白主题：用户名必须清晰可见
================================================== */

html[data-theme='light']
body
.main-layout.nav-top
.top-actions
.user-menu {
  color: #111111 !important;
  background: transparent !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.top-actions
.user-trigger {
  color: #111111 !important;
  background: rgba(255, 252, 246, 0.94) !important;
  border-color: rgba(74, 69, 58, 0.20) !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.top-actions
.user-trigger > span {
  color: #111111 !important;
  -webkit-text-fill-color: #111111 !important;
  opacity: 1 !important;
  font-weight: 900 !important;
  text-shadow: none !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.top-actions
.user-trigger > svg:first-child {
  color: #e6a21d !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.top-actions
.user-trigger
.user-arrow {
  color: #444b45 !important;
}

/* 顶部用户下拉框保持深色，退出登录保持白色 */
html[data-theme='light']
body
.main-layout.nav-top
.user-dropdown {
  color: #ffffff !important;
  background: rgba(21, 22, 29, 0.98) !important;
  border-color: rgba(255, 255, 255, 0.13) !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.user-dropdown
.dropdown-item.logout,
html[data-theme='light']
body
.main-layout.nav-top
.user-dropdown
.dropdown-item.logout svg,
html[data-theme='light']
body
.main-layout.nav-top
.user-dropdown
.dropdown-item.logout span {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-theme='light']
body
.main-layout.nav-top
.user-dropdown
.dropdown-item.logout:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
}


/* ==================================================
   左侧导航 + 米白主题：导航栏完全沿用深色主题
   页面主体仍保持米白主题
================================================== */

html[data-theme='light']
body
.main-layout.nav-left
.side-nav {
  color: rgba(246, 242, 232, 0.72) !important;
  background:
    linear-gradient(
      180deg,
      rgba(18, 19, 27, 0.96),
      rgba(11, 12, 18, 0.93)
    ) !important;
  border-right-color: rgba(255, 255, 255, 0.09) !important;
  box-shadow: 18px 0 60px rgba(0, 0, 0, 0.14) !important;

  /* 主题按钮在左侧导航中也必须使用深色主题配色 */
  --theme-toggle-bg: rgba(255, 255, 255, 0.07);
  --theme-toggle-border: rgba(255, 255, 255, 0.15);
  --theme-toggle-border-hover: rgba(244, 184, 71, 0.44);
  --theme-toggle-text: rgba(246, 242, 232, 0.82);
  --theme-toggle-track: rgba(255, 255, 255, 0.10);
  --theme-toggle-track-border: rgba(255, 255, 255, 0.10);
  --theme-toggle-thumb: #f4b847;
  --theme-toggle-icon: #11110f;
  --theme-toggle-thumb-shadow: rgba(0, 0, 0, 0.28);
  --theme-toggle-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-logo {
  color: #ffffff !important;
  background: transparent !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-logo:hover {
  background: rgba(255, 255, 255, 0.055) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-logo svg {
  color: #f4b847 !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-layout-switch {
  color: rgba(246, 242, 232, 0.72) !important;
  background: rgba(255, 255, 255, 0.055) !important;
  border-color: rgba(255, 255, 255, 0.11) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-layout-switch:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-item {
  color: rgba(246, 242, 232, 0.67) !important;
  background: transparent !important;
  border-color: transparent !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-item:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.07) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-item.active {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.075) !important;
  border-color: rgba(255, 255, 255, 0.09) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-item.active
.side-item-icon {
  color: #f4b847 !important;
  background: transparent !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.active-marker {
  background-color: #f4b847 !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.nav-mode-card,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-trigger,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-login-entry {
  color: rgba(246, 242, 232, 0.76) !important;
  background: rgba(255, 255, 255, 0.055) !important;
  border-color: rgba(255, 255, 255, 0.10) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.nav-mode-card:hover,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-trigger:hover,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-login-entry:hover {
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.09) !important;
  border-color: rgba(255, 255, 255, 0.13) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.nav-mode-card > svg,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-avatar,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-login-entry svg {
  color: #f4b847 !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.nav-mode-card strong,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-info strong {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.nav-mode-card small,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-info small {
  color: rgba(246, 242, 232, 0.43) !important;
}

/* 左侧主题按钮：文字、轨道、图标全部恢复深色主题样式 */
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.theme-toggle {
  color: rgba(246, 242, 232, 0.82) !important;
  background: rgba(255, 255, 255, 0.07) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.theme-toggle:hover {
  border-color: rgba(244, 184, 71, 0.44) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.theme-toggle
.toggle-label {
  color: rgba(246, 242, 232, 0.82) !important;
  -webkit-text-fill-color: rgba(246, 242, 232, 0.82) !important;
  opacity: 1 !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.theme-toggle
.toggle-track {
  background: rgba(255, 255, 255, 0.10) !important;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.10) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.theme-toggle
.toggle-thumb {
  color: #11110f !important;
  background: #f4b847 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28) !important;
}

/* 左侧用户下拉菜单始终保持深色 */
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-dropdown {
  color: #ffffff !important;
  background: rgba(17, 18, 26, 0.98) !important;
  border-color: rgba(255, 255, 255, 0.11) !important;
}

html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-dropdown
.dropdown-item.logout,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-dropdown
.dropdown-item.logout svg,
html[data-theme='light']
body
.main-layout.nav-left
.side-nav
.side-user-dropdown
.dropdown-item.logout span {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
</style>
