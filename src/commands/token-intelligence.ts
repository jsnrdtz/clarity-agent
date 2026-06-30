import {
  runTokenIntelligence
} from "../services/token-intelligence.js";

export type TokenIntelligenceCommandResult = {
  output: string;
  hasFailures: boolean;
};

export type TokenIntelligenceCommandDependencies = {
  runIntelligence?:
    typeof runTokenIntelligence;
};

function formatTextReport(
  result:
    Awaited<
      ReturnType<
        typeof runTokenIntelligence
      >
    >
): string {
  const {
    report,
    outputPath
  } = result;

  return [
    "CLARITY TOKEN INTELLIGENCE",
    "",
    `Generated: ${report.generatedAt}`,
    `Tokens: ${report.summary.total}`,
    "",
    "PROVIDER COVERAGE",
    `DEX available: ${report.summary.dexAvailable}`,
    `Security available: ${report.summary.securityAvailable}`,
    `Holders available: ${report.summary.holdersAvailable}`,
    `Provider failures: ${report.summary.providerFailures}`,
    "",
    "SCORING",
    `Complete: ${report.summary.complete}`,
    `Partial: ${report.summary.partial}`,
    `Unavailable: ${report.summary.unavailable}`,
    `Scores available: ${report.summary.scoresAvailable}`,
    "",
    `Saved: ${outputPath}`
  ].join("\n");
}

export async function runTokenIntelligenceCommand(
  asJson = false,

  dependencies:
    TokenIntelligenceCommandDependencies = {}
): Promise<
  TokenIntelligenceCommandResult
> {
  const runIntelligence =
    dependencies.runIntelligence ??
    runTokenIntelligence;

  const result =
    await runIntelligence();

  return {
    output:
      asJson
        ? JSON.stringify(
            result.report,
            null,
            2
          )
        : formatTextReport(
            result
          ),

    hasFailures:
      result.report
        .summary
        .scoresAvailable ===
      0
  };
}
