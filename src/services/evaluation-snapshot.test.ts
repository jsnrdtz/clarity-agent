import assert from "node:assert/strict";
import test from "node:test";

import {
  ClarityError
} from "../errors/clarity-error.js";

import type {
  AgentEvaluation
} from "./agent-evaluation.js";

import {
  getAgentEvaluation,
  resolveAgentEvaluation,
  resolveRecentAgentEvaluation,
  type AgentEvaluationSnapshot
} from "./evaluation-snapshot.js";

function createEvaluation(
  slug = "aeon"
): AgentEvaluation {
  return {
    schemaVersion: "1.0",

    agent: {
      slug,
      name: "Test Agent"
    },

    scores: {
      github: {
        overall: 77
      },

      publicEvidence: {
        coverage: 90
      }
    }
  } as unknown as AgentEvaluation;
}

function createSnapshot(
  evaluation:
    AgentEvaluation
): AgentEvaluationSnapshot {
  return {
    schemaVersion: "1.0",

    savedAt:
      "2026-01-01T00:00:00.000Z",

    evaluation
  };
}

function createRetryableGitHubError():
ClarityError {
  return new ClarityError(
    "GITHUB_UNAVAILABLE",
    "GitHub unavailable",
    503,
    {
      retryable: true
    }
  );
}

test(
  "returns live evaluation and saves snapshot",
  async () => {
    const evaluation =
      createEvaluation();

    let savedEvaluation:
      AgentEvaluation | null =
        null;

    const result =
      await resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () =>
              evaluation,

          saveSnapshot:
            async (
              value
            ) => {
              savedEvaluation =
                value;

              return createSnapshot(
                value
              );
            },

          loadSnapshot:
            async () =>
              null
        }
      );

    assert.equal(
      result.delivery.source,
      "live"
    );

    assert.equal(
      result.delivery.stale,
      false
    );

    assert.equal(
      result.delivery.snapshotSavedAt,
      "2026-01-01T00:00:00.000Z"
    );

    assert.strictEqual(
      result.evaluation,
      evaluation
    );

    assert.strictEqual(
      savedEvaluation,
      evaluation
    );
  }
);

test(
  "returns snapshot when retryable live evaluation fails",
  async () => {
    const evaluation =
      createEvaluation();

    const result =
      await resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () => {
              throw createRetryableGitHubError();
            },

          saveSnapshot:
            async (
              value
            ) =>
              createSnapshot(value),

          loadSnapshot:
            async () =>
              createSnapshot(
                evaluation
              )
        }
      );

    assert.equal(
      result.delivery.source,
      "snapshot"
    );

    assert.equal(
      result.delivery.stale,
      true
    );

    assert.equal(
      result.delivery.liveError,
      "GitHub unavailable"
    );

    assert.equal(
      result.delivery.snapshotSavedAt,
      "2026-01-01T00:00:00.000Z"
    );

    assert.strictEqual(
      result.evaluation,
      evaluation
    );
  }
);

test(
  "rethrows live error when no snapshot exists",
  async () => {
    await assert.rejects(
      resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () => {
              throw createRetryableGitHubError();
            },

          saveSnapshot:
            async (
              value
            ) =>
              createSnapshot(value),

          loadSnapshot:
            async () =>
              null
        }
      ),

      /GitHub unavailable/
    );
  }
);

test(
  "does not use snapshot for non-retryable live errors",
  async () => {
    const liveError =
      new Error(
        "Application bug"
      );

    let snapshotLoaded =
      false;

    await assert.rejects(
      resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () => {
              throw liveError;
            },

          saveSnapshot:
            async (
              value
            ) =>
              createSnapshot(value),

          loadSnapshot:
            async () => {
              snapshotLoaded =
                true;

              return createSnapshot(
                createEvaluation()
              );
            }
        }
      ),

      /Application bug/
    );

    assert.equal(
      snapshotLoaded,
      false
    );
  }
);

test(
  "does not fail live evaluation when snapshot write fails",
  async () => {
    const evaluation =
      createEvaluation();

    const result =
      await resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () =>
              evaluation,

          saveSnapshot:
            async () => {
              throw new Error(
                "Disk unavailable"
              );
            },

          loadSnapshot:
            async () =>
              null
        }
      );

    assert.equal(
      result.delivery.source,
      "live"
    );

    assert.equal(
      result.delivery.snapshotSavedAt,
      null
    );

    assert.strictEqual(
      result.evaluation,
      evaluation
    );
  }
);

test(
  "uses a recent snapshot without building a live evaluation",
  async () => {
    const snapshotEvaluation =
      createEvaluation(
        "snapshot-agent"
      );

    let liveEvaluationCalls =
      0;

    const evaluation =
      await getAgentEvaluation(
        "snapshot-agent",
        {
          loadSnapshot:
            async () => ({
              schemaVersion: "1.0",

              savedAt:
                "2026-06-27T04:00:00.000Z",

              evaluation:
                snapshotEvaluation
            }),

          resolveLiveEvaluation:
            async () => {
              liveEvaluationCalls +=
                1;

              return {
                evaluation:
                  createEvaluation(
                    "live-agent"
                  ),

                delivery: {
                  source: "live",
                  stale: false,
                  snapshotSavedAt: null,
                  liveError: null
                }
              };
            },

          now:
            () =>
              new Date(
                "2026-06-27T06:00:00.000Z"
              ).getTime(),

          maxAgeMs:
            6 * 60 * 60 * 1000
        }
      );

    assert.strictEqual(
      evaluation,
      snapshotEvaluation
    );

    assert.equal(
      liveEvaluationCalls,
      0
    );
  }
);

test(
  "refreshes an expired ranking snapshot",
  async () => {
    const liveEvaluation =
      createEvaluation(
        "live-agent"
      );

    let liveEvaluationCalls =
      0;

    const evaluation =
      await getAgentEvaluation(
        "aeon",
        {
          loadSnapshot:
            async () => ({
              schemaVersion: "1.0",

              savedAt:
                "2026-06-27T00:00:00.000Z",

              evaluation:
                createEvaluation(
                  "snapshot-agent"
                )
            }),

          resolveLiveEvaluation:
            async () => {
              liveEvaluationCalls +=
                1;

              return {
                evaluation:
                  liveEvaluation,

                delivery: {
                  source: "live",
                  stale: false,
                  snapshotSavedAt: null,
                  liveError: null
                }
              };
            },

          now:
            () =>
              new Date(
                "2026-06-27T07:00:00.000Z"
              ).getTime(),

          maxAgeMs:
            6 * 60 * 60 * 1000
        }
      );

    assert.strictEqual(
      evaluation,
      liveEvaluation
    );

    assert.equal(
      liveEvaluationCalls,
      1
    );
  }
);


test(
  "returns a recent snapshot without starting a live evaluation",
  async () => {
    const snapshotEvaluation =
      createEvaluation(
        "snapshot-agent"
      );

    let liveEvaluationCalls =
      0;

    const result =
      await resolveRecentAgentEvaluation(
        "aeon",
        {
          loadSnapshot:
            async () => ({
              schemaVersion:
                "1.0",

              savedAt:
                "2026-06-27T05:30:00.000Z",

              evaluation:
                snapshotEvaluation
            }),

          resolveLiveEvaluation:
            async () => {
              liveEvaluationCalls +=
                1;

              return {
                evaluation:
                  createEvaluation(
                    "live-agent"
                  ),

                delivery: {
                  source:
                    "live",

                  stale:
                    false,

                  snapshotSavedAt:
                    null,

                  liveError:
                    null
                }
              };
            },

          now:
            () =>
              new Date(
                "2026-06-27T06:00:00.000Z"
              ).getTime(),

          maxAgeMs:
            6 * 60 * 60 * 1000
        }
      );

    assert.strictEqual(
      result.evaluation,
      snapshotEvaluation
    );

    assert.equal(
      result.delivery.source,
      "snapshot"
    );

    assert.equal(
      result.delivery.stale,
      false
    );

    assert.equal(
      result.delivery.snapshotSavedAt,
      "2026-06-27T05:30:00.000Z"
    );

    assert.equal(
      liveEvaluationCalls,
      0
    );
  }
);

test(
  "falls back to a snapshot when live evaluation times out",
  async () => {
    const snapshotEvaluation =
      createEvaluation(
        "snapshot-agent"
      );

    const result =
      await resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () =>
              new Promise<AgentEvaluation>(
                () => undefined
              ),

          saveSnapshot:
            async (
              evaluation
            ) =>
              createSnapshot(
                evaluation
              ),

          loadSnapshot:
            async () =>
              createSnapshot(
                snapshotEvaluation
              ),

          liveTimeoutMs:
            5
        }
      );

    assert.strictEqual(
      result.evaluation,
      snapshotEvaluation
    );

    assert.equal(
      result.delivery.source,
      "snapshot"
    );

    assert.equal(
      result.delivery.stale,
      true
    );

    assert.match(
      result.delivery.liveError ?? "",
      /timed out after 5 ms/
    );
  }
);
