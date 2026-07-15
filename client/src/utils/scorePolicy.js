export const DEFAULT_SCORE_LIMITS = Object.freeze({
  total: 100,
  F1: 100,
  F2: 100,
  F3: 100,
  A1: 20,
  A2: 20,
  A3: 20,
  A4: 20,
  A5: 20,
  COURSE: 100,
  B1: 30,
  B2: 30,
  B3: 30,
  B4: 30,
  B5: 30,
  B6: 30,
  B7: 30,
  B8: 30,
});

export const DEFAULT_GRADE_RULES = Object.freeze([
  { grade: '优', min: 80 },
  { grade: '良', min: 70 },
  { grade: '合格', min: 60 },
  { grade: '不合格', min: 0 },
]);

export function normalizeScoreLimits(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(Object.entries(DEFAULT_SCORE_LIMITS).map(([key, fallback]) => {
    const value = Number(source[key] ?? fallback);
    return [key, Number.isFinite(value) && value >= 0 ? value : fallback];
  }));
}

export function scoreLimitForItem(section, subKey, input = {}) {
  const limits = normalizeScoreLimits(input);
  return Number(limits[subKey] ?? limits[section] ?? limits.total ?? 100);
}

export function calculateLevel(score, rules = DEFAULT_GRADE_RULES) {
  const normalizedRules = Array.isArray(rules) && rules.length ? rules : DEFAULT_GRADE_RULES;
  return [...normalizedRules]
    .sort((a, b) => Number(b.min) - Number(a.min))
    .find(rule => Number(score || 0) >= Number(rule.min))?.grade || '不合格';
}

export function calculateFormScores(items = [], inputLimits = {}) {
  const limits = normalizeScoreLimits(inputLimits);
  const grouped = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const section = item?.section || '';
    const subKey = item?.subKey || item?.sub_key || section;
    const key = `${section}:${subKey}`;
    if (!grouped.has(key)) grouped.set(key, { section, subKey, score: 0 });
    const group = grouped.get(key);
    const value = Number(item?.score || 0);
    group.score += Number.isFinite(value) && value > 0 ? value : 0;
  }

  let f1 = 0;
  let f2 = 0;
  let f3 = 0;
  for (const group of grouped.values()) {
    const capped = Math.min(group.score, scoreLimitForItem(group.section, group.subKey, limits));
    if (group.section === 'F1') f1 += capped;
    if (group.section === 'F2') f2 += capped;
    if (group.section === 'F3') f3 += capped;
  }
  f1 = Math.min(f1, limits.F1);
  f2 = Math.min(f2, limits.F2);
  f3 = Math.min(f3, limits.F3);
  const total = Math.min(f1 * 0.1 + f2 * 0.65 + f3 * 0.25, limits.total);
  return {
    f1_basic_quality: Number(f1.toFixed(2)),
    f2_course_learning: Number(f2.toFixed(2)),
    f3_innovation_practice: Number(f3.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}
