/** Review-only planner. No database, filesystem mutation, scheduler or executor.
 * A duration in test fixtures is not an approved duration for Mon BPREA. */
export function planRetention(policy, records, now) {
  if (policy?.validated !== true || !policy.approval || !Array.isArray(policy.rules) || !Number.isFinite(now)) throw new Error('Politique non validée : aucune purge autorisée.');
  const rules = new Map();
  for (const rule of policy.rules) {
    if (!rule.category || rules.has(rule.category) || !rule.trigger || !rule.purpose || !rule.justification || !rule.validator ||
      !rule.archiveDecision || !rule.exceptionDecision || !rule.proof || !Number.isSafeInteger(rule.durationMs) || rule.durationMs < 0) throw new Error('Règle incomplète : aucune purge autorisée.');
    rules.set(rule.category, rule);
  }
  return records.map(record => {
    const rule = rules.get(record.category);
    if (!rule) return { id: record.id, result: 'no_rule' };
    if (record.hold || record.activePurpose || record.archive && !record.archiveApproved) return { id: record.id, result: 'protected' };
    const event = record.events?.[rule.trigger], activity = record.lastActivity ?? event;
    if (!Number.isFinite(event) || !Number.isFinite(activity) || event > now || activity > now) return { id: record.id, result: 'missing_event' };
    const due = Math.max(event, activity) + rule.durationMs;
    return { id: record.id, result: Number.isSafeInteger(due) && due <= now ? 'review_candidate' : 'retain' };
  });
}
