import assert from "node:assert/strict";

import test from "node:test";

import {
  runTokenIntelligenceCommand
} from "./token-intelligence.js";

import type {
  runTokenIntelligence
} from "../services/token-intelligence.js";

function createRunResult(
  scoresAvailable: number
): Awaited<
  ReturnType<
    typeof runTokenIntelligence
  >
> {
  return {
    outputPath:
      "data/token-intelligence/bankr-tokens.json",

    report: {
      schemaVersion:
        "1.0",

      source:
        "bankr",

      generatedAt:
        "2026-06-30T00:00:00.000Z",

      summary: {
        total:
          1,

        complete:
          0,

        partial:
          scoresAvailable > 0
            ? 1
            : 0,

        unavailable:
          scoresAvailable > 0
            ? 0
            : 1,

        dexAvailable:
          scoresAvailable > 0
            ? 1
            : 0,

        securityAvailable:
          scoresAvailable > 0
            ? 1
            : 0,

        holdersAvailable:
          0,

        scoresAvailable,

        providerFailures:
          scoresAvailable > 0
            ? 0
            : 2
      },

      tokens:
        []
    }
  };
}

test(
  "prints a JSON token intelligence report",
  async () => {
    const result =
      await runTokenIntelligenceCommand(
        true,
        {
          runIntelligence:
            async () =>
              createRunResult(
                1
              )
        }
      );

    const parsed =
      JSON.parse(
        result.output
      );

    assert.equal(
      parsed.schemaVersion,
      "1.0"
    );

    assert.equal(
      parsed.summary
        .scoresAvailable,
      1
    );

    assert.equal(
      result.hasFailures,
      false
    );
  }
);

test(
  "marks the command failed when no token scores are available",
  async () => {
    const result =
      await runTokenIntelligenceCommand(
        false,
        {
          runIntelligence:
            async () =>
              createRunResult(
                0
              )
        }
      );

    assert.match(
      result.output,
      /Scores available: 0/u
    );

    assert.equal(
      result.hasFailures,
      true
    );
  }
);
