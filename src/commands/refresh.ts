import {
  refreshAllAgentSnapshots
} from "../services/agent-refresh.js";

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

export async function runRefreshCommand(
  asJson = false
): Promise<RefreshCommandResult> {
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
}
