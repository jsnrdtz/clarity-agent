import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentEvaluation
} from "./agent-evaluation.js";

import {
  buildAgentComparison,
  buildAgentRanking,
  type AgentRankingDependencies
} from "./agent-ranking.js";

type Confidence =
  AgentEvaluation["scores"]["publicEvidence"]["confidence"];

type FixtureInput = {
  slug: string;
  score: number;
  evidenceCoverage: number;
  confidence?: Confidence;
};

function createEvaluation(
  input: FixtureInput
): AgentEvaluation {
  const confidence =
    input.confidence ??
    (
      input.evidenceCoverage >= 75
        ? "high"
        : input.evidenceCoverage >= 45
          ? "medium"
          : "low"
    );

  const eligible =
    confidence !== "low";

  const detectedVisibility =
    confidence === "high"
      ? "public-heavy"
      : confidence === "medium"
        ? "partial"
        : "unknown";

  const name =
    input.slug
      .charAt(0)
      .toUpperCase() +
    input.slug.slice(1);

  return {
    schemaVersion: "1.0",

    agent: {
      slug:
        input.slug,

      name
    },

    github: {
      owner:
        `${input.slug}-owner`,

      anchorRepository:
        input.slug,

      anchorFullName:
        `${input.slug}-owner/${input.slug}`,

      anchorUrl:
        `https://github.com/${input.slug}-owner/${input.slug}`,

      anchorScope:
        "primary",

      dedicatedBrandAccount:
        true
    },

    scores: {
      github: {
        overall:
          input.score,

        activity:
          input.score,

        collaboration:
          input.score,

        adoption:
          input.score,

        releases:
          input.score,

        dataCoverage:
          100
      },

      publicEvidence: {
        coverage:
          input.evidenceCoverage,

        confidence,

        detectedVisibility,

        interpretation:
          eligible
            ? "Public evidence is sufficient."
            : "Public evidence is insufficient.",

        signals: [],

        limitations:
          eligible
            ? []
            : [
                "Public evidence is limited."
              ]
      }
    },

    repositories: {
      core: [],
      ecosystem: [],
      review: []
    },

    summary: {
      coreRepositories: 1,
      ecosystemRepositories: 0,
      reviewRepositories: 0,
      unrelatedRepositoriesHidden: 0,
      excludedRepositories: 0,
      rawCommitsLast30Days: 0,
      adjustedActivity: 0,
      uniqueContributors: 1
    },

    eligibility: {
      ranking: {
        eligible,

        reason:
          eligible
            ? "Evidence confidence is sufficient."
            : "Evidence confidence is insufficient."
      },

      comparison: {
        eligible,

        reason:
          eligible
            ? "Evidence confidence is sufficient."
            : "Evidence confidence is insufficient."
      }
    },

    context: {
      privacySensitive: false,
      registryVisibilityLabel: detectedVisibility,
      registryNote: "Test fixture.",
      affectsAutomaticCoverageScore: false
    },

    sourceCollectedAt:
      "2026-01-01T00:00:00.000Z",

    collectedAt:
      "2026-01-01T00:00:00.000Z"
  };
}

function createDependencies(
  evaluations: AgentEvaluation[]
): AgentRankingDependencies {
  const evaluationsBySlug =
    new Map(
      evaluations.map(
        (evaluation) => [
          evaluation.agent.slug,
          evaluation
        ]
      )
    );

  return {
    listAgentSlugs: () =>
      evaluations.map(
        (evaluation) =>
          evaluation.agent.slug
      ),

    evaluateAgent:
      async (
        agentSlug: string
      ): Promise<AgentEvaluation> => {
        const evaluation =
          evaluationsBySlug.get(
            agentSlug.toLowerCase()
          );

        if (!evaluation) {
          throw new Error(
            `Agent "${agentSlug}" is not registered.`
          );
        }

        return evaluation;
      }
  };
}

test(
  "excludes low-confidence agents from ranking",
  async () => {
    const strong =
      createEvaluation({
        slug: "strong",
        score: 70,
        evidenceCoverage: 90
      });

    const hidden =
      createEvaluation({
        slug: "hidden",
        score: 99,
        evidenceCoverage: 30
      });

    const ranking =
      await buildAgentRanking(
        createDependencies([
          strong,
          hidden
        ])
      );

    assert.deepEqual(
      ranking.ranked.map(
        (entry) =>
          entry.agent.slug
      ),
      ["strong"]
    );

    assert.deepEqual(
      ranking.unranked.map(
        (entry) =>
          entry.agent.slug
      ),
      ["hidden"]
    );

    assert.deepEqual(
      ranking.totals,
      {
        registered: 2,
        ranked: 1,
        unranked: 1
      }
    );
  }
);

test(
  "sorts eligible agents by GitHub score",
  async () => {
    const lower =
      createEvaluation({
        slug: "lower",
        score: 55,
        evidenceCoverage: 90
      });

    const higher =
      createEvaluation({
        slug: "higher",
        score: 85,
        evidenceCoverage: 80
      });

    const ranking =
      await buildAgentRanking(
        createDependencies([
          lower,
          higher
        ])
      );

    assert.deepEqual(
      ranking.ranked.map(
        (entry) => ({
          rank:
            entry.rank,

          slug:
            entry.agent.slug
        })
      ),
      [
        {
          rank: 1,
          slug: "higher"
        },
        {
          rank: 2,
          slug: "lower"
        }
      ]
    );
  }
);

test(
  "uses evidence coverage to break equal scores",
  async () => {
    const lowerEvidence =
      createEvaluation({
        slug: "lower-evidence",
        score: 80,
        evidenceCoverage: 60
      });

    const higherEvidence =
      createEvaluation({
        slug: "higher-evidence",
        score: 80,
        evidenceCoverage: 95
      });

    const ranking =
      await buildAgentRanking(
        createDependencies([
          lowerEvidence,
          higherEvidence
        ])
      );

    assert.deepEqual(
      ranking.ranked.map(
        (entry) =>
          entry.agent.slug
      ),
      [
        "higher-evidence",
        "lower-evidence"
      ]
    );
  }
);

test(
  "returns undetermined when one agent has low evidence",
  async () => {
    const visible =
      createEvaluation({
        slug: "visible",
        score: 80,
        evidenceCoverage: 90
      });

    const privateAgent =
      createEvaluation({
        slug: "private",
        score: 20,
        evidenceCoverage: 30
      });

    const comparison =
      await buildAgentComparison(
        "visible",
        "private",
        createDependencies([
          visible,
          privateAgent
        ])
      );

    assert.equal(
      comparison.status,
      "limited"
    );

    assert.equal(
      comparison.outcome,
      "undetermined"
    );

    assert.equal(
      comparison.leader,
      null
    );

    assert.match(
      comparison.reason,
      /Private/
    );
  }
);

test(
  "selects the higher-scoring comparable agent",
  async () => {
    const left =
      createEvaluation({
        slug: "left",
        score: 88,
        evidenceCoverage: 90
      });

    const right =
      createEvaluation({
        slug: "right",
        score: 64,
        evidenceCoverage: 85
      });

    const comparison =
      await buildAgentComparison(
        "left",
        "right",
        createDependencies([
          left,
          right
        ])
      );

    assert.equal(
      comparison.status,
      "comparable"
    );

    assert.equal(
      comparison.outcome,
      "left"
    );

    assert.deepEqual(
      comparison.leader,
      {
        slug: "left",
        name: "Left"
      }
    );

    assert.equal(
      comparison.differences.githubScore,
      24
    );
  }
);

test(
  "returns tie when comparable scores are equal",
  async () => {
    const left =
      createEvaluation({
        slug: "left",
        score: 75,
        evidenceCoverage: 95
      });

    const right =
      createEvaluation({
        slug: "right",
        score: 75,
        evidenceCoverage: 80
      });

    const comparison =
      await buildAgentComparison(
        "left",
        "right",
        createDependencies([
          left,
          right
        ])
      );

    assert.equal(
      comparison.status,
      "comparable"
    );

    assert.equal(
      comparison.outcome,
      "tie"
    );

    assert.equal(
      comparison.leader,
      null
    );

    assert.equal(
      comparison.differences.githubScore,
      0
    );

    assert.equal(
      comparison.differences.evidenceCoverage,
      15
    );
  }
);
