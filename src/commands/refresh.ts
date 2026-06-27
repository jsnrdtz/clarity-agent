import {
  refreshAllAgentSnapshots
} from "../services/agent-refresh.js";

import {
  acquireRefreshLock,
  RefreshAlreadyRunningError
} from "../services/refresh-lock.js";

export type RefreshCommandResult = {
  output: string;
  hasFailures: boolean;
};

function formatTextReport(
  report:
    Awaited<
      ReturnType<
        typeof refreshAllAgentSnapshots
      >
    >
): string {
  const resultRows =
    report.results.map(
      (result) => {
        if (
          result.status ===
          "refreshed"
        ) {
          return [
            `OK     ${result.agent.slug}`,
            `       Duration: ${result.durationMs} ms`,
            `       Snapshot: ${result.snapshotSavedAt}`
          ].join("\n");
        }

        return [
          `FAILED ${result.agent.slug}`,
          `       Duration: ${result.durationMs} ms`,
          `       Code: ${result.error.code}`,
          `       Retryable: ${result.error.retryable}`,
          `       Message: ${result.error.message}`
        ].join("\n");
      }
    );

  return [
    "CLARITY SNAPSHOT REFRESH",
    "",
    `Started: ${report.startedAt}`,
    `Completed: ${report.completedAt}`,
    `Duration: ${report.durationMs} ms`,
    "",
    ...resultRows,
    "",
    "SUMMARY",
    `Registered: ${report.totals.registered}`,
    `Refreshed: ${report.totals.refreshed}`,
    `Failed: ${report.totals.failed}`
  ].join("\n");
}

function formatLockFailure(
  error:
    RefreshAlreadyRunningError,

  asJson: boolean
): string {
  const failure = {
    schemaVersion: "1.0",

    status: "failed",

    error: {
      code:
        error.code,

      message:
        error.message,

      retryable:
        error.retryable
    }
  };

  if (asJson) {
    return JSON.stringify(
      failure,
      null,
      2
    );
  }

  return [
    "CLARITY SNAPSHOT REFRESH",
    "",
    "FAILED",
    `Code: ${failure.error.code}`,
    `Retryable: ${failure.error.retryable}`,
    `Message: ${failure.error.message}`
  ].join("\n");
}

export async function runRefreshCommand(
  asJson = false
): Promise<RefreshCommandResult> {
  let lock:
    Awaited<
      ReturnType<
        typeof acquireRefreshLock
      >
    >;

  try {
    lock =
      await acquireRefreshLock();
  } catch (error) {
    if (
      error instanceof
        RefreshAlreadyRunningError
    ) {
      return {
        output:
          formatLockFailure(
            error,
            asJson
          ),

        hasFailures:
          true
      };
    }

    throw error;
  }

  try {
    const report =
      await refreshAllAgentSnapshots();

    return {
      output:
        asJson
          ? JSON.stringify(
              report,
              null,
              2
            )
          : formatTextReport(
              report
            ),

      hasFailures:
        report.totals.failed > 0
    };
  } finally {
    await lock.release();
  }
}
