import { ALL_RULES } from "./rules";
import type { RoundWithHoleScores, RuleOutput } from "./types";

export interface EngineDecision {
  /** Rule outputs that should be persisted (replacing any prior rec for the same rule). */
  toCreate: RuleOutput[];
  /** Rule ids whose active recommendation (if any) should be dismissed. */
  toDismiss: string[];
}

/**
 * Run every rule against the supplied chronologically ordered rounds and
 * return the deterministic set of recommendations to persist plus the rule
 * ids whose recommendations should be cleared. Pure so it can be unit-tested
 * without a database.
 *
 * @param rounds   Rounds (oldest first) for the player.
 * @param activeRuleIds Optional list of rule ids that currently have an
 *   active recommendation; used so we only ask the persister to dismiss
 *   rules that previously triggered.
 */
export function evaluateRules(
  rounds: readonly RoundWithHoleScores[],
  activeRuleIds: readonly string[] = [],
): EngineDecision {
  const toCreate: RuleOutput[] = [];
  const triggeredIds = new Set<string>();
  for (const { id, rule } of ALL_RULES) {
    const result = rule(rounds);
    if (result) {
      toCreate.push(result);
      triggeredIds.add(id);
    }
  }
  const toDismiss = activeRuleIds.filter((id) => !triggeredIds.has(id));
  return { toCreate, toDismiss };
}
