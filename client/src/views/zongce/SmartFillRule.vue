<template>
  <div class="rule-page">
    <!-- 空状态 -->
    <div v-if="!currentBatch" class="empty-state">
      <span class="empty-icon">📋</span>
      <h3>未识别到测评批次</h3>
      <p>请联系管理员创建您所在学院和年级的测评批次</p>
    </div>
    <div v-else-if="!publishedRules || publishedRules.length === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <h3>该批次尚未上传规则集</h3>
      <p>当前批次「{{ currentBatch.title }}」暂无已发布的计分规则，请等待管理员上传</p>
      <div class="batch-info-mini">
        <span>{{ currentBatch.school_year }}</span>
        <span>·</span>
        <span>{{ currentBatch.college }}</span>
        <span>·</span>
        <span>{{ currentBatch.grade }}</span>
      </div>
    </div>

    <!-- 有规则 -->
    <div v-else class="rules-display">
      <!-- 批次概览 -->
      <div class="overview-bar">
        <div class="ov-left">
          <span class="ov-title">{{ currentBatch.title }}</span>
          <span class="ov-meta">{{ currentBatch.school_year }} · {{ currentBatch.college }} · {{ currentBatch.grade }}</span>
        </div>
        <div class="ov-right">
          <div class="ov-stat">
            <span class="ov-num">{{ groupedRules.length }}</span>
            <span class="ov-label">类别</span>
          </div>
          <div class="ov-stat">
            <span class="ov-num">{{ publishedRules.length }}</span>
            <span class="ov-label">条目</span>
          </div>
          <div class="ov-stat" v-if="ruleSetVersion">
            <span class="ov-num version">{{ ruleSetVersion }}</span>
            <span class="ov-label">版本</span>
          </div>
        </div>
      </div>

      <!-- 规则分组 -->
      <div class="groups-list">
        <div v-for="group in groupedRules" :key="group.key" class="group-card" :class="{ open: openState[group.key] }">
          <button class="group-trigger" @click="toggleGroup(group.key)">
            <span class="g-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <span class="g-badge">{{ group.key }}</span>
            <span class="g-name">{{ group.name }}</span>
            <span class="g-meta">{{ group.rules.length }} 条 · 最高 {{ group.maxScore }} 分</span>
          </button>
          <div v-show="openState[group.key]" class="group-body">
            <table class="rule-table">
              <thead>
                <tr><th>等级</th><th>奖项等次</th><th class="col-score">加分</th><th class="col-kw">关键词</th><th>说明</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, ri) in group.rules" :key="ri">
                  <td>
                    <span class="level-pill" :class="levelClass(r.score_level)">{{ r.score_level || '-' }}</span>
                  </td>
                  <td class="col-rank">{{ r.score_rank || '-' }}</td>
                  <td class="col-score">+{{ r.score }}</td>
                  <td class="col-kw">{{ r.keywords || '-' }}</td>
                  <td class="col-desc">{{ r.description || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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

const openState = reactive({})

function toggleGroup(key) { openState[key] = !openState[key] }

function levelClass(level) {
  const l = (level || '').toLowerCase()
  if (l.includes('national') || l.includes('国家')) return 'lvl-national'
  if (l.includes('provincial') || l.includes('省')) return 'lvl-province'
  if (l.includes('school') || l.includes('校')) return 'lvl-school'
  if (l.includes('college') || l.includes('院')) return 'lvl-college'
  return ''
}

const labelMap = { B1:'职业技能',B2:'学科竞赛',B3:'科研学术',B4:'宣传报道',B5:'社会工作',B6:'社会实践',B7:'文体竞赛',B8:'劳动教育' }

const statusLabel = computed(() => {
  const m = { draft:'草稿',published:'进行中',closed:'已结束',archived:'已归档' }
  return m[props.currentBatch?.status] || props.currentBatch?.status || ''
})

const ruleSetVersion = computed(() => props.publishedRules[0]?.version_label || '')

const groupedRules = computed(() => {
  if (!props.publishedRules?.length) return []
  const map = new Map()
  for (const r of props.publishedRules) {
    const key = r.item_key || '?'
    if (!map.has(key)) map.set(key, { key, name: labelMap[key] || key, rules: [], maxScore: 0 })
    const g = map.get(key)
    g.rules.push(r)
    if (r.score > g.maxScore) g.maxScore = r.score
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
})
</script>

<style scoped>
.rule-page { display: flex; flex-direction: column; gap: 24px; }

/* ===== 空状态 ===== */
.empty-state { text-align:center;padding:60px 20px;color:var(--color-text-secondary);display:flex;flex-direction:column;align-items:center;gap:10px; }
.empty-icon { font-size:52px;margin-bottom:4px; }
.empty-state h3 { font-size:18px;color:var(--color-text);margin:0; }
.empty-state p { font-size:14px;margin:0;max-width:420px; }
.batch-info-mini { margin-top:12px;display:flex;gap:8px;font-size:13px;color:var(--color-text-tertiary); }

/* ===== 概览条 ===== */
.overview-bar {
  display:flex;align-items:center;justify-content:space-between;gap:24px;
  padding:18px 22px;border-radius:16px;
  background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
}
.ov-left { display:flex;flex-direction:column;gap:2px; }
.ov-title { font-size:16px;font-weight:700;color:var(--color-text); }
.ov-meta { font-size:12px;color:var(--color-text-tertiary); }
.ov-right { display:flex;gap:28px; }
.ov-stat { display:flex;flex-direction:column;align-items:center;gap:2px; }
.ov-num { font-size:22px;font-weight:700;color:#c4a882; }
.ov-num.version { font-size:13px;font-weight:600;color:var(--color-text-secondary); }
.ov-label { font-size:11px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.06em; }

/* ===== 分组卡片 ===== */
.groups-list { display:flex;flex-direction:column;gap:6px; }
.group-card {
  border-radius:14px;overflow:hidden;
  background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);
  transition:background 0.2s;
}
.group-card.open { background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08); }

.group-trigger {
  width:100%;display:flex;align-items:center;gap:12px;
  padding:14px 18px;border:none;background:none;cursor:pointer;
  font-family:inherit;color:var(--color-text);text-align:left;
  transition:background 0.15s;
}
.group-trigger:hover { background:rgba(196,168,130,0.06); }

.g-arrow {
  color:var(--color-text-tertiary);display:flex;transition:transform 0.25s;
}
.group-card.open .g-arrow { transform:rotate(90deg); }

.g-badge {
  font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;
  background:rgba(196,168,130,0.15);color:#c4a882;
  min-width:32px;text-align:center;
}
.g-name { font-size:15px;font-weight:600;flex:1; }
.g-meta { font-size:12px;color:var(--color-text-tertiary); }

/* ===== 表格 ===== */
.group-body { padding:0 18px 16px; }
.rule-table { width:100%;border-collapse:collapse;font-size:13px; }
.rule-table th {
  text-align:left;padding:10px 8px 8px;
  border-bottom:1.5px solid rgba(255,255,255,0.08);
  color:var(--color-text-tertiary);font-weight:500;font-size:11px;
  text-transform:uppercase;letter-spacing:0.05em;
}
.rule-table td { padding:9px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--color-text-secondary); }
.rule-table tbody tr:hover { background:rgba(196,168,130,0.04); }
.rule-table tbody tr:last-child td { border-bottom:none; }

.col-score { font-weight:700;color:#7d9b76;white-space:nowrap; }
.col-rank { font-weight:500; }
.col-kw { max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--color-text-tertiary); }
.col-desc { max-width:220px;font-size:12px;color:var(--color-text-tertiary);line-height:1.45; }

/* 等级标签 */
.level-pill {
  font-size:11px;padding:3px 9px;border-radius:6px;font-weight:600;white-space:nowrap;
  background:rgba(255,255,255,0.05);color:var(--color-text-secondary);
}
.lvl-national { background:rgba(196,168,130,0.15);color:#c4a882; }
.lvl-province { background:rgba(125,155,118,0.13);color:#7d9b76; }
.lvl-school { background:rgba(163,181,199,0.15);color:#a3b5c7; }
.lvl-college { background:rgba(180,180,180,0.12);color:#999; }
</style>
