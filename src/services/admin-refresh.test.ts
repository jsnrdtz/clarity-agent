import assert from "node:assert/strict";
import test from "node:test";

import {
  ClarityError
} from "../errors/clarity-error.js";

import type {
  AgentRefreshReport
} from "./agent-refresh.js";

import {
  authenticateAdminRefresh,
  runAdminRefresh
} from "./admin-refresh.js";

import {
  RefreshAlreadyRunningError
} from "./refresh-lock.js";

const VALID_TOKEN =
  "0123456789abcdef0123456789abcdef";

function createReport():
AgentRefreshReport {
  return {
    schemaVersion: "1.0",

    startedAt:
      "2026-06-28T00:00:00.000Z",

    completedAt:
      "2026-06-28T00:00:01.000Z",

    durationMs:
      1000,

    totals: {
      registered: 4,
      refreshed: 4,
      failed: 0
    },

    results: []
  };
}

test(
  "rejects refresh when no token is configured",
  () => {
    assert.throws(
      () => {
        authenticateAdminRefresh(
          undefined,
          ""
        );
      },

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "REFRESH_NOT_CONFIGURED"
        );

        assert.equal(
          error.statusCode,
          503
        );

        return true;
      }
    );
  }
);

test(
  "rejects refresh when configured token is too short",
  () => {
    assert.throws(
      () => {
        authenticateAdminRefresh(
          "Bearer short",
          "short"
        );
      },

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "REFRESH_NOT_CONFIGURED"
        );

        return true;
      }
    );
  }
);

test(
  "rejects refresh without Bearer authentication",
  () => {
    assert.throws(
      () => {
        authenticateAdminRefresh(
          undefined,
          VALID_TOKEN
        );
      },

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "REFRESH_AUTHENTICATION_FAILED"
        );

        assert.equal(
          error.statusCode,
          401
        );

        return true;
      }
    );
  }
);

test(
  "rejects refresh with an invalid token",
  () => {
    assert.throws(
      () => {
        authenticateAdminRefresh(
          "Bearer invalid-token",
          VALID_TOKEN
        );
      },

      (
        error: unknown
      ): boolean => {
        assert.ok(
          error instanceof
            ClarityError
        );

        assert.equal(
          error.code,
          "REFRESH_AUTHENTICATION_FAILED"
        );

        return true;
      }
    );
  }
);

test(
  "accepts a valid Bearer token",
  () => {
    assert.doesNotThrow(
      () => {
        authenticateAdminRefresh(
          `Bearer ${VALID_TOKEN}`,
          VALID_TOKEN
        );
      }
    );
  }
);

test(
  "runs refresh while holding the lock",
  async () => {
    const events: string[] = [];

    const report =
      createReport();

    const result =
      await runAdminRefresh(
        {
          acquireLock:
            async () => {
              events.push(
                "acquired"
              );

              return {
                path:
                  "data/refresh.lock",

                release:
                  async () => {
                    events.push(
                      "released"
                    );
                  }
              };
            },

          refreshSnapshots:
            async () => {
              events.push(
                "refreshed"
              );

              return report;
            }
        }
      );

    assert.equal(
      result,
      report
    );

    assert.deepEqual(
      events,
      [
        "acquired",
        "refreshed",
        "released"
      ]
    );
  }
);

test(
  "releases the lock when refresh fails",
  async () => {
    let released =
      false;

    await assert.rejects(
      runAdminRefresh(
        {
          acquireLock:
            async () => ({
              path:
                "data/refresh.lock",

              release:
                async () => {
                  released =
                    true;
                }
            }),

          refreshSnapshots:
            async () => {
              throw new Error(
                "Refresh failed."
              );
            }
        }
      ),

      /Refresh failed/
    );

    assert.equal(
      released,
      true
    );
  }
);

test(
  "maps an overlapping refresh to a typed conflict",
  async () => {
    await assert.rejects(
      runAdminRefresh(
        {
          acquireLock:
            async () => {
              throw new RefreshAlreadyRunningError(
                "data/refresh.lock"
              );
            }
        }
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
          "REFRESH_ALREADY_RUNNING"
        );

        assert.equal(
          error.statusCode,
          409
        );

        assert.equal(
          error.retryable,
          true
        );

        assert.doesNotMatch(
          error.message,
          /data\/refresh\.lock/
        );

        return true;
      }
    );
  }
);
