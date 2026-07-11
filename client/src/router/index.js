import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "../stores/user";
const smartFillView = () => import("../views/zongce/SmartFill.vue");

const routes = [
  { path: "/login", name: "Login", component: () => import("../views/auth/Login.vue"), meta: { layout: "auth" } },
  { path: "/register", name: "Register", component: () => import("../views/auth/Register.vue"), meta: { layout: "auth" } },
  { path: "/", redirect: "/home" },
  { path: "/home", name: "Home", component: () => import("../views/Home.vue"), meta: { layout: "main", title: "首页" } },
  /* 综测核心 */
  { path: "/zongce/smart-fill", name: "SmartFill", component: smartFillView, meta: { layout: "main", title: "智能填表", instant: true } },
  { path: "/zongce/batch-fill", name: "BatchFill", component: () => import("../views/zongce/BatchFill.vue"), meta: { layout: "main", title: "批量填表" } },
  { path: "/zongce/chat-fill", name: "ChatFill", component: () => import("../views/zongce/ChatFill.vue"), meta: { layout: "main", title: "对话填表" } },
  /* 模块二 */
  { path: "/module2/evaluation", name: "EvaluationResult", component: () => import("../views/module2/EvaluationResult.vue"), meta: { layout: "main", title: "评定结果" } },
  { path: "/module2/profile", name: "PersonalProfile", component: () => import("../views/module2/PersonalProfile.vue"), meta: { layout: "main", title: "个人画像" } },
  { path: "/module2/report", name: "ReportView", component: () => import("../views/module2/ReportView.vue"), meta: { layout: "main", title: "评定报告" } },
  /* 模块三 */
  { path: "/module3/student", name: "StudentDashboard", component: () => import("../views/module3/StudentDashboard.vue"), meta: { layout: "main", title: "我的综测" } },
  { path: "/module3/class-leader", name: "ClassLeaderDesk", component: () => import("../views/module3/ClassLeaderDesk.vue"), meta: { layout: "main", title: "评价学生列表", roles: ["admin", "class_committee", "counselor", "student_affairs"] } },
  { path: "/module3/teacher", name: "TeacherConsole", component: () => import("../views/module3/TeacherConsole.vue"), meta: { layout: "main", title: "统计总览", roles: ["admin", "class_committee", "counselor", "student_affairs"] } },
  { path: "/module3/review-detail/:id", name: "ReviewDetail", component: () => import("../views/module3/ReviewDetail.vue"), meta: { layout: "main", title: "材料审核详情", roles: ["admin", "class_committee", "counselor", "student_affairs"] } },
  { path: "/module3/batch-manage", name: "BatchManage", component: () => import("../views/module3/BatchManage.vue"), meta: { layout: "main", title: "批次管理", roles: ["admin"] } },
];
const router = createRouter({ history: createWebHistory(), routes });

// 路由守卫：检查页面级角色权限
router.beforeEach((to, from, next) => {
  const store = useUserStore();
  const requiredRoles = to.meta.roles;
  if (requiredRoles && !requiredRoles.includes(store.userRole)) {
    next({ name: "Home" });
  } else {
    next();
  }
});

export default router;
