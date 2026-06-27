import {
  getAgentEvidenceProfile
} from "../data/agent-evidence.js";

import {
  findRegisteredAgent,
  type RegisteredAgent
} from "../data/agent-registry.js";

import {
  assessPublicEvidence,
  type PublicEvidenceAssessment
} from "../services/public-evidence.js";

import {
  calculateProjectScore,
  type ProjectScoreResult
} from "../services/project-score.js";

type ComparedAgent = {
  agent: RegisteredAgent;
  result: ProjectScoreResult;
  evidence: PublicEvidenceAssessment;
};

async function analyzeAgent(
  agent: RegisteredAgent
): Promise<ComparedAgent> {
  const profile =
    getAgentEvidenceProfile(
      agent.slug
    );

  const evidence =
    assessPublicEvidence(
      agent,
      profile
    );

  const result =
    await calculateProjectScore(
      agent.name,
      agent.github.owner,
      agent.github.repository
    );

  return {
    agent,
    result,
    evidence
  };
}

function formatNumber(
  value: number,
  width: number
): string {
  return String(value).padStart(width);
}

function formatMetricRow(
  label: string,
  firstValue: number,
  secondValue: number,
  firstWidth: number,
  secondWidth: number
): string {
  return [
    label.padEnd(25),
    formatNumber(
      firstValue,
      firstWidth
    ),
    formatNumber(
      secondValue,
      secondWidth
    )
  ].join("  ");
}

function hasComparableEvidence(
  compared: ComparedAgent
): boolean {
  return (
    compared.evidence.confidence !==
    "low"
  );
}

function determineComparisonStatus(
  first: ComparedAgent,
  second: ComparedAgent
): string {
  if (
    !hasComparableEvidence(first) ||
    !hasComparableEvidence(second)
  ) {
    return (
      "Limited — at least one project has insufficient public evidence."
    );
  }

  return (
    "Comparable — both projects have sufficient public evidence."
  );
}

function determineLeader(
  first: ComparedAgent,
  second: ComparedAgent
): string {
  if (
    !hasComparableEvidence(first) ||
    !hasComparableEvidence(second)
  ) {
    return (
      "Not determined — the available public evidence is not sufficiently comparable."
    );
  }

  const firstScore =
    first.result.score.overall;

  const secondScore =
    second.result.score.overall;

  if (firstScore === secondScore) {
    return "Tie";
  }

  return firstScore > secondScore
    ? first.agent.name
    : second.agent.name;
}

function formatProjectSummary(
  compared: ComparedAgent
): string {
  const {
    agent,
    result,
    evidence
  } = compared;

  return [
    agent.name,
    `  Observed GitHub score: ${result.score.overall}/100`,
    `  Public evidence coverage: ${evidence.coverage}/100`,
    `  Rating confidence: ${evidence.confidence}`,
    `  Visibility profile: ${evidence.visibility}`,
    `  Anchor: ${result.discovery.anchor.fullName}`,
    `  Core repositories: ${result.metrics.repositories.length}`,
    `  Ecosystem repositories: ${result.ecosystem.length}`,
    `  Raw commits: ${result.metrics.rawCommitsLast30Days}`,
    `  Adjusted activity: ${result.metrics.adjustedCommitsLast30Days}`,
    `  Unique contributors: ${result.metrics.uniqueContributors}`,
    `  Interpretation: ${evidence.interpretation}`
  ].join("\n");
}

function formatLimitations(
  compared: ComparedAgent
): string[] {
  if (
    compared.evidence.limitations.length ===
    0
  ) {
    return [
      `- ${compared.agent.name}: no major evidence limitations detected.`
    ];
  }

  return compared.evidence.limitations.map(
    (limitation) =>
      `- ${compared.agent.name}: ${limitation}`
  );
}

export async function compareAgents(
  firstSlug: string,
  secondSlug: string
): Promise<string> {
  const firstAgent =
    findRegisteredAgent(firstSlug);

  const secondAgent =
    findRegisteredAgent(secondSlug);

  if (!firstAgent) {
    throw new Error(
      `Agent "${firstSlug}" is not registered.`
    );
  }

  if (!secondAgent) {
    throw new Error(
      `Agent "${secondSlug}" is not registered.`
    );
  }

  const [
    first,
    second
  ] = await Promise.all([
    analyzeAgent(firstAgent),
    analyzeAgent(secondAgent)
  ]);

  const firstName =
    first.agent.name;

  const secondName =
    second.agent.name;

  const firstWidth =
    Math.max(
      firstName.length,
      5
    );

  const secondWidth =
    Math.max(
      secondName.length,
      5
    );

  const header = [
    "Metric".padEnd(25),
    firstName.padStart(firstWidth),
    secondName.padStart(secondWidth)
  ].join("  ");

  const separator =
    "-".repeat(header.length);

  const rows = [
    formatMetricRow(
      "Observed GitHub Score",
      first.result.score.overall,
      second.result.score.overall,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Public Evidence",
      first.evidence.coverage,
      second.evidence.coverage,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Current Activity",
      first.result.score.activity,
      second.result.score.activity,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Collaboration",
      first.result.score.collaboration,
      second.result.score.collaboration,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Adoption",
      first.result.score.adoption,
      second.result.score.adoption,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Release Discipline",
      first.result.score.releases,
      second.result.score.releases,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Core Repositories",
      first.result.metrics.repositories.length,
      second.result.metrics.repositories.length,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Ecosystem Repositories",
      first.result.ecosystem.length,
      second.result.ecosystem.length,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Unique Contributors",
      first.result.metrics.uniqueContributors,
      second.result.metrics.uniqueContributors,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Raw Commits (30d)",
      first.result.metrics.rawCommitsLast30Days,
      second.result.metrics.rawCommitsLast30Days,
      firstWidth,
      secondWidth
    ),

    formatMetricRow(
      "Adjusted Activity",
      first.result.metrics.adjustedCommitsLast30Days,
      second.result.metrics.adjustedCommitsLast30Days,
      firstWidth,
      secondWidth
    )
  ];

  return [
    "CLARITY AGENT COMPARISON",
    "Observed public GitHub evidence — not a complete project quality comparison",
    "",
    `${firstName} vs ${secondName}`,
    "",
    header,
    separator,
    ...rows,
    "",
    `Comparison status: ${determineComparisonStatus(
      first,
      second
    )}`,
    `Leader: ${determineLeader(
      first,
      second
    )}`,
    "",
    "PROJECT SUMMARIES",
    "",
    formatProjectSummary(first),
    "",
    formatProjectSummary(second),
    "",
    "PUBLIC EVIDENCE LIMITATIONS",
    "",
    ...formatLimitations(first),
    ...formatLimitations(second),
    "",
    "Comparison method:",
    "- Observed GitHub scores describe only publicly visible development evidence.",
    "- Public Evidence Coverage measures how representative that evidence may be.",
    "- A project with low confidence cannot fairly win or lose a direct comparison.",
    "- Low evidence coverage is not treated as low project quality.",
    "- Ecosystem repositories do not directly affect the core GitHub score.",
    "",
    `Collected: ${new Date().toISOString()}`
  ].join("\n");
}
