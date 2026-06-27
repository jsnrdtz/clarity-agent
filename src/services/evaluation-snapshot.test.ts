import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentEvaluation
} from "./agent-evaluation.js";

import {
  resolveAgentEvaluation,
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
  "returns snapshot when live evaluation fails",
  async () => {
    const evaluation =
      createEvaluation();

    const result =
      await resolveAgentEvaluation(
        "aeon",
        {
          buildLiveEvaluation:
            async () => {
              throw new Error(
                "GitHub unavailable"
              );
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
              throw new Error(
                "GitHub unavailable"
              );
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
