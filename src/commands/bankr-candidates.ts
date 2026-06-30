import {
  runBankrCandidateImport
} from "../services/bankr-candidate-import.js";

export type BankrCandidatesCommandResult = {
  output: string;
  hasFailures: boolean;
};

export type BankrCandidatesCommandDependencies = {
  runImport?:
    typeof runBankrCandidateImport;
};

function formatTextReport(
  result:
    Awaited<
      ReturnType<
        typeof runBankrCandidateImport
      >
    >
): string {
  const {
    report,
    outputPath
  } = result;

  const warningRows =
    report.warnings.length > 0
      ? report.warnings.map(
          (entry) =>
            `${entry.warning}: ${entry.count}`
        )
      : [
          "None"
        ];

  const registryRows =
    report.automaticRegistry
      ? [
          "",
          "AUTOMATIC AGENT REGISTRY",
          `Agents: ${report.automaticRegistry.summary.total}`,
          `GitHub verified: ${report.automaticRegistry.summary.githubVerified}`,
          `GitHub probable: ${report.automaticRegistry.summary.githubProbable}`,
          `GitHub unresolved: ${report.automaticRegistry.summary.githubUnresolved}`,
          `Agent Score eligible: ${report.automaticRegistry.summary.agentScoreEligible}`,
          `Token Score eligible: ${report.automaticRegistry.summary.tokenScoreEligible}`
        ]
      : [];

  return [
    "CLARITY BANKR CANDIDATES",
    "",
    `Generated: ${report.generatedAt}`,
    `Profiles listed: ${report.profilesListed}`,
    `Details loaded: ${report.detailsLoaded}`,
    `Profile failures: ${report.failures.length}`,
    `Candidates: ${report.candidates.length}`,
    "",
    "WEBSITE DISCOVERY",
    `Skipped with GitHub: ${report.websiteDiscovery.skippedExistingGitHub}`,
    `Skipped without website: ${report.websiteDiscovery.skippedNoWebsite}`,
    `Skipped social websites: ${report.websiteDiscovery.skippedSocialWebsite}`,
    `Attempted: ${report.websiteDiscovery.attempted}`,
    `Repositories found: ${report.websiteDiscovery.repositoriesFound}`,
    `Owner pages found: ${report.websiteDiscovery.ownerPagesFound}`,
    `Website failures: ${report.websiteDiscovery.failed}`,
    "",
    "OWNER DISCOVERY",
    `Enabled: ${report.ownerDiscovery.enabled ? "yes" : "no"}`,
    `Skipped without token: ${report.ownerDiscovery.skippedNoToken}`,
    `Attempted owners: ${report.ownerDiscovery.attempted}`,
    `Probable matches: ${report.ownerDiscovery.probable}`,
    `Review matches: ${report.ownerDiscovery.review}`,
    `No repository match: ${report.ownerDiscovery.notFound}`,
    `Owner failures: ${report.ownerDiscovery.failed}`,
    `Repository candidates: ${report.ownerDiscovery.candidatesFound}`,
    "",
    "GLOBAL GITHUB DISCOVERY",
    `Enabled: ${report.globalGitHubDiscovery.enabled ? "yes" : "no"}`,
    `Skipped without token: ${report.globalGitHubDiscovery.skippedNoToken}`,
    `Skipped with GitHub: ${report.globalGitHubDiscovery.skippedExistingGitHub}`,
    `Skipped probable owner matches: ${report.globalGitHubDiscovery.skippedOwnerProbable}`,
    `Attempted candidates: ${report.globalGitHubDiscovery.attempted}`,
    `Probable matches: ${report.globalGitHubDiscovery.probable}`,
    `Review matches: ${report.globalGitHubDiscovery.review}`,
    `Weak matches: ${report.globalGitHubDiscovery.weak}`,
    `No repository match: ${report.globalGitHubDiscovery.notFound}`,
    `Search failures: ${report.globalGitHubDiscovery.failed}`,
    `Repository candidates: ${report.globalGitHubDiscovery.candidatesFound}`,
    "",
    "GITHUB EVIDENCE",
    `Candidates with GitHub: ${report.githubEvidence.candidatesWithGitHub}`,
    `Candidates without GitHub: ${report.githubEvidence.candidatesWithoutGitHub}`,
    `Classified repositories: ${report.githubEvidence.classifiedRepositories}`,
    `Unique repositories: ${report.githubEvidence.uniqueRepositories}`,
    ...registryRows,
    "",
    "WARNINGS",
    ...warningRows,
    "",
    `Saved: ${outputPath}`
  ].join("\n");
}

export async function runBankrCandidatesCommand(
  asJson = false,

  dependencies:
    BankrCandidatesCommandDependencies = {}
): Promise<
  BankrCandidatesCommandResult
> {
  const runImport =
    dependencies.runImport ??
    runBankrCandidateImport;

  const result =
    await runImport();

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
      result.report.failures.length >
      0
  };
}
