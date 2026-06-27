import assert from "node:assert/strict";
import test from "node:test";

import type {
  RegisteredAgent
} from "../data/agent-registry.js";

import {
  ClarityError
} from "../errors/clarity-error.js";

import type {
  AgentEvaluation
} from "./agent-evaluation.js";

import {
  refreshAllAgentSnapshots
} from "./agent-refresh.js";

function createAgent(
  slug: string
): RegisteredAgent {
  return {
    slug,
    name:
      slug.toUpperCase(),

    aliases: [],
    searchAliases: [],

    description:
      "Test agent.",

    github: {
      owner:
        "test-owner",

      repository:
        slug,

      scope:
        "primary"
    }
  };
}

function createEvaluation(
  slug: string
): AgentEvaluation {
  return {
    schemaVersion: "1.0",

    agent: {
      slug,
      name:
        slug.toUpperCase()
    }
  } as unknown as AgentEvaluation;
}

test(
  "refreshes and saves every registered agent sequentially",
  async () => {
    const built: string[] = [];
    const saved: string[] = [];

    const report =
      await refreshAllAgentSnapshots(
        {
          listAgents:
            () => [
              createAgent("alpha"),
              createAgent("beta")
            ],

          buildLiveEvaluation:
            async (
              slug
            ) => {
              built.push(slug);

              return createEvaluation(
                slug
              );
            },

          saveSnapshot:
            async (
              evaluation
            ) => {
              saved.push(
                evaluation.agent.slug
              );

              return {
                schemaVersion: "1.0",

                savedAt:
                  "2026-06-27T00:00:00.000Z",

                evaluation
              };
            },

          now:
            () =>
              1_750_000_000_000
        }
      );

    assert.deepEqual(
      built,
      [
        "alpha",
        "beta"
      ]
    );

    assert.deepEqual(
      saved,
      [
        "alpha",
        "beta"
      ]
    );

    assert.deepEqual(
      report.totals,
      {
        registered: 2,
        refreshed: 2,
        failed: 0
      }
    );
  }
);

test(
  "continues refreshing after one agent fails",
  async () => {
    const attempted: string[] = [];

    const report =
      await refreshAllAgentSnapshots(
        {
          listAgents:
            () => [
              createAgent("alpha"),
              createAgent("beta"),
              createAgent("gamma")
            ],

          buildLiveEvaluation:
            async (
              slug
            ) => {
              attempted.push(slug);

              if (slug === "beta") {
                throw new ClarityError(
                  "GITHUB_UNAVAILABLE",
                  "GitHub unavailable.",
                  503,
                  {
                    retryable: true
                  }
                );
              }

              return createEvaluation(
                slug
              );
            },

          saveSnapshot:
            async (
              evaluation
            ) => ({
              schemaVersion: "1.0",

              savedAt:
                "2026-06-27T00:00:00.000Z",

              evaluation
            }),

          now:
            () =>
              1_750_000_000_000
        }
      );

    assert.deepEqual(
      attempted,
      [
        "alpha",
        "beta",
        "gamma"
      ]
    );

    assert.deepEqual(
      report.totals,
      {
        registered: 3,
        refreshed: 2,
        failed: 1
      }
    );

    const failed =
      report.results.find(
        (result) =>
          result.status ===
          "failed"
      );

    assert.equal(
      failed?.agent.slug,
      "beta"
    );

    if (
      failed?.status ===
      "failed"
    ) {
      assert.equal(
        failed.error.code,
        "GITHUB_UNAVAILABLE"
      );

      assert.equal(
        failed.error.retryable,
        true
      );
    }
  }
);

test(
  "reports snapshot write failures",
  async () => {
    const report =
      await refreshAllAgentSnapshots(
        {
          listAgents:
            () => [
              createAgent("alpha")
            ],

          buildLiveEvaluation:
            async (
              slug
            ) =>
              createEvaluation(
                slug
              ),

          saveSnapshot:
            async () => {
              throw new Error(
                "Disk unavailable"
              );
            },

          now:
            () =>
              1_750_000_000_000
        }
      );

    assert.equal(
      report.totals.refreshed,
      0
    );

    assert.equal(
      report.totals.failed,
      1
    );

    const result =
      report.results[0];

    assert.equal(
      result?.status,
      "failed"
    );

    if (
      result?.status ===
      "failed"
    ) {
      assert.equal(
        result.error.code,
        "INTERNAL_SERVER_ERROR"
      );

      assert.equal(
        result.error.message,
        "Disk unavailable"
      );
    }
  }
);
