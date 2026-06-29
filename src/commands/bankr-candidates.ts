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

  return [
    "CLARITY BANKR CANDIDATES",
    "",
    `Generated: ${report.generatedAt}`,
    `Profiles listed: ${report.profilesListed}`,
    `Details loaded: ${report.detailsLoaded}`,
    `Failures: ${report.failures.length}`,
    `Candidates: ${report.candidates.length}`,
    "",
    "GITHUB EVIDENCE",
    `Candidates with GitHub: ${report.githubEvidence.candidatesWithGitHub}`,
    `Candidates without GitHub: ${report.githubEvidence.candidatesWithoutGitHub}`,
    `Classified repositories: ${report.githubEvidence.classifiedRepositories}`,
    `Unique repositories: ${report.githubEvidence.uniqueRepositories}`,
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
