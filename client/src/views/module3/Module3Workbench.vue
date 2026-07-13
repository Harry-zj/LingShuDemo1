<template>
  <div class="workbench-page">
    <section class="hero glass-card">
      <div>
        <span class="eyebrow">MODULE 03</span>
        <h2>{{ config.title }}</h2>
        <p>{{ config.description }}</p>
      </div>
      <div class="role-chip">
        <VIcon :icon="config.icon" />
        <span>{{ config.roleLabel }}</span>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <h3>{{ config.sectionTitle }}</h3>
          <p>{{ config.sectionDescription }}</p>
        </div>
        <span>{{ primaryCards.length }} 个功能入口</span>
      </div>

      <div class="feature-grid" :class="{ 'four-grid': primaryCards.length === 4 }">
        <button
          v-for="card in primaryCards"
          :key="card.title"
          class="feature-card glass-card"
          :class="{ disabled: card.disabled }"
          :disabled="card.disabled"
          @click="open(card)"
        >
          <span class="icon-box"><VIcon :icon="card.icon" /></span>
          <span class="card-content">
            <strong>{{ card.title }}</strong>
            <small>{{ card.description }}</small>
            <em v-if="card.note">{{ card.note }}</em>
          </span>
          <VIcon icon="mdi:arrow-right" class="card-arrow" />
        </button>
      </div>
    </section>

    <section class="section-block" v-if="secondaryCards.length">
      <div class="section-heading compact">
        <div>
          <h3>常用入口</h3>
          <p>进入待办、统计或个人资料页面</p>
        </div>
      </div>
      <div class="quick-grid">
        <button v-for="card in secondaryCards" :key="card.title" class="quick-card" @click="open(card)">
          <VIcon :icon="card.icon" />
          <span><strong>{{ card.title }}</strong><small>{{ card.description }}</small></span>
          <VIcon icon="mdi:chevron-right" />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/user';

const router = useRouter();
const userStore = useUserStore();

const configs = {
  admin: {
    title: '管理员工作台',
    description: '先选择业务模块，再进入对应的配置页面。账号、组织、批次和统计相互独立，减少信息干扰。',
    icon: 'mdi:shield-account-outline',
    roleLabel: '系统管理员',
    sectionTitle: '管理功能',
    sectionDescription: '按照配置对象划分功能入口',
    primary: [
      { title: '账号管理', description: '创建、导入和查询账号，重置用户密码', icon: 'mdi:account-cog-outline', to: '/module3/account-manage' },
      { title: '组织结构管理', description: '维护学院、专业和班级的层级关系', icon: 'mdi:domain', to: '/module3/org-manage' },
      { title: '批次与流程配置', description: '创建批次，设置评价链、注册和异议规则', icon: 'mdi:calendar-plus-outline', to: '/module3/batch-manage' },
      { title: '进度与结果统计', description: '查看各批次评价进度并导出汇总结果', icon: 'mdi:chart-timeline-variant', to: '/module3/teacher' },
    ],
    secondary: [
      { title: '个人中心', description: '修改个人信息和登录密码', icon: 'mdi:account-outline', to: '/module3/profile' },
    ],
  },
  counselor: {
    title: '辅导员工作台',
    description: '管辖范围、学生信息、评价小组和跨班互评分开管理。点击卡片后进入单独的详细设置页面。',
    icon: 'mdi:account-supervisor-outline',
    roleLabel: '辅导员',
    sectionTitle: '四项核心工作',
    sectionDescription: '每个入口只处理一种业务，配置路径更清晰',
    primary: [
      { title: '管辖范围设置', description: '设置负责的学院、年级和可选班级范围', icon: 'mdi:map-marker-radius-outline', to: '/module3/counselor/scope' },
      { title: '管辖学生信息', description: '查询管辖范围内学生及其最新综测状态', icon: 'mdi:account-group-outline', to: '/module3/counselor/students' },
      { title: '评价小组管理', description: '按批次赋予或移除学生评价小组身份', icon: 'mdi:account-multiple-check-outline', to: '/module3/counselor/members' },
      { title: '跨班互评配置', description: '配置被评班级、评价班级和具体评价成员', icon: 'mdi:swap-horizontal-bold', to: '/module3/counselor/assignments' },
    ],
    secondary: [
      { title: '我的待评价', description: '处理分配给当前辅导员的评价任务', icon: 'mdi:clipboard-account-outline', to: '/module3/class-leader' },
      { title: '进度监控', description: '查看管辖范围内批次评价进度', icon: 'mdi:chart-timeline-variant', to: '/module3/teacher' },
      { title: '个人中心', description: '完善个人资料和修改密码', icon: 'mdi:account-outline', to: '/module3/profile' },
    ],
  },
  student_affairs: {
    title: '学生工作处工作台',
    description: '从待评价、进度统计和个人资料入口分别进入详细页面，集中关注最终评价环节。',
    icon: 'mdi:office-building-outline',
    roleLabel: '学生工作处',
    sectionTitle: '工作入口',
    sectionDescription: '按任务类型进入对应页面',
    primary: [
      { title: '待评价任务', description: '处理进入学生工作处环节的综测表单', icon: 'mdi:clipboard-account-outline', to: '/module3/class-leader' },
      { title: '评价进度监控', description: '查看各批次状态分布与评价明细', icon: 'mdi:chart-timeline-variant', to: '/module3/teacher' },
      { title: '个人中心', description: '维护个人信息并修改登录密码', icon: 'mdi:account-outline', to: '/module3/profile' },
    ],
    secondary: [],
  },
  student: {
    title: '学生综测工作台',
    description: '填写材料、查看结果、处理评价任务和维护个人资料分别进入，避免所有信息同时堆在一个页面。',
    icon: 'mdi:school-outline',
    roleLabel: '学生',
    sectionTitle: '综测功能',
    sectionDescription: '选择当前要完成的事项',
    primary: [
      { title: '综测信息填写', description: '选择批次，编辑、保存并提交综测表', icon: 'mdi:file-document-edit-outline', to: '/module3/student/forms' },
      { title: '结果与异议', description: '选择批次查看最终评价记录，并统一提交异议', icon: 'mdi:message-question-outline', to: '/module3/student/results' },
      { title: '我的待评价', description: '作为评价小组成员处理分配给自己的任务', icon: 'mdi:clipboard-account-outline', to: '/module3/class-leader', disabled: !userStore.user?.is_assessment_member, note: !userStore.user?.is_assessment_member ? '当前未获得评价小组身份' : '' },
      { title: '个人中心', description: '完善学院、专业、年级、班级等资料', icon: 'mdi:account-outline', to: '/module3/profile' },
    ],
    secondary: [],
  },
};

const config = computed(() => configs[userStore.userRole] || configs.student);
const primaryCards = computed(() => config.value.primary);
const secondaryCards = computed(() => config.value.secondary || []);

function open(card) {
  if (!card.disabled && card.to) router.push(card.to);
}
</script>

<style scoped>
.workbench-page { display: flex; flex-direction: column; gap: 28px; animation: fadeIn .35s var(--easing-decelerate); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 28px; border-radius: 8px !important; }
.eyebrow { display: inline-block; margin-bottom: 8px; color: var(--color-primary); font-size: 11px; font-weight: 700; letter-spacing: .18em; }
.hero h2 { font-size: 26px; line-height: 1.25; }
.hero p { max-width: 760px; margin-top: 8px; color: var(--color-text-secondary); line-height: 1.7; }
.role-chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 8px !important; background: var(--color-bg); color: var(--color-primary); white-space: nowrap; }
.section-block { display: flex; flex-direction: column; gap: 16px; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.section-heading h3 { font-size: 18px; }
.section-heading p, .section-heading > span { margin-top: 4px; color: var(--color-text-secondary); font-size: 13px; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
.feature-grid.four-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.feature-card { position: relative; min-height: 190px; padding: 22px; border: 1px solid var(--color-border); border-radius: 8px !important; color: var(--color-text-primary); text-align: left; cursor: pointer; overflow: hidden; transition: transform var(--duration-fast) var(--easing-standard), border-color var(--duration-fast), box-shadow var(--duration-fast); }
.feature-card:hover:not(.disabled) { transform: translateY(-3px); border-color: color-mix(in srgb, var(--color-primary) 48%, var(--color-border)); box-shadow: var(--shadow-level-2); }
.feature-card.disabled { opacity: .55; cursor: not-allowed; }
.icon-box { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 8px !important; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); font-size: 24px; }
.card-content { display: flex; flex-direction: column; gap: 7px; margin-top: 20px; padding-right: 34px; }
.card-content strong { font-size: 17px; }
.card-content small { color: var(--color-text-secondary); font-size: 13px; line-height: 1.65; }
.card-content em { color: #d97706; font-size: 12px; font-style: normal; }
.card-arrow { position: absolute; right: 20px; bottom: 20px; color: var(--color-primary); }
.quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.quick-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; min-height: 76px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px !important; background: var(--color-surface); color: var(--color-text-primary); text-align: left; cursor: pointer; }
.quick-card > svg:first-child { color: var(--color-primary); font-size: 22px; }
.quick-card span { display: flex; flex-direction: column; gap: 3px; }
.quick-card small { color: var(--color-text-secondary); line-height: 1.4; }
@media (max-width: 800px) {
  .hero, .section-heading { flex-direction: column; align-items: stretch; }
  .feature-grid.four-grid { grid-template-columns: 1fr; }
}

/* 模块三局部圆角兜底：仅作用于当前模块三组件树，不影响顶部导航及其他模块。 */
:deep(*) {
  border-radius: 8px !important;
}

</style>
