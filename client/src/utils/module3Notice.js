export const MODULE3_NOTICE_CHANGE_EVENT = 'lingshu-module3-notice-change'

export function module3NoticeStorageKey(userId) {
  return `lingshu-module3-seen-notices-${userId || 'anonymous'}`
}

export function readModule3SeenNoticeKeys(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(module3NoticeStorageKey(userId)) || '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

export function writeModule3SeenNoticeKeys(userId, keys) {
  try {
    localStorage.setItem(module3NoticeStorageKey(userId), JSON.stringify([...keys]))
  } catch {
    // 本地存储不可用时仍保留当前页面状态
  }
}

function resultNoticeKey(form) {
  return `result-${form.id}-${form.result_released_at || form.updated_at || form.status}`
}

function isActionableForm(form) {
  if (!form) return true
  const status = String(form.status || '')
  return ['draft', 'smart_ready'].includes(status) || status.startsWith('returned')
}

export function buildStudentNoticeSummary(batches = [], forms = [], seenKeys = new Set()) {
  const normalizedSeenKeys = seenKeys instanceof Set ? seenKeys : new Set(seenKeys || [])
  const formsByBatch = new Map(
    (forms || [])
      .filter(form => Number(form?.batch_id || 0))
      .map(form => [Number(form.batch_id), form])
  )
  const actionableByBatch = new Map()
  const unreadResults = []

  ;(batches || [])
    .filter(batch => batch?.status === 'published')
    .forEach(batch => {
      const batchId = Number(batch.id || 0)
      if (!batchId) return
      const form = formsByBatch.get(batchId)
      if (!isActionableForm(form)) return

      const returned = String(form?.status || '').startsWith('returned')
      actionableByBatch.set(batchId, {
        key: `form-${batchId}`,
        lifecycle: 'actionable',
        type: 'form',
        title: returned ? '综测表已被退回' : '新的综测批次已发布',
        description: returned
          ? `“${form?.batch_title || batch.title || '当前批次'}”需要修改后重新提交。`
          : `“${batch.title || '当前批次'}”已开放，请进入综测信息填写。`,
        icon: returned ? 'mdi:file-undo-outline' : 'mdi:calendar-star-outline',
        to: `/module3/student/forms/${batchId}`,
      })
    })

  ;(forms || []).forEach(form => {
    const batchId = Number(form?.batch_id || 0)
    if (!batchId) return
    const status = String(form?.status || '')

    // 与导航栏一致：退回属于持续待办，只有重新提交、状态变更后才消失，点击不清除。
    if (status.startsWith('returned')) {
      actionableByBatch.set(batchId, {
        key: `form-${batchId}`,
        lifecycle: 'actionable',
        type: 'form',
        title: '综测表已被退回',
        description: `“${form.batch_title || '当前批次'}”需要修改后重新提交。`,
        icon: 'mdi:file-undo-outline',
        to: `/module3/student/forms/${batchId}`,
      })
    }

    if (form?.result_released && status !== 'pending_objection_review') {
      const key = resultNoticeKey(form)
      if (!normalizedSeenKeys.has(key)) {
        unreadResults.push({
          key,
          lifecycle: 'unread',
          type: 'result',
          title: '综测结果已返回',
          description: `“${form.batch_title || '当前批次'}”结果已生成，可查看评价记录和异议入口。`,
          icon: 'mdi:bell-check-outline',
          to: `/module3/student/results/${batchId}`,
        })
      }
    }
  })

  const actionable = [...actionableByBatch.values()]
  return {
    actionable,
    unreadResults,
    notices: [...actionable, ...unreadResults],
    formCount: actionable.length,
    resultCount: unreadResults.length,
  }
}

export function calculateStudentNoticeCount(batches, forms, pendingCount = 0, seenKeys = new Set()) {
  const summary = buildStudentNoticeSummary(batches, forms, seenKeys)
  return summary.formCount + summary.resultCount + Math.max(Number(pendingCount || 0), 0)
}
