import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentEvaluation
} from "./agent-evaluation.js";

import {
  buildAgentComparison,
  buildAgentRanking
} from "./agent-ranking.js";

function createEvaluation(
  slug: string,
  score: number
): AgentEvaluation {
  return {
    schemaVersion: "1.0",

    agent: {
      slug,
      name:
        slug.toUpperCase()
    },

    scores: {
      github: {
        overall: score
      },

      publicEvidence: {
        coverage: 80,
        confidence: "high",
        detectedVisibility:
          "public-heavy",
        limitations: []
      }
    },

    eligibility: {
      ranking: {
        eligible: true,
        reason:
          "Evidence is sufficient."
      },

      comparison: {
        eligible: true,
        reason:
          "Evidence is sufficient."
      }
    },

    summary: {
      coreRepositories: 1,
      ecosystemRepositories: 0,
      reviewRepositories: 0
    },

    sourceCollectedAt:
      "2026-06-27T01:00:00.000Z",

    collectedAt:
      "2026-06-27T01:01:00.000Z"
  } as unknown as AgentEvaluation;
}

test(
  "ranking exposes source and evaluation collection times",
  async () => {
    const response =
      await buildAgentRanking(
        {
          listAgentSlugs:
            () => [
              "alpha"
            ],

          evaluateAgent:
            async () =>
              createEvaluation(
                "alpha",
                80
              )
        }
      );

    assert.equal(
      response.ranked[0]
        ?.sourceCollectedAt,
      "2026-06-27T01:00:00.000Z"
    );

    assert.equal(
      response.ranked[0]
        ?.evaluationCollectedAt,
      "2026-06-27T01:01:00.000Z"
    );
  }
);

test(
  "comparison exposes collection times for both agents",
  async () => {
    const response =
      await buildAgentComparison(
        "alpha",
        "beta",
        {
          listAgentSlugs:
            () => [
              "alpha",
              "beta"
            ],

          evaluateAgent:
            async (
              slug
            ) =>
              createEvaluation(
                slug,
                slug === "alpha"
                  ? 80
                  : 70
              )
        }
      );

    assert.equal(
      response.agents.left
        .sourceCollectedAt,
      "2026-06-27T01:00:00.000Z"
    );

    assert.equal(
      response.agents.right
        .evaluationCollectedAt,
      "2026-06-27T01:01:00.000Z"
    );
  }
);
