export const STATUS_MAP = {
  draft: { label: '草稿', color: '#9AA0A6', bg: '#F1F3F4' },
  pending_class_leader: { label: '待班干部审核', color: '#E37400', bg: '#FEF7E0' },
  returned_by_class_leader: { label: '班干部退回', color: '#D93025', bg: '#FCE8E6' },
  pending_teacher: { label: '待老师审核', color: '#E37400', bg: '#FEF7E0' },
  returned_by_teacher: { label: '老师退回', color: '#D93025', bg: '#FCE8E6' },
  approved: { label: '已通过', color: '#34A853', bg: '#E6F4EA' },
  rejected: { label: '已驳回', color: '#D93025', bg: '#FCE8E6' },
};

export const BATCH_STATUS_MAP = {
  draft: { label: '草稿', color: '#9AA0A6', bg: '#F1F3F4' },
  published: { label: '已发布', color: '#34A853', bg: '#E6F4EA' },
  closed: { label: '已关闭', color: '#E37400', bg: '#FEF7E0' },
  archived: { label: '已归档', color: '#5F6368', bg: '#F1F3F4' },
};

export const ROLE_LABEL = { student: '学生', class_leader: '班干部', teacher: '老师' };

export const REVIEW_ACTION_LABEL = { approve: '通过', return: '退回', reject: '驳回' };

export function statusStyle(status) {
  const m = STATUS_MAP[status] || BATCH_STATUS_MAP[status];
  return m ? { background: m.bg, color: m.color } : {};
}
