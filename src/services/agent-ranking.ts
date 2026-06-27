import {
  listRegisteredAgents
} from "../data/agent-registry.js";

import {
  buildAgentEvaluation,
  type AgentEvaluation
} from "./agent-evaluation.js";

export type EvaluationSummary = {
  agent: {
    slug: string;
    name: string;
  };

  githubScore: number;
  evidenceCoverage: number;

  confidence:
    AgentEvaluation["scores"]["publicEvidence"]["confidence"];

  detectedVisibility:
    AgentEvaluation["scores"]["publicEvidence"]["detectedVisibility"];

  rankingEligible: boolean;
  comparisonEligible: boolean;

  coreRepositories: number;
  ecosystemRepositories: number;
  reviewRepositories: number;

  limitations: string[];
  evaluationUrl: string;
};

export type RankingEntry =
  EvaluationSummary & {
    rank: number;
  };

export type UnrankedEntry =
  EvaluationSummary & {
    reason: string;
  };

export type RankingResponse = {
  schemaVersion: "1.0";

  methodology: {
    score: string;
    eligibility: string;
  };

  ranked: RankingEntry[];
  unranked: UnrankedEntry[];

  totals: {
    registered: number;
    ranked: number;
    unranked: number;
  };

  generatedAt: string;
};

export type ComparisonOutcome =
  | "left"
  | "right"
  | "tie"
  | "undetermined";

export type ComparisonResponse = {
  schemaVersion: "1.0";

  status:
    | "comparable"
    | "limited";

  outcome:
    ComparisonOutcome;

  agents: {
    left: EvaluationSummary;
    right: EvaluationSummary;
  };

  leader: {
    slug: string;
    name: string;
  } | null;

  differences: {
    githubScore: number;
    evidenceCoverage: number;
  };

  reason: string;
  generatedAt: string;
};

function createEvaluationSummary(
  evaluation: AgentEvaluation
): EvaluationSummary {
  return {
    agent: {
      slug:
        evaluation.agent.slug,

      name:
        evaluation.agent.name
    },

    githubScore:
      evaluation.scores.github.overall,

    evidenceCoverage:
      evaluation.scores
        .publicEvidence.coverage,

    confidence:
      evaluation.scores
        .publicEvidence.confidence,

    detectedVisibility:
      evaluation.scores
        .publicEvidence.detectedVisibility,

    rankingEligible:
      evaluation.eligibility
        .ranking.eligible,

    comparisonEligible:
      evaluation.eligibility
        .comparison.eligible,

    coreRepositories:
      evaluation.summary
        .coreRepositories,

    ecosystemRepositories:
      evaluation.summary
        .ecosystemRepositories,

    reviewRepositories:
      evaluation.summary
        .reviewRepositories,

    limitations:
      evaluation.scores
        .publicEvidence.limitations,

    evaluationUrl:
      `/api/v1/evaluate/${evaluation.agent.slug}`
  };
}

export async function buildAgentRanking():
Promise<RankingResponse> {
  const registeredAgents =
    listRegisteredAgents();

  const evaluations =
    await Promise.all(
      registeredAgents.map(
        (agent) =>
          buildAgentEvaluation(
            agent.slug
          )
      )
    );

  const eligibleEvaluations =
    evaluations
      .filter(
        (evaluation) =>
          evaluation.eligibility
            .ranking.eligible
      )
      .sort(
        (left, right) => {
          const scoreDifference =
            right.scores.github.overall -
            left.scores.github.overall;

          if (scoreDifference !== 0) {
            return scoreDifference;
          }

          return (
            right.scores.publicEvidence
              .coverage -
            left.scores.publicEvidence
              .coverage
          );
        }
      );

  const ineligibleEvaluations =
    evaluations
      .filter(
        (evaluation) =>
          !evaluation.eligibility
            .ranking.eligible
      )
      .sort(
        (left, right) =>
          right.scores.github.overall -
          left.scores.github.overall
      );

  const ranked =
    eligibleEvaluations.map(
      (evaluation, index) => ({
        ...createEvaluationSummary(
          evaluation
        ),

        rank:
          index + 1
      })
    );

  const unranked =
    ineligibleEvaluations.map(
      (evaluation) => ({
        ...createEvaluationSummary(
          evaluation
        ),

        reason:
          evaluation.eligibility
            .ranking.reason
      })
    );

  return {
    schemaVersion: "1.0",

    methodology: {
      score:
        "Observed public GitHub development score.",

      eligibility:
        "Only agents with medium or high automatic public evidence confidence are ranked."
    },

    ranked,
    unranked,

    totals: {
      registered:
        evaluations.length,

      ranked:
        ranked.length,

      unranked:
        unranked.length
    },

    generatedAt:
      new Date().toISOString()
  };
}

export async function buildAgentComparison(
  leftSlug: string,
  rightSlug: string
): Promise<ComparisonResponse> {
  if (
    leftSlug.toLowerCase() ===
    rightSlug.toLowerCase()
  ) {
    throw new Error(
      "Comparison requires two different agents."
    );
  }

  const [
    leftEvaluation,
    rightEvaluation
  ] = await Promise.all([
    buildAgentEvaluation(leftSlug),
    buildAgentEvaluation(rightSlug)
  ]);

  const left =
    createEvaluationSummary(
      leftEvaluation
    );

  const right =
    createEvaluationSummary(
      rightEvaluation
    );

  const scoreDifference =
    Math.abs(
      left.githubScore -
      right.githubScore
    );

  const evidenceCoverageDifference =
    Math.abs(
      left.evidenceCoverage -
      right.evidenceCoverage
    );

  const comparable =
    left.comparisonEligible &&
    right.comparisonEligible;

  if (!comparable) {
    const insufficientAgents =
      [left, right]
        .filter(
          (agent) =>
            !agent.comparisonEligible
        )
        .map(
          (agent) =>
            agent.agent.name
        )
        .join(", ");

    return {
      schemaVersion: "1.0",

      status: "limited",
      outcome: "undetermined",

      agents: {
        left,
        right
      },

      leader: null,

      differences: {
        githubScore:
          scoreDifference,

        evidenceCoverage:
          evidenceCoverageDifference
      },

      reason:
        `A reliable leader cannot be determined because public evidence is insufficient for: ${insufficientAgents}.`,

      generatedAt:
        new Date().toISOString()
    };
  }

  if (
    left.githubScore ===
    right.githubScore
  ) {
    return {
      schemaVersion: "1.0",

      status: "comparable",
      outcome: "tie",

      agents: {
        left,
        right
      },

      leader: null,

      differences: {
        githubScore: 0,

        evidenceCoverage:
          evidenceCoverageDifference
      },

      reason:
        "Both agents have the same observed public GitHub score.",

      generatedAt:
        new Date().toISOString()
    };
  }

  const leftLeads =
    left.githubScore >
    right.githubScore;

  const leader =
    leftLeads
      ? left.agent
      : right.agent;

  return {
    schemaVersion: "1.0",

    status: "comparable",

    outcome:
      leftLeads
        ? "left"
        : "right",

    agents: {
      left,
      right
    },

    leader,

    differences: {
      githubScore:
        scoreDifference,

      evidenceCoverage:
        evidenceCoverageDifference
    },

    reason:
      `${leader.name} has the higher observed public GitHub score.`,

    generatedAt:
      new Date().toISOString()
  };
}
