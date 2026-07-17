<template>
  <div class="home" ref="pageRef">
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

        <div class="hero-stats reveal-on-scroll" style="--reveal-delay: 0.1s">
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
      <div class="section-header reveal-on-scroll">
        <div>
          <span>Meridian Workflow</span>
          <h2>经络式智能工作流</h2>
        </div>
        <p>
          从材料上传、智能填表、信息管理、五维评定到报告生成，把综测流程重新编排成清晰顺畅的经络式闭环。
        </p>
      </div>

      <!-- 经络树 -->
      <div class="meridian-tree">
        <div class="trunk-line"></div>
        <div
          v-for="(item, idx) in modules"
          :key="item.path"
          class="branch-row"
        >
          <!-- 左卡（偶数索引）：desc在右 -->
          <template v-if="idx % 2 === 0">
            <div class="branch-card branch-left reveal-on-scroll"
              :data-reveal-idx="idx"
              :style="{ '--theme-color': item.color, '--reveal-delay': (idx * 0.08) + 's', '--card-height': (item.tall ? '280px' : idx === 0 ? '260px' : '220px') }"
              @mouseenter="item.path === '/zongce/smart-fill' && preloadSmartFill()"
              @focusin="item.path === '/zongce/smart-fill' && preloadSmartFill()"
              @click="goTo(item.path)"
            >
              <div class="branch-connector"></div>
              <div class="branch-card-inner">
                <div class="card-light"></div>
                <div class="card-top"><div class="card-icon"><VIcon :icon="item.icon" /></div><span>{{ item.tag }}</span></div>
                <div class="card-main"><h3>{{ item.title }}</h3><p>{{ item.desc }}</p></div>
                <div class="card-bottom"><span>{{ item.stage }}</span><VIcon icon="mdi:arrow-top-right" /></div>
              </div>
            </div>
            <div class="branch-dot dot-center"></div>
            <div class="branch-desc desc-right">
              <div class="desc-guide"></div>
              <p class="desc-typewriter">
                <span v-if="typedTexts[idx]">{{ typedTexts[idx] }}</span>
                <span v-if="!typedTexts[idx] || typedTexts[idx].length < (item.desc_long || item.desc).length" class="cursor">|</span>
              </p>
            </div>
          </template>
          <!-- 右卡（奇数索引）：desc在左 -->
          <template v-else>
            <div class="branch-desc desc-left">
              <div class="desc-guide"></div>
              <p class="desc-typewriter">
                <span v-if="typedTexts[idx]">{{ typedTexts[idx] }}</span>
                <span v-if="!typedTexts[idx] || typedTexts[idx].length < (item.desc_long || item.desc).length" class="cursor">|</span>
              </p>
            </div>
            <div class="branch-dot dot-center"></div>
            <div class="branch-card branch-right reveal-on-scroll"
              :data-reveal-idx="idx"
              :style="{ '--theme-color': item.color, '--reveal-delay': (idx * 0.08) + 's', '--card-height': (item.tall ? '280px' : idx === 0 ? '260px' : '220px') }"
              @mouseenter="item.path === '/zongce/smart-fill' && preloadSmartFill()"
              @focusin="item.path === '/zongce/smart-fill' && preloadSmartFill()"
              @click="goTo(item.path)"
            >
              <div class="branch-connector"></div>
              <div class="branch-card-inner">
                <div class="card-light"></div>
                <div class="card-top"><div class="card-icon"><VIcon :icon="item.icon" /></div><span>{{ item.tag }}</span></div>
                <div class="card-main"><h3>{{ item.title }}</h3><p>{{ item.desc }}</p></div>
                <div class="card-bottom"><span>{{ item.stage }}</span><VIcon icon="mdi:arrow-top-right" /></div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="workflow-spacer" aria-hidden="true"></div>

      <div class="workflow-ambient reveal-on-scroll" aria-hidden="true" style="--reveal-delay: 0.15s">
        <div class="ambient-line"></div>
        <div class="ambient-copy">
          <span>LingShu Meridian</span>
          <strong>五维脉络自然汇合</strong>
          <p>以轻量留白承接上方工作流，保持页面呼吸感。</p>
        </div>

        <div class="ambient-nodes">
          <div
            v-for="node in ambientNodes"
            :key="node.label"
            class="ambient-node"
          >
            <VIcon :icon="node.icon" />
            <span>{{ node.label }}</span>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';
import { useScrollReveal } from '../composables/useScrollReveal';

const router = useRouter();
const userStore = useUserStore();
const { setupObserver } = useScrollReveal();
const pageRef = ref(null);

// ★ Typewriter: one slot per card
const typedTexts = ref(['', '', '', '', '', ''])
const typingTimers = [null, null, null, null, null, null]

function triggerTyping(idx, text) {
  if (typedTexts.value[idx]) return
  let i = 0
  function type() {
    if (i <= text.length) {
      typedTexts.value[idx] = text.slice(0, i)
      i++
      typingTimers[idx] = setTimeout(type, 40)
    }
  }
  setTimeout(type, 400 + idx * 150)
}

let smartFillPreloadPromise;

function preloadSmartFill() {
  smartFillPreloadPromise ||= import('./zongce/SmartFill.vue');
}

function goTo(path) {
  if (path === '/zongce/smart-fill') preloadSmartFill();
  router.push(path);
}

onMounted(async () => {
  const scheduleIdle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 300));
  scheduleIdle(preloadSmartFill);
  await nextTick();
  // Scroll reveal + typewriter trigger
  if (pageRef.value) {
    setupObserver(pageRef.value, (el) => {
      const idx = Number(el.dataset.revealIdx)
      if (!isNaN(idx) && modules.value[idx]) {
        triggerTyping(idx, modules.value[idx].desc_long || modules.value[idx].desc)
      }
    })
  }
});

onBeforeUnmount(() => {
  typingTimers.forEach(t => t && clearTimeout(t))
})

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
    color: 'var(--color-primary)',
    className: 'node-zhiyu'
  },
  {
    name: '德育',
    icon: 'mdi:hand-heart-outline',
    color: 'var(--color-accent)',
    className: 'node-deyu'
  },
  {
    name: '体育',
    icon: 'mdi:run-fast',
    color: 'var(--color-primary-hover)',
    className: 'node-tiyu'
  },
  {
    name: '美育',
    icon: 'mdi:palette-outline',
    color: 'var(--color-primary)',
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
    desc: 'AI 识别材料内容，匹配综测规则并填入表单。',
    desc_long: '上传证书与证明材料，AI 自动提取事实并匹配计分规则，一键生成综测登记表。',
    path: '/zongce/smart-fill',
    icon: 'mdi:auto-fix',
    color: 'var(--color-primary)',
    stage: '01',
    tag: '核心入口',
    tall: true,
  },
  {
    title: '信息管理',
    desc: '按身份进入对应管理台，材料、初审、批次统一收口。',
    desc_long: '学生提交、班委初审、辅导员复核、学工处终审，全流程在线追踪，告别纸质表格。',
    path: managementHome.value,
    icon: 'mdi:account-group-outline',
    color: 'var(--color-accent)',
    stage: '02',
    tag: '权限分流',
  },
  {
    title: '批量填表',
    desc: '批量处理多人材料，减少重复录入，适合集中填报。',
    desc_long: '导入 Excel 名单与 Word 模板，系统自动为全班同学生成个性化综测表，效率提升数十倍。',
    path: '/zongce/batch-fill',
    icon: 'mdi:file-multiple-outline',
    color: '#35d07f',
    stage: '03',
    tag: '批量处理',
  },
  {
    title: '对话填表',
    desc: '自然语言补充材料信息，缺失字段问答快速完善。',
    desc_long: '像聊天一样填写综测表，AI 理解你的每一句话，自动定位并填入对应的表格字段。',
    path: '/zongce/chat-fill',
    icon: 'mdi:chat-processing-outline',
    color: '#ff6a3d',
    stage: '04',
    tag: '自然语言',
  },
  {
    title: '评定结果',
    desc: '五维评分、画像分析，快速定位优势与待提升项。',
    desc_long: '德育、智育、体育、美育、劳育五维雷达图，精准定位你的综测强项与发展方向。',
    path: '/module2/evaluation',
    icon: 'mdi:chart-box-outline',
    color: '#00a3ff',
    stage: '05',
    tag: '五维画像',
  },
  {
    title: '评定报告',
    desc: '智能评语、改进建议与综测报告，可导出最终成果。',
    desc_long: 'AI 生成个性化年度总结与提升建议，支持导出 Word 文档，综测成果一目了然。',
    path: '/module2/report',
    icon: 'mdi:file-chart-outline',
    color: '#ff4dca',
    stage: '06',
    tag: '结果沉淀',
    tall: true,
  },
]);

const ambientNodes = [
  { label: '德育', icon: 'mdi:hand-heart-outline' },
  { label: '智育', icon: 'mdi:book-open-page-variant-outline' },
  { label: '体育', icon: 'mdi:run-fast' },
  { label: '美育', icon: 'mdi:palette-outline' },
  { label: '劳育', icon: 'mdi:hammer-wrench' },
];
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 64px;
  padding-bottom: 120px;
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
  gap: 40px;
  margin-bottom: 20px;
}

.section-header span {
  color: var(--color-primary, #4f46e5);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-header h2 {
  margin-top: 4px;
  font-size: 28px;
  line-height: 1.2;
  color: var(--color-text, #1e293b);
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.section-header p {
  max-width: 360px;
  padding: 12px 16px;
  color: var(--color-text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.7;
  border-left: 2px solid var(--color-primary, #c4a882);
  background: color-mix(in srgb, var(--color-primary, #c4a882) 5%, transparent);
  border-radius: 0 8px 8px 0;
}

/* ===== 经络树 ===== */
.meridian-tree {
  position: relative;
  max-width: 1100px; margin: 0 auto;
  padding: 36px 0 80px;
  display: flex; flex-direction: column;
}

/* 中心主干线 */
.trunk-line {
  position: absolute;
  left: 50%; top: 0; bottom: 0; width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(180deg,
    transparent 0%,
    var(--color-primary, #c4a882) 6%,
    rgba(196,168,130,0.5) 45%,
    rgba(125,155,118,0.3) 80%,
    transparent 100%);
  z-index: 0;
}

/* 每行 */
.branch-row {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  padding: 28px 0;
}

/* 分支卡片 */
.branch-card {
  position: relative;
  width: 47%;
  height: var(--card-height, 220px);
  cursor: pointer; flex-shrink: 0; z-index: 1;
}
.branch-left { margin-right: 6%; }
.branch-right { margin-left: 6%; }

/* 分支连接线 */
.branch-connector {
  position: absolute; top: 34px;
  height: 2px;
  background: var(--theme-color);
  opacity: 0.35;
  transition: opacity 0.4s;
}
.branch-left .branch-connector {
  left: 100%;
  width: calc(6% + 22px);
}
.branch-right .branch-connector {
  right: 100%;
  width: calc(6% + 22px);
}
.branch-card:hover .branch-connector { opacity: 0.7; }

/* 中心圆点 */
.dot-center {
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--theme-color, #c4a882);
  border: 2.5px solid var(--color-bg, #050505);
  box-shadow: 0 0 10px rgba(196,168,130,0.3);
  position: relative; z-index: 2; flex-shrink: 0;
  margin: 0 -7px;
  transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s;
}
.branch-row:hover .dot-center {
  transform: scale(1.5);
  box-shadow: 0 0 18px var(--theme-color, #c4a882);
}

/* 卡片内层 */
.branch-card-inner {
  width: 100%; height: 100%;
  padding: 20px 22px;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden; border-radius: 20px;
  background:
    radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--theme-color) 10%, transparent), transparent 36%),
    var(--glass-bg, rgba(255,255,255,0.06));
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  backdrop-filter: blur(14px);
  transition: transform 0.5s cubic-bezier(0.22,1,0.36,1),
              border-color 0.4s,
              box-shadow 0.5s;
}
/* ★ 悬停：向中心浮动 */
.branch-left:hover .branch-card-inner {
  transform: translateX(12px) translateY(-3px);
  border-color: color-mix(in srgb, var(--theme-color) 35%, transparent);
  box-shadow: 0 20px 56px rgba(0,0,0,0.34);
}
.branch-right:hover .branch-card-inner {
  transform: translateX(-12px) translateY(-3px);
  border-color: color-mix(in srgb, var(--theme-color) 35%, transparent);
  box-shadow: 0 20px 56px rgba(0,0,0,0.34);
}

/* ===== 对侧打字描述 ===== */
.branch-desc {
  width: 35%; min-height: 70px;
  display: flex; flex-direction: column; justify-content: center;
  padding-top: 8px; z-index: 1;
}
.desc-left { text-align: right; padding-right: 6%; }
.desc-right { text-align: left; padding-left: 6%; }

/* 引导线 */
.desc-guide {
  height: 1.5px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
  opacity: 0;
  transition: opacity 0.8s;
  margin-bottom: 12px;
}
.branch-row:has(.revealed) .desc-guide { opacity: 1; }

/* 打字文本 */
.desc-typewriter {
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Serif SC", serif;
  font-size: 14.5px; line-height: 1.85;
  color: var(--color-text-secondary); margin: 0;
  opacity: 0; transform: translateY(12px);
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1);
}
.branch-row:has(.revealed) .desc-typewriter {
  opacity: 1; transform: translateY(0);
}
.cursor {
  display: inline-block;
  color: var(--color-primary, #c4a882);
  font-weight: 300;
  animation: blink 0.8s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

/* ★ 慢节奏渐现动画 */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(40px);
  transition:
    opacity 0.9s cubic-bezier(0.22,1,0.36,1),
    transform 0.9s cubic-bezier(0.22,1,0.36,1);
  transition-delay: var(--reveal-delay, 0s);
}
.reveal-on-scroll.revealed {
  opacity: 1;
  transform: translateY(0);
}

/* 卡片内部装饰光晕 */
.card-light {
  position: absolute;
  right: -50px;
  bottom: -60px;
  width: 140px;
  height: 140px;
  border-radius: 999px;
  background: var(--theme-color);
  opacity: 0.10;
  filter: blur(20px);
  transition: all 0.3s ease;
}
.branch-card:hover .card-light {
  transform: scale(1.15);
  opacity: 0.16;
}

/* 卡片内部布局 */
.card-top,
.card-bottom {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: var(--theme-color);
  background: rgba(255, 255, 255, 0.65);
  font-size: 24px;
}

.module-card.large .card-icon,
.module-card.wide .card-icon {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  font-size: 32px;
}

.card-top span {
  padding: 5px 10px;
  border-radius: 999px;
  color: var(--theme-color);
  background: rgba(255, 255, 255, 0.62);
  font-size: 11px;
  font-weight: 700;
}

.card-main {
  position: relative;
  z-index: 1;
}

.card-main h3 {
  font-size: 17px;
  color: var(--color-text, #1e293b);
}

.module-card.large .card-main h3,
.module-card.wide .card-main h3 {
  font-size: 22px;
  letter-spacing: -0.03em;
}

.module-card:nth-child(1) {
  background:
    radial-gradient(circle at 88% 14%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 36%),
    var(--glass-bg);
}

.module-card:nth-child(2) {
  background:
    radial-gradient(circle at 88% 14%, color-mix(in srgb, var(--color-accent) 13%, transparent), transparent 36%),
    var(--glass-bg);
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

/* 工作流下方隔离与装饰区 */
.workflow-spacer {
  height: 100px;
  flex: 0 0 100px;
}

.workflow-ambient {
  position: relative;
  z-index: 0;
  min-height: auto;
  padding: 0 0 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 40px;
  overflow: visible;
  pointer-events: none;
}

.workflow-ambient::before {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  top: -72px;
  height: 1px;
  background: linear-gradient(90deg,
    transparent,
    color-mix(in srgb, var(--color-primary) 18%, transparent),
    color-mix(in srgb, var(--color-accent) 12%, transparent),
    transparent
  );
}

.ambient-line {
  position: absolute;
  left: 35%;
  right: 8%;
  top: 50%;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--color-primary) 10%, transparent),
    color-mix(in srgb, var(--color-primary) 22%, transparent),
    color-mix(in srgb, var(--color-accent) 16%, transparent),
    transparent
  );
}

.ambient-copy,
.ambient-nodes {
  position: relative;
  z-index: 1;
}

.ambient-copy span {
  color: color-mix(in srgb, var(--color-primary) 76%, var(--color-text-secondary));
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ambient-copy strong {
  display: block;
  margin-top: 6px;
  color: var(--color-text);
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.ambient-copy p {
  max-width: 400px;
  margin-top: 6px;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
}

.ambient-nodes {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.ambient-node {
  min-height: 80px;
  display: grid;
  place-items: center;
  gap: 6px;
  border-radius: 20px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--glass-bg, rgba(255, 255, 255, 0.45)) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 10%, var(--glass-border, rgba(255, 255, 255, 0.18)));
  box-shadow:
    0 14px 38px color-mix(in srgb, var(--color-primary) 5%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 58%, transparent);
  backdrop-filter: blur(16px);
}

.ambient-node svg {
  font-size: 24px;
}

.ambient-node span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 800;
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

  .meridian-tree { max-width: 100%; padding: 24px 12px 40px; }
  .branch-row {
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
  }
  .branch-card { width: 56%; }
  .branch-desc {
    display: flex;
    width: 56%;
    min-height: auto;
    padding: 12px 0 0;
    text-align: center;
    order: 1;
  }
  .desc-left, .desc-right { text-align: center; padding: 12px 0 0; }
  .desc-guide { display: none; }
  .desc-typewriter { opacity: 1; transform: none; }
  .dot-center { display: none; }
  .trunk-line { left: 6%; }
  .branch-left { margin-right: auto; }
  .branch-right { margin-left: auto; }

  .workflow-spacer {
    height: 80px;
    flex-basis: 80px;
  }

  .workflow-ambient {
    grid-template-columns: 1fr;
  }

  .ambient-line {
    left: 28px;
    right: 28px;
    top: auto;
    bottom: 50px;
  }

  .ambient-nodes {
    grid-template-columns: repeat(5, minmax(72px, 1fr));
    overflow-x: auto;
    padding-bottom: 2px;
  }

}

/* ===== 可变宽度：workflow 区稍窄 ===== */
/* ===== Scroll Reveal ===== */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(36px);
  transition:
    opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--reveal-delay, 0s);
}
.reveal-on-scroll.revealed {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    opacity: 1;
    transform: none;
    transition: none;
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
    min-height: auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 20px 4px 8px;
  }
  .orbit { display: none; }
  .center-card {
    position: static;
    width: 100px;
    height: auto;
    padding: 14px 12px;
    border-radius: 20px;
    margin-right: 6px;
  }
  .center-icon { width: 40px; height: 40px; border-radius: 14px; font-size: 22px; }
  .center-card strong { font-size: 18px; margin-top: 6px; }
  .center-card span { font-size: 10px; margin-top: 3px; }
  .dimension-node {
    position: static;
    transform: none;
    width: auto;
    height: auto;
    min-width: 52px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 14px;
  }
  .dimension-node svg { font-size: 16px; }
  .dimension-node span { font-size: 10px; font-weight: 700; }

  .section-header {
    display: block;
  }

  .section-header p {
    margin-top: 12px;
  }

  .meridian-tree { padding: 16px 8px 32px; }
  .branch-row {
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
  }
  .branch-card { width: 88%; height: auto !important; }
  .branch-desc {
    display: block;
    width: 88%;
    min-height: auto;
    padding: 10px 0 0;
    text-align: center;
    order: 1;
  }
  .desc-left, .desc-right { text-align: center; padding: 10px 0 0; }
  .desc-guide { display: none; }
  .desc-typewriter { opacity: 1; transform: none; font-size: 13px; }
  .dot-center, .trunk-line { display: none; }
  .branch-left, .branch-right { margin: 0 auto; }
  .branch-connector { display: none; }
  .branch-card-inner { padding: 18px 16px; }
  .card-icon { width: 38px; height: 38px; font-size: 20px; }
  .card-main h3 { font-size: 16px !important; }
  .card-main p { font-size: 13px; line-height: 1.65; overflow: visible; }

  .workflow-spacer {
    height: 120px;
    flex-basis: 120px;
  }

  .workflow-ambient {
    padding: 0 4px 8px;
  }

  .ambient-nodes {
    grid-template-columns: repeat(5, minmax(66px, 1fr));
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .ambient-node {
    min-height: 66px;
    border-radius: 18px;
  }

}
</style>
