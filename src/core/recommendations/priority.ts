/**
 * Priority for an opportunity recommendation, on a 0-100 scale (higher =
 * more important to address). Composed from three signals:
 *
 *   priority = scoreImpactEstimate * 10
 *            + severityRatio * 30
 *            + min(chronicityWeeks, 8) * 5
 *
 * Cap at 100. Each rule supplies its own three numbers:
 *
 * - scoreImpactEstimate: 0-10. Roughly the strokes/round the player could
 *   reclaim if the issue is fixed.
 * - severityRatio: 0-1. How far past the rule's threshold the metric sits,
 *   normalised so 1 = "double the threshold gap".
 * - chronicityWeeks: how long the pattern has been visible. Capped at 8
 *   weeks before further weeks stop adding priority.
 */

export function computePriority(
  scoreImpactEstimate: number,
  severityRatio: number,
  chronicityWeeks: number,
): number {
  const impact = Math.max(0, Math.min(10, scoreImpactEstimate));
  const severity = Math.max(0, Math.min(1, severityRatio));
  const chronicity = Math.max(0, Math.min(8, chronicityWeeks));
  const raw = impact * 10 + severity * 30 + chronicity * 5;
  return Math.max(0, Math.min(100, raw));
}
