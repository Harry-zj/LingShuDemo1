const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeIds,
  resolveSmartFillEvidenceItem,
  mergeSmartFillItems,
} = require('../src/services/module3/smartFillEvidence');

test('识别智能填表指标并映射到评价表项目', () => {
  assert.deepEqual(
    resolveSmartFillEvidenceItem({ indicator: { code: 'B3' } }, {}),
    { section: 'F3', subKey: 'B3', key: 'F3:B3' }
  );
  assert.deepEqual(
    resolveSmartFillEvidenceItem({}, { match_item_key: 'F1_A2_score' }),
    { section: 'F1', subKey: 'A2', key: 'F1:A2' }
  );
});

test('提交项目时合并理由并去重附件', () => {
  const result = mergeSmartFillItems(
    [{ section: 'F1', subKey: 'A1', reason: '', score: 18, evidence_ids: [7, 7] }],
    [{ section: 'F1', subKey: 'A1', reason: '积极参加理论学习', evidence_ids: [5, 7] }]
  );
  assert.equal(result[0].reason, '积极参加理论学习');
  assert.deepEqual(result[0].evidence_ids, [5, 7]);
  assert.deepEqual(normalizeIds([0, 1, '2', 2, -1]), [1, 2]);
});
