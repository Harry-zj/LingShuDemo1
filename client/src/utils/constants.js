export const STATUS_MAP = {
  smart_ready: { label: "智能填表待提交", color: "#9AA0A6", bg: "#F1F3F4" },
  pending_class_committee: { label: "待综测成员评价", color: "#E37400", bg: "#FEF7E0" },
  returned_by_class_committee: { label: "综测成员退回", color: "#D93025", bg: "#FCE8E6" },
  pending_counselor: { label: "待辅导员评价", color: "#E37400", bg: "#FEF7E0" },
  returned_by_counselor: { label: "辅导员退回", color: "#D93025", bg: "#FCE8E6" },
  pending_student_affairs: { label: "待学生工作处评价", color: "#E37400", bg: "#FEF7E0" },
  returned_by_student_affairs: { label: "学生工作处退回", color: "#D93025", bg: "#FCE8E6" },
  approved: { label: "学生工作处认定通过", color: "#34A853", bg: "#E6F4EA" },
  rejected: { label: "不予认定", color: "#D93025", bg: "#FCE8E6" }
};

export const ROLE_LABEL = {
  student: "学生",
  admin: "管理员",
  counselor: "辅导员",
  student_affairs: "学生工作处"
};

export const LOGIN_ROLES = ["student", "counselor", "student_affairs", "admin"];
export const REVIEWER_ROLES = ["student", "counselor", "student_affairs"];

export const FORM_STRUCTURE = [
  {
    key: "F1",
    title: "F1 基本素质评分",
    children: [
      { key: "A1", title: "思想政治表现A1" },
      { key: "A2", title: "道德品质修养A2" },
      { key: "A3", title: "学习态度作风A3" },
      { key: "A4", title: "组织纪律观念A4" },
      { key: "A5", title: "身心健康素质A5" }
    ]
  },
  { key: "F2", title: "F2 课程学习成绩评分", children: [{ key: "COURSE", title: "课程成绩" }] },
  {
    key: "F3",
    title: "F3 创新素质与实践能力评分",
    children: [
      { key: "B1", title: "职业技能类B1" },
      { key: "B2", title: "学科竞赛类B2" },
      { key: "B3", title: "科研学术活动类B3" },
      { key: "B4", title: "文学艺术创作与宣传报道类B4" },
      { key: "B5", title: "社会工作类B5" },
      { key: "B6", title: "社会实践类B6" },
      { key: "B7", title: "文体艺术活动类B7" },
      { key: "B8", title: "劳育类B8" }
    ]
  }
];
