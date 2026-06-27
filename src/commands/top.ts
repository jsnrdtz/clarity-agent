import {
  getAgentEvidenceProfile
} from "../data/agent-evidence.js";

import {
  listRegisteredAgents,
  type RegisteredAgent
} from "../data/agent-registry.js";

import {
  assessAutomaticPublicEvidence
} from "../services/automatic-public-evidence.js";

import {
  type PublicEvidenceAssessment
} from "../services/public-evidence.js";

import {
  calculateProjectScore,
  type ProjectScoreResult
} from "../services/project-score.js";

type EvaluatedAgent = {
  agent: RegisteredAgent;
  result: ProjectScoreResult;
  evidence: PublicEvidenceAssessment;
};

type FailedAgent = {
  agent: RegisteredAgent;
  reason: string;
};

async function evaluateAgent(
  agent: RegisteredAgent
): Promise<EvaluatedAgent> {
  const result =
    await calculateProjectScore(
      agent.name,
      agent.github.owner,
      agent.github.repository
    );

  const profile =
    getAgentEvidenceProfile(
      agent.slug
    );

  const evidence =
    assessAutomaticPublicEvidence(
      agent,
      profile,
      result
    );

  return {
    agent,
    result,
    evidence
  };
}

function formatRankedAgent(
  item: EvaluatedAgent,
  index: number
): string {
  const {
    agent,
    result,
    evidence
  } = item;

  return [
    `#${index + 1}  ${agent.name}  ${result.score.overall}/100`,
    `     Activity: ${result.score.activity}/100`,
    `     Collaboration: ${result.score.collaboration}/100`,
    `     Adoption: ${result.score.adoption}/100`,
    `     Releases: ${result.score.releases}/100`,
    `     Evidence coverage: ${evidence.coverage}/100`,
    `     Rating confidence: ${evidence.confidence}`,
    `     Core repositories: ${result.metrics.repositories.length}`,
    `     Ecosystem repositories: ${result.ecosystem.length}`,
    `     Unique contributors: ${result.metrics.uniqueContributors}`,
    `     Anchor: ${result.discovery.anchor.fullName}`
  ].join("\n");
}

function formatLimitedEvidenceAgent(
  item: EvaluatedAgent,
  index: number
): string {
  const {
    agent,
    result,
    evidence
  } = item;

  return [
    `${index + 1}. ${agent.name}`,
    `   Observed public GitHub score: ${result.score.overall}/100`,
    `   Public evidence coverage: ${evidence.coverage}/100`,
    `   Rating confidence: ${evidence.confidence}`,
    "   Ranking status: not ranked",
    `   Reason: ${evidence.interpretation}`,
    `   Anchor: ${result.discovery.anchor.fullName}`
  ].join("\n");
}

export async function getTopAgents():
  Promise<string> {
  const agents =
    listRegisteredAgents();

  if (agents.length === 0) {
    return "No agents are registered.";
  }

  const settled =
    await Promise.allSettled(
      agents.map(
        (agent) =>
          evaluateAgent(agent)
      )
    );

  const evaluated:
    EvaluatedAgent[] = [];

  const failed:
    FailedAgent[] = [];

  settled.forEach(
    (result, index) => {
      const agent =
        agents[index];

      if (!agent) {
        return;
      }

      if (
        result.status === "fulfilled"
      ) {
        evaluated.push(
          result.value
        );

        return;
      }

      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown error";

      failed.push({
        agent,
        reason
      });
    }
  );

  const ranked =
    evaluated
      .filter(
        (item) =>
          item.evidence.confidence !==
          "low"
      )
      .sort(
        (first, second) =>
          second.result.score.overall -
          first.result.score.overall
      );

  const limitedEvidence =
    evaluated
      .filter(
        (item) =>
          item.evidence.confidence ===
          "low"
      )
      .sort(
        (first, second) =>
          second.evidence.coverage -
          first.evidence.coverage
      );

  const rankingRows =
    ranked.length > 0
      ? ranked
          .map(formatRankedAgent)
          .join("\n\n")
      : (
          "No projects currently have enough public evidence for ranking."
        );

  const limitedRows =
    limitedEvidence.length > 0
      ? limitedEvidence
          .map(
            formatLimitedEvidenceAgent
          )
          .join("\n\n")
      : (
          "No projects have insufficient public evidence."
        );

  const failedRows =
    failed.map(
      ({ agent, reason }) =>
        `- ${agent.name}: ${reason}`
    );

  return [
    "CLARITY AGENT RANKING",
    "Public GitHub evidence only — not a complete quality ranking",
    "",
    "RANKED PROJECTS",
    "Only projects with medium or high automatic evidence confidence receive a ranking position.",
    "",
    rankingRows,
    "",
    "INSUFFICIENT PUBLIC EVIDENCE",
    "Observed scores are displayed, but these projects are not ranked.",
    "",
    limitedRows,
    "",
    `Agents evaluated: ${evaluated.length}`,
    `Agents ranked: ${ranked.length}`,
    `Agents not ranked: ${limitedEvidence.length}`,
    `Agents failed: ${failed.length}`,
    "",
    ...(failedRows.length > 0
      ? [
          "Failed agents:",
          ...failedRows,
          ""
        ]
      : []),
    "Ranking method:",
    "- Project repositories are discovered automatically.",
    "- Only approved core repositories affect the observed GitHub score.",
    "- Evidence coverage is calculated from observable repository structure and activity.",
    "- Manual visibility labels do not affect the automatic coverage score.",
    "- Low-confidence projects are displayed separately instead of receiving a ranking position.",
    "- Low evidence coverage is not treated as low project quality.",
    "",
    `Collected: ${new Date().toISOString()}`
  ].join("\n");
}
