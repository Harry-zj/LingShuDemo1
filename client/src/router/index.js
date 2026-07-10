import { createRouter, createWebHistory } from "vue-router";
const routes = [
  { path: "/login", name: "Login", component: () => import("../views/auth/Login.vue"), meta: { layout: "auth" } },
  { path: "/", redirect: "/home" },
  { path: "/home", name: "Home", component: () => import("../views/Home.vue"), meta: { layout: "main", title: "首页" } },
  /* 模块一 */
  { path: "/module1/smart-fill", name: "SmartFill", component: () => import("../views/module1/SmartFill.vue"), meta: { layout: "main", title: "智能填表" } },
  { path: "/module1/batch-fill", name: "BatchFill", component: () => import("../views/module1/BatchFill.vue"), meta: { layout: "main", title: "批量填表" } },
  { path: "/module1/chat-fill", name: "ChatFill", component: () => import("../views/module1/ChatFill.vue"), meta: { layout: "main", title: "对话填表" } },
  /* 模块二 */
  { path: "/module2/evaluation", name: "EvaluationResult", component: () => import("../views/module2/EvaluationResult.vue"), meta: { layout: "main", title: "评定结果" } },
  { path: "/module2/profile", name: "PersonalProfile", component: () => import("../views/module2/PersonalProfile.vue"), meta: { layout: "main", title: "个人画像" } },
  { path: "/module2/report", name: "ReportView", component: () => import("../views/module2/ReportView.vue"), meta: { layout: "main", title: "评定报告" } },
  /* 模块三 */
  { path: "/module3/student", name: "StudentDashboard", component: () => import("../views/module3/StudentDashboard.vue"), meta: { layout: "main", title: "我的综测" } },
  { path: "/module3/class-leader", name: "ClassLeaderDesk", component: () => import("../views/module3/ClassLeaderDesk.vue"), meta: { layout: "main", title: "评价学生列表" } },
  { path: "/module3/teacher", name: "TeacherConsole", component: () => import("../views/module3/TeacherConsole.vue"), meta: { layout: "main", title: "统计总览" } },
  { path: "/module3/review-detail/:id", name: "ReviewDetail", component: () => import("../views/module3/ReviewDetail.vue"), meta: { layout: "main", title: "材料审核详情" } },
  { path: "/module3/batch-manage", name: "BatchManage", component: () => import("../views/module3/BatchManage.vue"), meta: { layout: "main", title: "批次管理" } },
];
const router = createRouter({ history: createWebHistory(), routes });
export default router;
