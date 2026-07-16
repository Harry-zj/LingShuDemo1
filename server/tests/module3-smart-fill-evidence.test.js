const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadSmartFillEvidenceMap,
  mergeSmartFillEvidence,
  resolveEvidenceItemKey,
} = require('../src/services/module3/smartFillEvidence');

test('已确认规则编码可以映射到综测表小项', () => {
  assert.equal(resolveEvidenceItemKey(JSON.stringify({ indicator: { code: 'B1' } }), '{}'), 'B1');
  assert.equal(resolveEvidenceItemKey(JSON.stringify({ indicator_code: 'F3.B7.2' }), '{}'), 'B7');
  assert.equal(resolveEvidenceItemKey('{}', JSON.stringify({ match_item_key: 'F1_A4' })), 'A4');
  assert.equal(resolveEvidenceItemKey(JSON.stringify({ indicator: { name: '学科竞赛类' } }), '{}'), 'B2');
  assert.equal(resolveEvidenceItemKey(JSON.stringify({ indicator: { code: 'F2' } }), '{}'), 'COURSE');
});

test('同一材料的全部附件会跟随对应小项同步', async () => {
  let call = 0;
  const db = {
    async execute() {
      call += 1;
      if (call === 1) {
        return [[
          { material_id: 10, fact_id: 1, fact_data: JSON.stringify({ match_item_key: 'B1' }), preview_data: '{}' },
          { material_id: 10, fact_id: 2, fact_data: '{}', preview_data: JSON.stringify({ indicator: { code: 'B2' } }) },
          { material_id: 11, fact_id: 3, fact_data: '{}', preview_data: JSON.stringify({ indicator: { code: 'A3' } }) },
        ]];
      }
      return [[
        { id: 101, material_id: 10 },
        { id: 102, material_id: 10 },
        { id: 103, material_id: 11 },
      ]];
    },
  };

  const map = await loadSmartFillEvidenceMap(db, 8, 9);
  assert.deepEqual(map.get('B1'), [101, 102]);
  assert.deepEqual(map.get('B2'), [101, 102]);
  assert.deepEqual(map.get('A3'), [103]);
});

test('自动识别附件与学生手动添加附件合并且不重复', () => {
  const map = new Map([['B1', [101, 102, 102]]]);
  const items = mergeSmartFillEvidence([
    { section: 'F3', subKey: 'B1', evidence_ids: '[99,101]' },
  ], map);
  assert.deepEqual(items[0].evidence_ids, [99, 101, 102]);
});
