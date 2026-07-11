<template>
  <div class="home">
    <!-- 顶部主视觉 -->
    <section class="hero-section">
      <div class="hero-bg-grid"></div>
      <div class="hero-glow hero-glow-one"></div>
      <div class="hero-glow hero-glow-two"></div>

      <div class="hero-content">
        <div class="hero-badge">
          <span></span>
          LingShu Intelligence Hub
        </div>

        <h1 class="hero-title">
  <span class="hero-title-line">
    <span class="brand-word">灵枢</span>
    <em>五维智评中枢</em>
  </span>
  <strong>让综测从填报，走向智能画像</strong>
</h1>


        <p>
          基于 AI 语义匹配、材料智能识别、五维画像分析与闭环流程管理，
          将综合测评流程连接成一条清晰、高效、可追踪的智慧经络。
        </p>

        <div class="hero-actions">
          <button
            class="primary-btn"
            @mouseenter="preloadSmartFill"
            @focus="preloadSmartFill"
            @click="goTo('/zongce/smart-fill')"
          >
            <VIcon icon="mdi:lightning-bolt" />
            开始智能填表
          </button>

          <button class="ghost-btn" @click="goTo('/module2/evaluation')">
            查看五维评定
            <VIcon icon="mdi:arrow-right" />
          </button>
        </div>

        <div class="hero-stats">
          <div class="stat-card">
            <strong>AI</strong>
            <span>语义匹配</span>
          </div>
          <div class="stat-card">
            <strong>五维</strong>
            <span>智能画像</span>
          </div>
          <div class="stat-card">
            <strong>闭环</strong>
            <span>流程追踪</span>
          </div>
        </div>
      </div>

      <div class="hero-visual">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="orbit orbit-three"></div>

        <div class="center-card">
          <div class="center-icon">
            <VIcon icon="mdi:brain" />
          </div>
          <strong>AI</strong>
          <span>智评引擎</span>
        </div>

        <div
          v-for="item in dimensions"
          :key="item.name"
          class="dimension-node"
          :class="item.className"
          :style="{ '--node-color': item.color }"
        >
          <VIcon :icon="item.icon" />
          <span>{{ item.name }}</span>
        </div>
      </div>
    </section>

    <!-- 功能模块 -->
    <section class="module-section">
      <div class="section-header">
        <div>
          <span>Meridian Workflow</span>
          <h2>经络式智能工作流</h2>
        </div>
        <p>
          从材料上传、智能填表、信息管理、五维评定到报告生成，把综测流程重新编排成清晰顺畅的经络式闭环。
        </p>
      </div>

      <div class="module-grid">
        <div
          v-for="item in modules"
          :key="item.path"
          class="module-card"
          :class="{ large: item.large, wide: item.wide }"
          :style="{ '--theme-color': item.color }"
          @mouseenter="item.path === '/zongce/smart-fill' && preloadSmartFill()"
          @focusin="item.path === '/zongce/smart-fill' && preloadSmartFill()"
          @click="goTo(item.path)"
        >
          <div class="card-light"></div>

          <div class="card-top">
            <div class="card-icon">
              <VIcon :icon="item.icon" />
            </div>
            
          </div>

          <div class="card-main">
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>

          <div class="card-bottom">
            <span>{{ item.stage }}</span>
            <VIcon icon="mdi:arrow-top-right" />
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';

const router = useRouter();
const userStore = useUserStore();

let smartFillPreloadPromise;

function preloadSmartFill() {
  smartFillPreloadPromise ||= import('./zongce/SmartFill.vue');
}

function goTo(path) {
  if (path === '/zongce/smart-fill') preloadSmartFill();
  router.push(path);
}

onMounted(() => {
  const scheduleIdle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 300));
  scheduleIdle(preloadSmartFill);
});

const MANAGEMENT_HOME_BY_ROLE = {
  student: '/module3/student',
  admin: '/module3/batch-manage',
  class_committee: '/module3/class-leader',
  counselor: '/module3/class-leader',
  student_affairs: '/module3/teacher',
};

const managementHome = computed(() => (
  MANAGEMENT_HOME_BY_ROLE[userStore.userRole] || '/module3/student'
));

const dimensions = [
  {
    name: '智育',
    icon: 'mdi:book-open-page-variant-outline',
    color: '#4F46E5',
    className: 'node-zhiyu'
  },
  {
    name: '德育',
    icon: 'mdi:hand-heart-outline',
    color: '#D97706',
    className: 'node-deyu'
  },
  {
    name: '体育',
    icon: 'mdi:run-fast',
    color: '#059669',
    className: 'node-tiyu'
  },
  {
    name: '美育',
    icon: 'mdi:palette-outline',
    color: '#7C3AED',
    className: 'node-meiyu'
  },
  {
    name: '劳育',
    icon: 'mdi:hammer-wrench',
    color: '#EA580C',
    className: 'node-laoyu'
  }
];

const modules = computed(() => [
  {
    title: '智能填表',
    desc: 'AI 自动识别材料内容，匹配综测规则和表单字段，是整个平台的核心入口。',
    path: '/zongce/smart-fill',
    icon: 'mdi:auto-fix',
    color: '#4F46E5',
    stage: 'Material → Form',
    large: true
  },
  {
    title: '信息管理',
    desc: '按登录身份进入对应管理台，材料状态、班级初审、批次管理与老师总控统一收口。',
    path: managementHome.value,
    icon: 'mdi:account-group-outline',
    color: '#F59E0B',
    stage: 'Manage → Review',
    large: true
  },
  {
    title: '批量填表',
    desc: '批量处理多人材料，减少重复录入，适合班级或批次集中填报。',
    path: '/zongce/batch-fill',
    icon: 'mdi:file-multiple-outline',
    color: '#059669',
    stage: 'Batch'
  },
  {
    title: '对话填表',
    desc: '用自然语言补充材料信息，让缺失字段通过问答方式快速完善。',
    path: '/zongce/chat-fill',
    icon: 'mdi:chat-processing-outline',
    color: '#7C3AED',
    stage: 'Chat'
  },
  {
    title: '评定结果',
    desc: '查看五维评分、画像分析与评定结果，快速定位优势和待提升项。',
    path: '/module2/evaluation',
    icon: 'mdi:chart-box-outline',
    color: '#D97706',
    stage: 'Evaluate'
  },
  {
    title: '评定报告',
    desc: '生成智能评语、改进建议与综测报告，形成可导出的最终成果。',
    path: '/module2/report',
    icon: 'mdi:file-chart-outline',
    color: '#06B6D4',
    stage: 'Report'
  },
]);
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 42px;
  padding-bottom: 72px;
}

/* 顶部主视觉 */
.hero-section {
  position: relative;
  min-height: 560px;
  margin: -40px -40px 0;
  padding: 72px min(7vw, 96px);
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  align-items: center;
  gap: 48px;
  overflow: hidden;
  isolation: isolate;
  border-radius: 0 0 36px 36px;
  background:
    radial-gradient(circle at 74% 45%, rgba(99, 102, 241, 0.25), transparent 32%),
    radial-gradient(circle at 88% 18%, rgba(139, 92, 246, 0.16), transparent 28%),
    radial-gradient(circle at 18% 25%, rgba(6, 182, 212, 0.13), transparent 30%),
    linear-gradient(135deg, #f8faff 0%, #eef2ff 45%, #f7f0ff 100%);
  box-shadow: 0 34px 110px rgba(79, 70, 229, 0.13);
}

.hero-bg-grid {
  position: absolute;
  inset: 0;
  z-index: -2;
  background-image:
    linear-gradient(rgba(79, 70, 229, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 70, 229, 0.055) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at 70% 45%, black 0%, transparent 68%);
}

.hero-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.56;
  z-index: -1;
}

.hero-glow-one {
  width: 300px;
  height: 300px;
  left: 12%;
  top: 18%;
  background: rgba(6, 182, 212, 0.18);
}

.hero-glow-two {
  width: 360px;
  height: 360px;
  right: 13%;
  bottom: -6%;
  background: rgba(139, 92, 246, 0.2);
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.78);
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: 0 10px 30px rgba(79, 70, 229, 0.08);
  backdrop-filter: blur(18px);
}

.hero-badge span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #8b5cf6);
  box-shadow: 0 0 0 7px rgba(99, 102, 241, 0.1);
}

.hero-content h1 {
  margin-top: 24px;
  max-width: 860px;
  color: rgba(8, 6, 20, 0.92);
  font-size: clamp(42px, 4.6vw, 68px);
  line-height: 1.16;
  letter-spacing: -0.055em;
  font-weight: 850;
  overflow: visible;
}

.hero-content h1 .brand-word {
  display: inline-block;
  margin-right: 10px;
  padding-bottom: 10px;
  font-size: clamp(72px, 8vw, 118px);
  font-weight: 950;
  letter-spacing: -0.04em;
  line-height: 1.12;
  background:
    linear-gradient(135deg, #1e1b4b 0%, #4338ca 34%, #7c3aed 66%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 18px 38px rgba(79, 70, 229, 0.22));
}

.hero-content h1 em {
  font-style: normal;
  font-size: clamp(34px, 4vw, 58px);
  font-weight: 850;
  letter-spacing: -0.055em;
  color: rgba(15, 23, 42, 0.88);
}

.hero-content h1 strong {
  display: block;
  margin-top: 12px;
  font-size: clamp(22px, 2.25vw, 34px);
  line-height: 1.28;
  font-weight: 800;
  letter-spacing: -0.035em;
  background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 54%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 10px 24px rgba(79, 70, 229, 0.12));
}

.hero-content p {
  max-width: 670px;
  margin-top: 22px;
  color: var(--color-text-secondary, #64748b);
  font-size: 17px;
  line-height: 1.9;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 32px;
}

.primary-btn,
.ghost-btn {
  height: 50px;
  padding: 0 26px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.25s ease;
}

.primary-btn {
  color: #fff;
  background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  box-shadow: 0 18px 42px rgba(79, 70, 229, 0.28);
}

.primary-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 24px 58px rgba(79, 70, 229, 0.34);
}

.ghost-btn {
  color: var(--color-text, #1e293b);
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.ghost-btn:hover {
  transform: translateY(-2px);
  color: var(--color-primary, #4f46e5);
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}

.stat-card {
  min-width: 136px;
  padding: 15px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 50px rgba(79, 70, 229, 0.08);
  backdrop-filter: blur(18px);
}

.stat-card strong {
  display: block;
  font-size: 28px;
  line-height: 1;
  color: var(--color-primary, #4f46e5);
}

.stat-card span {
  display: block;
  margin-top: 7px;
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
}

/* 右侧视觉 */
.hero-visual {
  position: relative;
  min-height: 470px;
  display: grid;
  place-items: center;
}

.orbit {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(79, 70, 229, 0.14);
  box-shadow: inset 0 0 36px rgba(99, 102, 241, 0.035);
}

.orbit-one {
  width: 430px;
  height: 430px;
  animation: rotateSlow 38s linear infinite;
}

.orbit-two {
  width: 330px;
  height: 330px;
  border-style: dashed;
  animation: rotateSlow 26s linear infinite reverse;
}

.orbit-three {
  width: 220px;
  height: 220px;
  border-color: rgba(6, 182, 212, 0.18);
}

.center-card {
  position: relative;
  z-index: 3;
  width: 178px;
  height: 210px;
  padding: 28px 20px;
  border-radius: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.46));
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow:
    0 30px 90px rgba(79, 70, 229, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(24px);
  animation: float 5s ease-in-out infinite;
}

.center-icon {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 38px;
  background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  box-shadow: 0 18px 40px rgba(79, 70, 229, 0.3);
}

.center-card strong {
  margin-top: 18px;
  font-size: 30px;
  line-height: 1;
  color: var(--color-text, #1e293b);
}

.center-card span {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
}

.dimension-node {
  position: absolute;
  z-index: 2;
  width: 86px;
  height: 86px;
  border-radius: 28px;
  display: grid;
  place-items: center;
  color: var(--node-color);
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow: 0 20px 60px rgba(79, 70, 229, 0.1);
  backdrop-filter: blur(20px);
}

.dimension-node svg {
  font-size: 26px;
}

.dimension-node span {
  font-size: 12px;
  font-weight: 700;
}

.node-zhiyu {
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
}

.node-deyu {
  top: 142px;
  right: 18px;
}

.node-tiyu {
  bottom: 42px;
  right: 76px;
}

.node-meiyu {
  bottom: 42px;
  left: 76px;
}

.node-laoyu {
  top: 142px;
  left: 18px;
}

/* 功能区 */
.module-section {
  position: relative;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 32px;
  margin-bottom: 24px;
}

.section-header span {
  color: var(--color-primary, #4f46e5);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.section-header h2 {
  margin-top: 6px;
  font-size: clamp(28px, 3vw, 40px);
  line-height: 1.15;
  color: var(--color-text, #1e293b);
  letter-spacing: -0.03em;
}

.section-header p {
  max-width: 520px;
  color: var(--color-text-secondary, #64748b);
  font-size: 14px;
  line-height: 1.8;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-auto-rows: 168px;
  gap: 18px;
  align-items: stretch;
}

.module-card {
  position: relative;
  grid-column: span 2;
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border-radius: 28px;
  cursor: pointer;
  background:
    radial-gradient(circle at 90% 10%, rgba(99, 102, 241, 0.12), transparent 32%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.46));
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 20px 70px rgba(79, 70, 229, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(22px);
  transition: all 0.25s ease;
}

.module-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--theme-color);
  opacity: 0.55;
}

.card-light {
  position: absolute;
  right: -70px;
  bottom: -90px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: var(--theme-color);
  opacity: 0.13;
  filter: blur(24px);
  transition: all 0.25s ease;
}

.module-card:hover {
  transform: translateY(-7px);
  border-color: rgba(99, 102, 241, 0.24);
  box-shadow:
    0 30px 90px rgba(79, 70, 229, 0.14),
    0 10px 34px rgba(99, 102, 241, 0.1);
}

.module-card:hover .card-light {
  transform: scale(1.12);
  opacity: 0.18;
}

.module-card.large {
  grid-column: span 4;
  grid-row: span 2;
  padding: 30px;
}

.module-card.wide {
  grid-column: span 4;
}

.card-top,
.card-bottom {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-icon {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: var(--theme-color);
  background: rgba(255, 255, 255, 0.65);
  font-size: 28px;
}

.module-card.large .card-icon {
  width: 68px;
  height: 68px;
  border-radius: 24px;
  font-size: 36px;
}

.card-top span {
  padding: 6px 11px;
  border-radius: 999px;
  color: var(--theme-color);
  background: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  font-weight: 700;
}

.card-main {
  position: relative;
  z-index: 1;
}

.card-main h3 {
  font-size: 19px;
  color: var(--color-text, #1e293b);
}

.module-card.large .card-main h3 {
  font-size: 34px;
  letter-spacing: -0.04em;
}

.module-card:nth-child(1) {
  background:
    radial-gradient(circle at 88% 14%, rgba(79, 70, 229, 0.18), transparent 36%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.48));
}

.module-card:nth-child(2) {
  background:
    radial-gradient(circle at 88% 14%, rgba(245, 158, 11, 0.2), transparent 36%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.48));
}

.card-main p {
  margin-top: 9px;
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.7;
}

.module-card.large .card-main p {
  max-width: 520px;
  font-size: 15px;
  line-height: 1.9;
}

.card-bottom {
  color: var(--theme-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.card-bottom svg {
  font-size: 19px;
  transition: transform 0.25s ease;
}

.module-card:hover .card-bottom svg {
  transform: translate(3px, -3px);
}

/* 动画 */
@keyframes rotateSlow {
  to {
    transform: rotate(360deg);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-12px);
  }
}

/* 响应式 */
@media (max-width: 1180px) {
  .hero-section {
    grid-template-columns: 1fr;
  }

  .module-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-auto-rows: 168px;
  }

  .module-card {
    grid-column: span 2;
  }

  .module-card.large,
  .module-card.wide {
    grid-column: span 2;
    grid-row: span 2;
  }

}

@media (max-width: 720px) {
  .home {
    gap: 28px;
  }

  .hero-section {
    margin: -16px -16px 0;
    padding: 42px 18px;
    min-height: auto;
    border-radius: 0 0 26px 26px;
  }

  .hero-content h1 {
    font-size: 38px;
    line-height: 1.16;
  }

  .hero-content h1 .brand-word {
    display: block;
    font-size: 68px;
    margin-right: 0;
    margin-bottom: 8px;
    padding-bottom: 8px;
    line-height: 1.12;
  }

  .hero-content h1 em {
    display: block;
    font-size: 30px;
  }

  .hero-content h1 strong {
    font-size: 22px;
  }

  .hero-content p {
    font-size: 14px;
  }

  .hero-visual {
    display: none;
  }

  .section-header {
    display: block;
  }

  .section-header p {
    margin-top: 12px;
  }

  .module-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }

  .module-card,
  .module-card.large,
  .module-card.wide {
    grid-column: auto;
    grid-row: auto;
    min-height: 190px;
  }

  .module-card.large .card-main h3 {
    font-size: 24px;
  }

}
</style>
