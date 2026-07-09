<template>
  <div class="home">
    <!-- ═══════ 灵枢·中枢 ═══════ -->
    <section class="hub-section">
      <div class="hub-bg">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
      </div>
      <div class="hub-content">
        <div class="hub-icon">
          <VIcon icon="mdi:brain" />
        </div>
        <h1 class="hub-title">灵<span class="hub-accent">枢</span></h1>
        <p class="hub-subtitle">五维综测 · 智能中枢</p>
        <p class="hub-desc">基于多模态语义对齐的高校综测智能填写与决策平台</p>
        <div class="hub-actions">
          <button class="btn-primary" @click="goTo('/module1/smart-fill')">
            <VIcon icon="mdi:lightning-bolt" /> 开始填表
          </button>
          <button class="btn-hollow" @click="goTo('/module2/evaluation')">
            查看评定 <VIcon icon="mdi:arrow-right" />
          </button>
        </div>
      </div>
      <!-- 底部三个微统计 -->
      <div class="mini-stats">
        <div class="mini-stat" v-for="s in stats" :key="s.label">
          <span class="ms-num" :style="{ color: s.color }">{{ s.num }}</span>
          <span class="ms-label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <!-- ═══════ 经络流·功能模块 ═══════ -->
    <section class="meridian-section">
      <div class="meridian-header">
        <h2>工 作 流</h2>
        <p>从材料上传到报告生成，一气呵成</p>
      </div>

      <!-- 经络线 SVG -->
      <svg class="meridian-svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path class="m-path" d="M0,60 Q200,0 400,60 T800,60 T1200,60"
          fill="none" stroke="var(--meridian-line)" stroke-width="2" />
        <path class="m-path-animated" d="M0,60 Q200,0 400,60 T800,60 T1200,60"
          fill="none" stroke="var(--meridian-line-active)" stroke-width="2"
          stroke-dasharray="10 15" />
      </svg>

      <!-- 模块排列：四阶段两行 -->
      <div class="flow-grid">
        <div class="flow-card" v-for="(m, idx) in modules" :key="m.path"
          @click="goTo(m.path)"
          :style="{ animationDelay: (0.15 + idx * 0.08) + 's' }">
          <div class="flow-accent" :style="{ background: m.meridianColor }"></div>
          <div class="flow-icon-wrap" :style="{ background: m.iconBg }">
            <VIcon :icon="m.icon" class="flow-icon" :style="{ color: m.meridianColor }" />
          </div>
          <div class="flow-body">
            <h4>{{ m.title }}</h4>
            <p>{{ m.desc }}</p>
          </div>
          <div class="flow-meta">
            <span class="flow-tag" :style="{ background: m.meridianColor + '18', color: m.meridianColor }">
              {{ m.tag }}
            </span>
            <VIcon icon="mdi:arrow-right-circle-outline" class="flow-arrow"
              :style="{ color: m.meridianColor }" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
function goTo(path) { router.push(path); }

const stats = [
  { num: 'AI', label: '语义匹配', color: 'var(--color-primary)' },
  { num: '五维', label: '综合评定', color: 'var(--color-meiyu)' },
  { num: '三端', label: '协同管理', color: 'var(--color-tiyu)' },
];

const modules = [
  { title: '智能填表', desc: 'AI自动解析材料与规则，精准匹配填入表格', path: '/module1/smart-fill', icon: 'mdi:auto-fix', iconBg: 'rgba(79,70,229,0.08)', meridianColor: '#4F46E5', tag: 'AI核心' },
  { title: '批量填表', desc: '一键批量生成多人文档，告别重复劳动', path: '/module1/batch-fill', icon: 'mdi:file-multiple-outline', iconBg: 'rgba(5,150,105,0.08)', meridianColor: '#059669', tag: '提效' },
  { title: '对话填表', desc: 'AI引导式提问，边聊边填', path: '/module1/chat-fill', icon: 'mdi:chat-processing-outline', iconBg: 'rgba(124,58,237,0.08)', meridianColor: '#7C3AED', tag: '智能' },
  { title: '个性评定', desc: '五维评分·雷达图·班级对比', path: '/module2/evaluation', icon: 'mdi:chart-radar', iconBg: 'rgba(217,119,6,0.08)', meridianColor: '#D97706', tag: '分析' },
  { title: '评定报告', desc: '智能评语·改进建议·PDF导出', path: '/module2/report', icon: 'mdi:file-document-text-outline', iconBg: 'rgba(6,182,212,0.08)', meridianColor: '#06B6D4', tag: '输出' },
  { title: '我的综测', desc: '学生端：材料提交·状态追踪', path: '/module3/student', icon: 'mdi:account-school-outline', iconBg: 'rgba(79,70,229,0.08)', meridianColor: '#4F46E5', tag: '学生' },
  { title: '班级初审', desc: '班干部端：本班材料审核', path: '/module3/class-leader', icon: 'mdi:account-tie-outline', iconBg: 'rgba(234,88,12,0.08)', meridianColor: '#EA580C', tag: '班干' },
  { title: '总控中心', desc: '老师端：批次管理·统计导出', path: '/module3/teacher', icon: 'mdi:view-dashboard-outline', iconBg: 'rgba(5,150,105,0.08)', meridianColor: '#059669', tag: '管理' },
];
</script>

<style scoped>
.home {
  display: flex; flex-direction: column; gap: 0;
  padding-bottom: 64px;
}

/* ═══════ 中枢 Hero ═══════ */
.hub-section {
  position: relative; text-align: center;
  padding: 72px 24px 40px;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 40%, #F8FAFC 70%, #F0F4FF 100%);
  overflow: hidden; isolation: isolate;
  margin: -32px -24px 0;
  min-height: 420px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.hub-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.ring {
  position: absolute; border-radius: 50%;
  border: 1px solid rgba(99,102,241,0.1);
  left: 50%; top: 50%; transform: translate(-50%, -50%);
}
.ring-1 { width: 360px; height: 360px; animation: hubPulse 4s ease-in-out infinite; }
.ring-2 { width: 280px; height: 280px; animation: hubPulse 4s ease-in-out infinite 1s; }
.ring-3 { width: 200px; height: 200px; border-color: rgba(99,102,241,0.2); animation: hubPulse 4s ease-in-out infinite 2s; }

.hub-content { position: relative; z-index: 1; }
.hub-icon {
  font-size: 56px; color: var(--color-primary);
  filter: drop-shadow(0 0 24px rgba(99,102,241,0.35));
  animation: float 4s ease-in-out infinite;
  margin-bottom: 8px;
}
.hub-title {
  font-size: 48px; font-weight: var(--font-weight-bold);
  letter-spacing: 12px; color: var(--color-text);
}
.hub-accent {
  background: var(--color-primary-gradient-bright);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hub-subtitle {
  font-size: 14px; letter-spacing: 6px;
  color: var(--color-primary); font-weight: var(--font-weight-medium);
  margin-top: 4px;
}
.hub-desc {
  font-size: 15px; color: var(--color-text-secondary);
  margin-top: 8px; max-width: 400px; margin-left: auto; margin-right: auto;
}
.hub-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }
.btn-primary, .btn-hollow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 28px; border-radius: var(--radius-full);
  font-size: 15px; font-weight: var(--font-weight-semibold);
  cursor: pointer; transition: all var(--duration-normal) var(--easing-spring);
}
.btn-primary {
  background: var(--color-primary-gradient-bright); color: white;
  border: none; box-shadow: 0 4px 20px rgba(99,102,241,0.3);
}
.btn-primary:hover { box-shadow: 0 8px 32px rgba(99,102,241,0.4); transform: translateY(-2px); }
.btn-primary:active { transform: translateY(0) scale(0.98); }
.btn-hollow {
  background: transparent; color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-hollow:hover { border-color: var(--color-primary); color: var(--color-primary); }

/* 微统计 */
.mini-stats {
  display: flex; gap: 32px; margin-top: 28px;
  position: relative; z-index: 1;
}
.mini-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ms-num { font-size: 24px; font-weight: var(--font-weight-bold); }
.ms-label { font-size: 12px; color: var(--color-text-secondary); }

/* ═══════ 经络流区 ═══════ */
.meridian-section {
  margin-top: 48px;
}
.meridian-header { text-align: center; margin-bottom: 32px; }
.meridian-header h2 {
  font-size: 16px; letter-spacing: 8px;
  color: var(--color-primary); font-weight: var(--font-weight-semibold);
}
.meridian-header p { font-size: 14px; color: var(--color-text-secondary); margin-top: 4px; }

/* SVG 经络线 */
.meridian-svg {
  width: 100%; height: 40px;
  margin-bottom: 32px;
}
.m-path { opacity: 0.5; }
.m-path-animated {
  animation: meridianFlow 20s linear infinite;
}

/* 模块流 */
.flow-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.flow-card {
  position: relative;
  padding: 20px 16px 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  cursor: pointer;
  opacity: 0;
  animation: fadeInUp 0.5s var(--easing-spring) forwards;
  transition: all var(--duration-normal) var(--easing-spring);
  display: flex; flex-direction: column; gap: 12px;
  overflow: hidden;
}
/* 左侧经络线装饰 */
.flow-card::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--meridian-line);
  transition: all var(--duration-normal) var(--easing-standard);
}
.flow-card:hover::before {
  width: 4px;
  box-shadow: 0 0 12px rgba(99,102,241,0.2);
}
.flow-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--glass-shadow-hover);
}

/* 渐变色装饰条 */
.flow-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  border-radius: 3px 3px 0 0;
  opacity: 0.4;
  transition: opacity var(--duration-normal) var(--easing-standard);
}
.flow-card:hover .flow-accent { opacity: 1; height: 4px; }

.flow-icon-wrap {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: transform var(--duration-normal) var(--easing-spring);
}
.flow-card:hover .flow-icon-wrap { transform: scale(1.08) rotate(-4deg); }
.flow-icon { font-size: 22px; }

.flow-body { flex: 1; }
.flow-body h4 { font-size: 15px; font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: 4px; }
.flow-body p { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }

.flow-meta { display: flex; align-items: center; justify-content: space-between; }
.flow-tag { font-size: 11px; padding: 2px 10px; border-radius: var(--radius-full); font-weight: var(--font-weight-medium); }
.flow-arrow { font-size: 18px; opacity: 0.4; transition: all var(--duration-fast) var(--easing-standard); }
.flow-card:hover .flow-arrow { opacity: 1; transform: translateX(4px); }

/* ═══════ 响应式 ═══════ */
@media (max-width: 1024px) {
  .flow-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .hub-section { padding: 48px 16px 32px; min-height: auto; }
  .hub-title { font-size: 32px; letter-spacing: 8px; }
  .flow-grid { grid-template-columns: 1fr; }
  .mini-stats { gap: 20px; }
}
</style>
