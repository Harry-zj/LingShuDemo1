export const STATUS_MAP = {
  draft: { label: "草稿", color: "#9AA0A6", bg: "#F1F3F4" },
  pending_class_leader: { label: "待班干审核", color: "#E37400", bg: "#FEF7E0" },
  pending_teacher: { label: "待老师审核", color: "#E37400", bg: "#FEF7E0" },
  approved: { label: "已通过", color: "#34A853", bg: "#E6F4EA" },
  rejected: { label: "已驳回", color: "#D93025", bg: "#FCE8E6" },
  returned_by_class_leader: { label: "班干退回", color: "#D93025", bg: "#FCE8E6" },
  returned_by_teacher: { label: "老师退回", color: "#D93025", bg: "#FCE8E6" }
}
export const ROLE_LABEL = { student: "学生", class_leader: "班干部", teacher: "老师" }
