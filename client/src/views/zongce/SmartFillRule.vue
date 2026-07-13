<template>
  <div class="rule-page">
    <!-- ===== 未匹配到批次 ===== -->
    <div v-if="!currentBatch" class="empty-state">
      <span class="empty-icon">📋</span>
      <h3>未识别到测评批次</h3>
      <p>请联系管理员创建您所在学院和年级的测评批次</p>
    </div>

    <!-- ===== 有批次但无已发布规则 ===== -->
    <div v-else-if="!publishedRules || publishedRules.length === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <h3>该批次尚未上传规则集</h3>
      <p>当前批次「{{ currentBatch.title }}」暂无已发布的计分规则，请等待管理员上传</p>
      <div class="batch-info-card">
        <div class="info-row"><span class="info-label">学年</span><span class="info-value">{{ currentBatch.school_year }}</span></div>
        <div class="info-row"><span class="info-label">学院</span><span class="info-value">{{ currentBatch.college }}</span></div>
        <div class="info-row"><span class="info-label">年级</span><span class="info-value">{{ currentBatch.grade }}</span></div>
        <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-tag" :class="'status-' + currentBatch.status">{{ statusLabel }}</span></span></div>
      </div>
    </div>

    <!-- ===== 有已发布规则 ===== -->
    <div v-else class="rules-display">
      <!-- 批次信息头 -->
      <div class="batch-header-card">
        <div class="batch-header-top">
          <span class="batch-icon">📋</span>
          <div>
            <h3>{{ currentBatch.title }}</h3>
            <p class="batch-sub">{{ currentBatch.school_year }} · {{ currentBatch.college }} · {{ currentBatch.grade }}</p>
          </div>
          <span class="status-tag" :class="'status-' + currentBatch.status">{{ statusLabel }}</span>
        </div>
        <div class="batch-stats">
          <div class="stat-item">
            <span class="stat-num">{{ groupedRules.length }}</span>
            <span class="stat-label">规则类别</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">{{ publishedRules.length }}</span>
            <span class="stat-label">计分规则条目</span>
          </div>
          <div class="stat-item" v-if="ruleSetVersion">
            <span class="stat-num">{{ ruleSetVersion }}</span>
            <span class="stat-label">规则集版本</span>
          </div>
        </div>
      </div>

      <!-- 规则分组列表（按 item_key 分组） -->
      <div v-for="group in groupedRules" :key="group.key" class="rule-group-card">
        <div class="group-header" @click="toggleGroup(group.key)">
          <span class="group-arrow">{{ openState[group.key] ? '▼' : '▶' }}</span>
          <span class="group-key">{{ group.key }}</span>
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ group.rules.length }} 条规则</span>
          <span class="group-max">最高 {{ group.maxScore }} 分</span>
        </div>
        <div v-show="openState[group.key]" class="group-body">
          <table class="rule-table">
            <thead>
              <tr><th>等级</th><th>奖项</th><th>加分</th><th>关键词</th><th>说明</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in group.rules" :key="ri">
                <td><span class="level-tag">{{ r.score_level || '-' }}</span></td>
                <td>{{ r.score_rank || '-' }}</td>
                <td class="score-cell">+{{ r.score }}</td>
                <td class="keywords-cell">{{ r.keywords || '-' }}</td>
                <td class="desc-cell">{{ r.description || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({
  currentBatch: { type: Object, default: null },
  publishedRules: { type: Array, default: () => [] },
})

// ★ 独立追踪每个分组的展开/收起状态（不能放在 computed 里，会被重置）
const openState = reactive({})

function toggleGroup(key) {
  openState[key] = !openState[key]
}

const statusLabel = computed(() => {
  const s = props.currentBatch?.status
  if (s === 'draft') return '草稿'
  if (s === 'published') return '进行中'
  if (s === 'closed') return '已结束'
  if (s === 'archived') return '已归档'
  return s || ''
})

const ruleSetVersion = computed(() => {
  if (!props.publishedRules || props.publishedRules.length === 0) return ''
  return props.publishedRules[0].version_label || ''
})

// ★ 按 item_key 分组
const groupedRules = computed(() => {
  if (!props.publishedRules || props.publishedRules.length === 0) return []
  const map = new Map()
  const labelMap = {
    B1: '职业技能', B2: '学科竞赛', B3: '科研学术',
    B4: '宣传报道', B5: '社会工作', B6: '社会实践',
    B7: '文体竞赛', B8: '劳动教育',
  }
  for (const r of props.publishedRules) {
    const key = r.item_key || '?'
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: labelMap[key] || key,
        rules: [],
        maxScore: 0,
      })
    }
    const g = map.get(key)
    g.rules.push(r)
    if (r.score > g.maxScore) g.maxScore = r.score
  }
  // 按 B1-B8 排序
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
})
</script>

<style scoped>
.rule-page { display: flex; flex-direction: column; gap: 20px; }

/* ===== 空状态 ===== */
.empty-state {
  text-align: center; padding: 50px 20px; color: var(--color-text-secondary);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.empty-icon { font-size: 48px; margin-bottom: 8px; }
.empty-state h3 { font-size: 18px; color: var(--color-text); margin: 0; }
.empty-state p { font-size: 14px; margin: 0; max-width: 400px; }

/* ===== 批次信息卡片 ===== */
.batch-info-card {
  margin-top: 16px; padding: 16px 20px; background: var(--color-surface-variant);
  border-radius: 8px; display: flex; flex-direction: column; gap: 8px;
  min-width: 260px; text-align: left;
}
.info-row { display: flex; justify-content: space-between; font-size: 13px; }
.info-label { color: var(--color-text-tertiary); }
.info-value { font-weight: 500; }

/* ===== 批次信息头 ===== */
.batch-header-card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: 12px; padding: 20px 24px;
}
.batch-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.batch-icon { font-size: 28px; }
.batch-header-top h3 { font-size: 17px; margin: 0; }
.batch-sub { font-size: 13px; color: var(--color-text-tertiary); margin: 2px 0 0; }
.batch-stats { display: flex; gap: 24px; }
.stat-item { display: flex; flex-direction: column; }
.stat-num { font-size: 22px; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 12px; color: var(--color-text-tertiary); }

/* ===== 状态标签 ===== */
.status-tag { font-size: 12px; padding: 2px 10px; border-radius: 12px; font-weight: 500; }
.status-published { background: #e6f4ea; color: #34A853; }
.status-draft { background: #fef7e0; color: #E37400; }
.status-closed { background: #fce8e6; color: #D93025; }
.status-archived { background: #f1f3f4; color: #999; }

/* ===== 规则分组卡片 ===== */
.rule-group-card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: 10px; overflow: hidden;
}
.group-header {
  display: flex; align-items: center; gap: 10px; padding: 14px 16px;
  background: var(--color-surface-variant); cursor: pointer; user-select: none;
}
.group-header:hover { background: var(--color-surface-variant); }
.group-arrow { font-size: 12px; color: var(--color-text-tertiary); width: 16px; }
.group-key {
  font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
  background: var(--color-primary); color: #fff; min-width: 32px; text-align: center;
}
.group-name { font-weight: 600; font-size: 15px; flex: 1; }
.group-count { font-size: 13px; color: var(--color-text-tertiary); }
.group-max { font-size: 13px; font-weight: 600; color: var(--color-primary); }
.group-body { padding: 0 16px 12px; }

/* ===== 规则表格 ===== */
.rule-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rule-table th { text-align: left; padding: 8px 6px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 500; white-space: nowrap; }
.rule-table td { padding: 7px 6px; border-bottom: 1px solid var(--color-border); }
.score-cell { font-weight: 700; color: #34A853; }
.keywords-cell { color: var(--color-text-secondary); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.desc-cell { max-width: 200px; color: var(--color-text-tertiary); font-size: 12px; }
.level-tag {
  font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #e8f0fe; color: #1a73e8;
}
</style>
