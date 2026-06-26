import { findAgent } from "../data/agents.js";
import type { AgentRecord } from "../types.js";

type ScoreKey =
  | "overall"
  | "development"
  | "activity"
  | "documentation"
  | "community"
  | "transparency";

const scoreRows: Array<{ label: string; key: ScoreKey }> = [
  { label: "Overall", key: "overall" },
  { label: "Development", key: "development" },
  { label: "Activity", key: "activity" },
  { label: "Documentation", key: "documentation" },
  { label: "Community", key: "community" },
  { label: "Transparency", key: "transparency" }
];

function determineLeader(
  first: AgentRecord,
  second: AgentRecord
): string {
  if (first.scores.overall > second.scores.overall) {
    return first.name;
  }

  if (second.scores.overall > first.scores.overall) {
    return second.name;
  }

  return "Tie";
}

export function compareAgents(
  firstSlug: string,
  secondSlug: string
): string {
  const first = findAgent(firstSlug);
  const second = findAgent(secondSlug);

  if (!first) {
    throw new Error(`Agent "${firstSlug}" was not found.`);
  }

  if (!second) {
    throw new Error(`Agent "${secondSlug}" was not found.`);
  }

  const rows = scoreRows.map(({ label, key }) => {
    const firstScore = String(first.scores[key]).padStart(3);
    const secondScore = String(second.scores[key]).padStart(3);

    return `${label.padEnd(16)} ${firstScore}  ${secondScore}`;
  });

  return [
    "DEMO DATA — NOT A REAL CLARITY RATING",
    "",
    `${first.name.toUpperCase()} vs ${second.name.toUpperCase()}`,
    "",
    `${"Metric".padEnd(16)} ${first.name
      .slice(0, 3)
      .toUpperCase()}  ${second.name.slice(0, 3).toUpperCase()}`,
    "-".repeat(26),
    ...rows,
    "",
    `Leader: ${determineLeader(first, second)}`,
    `Updated: ${new Date().toISOString()}`
  ].join("\n");
}