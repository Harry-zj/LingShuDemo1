import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "../stores/user";
const smartFillView = () => import("../views/zongce/SmartFill.vue");

const routes = [
  { path: "/login", name: "Login", component: () => import("../views/auth/Login.vue"), meta: { layout: "auth" } },
  { path: "/register", name: "Register", component: () => import("../views/auth/Register.vue"), meta: { layout: "auth" } },
  { path: "/", redirect: "/home" },
  { path: "/home", name: "Home", component: () => import("../views/Home.vue"), meta: { layout: "main", title: "首页" } },
  /* 综测核心 */
  { path: "/zongce/smart-fill", name: "SmartFill", component: smartFillView, meta: { layout: "main", title: "智能填表", roles: ["student"] } },
  { path: "/zongce/batch-fill", name: "BatchFill", component: () => import("../views/zongce/BatchFill.vue"), meta: { layout: "main", title: "批量填表", roles: ["student"] } },
  { path: "/zongce/chat-fill", name: "ChatFill", component: () => import("../views/zongce/ChatFill.vue"), meta: { layout: "main", title: "对话填表", roles: ["student"] } },
  /* 模块二 */
  { path: "/module2/evaluation", name: "EvaluationResult", component: () => import("../views/module2/EvaluationResult.vue"), meta: { layout: "main", title: "数据总览", roles: ["student"] } },
  { path: "/module2/profile", name: "PersonalProfile", component: () => import("../views/module2/PersonalProfile.vue"), meta: { layout: "main", title: "个人画像", roles: ["student"] } },
  { path: "/module2/report", name: "ReportView", component: () => import("../views/module2/ReportView.vue"), meta: { layout: "main", title: "评定报告", roles: ["student"] } },
{ path: "/module2/dimension/:key", name: "DimensionDetail", component: () => import("../views/module2/DimensionDetail.vue"), meta: { layout: "main", title: "维度活动指南", roles: ["student"] } },
  /* 模块三 */
  { path: "/module3/profile", name: "Module3Profile", component: () => import("../views/module3/Module3Profile.vue"), props: { view: "menu" }, meta: { layout: "main", title: "个人中心", roles: ["student", "admin", "counselor", "student_affairs"] } },
  { path: "/module3/profile/basic", name: "Module3ProfileBasic", component: () => import("../views/module3/Module3Profile.vue"), props: { view: "basic" }, meta: { layout: "main", title: "基础信息", roles: ["student", "admin", "counselor", "student_affairs"] } },
  { path: "/module3/profile/password", name: "Module3ProfilePassword", component: () => import("../views/module3/Module3Profile.vue"), props: { view: "password" }, meta: { layout: "main", title: "修改密码", roles: ["student", "admin", "counselor", "student_affairs"] } },
  { path: "/module3/admin", name: "AdminWorkbench", component: () => import("../views/module3/Module3Workbench.vue"), meta: { layout: "main", title: "管理员工作台", roles: ["admin"] } },
  { path: "/module3/counselor", name: "CounselorWorkbench", component: () => import("../views/module3/Module3Workbench.vue"), meta: { layout: "main", title: "辅导员工作台", roles: ["counselor"] } },
  { path: "/module3/student-affairs", name: "StudentAffairsWorkbench", component: () => import("../views/module3/Module3Workbench.vue"), meta: { layout: "main", title: "学生工作处工作台", roles: ["student_affairs"] } },
  { path: "/module3/student", name: "StudentWorkbench", component: () => import("../views/module3/Module3Workbench.vue"), meta: { layout: "main", title: "学生综测工作台", roles: ["student"] } },
  { path: "/module3/student/forms", name: "StudentFormBatches", component: () => import("../views/module3/StudentBatchList.vue"), props: { view: "form" }, meta: { layout: "main", title: "选择综测批次", roles: ["student"] } },
  { path: "/module3/student/forms/:batchId", name: "StudentFormDetail", component: () => import("../views/module3/StudentDashboard.vue"), props: { view: "form" }, meta: { layout: "main", title: "综测信息填写详情", roles: ["student"] } },
  { path: "/module3/student/results", name: "StudentResultBatches", component: () => import("../views/module3/StudentBatchList.vue"), props: { view: "result" }, meta: { layout: "main", title: "选择结果批次", roles: ["student"] } },
  { path: "/module3/student/results/:batchId", name: "StudentResultDetail", component: () => import("../views/module3/StudentDashboard.vue"), props: { view: "result" }, meta: { layout: "main", title: "综测结果与异议详情", roles: ["student"] } },
  { path: "/module3/counselor/scope", name: "CounselorScope", component: () => import("../views/module3/CounselorConsole.vue"), props: { view: "scope" }, meta: { layout: "main", title: "管辖范围设置", roles: ["counselor"] } },
  { path: "/module3/counselor/students", name: "CounselorStudents", component: () => import("../views/module3/CounselorConsole.vue"), props: { view: "students" }, meta: { layout: "main", title: "管辖学生信息", roles: ["counselor"] } },
  { path: "/module3/counselor/members", name: "CounselorMembers", component: () => import("../views/module3/CounselorConsole.vue"), props: { view: "members" }, meta: { layout: "main", title: "评价小组管理", roles: ["counselor"] } },
  { path: "/module3/counselor/assignments", name: "CounselorAssignments", component: () => import("../views/module3/CounselorConsole.vue"), props: { view: "assignments" }, meta: { layout: "main", title: "跨班互评配置", roles: ["counselor"] } },
  { path: "/module3/account-manage", name: "AdminAccountManage", component: () => import("../views/module3/AdminAccountManage.vue"), props: { view: "menu" }, meta: { layout: "main", title: "账号管理", roles: ["admin"] } },
  ...[
    ["manual", "手动创建学生"], ["import", "文本导入学生"], ["generate", "批量生成账号"], ["reset", "重置密码"], ["list", "账号列表"]
  ].map(([view, title]) => ({ path: `/module3/account-manage/${view}`, name: `AdminAccountManage_${view}`, component: () => import("../views/module3/AdminAccountManage.vue"), props: { view }, meta: { layout: "main", title, roles: ["admin"] } })),
  { path: "/module3/org-manage", name: "OrganizationManage", component: () => import("../views/module3/OrganizationManage.vue"), props: { view: "menu" }, meta: { layout: "main", title: "组织管理", roles: ["admin"] } },
  ...[["college", "学院管理"], ["major", "专业管理"], ["class", "班级管理"]].map(([view, title]) => ({ path: `/module3/org-manage/${view}`, name: `OrganizationManage_${view}`, component: () => import("../views/module3/OrganizationManage.vue"), props: { view }, meta: { layout: "main", title, roles: ["admin"] } })),
  { path: "/module3/class-leader", name: "ClassLeaderDesk", component: () => import("../views/module3/ClassLeaderDesk.vue"), props: { view: "menu" }, meta: { layout: "main", title: "待评价任务", roles: ["student", "counselor", "student_affairs"] } },
  ...[["initial", "首次评价任务"], ["objection", "异议复评任务"]].map(([view, title]) => ({ path: `/module3/class-leader/${view}`, name: `ClassLeaderDesk_${view}`, component: () => import("../views/module3/ClassLeaderDesk.vue"), props: { view }, meta: { layout: "main", title, roles: ["student", "counselor", "student_affairs"] } })),
  { path: "/module3/teacher", name: "TeacherConsole", component: () => import("../views/module3/TeacherConsole.vue"), props: { view: "menu" }, meta: { layout: "main", title: "评价统计", roles: ["admin", "counselor", "student_affairs"] } },
  ...[["progress", "评价进度"], ["records", "评价明细"]].map(([view, title]) => ({ path: `/module3/teacher/${view}`, name: `TeacherConsole_${view}`, component: () => import("../views/module3/TeacherConsole.vue"), props: { view }, meta: { layout: "main", title, roles: ["admin", "counselor", "student_affairs"] } })),
  { path: "/module3/review-detail/:id", name: "ReviewDetail", component: () => import("../views/module3/ReviewDetail.vue"), meta: { layout: "main", title: "材料审核详情", roles: ["student", "counselor", "student_affairs"] } },
  { path: "/module3/admin/rules", name: "AdminRuleManage", component: () => import("../views/module3/AdminRuleManage.vue"), props: { view: "menu" }, meta: { layout: "main", title: "批次规则管理", roles: ["admin"] } },
  { path: "/module3/admin/rules/manage", name: "AdminRuleManage_manage", component: () => import("../views/module3/AdminRuleManage.vue"), props: { view: "manage" }, meta: { layout: "main", title: "批次规则管理", roles: ["admin"] } },
  { path: "/module3/batch-manage", name: "BatchManage", component: () => import("../views/module3/BatchManage.vue"), props: { view: "menu" }, meta: { layout: "main", title: "批次管理", roles: ["admin"] } },
  ...[["create", "创建批次"], ["settings", "全局流程设置"], ["limits", "分数上限设置"], ["active", "进行中的批次"], ["history", "历史批次"]].map(([view, title]) => ({ path: `/module3/batch-manage/${view}`, name: `BatchManage_${view}`, component: () => import("../views/module3/BatchManage.vue"), props: { view }, meta: { layout: "main", title, roles: ["admin"] } })),
];
const router = createRouter({ history: createWebHistory(), routes });

const ROLE_LANDING = {
  student: "/home",
  admin: "/module3/admin",
  counselor: "/module3/counselor",
  student_affairs: "/module3/student-affairs",
};

function isStudentPortalRoute(path) {
  return path === "/home" || path.startsWith("/zongce/") || path.startsWith("/module2/");
}

// 路由守卫：检查页面级角色权限，并隔离学生端与管理端入口。
router.beforeEach((to, from, next) => {
  const store = useUserStore();
  const role = store.userRole;
  const roleLanding = ROLE_LANDING[role] || "/login";

  if (store.isLoggedIn && role !== "student" && isStudentPortalRoute(to.path)) {
    next(roleLanding);
    return;
  }

  const requiredRoles = to.meta.roles;
  if (requiredRoles && !requiredRoles.includes(role)) {
    next(store.isLoggedIn ? roleLanding : { name: "Login" });
    return;
  }
  if (role === "counselor" && store.user?.profile_complete === false && to.name !== "Module3ProfileBasic") {
    next({ name: "Module3ProfileBasic", query: { required: "1" } });
    return;
  }
  next();
});

export default router;
