import assert from "node:assert/strict";
import test from "node:test";

import {
  ClarityError
} from "../errors/clarity-error.js";

import {
  buildAgentEvaluation
} from "./agent-evaluation.js";

import {
  buildAgentComparison
} from "./agent-ranking.js";

test(
  "throws AGENT_NOT_FOUND for an unknown agent",
  async () => {
    await assert.rejects(
      buildAgentEvaluation(
        "missing-agent"
      ),

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "AGENT_NOT_FOUND"
        );

        assert.equal(
          error.statusCode,
          404
        );

        assert.equal(
          error.retryable,
          false
        );

        return true;
      }
    );
  }
);

test(
  "throws INVALID_COMPARISON for the same agent",
  async () => {
    await assert.rejects(
      buildAgentComparison(
        "aeon",
        "aeon"
      ),

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "INVALID_COMPARISON"
        );

        assert.equal(
          error.statusCode,
          400
        );

        assert.equal(
          error.retryable,
          false
        );

        return true;
      }
    );
  }
);
