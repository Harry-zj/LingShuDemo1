<template>
  <div class="home">
    <section class="hero">
      <h1>灵枢</h1>
      <p>基于多模态语义对齐的高校综测智能填写与决策平台</p>
    </section>
    <section class="modules">
      <div class="module-card" v-for="m in modules" :key="m.path" @click="goTo(m.path)">
        <h3>{{ m.title }}</h3>
        <p>{{ m.desc }}</p>
      </div>
    </section>
  </div>
</template>
<script setup>
import { useRouter } from "vue-router";
const router = useRouter();
function goTo(path) { router.push(path); }
const modules = [
  { title: "智能填表", desc: "上传规则文件与证明材料，AI自动解析匹配并填入表格", path: "/zongce/smart-fill" },
  { title: "批量填表", desc: "上传名单和模板，一键批量生成多人文档", path: "/zongce/batch-fill" },
  { title: "对话填表", desc: "以轻松对话方式，AI引导逐步完成填表", path: "/zongce/chat-fill" },
  { title: "个性评定", desc: "五维评分分析、班级对比、个人发展画像", path: "/module2/evaluation" },
  { title: "评定报告", desc: "自动生成个性化评定报告与改进建议", path: "/module2/report" },
  { title: "我的综测", desc: "学生端：查看通知、提交材料、追踪审核状态", path: "/module3/student" },
  { title: "班级初审", desc: "班干部端：审核本班学生提交的综测材料", path: "/module3/class-leader" },
  { title: "总控中心", desc: "老师端：发布批次、复核材料、统计导出", path: "/module3/teacher" },
];
</script>
<style scoped>
.hero { text-align: center; padding: 48px 0 32px; }
.hero h1 { font-size: 36px; color: var(--color-primary); }
.hero p { font-size: 16px; color: var(--color-text-secondary); margin-top: 8px; }
.modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.module-card { padding: 24px; background: var(--color-white); border-radius: var(--radius-card); border: 1px solid var(--color-border); cursor: pointer; transition: box-shadow 0.2s; }
.module-card:hover { box-shadow: var(--shadow-card); }
.module-card h3 { font-size: 18px; color: var(--color-primary); }
.module-card p { font-size: 14px; color: var(--color-text-secondary); margin-top: 8px; }
</style>
