// 综测管理平台内存数据仓库
// 说明：当前阶段按需求分析先禁用真实数据库，所有数据保存在服务进程内存中。
// 重启后会恢复为下面的演示数据，后续接入数据库时可将本文件替换为持久化 service/DAO。
const bcrypt = require('bcryptjs');

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const toInt = (v) => Number.parseInt(v, 10);

const counters = {
  users: 6,
  classes: 3,
  batches: 3,
  materials: 7,
  attachments: 5,
  reviewRecords: 5,
  notifications: 5,
  operationLogs: 5,
};

const state = {
  users: [
    { id: 1, username: 'student', password: bcrypt.hashSync('123456', 4), role: 'student', real_name: '张三', class_id: 1, phone: '13800000001', avatar: '', created_at: now(), updated_at: now() },
    { id: 2, username: 'student2', password: bcrypt.hashSync('123456', 4), role: 'student', real_name: '李四', class_id: 1, phone: '13800000002', avatar: '', created_at: now(), updated_at: now() },
    { id: 3, username: 'leader', password: bcrypt.hashSync('123456', 4), role: 'class_leader', real_name: '王班长', class_id: 1, phone: '13800000003', avatar: '', created_at: now(), updated_at: now() },
    { id: 4, username: 'teacher', password: bcrypt.hashSync('123456', 4), role: 'teacher', real_name: '陈老师', class_id: null, phone: '13800000004', avatar: '', created_at: now(), updated_at: now() },
    { id: 5, username: 'student3', password: bcrypt.hashSync('123456', 4), role: 'student', real_name: '赵六', class_id: 2, phone: '13800000005', avatar: '', created_at: now(), updated_at: now() },
  ],
  classes: [
    { id: 1, name: '软件工程2301班', major: '软件工程', grade: '2023', teacher_id: 4, leader_id: 3, created_at: now() },
    { id: 2, name: '软件工程2302班', major: '软件工程', grade: '2023', teacher_id: 4, leader_id: null, created_at: now() },
  ],
  batches: [
    { id: 1, title: '2025-2026学年综合测评', description: '面向2023级软件工程专业的年度综合测评。', start_time: daysFromNow(-8), end_time: daysFromNow(12), status: 'published', requirements: '请按德育、智育、体育、美育、劳育分类提交加分申请，并上传清晰证明材料。', created_by: 4, created_at: daysFromNow(-10), updated_at: now() },
    { id: 2, title: '2024-2025学年综合测评归档', description: '历史批次，仅用于查看和归档。', start_time: '2025-06-01 00:00:00', end_time: '2025-06-30 23:59:59', status: 'archived', requirements: '历史批次。', created_by: 4, created_at: '2025-06-01 09:00:00', updated_at: '2025-07-01 09:00:00' },
  ],
  materials: [
    { id: 1, batch_id: 1, student_id: 1, title: '互联网+校赛一等奖', category: '竞赛获奖', score: 2.0, application_text: '参加互联网+创新创业大赛并获得校赛一等奖。', status: 'pending_class_leader', submit_time: daysFromNow(-1), created_at: daysFromNow(-2), updated_at: daysFromNow(-1) },
    { id: 2, batch_id: 1, student_id: 2, title: '志愿服务20小时', category: '社会实践', score: 1.0, application_text: '参与学院迎新志愿服务累计20小时。', status: 'pending_teacher', submit_time: daysFromNow(-2), created_at: daysFromNow(-3), updated_at: daysFromNow(-2) },
    { id: 3, batch_id: 1, student_id: 1, title: '优秀团员申请', category: '荣誉称号', score: 1.5, application_text: '申请优秀团员加分，证明材料需补充。', status: 'returned_by_teacher', submit_time: daysFromNow(-4), created_at: daysFromNow(-6), updated_at: daysFromNow(-2) },
    { id: 4, batch_id: 1, student_id: 2, title: 'CET-6 通过', category: '学业成果', score: 1.0, application_text: '大学英语六级成绩通过。', status: 'approved', submit_time: daysFromNow(-6), created_at: daysFromNow(-8), updated_at: daysFromNow(-3) },
    { id: 5, batch_id: 1, student_id: 5, title: '院级文体活动参与', category: '文体活动', score: 0.5, application_text: '参与院级文体活动。', status: 'draft', submit_time: null, created_at: daysFromNow(-1), updated_at: daysFromNow(-1) },
    { id: 6, batch_id: 1, student_id: 5, title: '优秀学生干部', category: '荣誉称号', score: 1.5, application_text: '申请优秀学生干部加分。', status: 'rejected', submit_time: daysFromNow(-3), created_at: daysFromNow(-4), updated_at: daysFromNow(-2) },
  ],
  attachments: [
    { id: 1, material_id: 1, file_name: 'internet-plus-award.pdf', original_name: '互联网+获奖证书.pdf', file_path: 'internet-plus-award.pdf', file_type: 'application/pdf', file_size: 204800, created_at: daysFromNow(-2) },
    { id: 2, material_id: 2, file_name: 'volunteer-hours.jpg', original_name: '志愿服务证明.jpg', file_path: 'volunteer-hours.jpg', file_type: 'image/jpeg', file_size: 512000, created_at: daysFromNow(-3) },
    { id: 3, material_id: 3, file_name: 'league-member.docx', original_name: '优秀团员证明.docx', file_path: 'league-member.docx', file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_size: 102400, created_at: daysFromNow(-6) },
    { id: 4, material_id: 4, file_name: 'cet6.png', original_name: '六级成绩单.png', file_path: 'cet6.png', file_type: 'image/png', file_size: 307200, created_at: daysFromNow(-8) },
  ],
  reviewRecords: [
    { id: 1, material_id: 2, reviewer_id: 3, reviewer_role: 'class_leader', action: 'approve', comment: '材料完整，提交老师复核。', created_at: daysFromNow(-2) },
    { id: 2, material_id: 3, reviewer_id: 3, reviewer_role: 'class_leader', action: 'approve', comment: '班级初审通过。', created_at: daysFromNow(-4) },
    { id: 3, material_id: 3, reviewer_id: 4, reviewer_role: 'teacher', action: 'return', comment: '请补充学院盖章证明。', created_at: daysFromNow(-2) },
    { id: 4, material_id: 4, reviewer_id: 3, reviewer_role: 'class_leader', action: 'approve', comment: '成绩单清晰。', created_at: daysFromNow(-6) },
    { id: 5, material_id: 4, reviewer_id: 4, reviewer_role: 'teacher', action: 'approve', comment: '复核通过。', created_at: daysFromNow(-3) },
  ],
  notifications: [
    { id: 1, user_id: 1, title: '材料被老师退回', content: '“优秀团员申请”需要补充学院盖章证明。', is_read: 0, created_at: daysFromNow(-2) },
    { id: 2, user_id: 2, title: '材料审核通过', content: '“CET-6 通过”已完成老师复核。', is_read: 0, created_at: daysFromNow(-3) },
    { id: 3, user_id: 1, title: '截止时间提醒', content: '当前综测批次将在12天后截止，请及时提交材料。', is_read: 0, created_at: now() },
    { id: 4, user_id: 4, title: '有材料待复核', content: '当前批次存在待老师审核材料。', is_read: 0, created_at: now() },
  ],
  operationLogs: [
    { id: 1, user_id: 4, action: 'create_batch', target_type: 'batch', target_id: 1, detail: '创建并发布2025-2026学年综合测评。', created_at: daysFromNow(-10) },
    { id: 2, user_id: 1, action: 'submit_material', target_type: 'material', target_id: 1, detail: '提交互联网+校赛一等奖。', created_at: daysFromNow(-1) },
    { id: 3, user_id: 3, action: 'review_material', target_type: 'material', target_id: 2, detail: '班干部初审通过。', created_at: daysFromNow(-2) },
    { id: 4, user_id: 4, action: 'review_material', target_type: 'material', target_id: 3, detail: '老师退回材料。', created_at: daysFromNow(-2) },
  ],
};

function nextId(key) {
  const id = counters[key] || 1;
  counters[key] = id + 1;
  return id;
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  const cls = state.classes.find((c) => c.id === user.class_id);
  return { ...rest, class_name: cls?.name || '' };
}

function getUser(id) {
  return state.users.find((u) => u.id === toInt(id));
}

function getClass(id) {
  return state.classes.find((c) => c.id === toInt(id));
}

function getBatch(id) {
  return state.batches.find((b) => b.id === toInt(id));
}

function getMaterial(id) {
  return state.materials.find((m) => m.id === toInt(id));
}

function decorateMaterial(material) {
  if (!material) return null;
  const student = getUser(material.student_id);
  const cls = getClass(student?.class_id);
  const batch = getBatch(material.batch_id);
  const attachments = state.attachments.filter((a) => a.material_id === material.id);
  const review_records = state.reviewRecords
    .filter((r) => r.material_id === material.id)
    .map((r) => ({ ...r, reviewer_name: getUser(r.reviewer_id)?.real_name || getUser(r.reviewer_id)?.username || '' }));
  return {
    ...material,
    student_name: student?.real_name || student?.username || '',
    username: student?.username || '',
    class_id: student?.class_id || null,
    class_name: cls?.name || '',
    batch_title: batch?.title || '',
    attachments,
    review_records,
  };
}

function canAccessMaterial(user, material) {
  if (!user || !material) return false;
  if (user.role === 'teacher') return true;
  if (user.role === 'student') return material.student_id === user.id;
  if (user.role === 'class_leader') {
    const student = getUser(material.student_id);
    return student?.class_id && student.class_id === user.class_id;
  }
  return false;
}

function log(userId, action, targetType, targetId, detail) {
  state.operationLogs.unshift({
    id: nextId('operationLogs'),
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    created_at: now(),
  });
}

function notify(userId, title, content) {
  state.notifications.unshift({
    id: nextId('notifications'),
    user_id: userId,
    title,
    content,
    is_read: 0,
    created_at: now(),
  });
}

function listBatches() {
  return [...state.batches].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function createBatch(user, data) {
  const batch = {
    id: nextId('batches'),
    title: data.title,
    description: data.description || '',
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status || 'draft',
    requirements: data.requirements || '',
    created_by: user.id,
    created_at: now(),
    updated_at: now(),
  };
  state.batches.unshift(batch);
  log(user.id, 'create_batch', 'batch', batch.id, `创建综测批次：${batch.title}`);
  return batch;
}

function updateBatch(user, id, data) {
  const batch = getBatch(id);
  if (!batch) return null;
  Object.assign(batch, {
    title: data.title ?? batch.title,
    description: data.description ?? batch.description,
    start_time: data.start_time ?? batch.start_time,
    end_time: data.end_time ?? batch.end_time,
    requirements: data.requirements ?? batch.requirements,
    status: data.status ?? batch.status,
    updated_at: now(),
  });
  log(user.id, 'update_batch', 'batch', batch.id, `更新综测批次：${batch.title}`);
  return batch;
}

function updateBatchStatus(user, id, status) {
  return updateBatch(user, id, { status });
}

function listMaterials(user, filters = {}) {
  let rows = state.materials.map(decorateMaterial).filter((m) => canAccessMaterial(user, m));
  if (filters.batch_id) rows = rows.filter((m) => m.batch_id === toInt(filters.batch_id));
  if (filters.status) rows = rows.filter((m) => m.status === filters.status);
  if (filters.class_id) rows = rows.filter((m) => m.class_id === toInt(filters.class_id));
  if (filters.keyword) {
    const kw = String(filters.keyword).trim();
    rows = rows.filter((m) => [m.title, m.category, m.student_name, m.class_name].some((v) => String(v || '').includes(kw)));
  }
  return rows.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

function createMaterial(user, data) {
  const batch = getBatch(data.batch_id);
  if (!batch) throw new Error('综测批次不存在');
  if (batch.status !== 'published') throw new Error('当前批次未发布，暂不能提交材料');
  const material = {
    id: nextId('materials'),
    batch_id: toInt(data.batch_id),
    student_id: user.id,
    title: data.title,
    category: data.category || '',
    score: Number(data.score || 0),
    application_text: data.application_text || '',
    status: 'draft',
    submit_time: null,
    created_at: now(),
    updated_at: now(),
  };
  state.materials.unshift(material);
  log(user.id, 'create_material', 'material', material.id, `保存材料草稿：${material.title}`);
  return decorateMaterial(material);
}

function updateMaterial(user, id, data) {
  const material = getMaterial(id);
  if (!material) throw new Error('材料不存在');
  if (material.student_id !== user.id) throw new Error('只能修改自己的材料');
  if (!['draft', 'returned_by_class_leader', 'returned_by_teacher'].includes(material.status)) {
    throw new Error('当前状态不允许修改材料');
  }
  Object.assign(material, {
    title: data.title ?? material.title,
    category: data.category ?? material.category,
    score: data.score === undefined ? material.score : Number(data.score || 0),
    application_text: data.application_text ?? material.application_text,
    updated_at: now(),
  });
  log(user.id, 'update_material', 'material', material.id, `修改材料：${material.title}`);
  return decorateMaterial(material);
}

function submitMaterial(user, id) {
  const material = getMaterial(id);
  if (!material) throw new Error('材料不存在');
  if (material.student_id !== user.id) throw new Error('只能提交自己的材料');
  if (['approved', 'rejected', 'pending_class_leader', 'pending_teacher'].includes(material.status)) {
    throw new Error('当前状态不允许重复提交');
  }
  material.status = 'pending_class_leader';
  material.submit_time = now();
  material.updated_at = now();
  log(user.id, 'submit_material', 'material', material.id, `正式提交材料：${material.title}`);
  const leader = state.users.find((u) => u.role === 'class_leader' && u.class_id === user.class_id);
  if (leader) notify(leader.id, '有新的待初审材料', `${user.real_name || user.username} 提交了“${material.title}”。`);
  return decorateMaterial(material);
}

function addAttachment(user, materialId, file) {
  const material = getMaterial(materialId);
  if (!material) throw new Error('材料不存在');
  if (!canAccessMaterial(user, material)) throw new Error('无权访问该材料');
  if (user.role === 'student' && material.student_id !== user.id) throw new Error('只能给自己的材料上传附件');
  if (user.role === 'student' && !['draft', 'returned_by_class_leader', 'returned_by_teacher'].includes(material.status)) {
    throw new Error('当前材料状态不允许继续上传附件');
  }
  const attachment = {
    id: nextId('attachments'),
    material_id: material.id,
    file_name: file.filename,
    original_name: file.originalname,
    file_path: file.filename,
    file_type: file.mimetype,
    file_size: file.size,
    created_at: now(),
  };
  state.attachments.push(attachment);
  material.updated_at = now();
  log(user.id, 'upload_attachment', 'material', material.id, `上传附件：${file.originalname}`);
  return attachment;
}

function getPendingReviews(user, filters = {}) {
  const status = user.role === 'class_leader' ? 'pending_class_leader' : 'pending_teacher';
  return listMaterials(user, { ...filters, status });
}

function reviewMaterial(user, id, action, comment = '') {
  const material = getMaterial(id);
  if (!material) throw new Error('材料不存在');
  if (!canAccessMaterial(user, material)) throw new Error('无权审核该材料');
  if (!['class_leader', 'teacher'].includes(user.role)) throw new Error('当前角色不能审核材料');
  if (user.role === 'class_leader' && material.status !== 'pending_class_leader') throw new Error('该材料当前不在班干部初审环节');
  if (user.role === 'teacher' && material.status !== 'pending_teacher') throw new Error('该材料当前不在老师复核环节');

  const statusMap = {
    class_leader: { approve: 'pending_teacher', return: 'returned_by_class_leader', reject: 'rejected' },
    teacher: { approve: 'approved', return: 'returned_by_teacher', reject: 'rejected' },
  };
  const nextStatus = statusMap[user.role]?.[action];
  if (!nextStatus) throw new Error('审核操作无效');

  material.status = nextStatus;
  material.updated_at = now();
  const record = {
    id: nextId('reviewRecords'),
    material_id: material.id,
    reviewer_id: user.id,
    reviewer_role: user.role,
    action,
    comment,
    created_at: now(),
  };
  state.reviewRecords.unshift(record);
  const actionLabel = action === 'approve' ? '通过' : action === 'return' ? '退回' : '驳回';
  log(user.id, 'review_material', 'material', material.id, `${user.role === 'teacher' ? '老师复核' : '班干部初审'}${actionLabel}：${material.title}`);
  notify(material.student_id, '材料审核结果更新', `“${material.title}”已${actionLabel}${comment ? `，意见：${comment}` : '。'}`);
  if (user.role === 'class_leader' && action === 'approve') {
    state.users.filter((u) => u.role === 'teacher').forEach((t) => notify(t.id, '有新的待复核材料', `“${material.title}”已通过班级初审，请老师复核。`));
  }
  return decorateMaterial(material);
}

function listNotifications(user) {
  return state.notifications
    .filter((n) => n.user_id === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function listLogs(user, filters = {}) {
  let rows = [...state.operationLogs];
  if (filters.action) rows = rows.filter((l) => l.action === filters.action);
  return rows
    .map((l) => ({ ...l, user_name: getUser(l.user_id)?.real_name || getUser(l.user_id)?.username || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function listClasses() {
  return state.classes.map((c) => ({
    ...c,
    teacher_name: getUser(c.teacher_id)?.real_name || '',
    leader_name: getUser(c.leader_id)?.real_name || '',
    student_count: state.users.filter((u) => u.role === 'student' && u.class_id === c.id).length,
  }));
}

function listUsers(filters = {}) {
  let users = state.users.map(publicUser);
  if (filters.role) users = users.filter((u) => u.role === filters.role);
  if (filters.class_id) users = users.filter((u) => u.class_id === toInt(filters.class_id));
  return users;
}

function setClassLeader(user, classId, leaderId) {
  const cls = getClass(classId);
  const leader = getUser(leaderId);
  if (!cls) throw new Error('班级不存在');
  if (!leader) throw new Error('用户不存在');
  leader.role = 'class_leader';
  leader.class_id = cls.id;
  leader.updated_at = now();
  cls.leader_id = leader.id;
  log(user.id, 'set_class_leader', 'class', cls.id, `设置${leader.real_name || leader.username}为${cls.name}班干部`);
  return { class: cls, leader: publicUser(leader) };
}

function statistics(batchId, user) {
  const batch_id = toInt(batchId || state.batches.find((b) => b.status === 'published')?.id || 1);
  let students = state.users.filter((u) => u.role === 'student');
  if (user.role === 'class_leader') students = students.filter((u) => u.class_id === user.class_id);
  const materials = listMaterials(user, { batch_id });
  const submittedStudentIds = new Set(materials.filter((m) => m.submit_time).map((m) => m.student_id));
  const unsubmitted = students
    .filter((s) => !submittedStudentIds.has(s.id))
    .map((s) => ({ id: s.id, real_name: s.real_name, username: s.username, class_name: getClass(s.class_id)?.name || '' }));
  const statusCounts = materials.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  const classProgress = listClasses().map((cls) => {
    const classStudents = students.filter((s) => s.class_id === cls.id);
    if (user.role === 'class_leader' && cls.id !== user.class_id) return null;
    const classMaterials = materials.filter((m) => m.class_id === cls.id);
    const classSubmitted = new Set(classMaterials.filter((m) => m.submit_time).map((m) => m.student_id)).size;
    return {
      class_id: cls.id,
      class_name: cls.name,
      student_count: classStudents.length,
      submitted_count: classSubmitted,
      unsubmitted_count: Math.max(classStudents.length - classSubmitted, 0),
      pending_count: classMaterials.filter((m) => ['pending_class_leader', 'pending_teacher'].includes(m.status)).length,
      approved_count: classMaterials.filter((m) => m.status === 'approved').length,
      returned_count: classMaterials.filter((m) => ['returned_by_class_leader', 'returned_by_teacher'].includes(m.status)).length,
    };
  }).filter(Boolean);
  return {
    batch_id,
    total_students: students.length,
    submitted_students: submittedStudentIds.size,
    unsubmitted_students: unsubmitted.length,
    pending_count: materials.filter((m) => ['pending_class_leader', 'pending_teacher'].includes(m.status)).length,
    approved_count: statusCounts.approved || 0,
    returned_count: (statusCounts.returned_by_class_leader || 0) + (statusCounts.returned_by_teacher || 0),
    rejected_count: statusCounts.rejected || 0,
    status_counts: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    unsubmitted,
    class_progress: classProgress,
  };
}

function exportCsv(batchId, user) {
  const materials = listMaterials(user, { batch_id: batchId });
  const header = ['批次', '班级', '学生', '材料标题', '类别', '申请分值', '状态', '提交时间', '附件数', '最后审核意见'];
  const rows = materials.map((m) => {
    const last = m.review_records?.[0];
    return [
      m.batch_title,
      m.class_name,
      m.student_name,
      m.title,
      m.category,
      m.score,
      m.status,
      m.submit_time || '',
      m.attachments.length,
      last?.comment || '',
    ];
  });
  const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

module.exports = {
  state,
  publicUser,
  getUser,
  getBatch,
  getMaterial,
  decorateMaterial,
  canAccessMaterial,
  listBatches,
  createBatch,
  updateBatch,
  updateBatchStatus,
  listMaterials,
  createMaterial,
  updateMaterial,
  submitMaterial,
  addAttachment,
  getPendingReviews,
  reviewMaterial,
  listNotifications,
  listLogs,
  listClasses,
  listUsers,
  setClassLeader,
  statistics,
  exportCsv,
  notify,
  log,
  now,
};
