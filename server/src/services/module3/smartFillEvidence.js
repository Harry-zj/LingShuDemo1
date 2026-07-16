function parseJson(value, fallback = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeIds(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(Number).filter(Number.isInteger).filter(value => value > 0))]
    : [];
}

function resolveSmartFillEvidenceItem(previewData, factData) {
  const preview = parseJson(previewData, {});
  const fact = parseJson(factData, {});
  const candidates = [
    preview?.indicator?.code,
    preview?.indicator_code,
    preview?.item_key,
    fact?.match_item_key,
    fact?.indicator_code,
    fact?.item_key,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim().toUpperCase();
    if (!value) continue;
    const direct = value.match(/^(A[1-5]|B[1-8])$/);
    const embedded = value.match(/(?:^|[^A-Z0-9])(A[1-5]|B[1-8])(?:$|[^A-Z0-9])/);
    const subKey = direct?.[1] || embedded?.[1] || '';
    if (!subKey) continue;
    return {
      section: subKey.startsWith('A') ? 'F1' : 'F3',
      subKey,
      key: `${subKey.startsWith('A') ? 'F1' : 'F3'}:${subKey}`,
    };
  }
  return null;
}

function mergeSmartFillItems(items = [], sourceItems = []) {
  const sourceMap = new Map(
    (Array.isArray(sourceItems) ? sourceItems : []).map(item => [
      `${item?.section || ''}:${item?.subKey || item?.sub_key || ''}`,
      item || {},
    ])
  );

  return (Array.isArray(items) ? items : []).map(item => {
    const key = `${item?.section || ''}:${item?.subKey || item?.sub_key || ''}`;
    const source = sourceMap.get(key) || {};
    const inputReason = String(item?.reason || '').trim();
    const sourceReason = String(source?.reason || '').trim();
    return {
      ...item,
      reason: inputReason || sourceReason,
      extraData: item?.extraData || source?.extraData || null,
      evidence_ids: normalizeIds([
        ...normalizeIds(source?.evidence_ids),
        ...normalizeIds(item?.evidence_ids),
      ]),
    };
  });
}

module.exports = {
  normalizeIds,
  resolveSmartFillEvidenceItem,
  mergeSmartFillItems,
};
