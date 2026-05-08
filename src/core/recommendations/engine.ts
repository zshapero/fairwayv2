import { ALL_RULES } from "./rules";
import type { RuleContext, RuleOutput } from "./types";

export interface EngineDecision {
  /** Rule outputs that should be persisted (replacing any prior rec for the same rule). */
  toCreate: RuleOutput[];
  /** Rule ids whose active recommendation (if any) should be dismissed. */
  toDismiss: string[];
}

/**
 * Run every rule against the supplied context and return the deterministic
 * set of recommendations to persist plus the rule ids whose recommendations
 * should be cleared.
 *
 * Opportunity recommendations are sorted highest-priority first; strengths
 * and milestones are sorted newest-first by triggering round id (a proxy
 * for recency since IDs grow monotonically with `played_at`).
 */
export function evaluateRules(
  ctx: RuleContext,
  activeRuleIds: readonly string[] = [],
): EngineDecision {
  const triggered: RuleOutput[] = [];
  const triggeredIds = new Set<string>();
  for (const { id, rule } of ALL_RULES) {
    const result = rule(ctx);
    if (result) {
      triggered.push(result);
      triggeredIds.add(id);
    }
  }

  const opportunities = triggered
    .filter((r) => r.type === "opportunity")
    .sort((a, b) => b.priority - a.priority);
  const positives = triggered
    .filter((r) => r.type !== "opportunity")
    .sort((a, b) => {
      const aMax = Math.max(0, ...a.triggeringRoundIds);
      const bMax = Math.max(0, ...b.triggeringRoundIds);
      return bMax - aMax;
    });

  const toCreate = [...opportunities, ...positives];
  const toDismiss = activeRuleIds.filter((id) => !triggeredIds.has(id));
  return { toCreate, toDismiss };
}
