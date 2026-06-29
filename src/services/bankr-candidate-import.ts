import {
  randomUUID
} from "node:crypto";

import {
  mkdir,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";

import {
  dirname
} from "node:path";

import {
  buildBankrCandidateReport
} from "./bankr-candidate.js";

import type {
  BankrCandidate,
  BankrCandidateConflictGroup,
  BankrCandidateWarning
} from "./bankr-candidate.js";

import {
  getBankrAgentProfile,
  listApprovedBankrProfiles
} from "./bankr-client.js";

import type {
  BankrAgentProfileDetail,
  BankrAgentProfileSummary
} from "./bankr-client.js";

import type {
  BankrGitHubEvidenceConfidence,
  BankrGitHubRelationship
} from "./bankr-github-evidence.js";

export type BankrCandidateImportFailure = {
  bankrProfileId: string;
  bankrSlug: string;
  code: string;
  message: string;
  retryable: boolean;
};

export type BankrCandidateWarningCount = {
  warning: BankrCandidateWarning;
  count: number;
};

export type BankrCandidateGitHubEvidenceSummary = {
  candidatesWithGitHub: number;
  candidatesWithoutGitHub: number;
  classifiedRepositories: number;
  uniqueRepositories: number;

  relationships:
    Record<
      BankrGitHubRelationship,
      number
    >;

  confidences:
    Record<
      BankrGitHubEvidenceConfidence,
      number
    >;
};

export type BankrCandidateImportReport = {
  schemaVersion: "1.0";
  source: "bankr";
  generatedAt: string;

  profilesListed: number;
  detailsLoaded: number;

  failures:
    BankrCandidateImportFailure[];

  candidates:
    BankrCandidate[];

  warnings:
    BankrCandidateWarningCount[];

  conflicts: {
    profileIds:
      BankrCandidateConflictGroup[];

    slugs:
      BankrCandidateConflictGroup[];

    tokenIdentities:
      BankrCandidateConflictGroup[];
  };

  githubEvidence:
    BankrCandidateGitHubEvidenceSummary;
};

export type BankrCandidateImportDependencies = {
  listProfiles?: (
  ) => Promise<
    BankrAgentProfileSummary[]
  >;

  getProfile?: (
    identifier: string
  ) => Promise<
    BankrAgentProfileDetail
  >;

  now?: () => string;
};

export type RunBankrCandidateImportOptions =
  BankrCandidateImportDependencies & {
    outputPath?: string;
  };

const WARNING_ORDER:
  BankrCandidateWarning[] =
    [
      "missing-description",
      "missing-website",
      "missing-twitter",
      "no-github-repository",
      "unapproved-profile",
      "shared-token-identity"
    ];

function createWarningSummary(
  candidates:
    BankrCandidate[]
): BankrCandidateWarningCount[] {
  const counts =
    new Map<
      BankrCandidateWarning,
      number
    >();

  for (
    const candidate
    of candidates
  ) {
    for (
      const warning
      of candidate.warnings
    ) {
      counts.set(
        warning,
        (
          counts.get(warning) ??
          0
        ) + 1
      );
    }
  }

  return WARNING_ORDER
    .map(
      (warning) => ({
        warning,

        count:
          counts.get(warning) ??
          0
      })
    )
    .filter(
      (entry) =>
        entry.count > 0
    );
}

function createGitHubEvidenceSummary(
  candidates:
    BankrCandidate[]
): BankrCandidateGitHubEvidenceSummary {
  const relationships:
    Record<
      BankrGitHubRelationship,
      number
    > = {
      primary:
        0,

      component:
        0,

      integration:
        0,

      dependency:
        0,

      example:
        0,

      unknown:
        0
    };

  const confidences:
    Record<
      BankrGitHubEvidenceConfidence,
      number
    > = {
      high:
        0,

      medium:
        0,

      low:
        0
    };

  const uniqueRepositories =
    new Set<string>();

  let candidatesWithGitHub =
    0;

  let classifiedRepositories =
    0;

  for (
    const candidate
    of candidates
  ) {
    if (
      candidate
        .githubRepositories
        .length > 0
    ) {
      candidatesWithGitHub +=
        1;
    }

    for (
      const repository
      of candidate.githubRepositories
    ) {
      classifiedRepositories +=
        1;

      uniqueRepositories.add(
        [
          repository
            .owner
            .toLowerCase(),

          repository
            .repository
            .toLowerCase()
        ].join("/")
      );

      relationships[
        repository.relationship
      ] += 1;

      confidences[
        repository.confidence
      ] += 1;
    }
  }

  return {
    candidatesWithGitHub,

    candidatesWithoutGitHub:
      candidates.length -
      candidatesWithGitHub,

    classifiedRepositories,

    uniqueRepositories:
      uniqueRepositories.size,

    relationships,
    confidences
  };
}

function createFailure(
  profile:
    BankrAgentProfileSummary,

  error: unknown
): BankrCandidateImportFailure {
  const candidate =
    (
      typeof error === "object" &&
      error !== null
    )
      ? error as {
          code?: unknown;
          message?: unknown;
          retryable?: unknown;
        }
      : {};

  const message =
    error instanceof Error
      ? error.message
      : typeof candidate.message ===
          "string"
        ? candidate.message
        : "Unknown Bankr profile load error.";

  return {
    bankrProfileId:
      profile.id,

    bankrSlug:
      profile.slug,

    code:
      typeof candidate.code ===
        "string"
        ? candidate.code
        : "BANKR_PROFILE_LOAD_FAILED",

    message,

    retryable:
      candidate.retryable ===
      true
  };
}

export function getBankrCandidateReportPath(): string {
  return (
    process.env
      .CLARITY_BANKR_CANDIDATE_REPORT_PATH ??
    "data/candidates/bankr.json"
  );
}

export async function generateBankrCandidateImportReport(
  dependencies:
    BankrCandidateImportDependencies = {}
): Promise<
  BankrCandidateImportReport
> {
  const listProfiles =
    dependencies.listProfiles ??
    listApprovedBankrProfiles;

  const getProfile =
    dependencies.getProfile ??
    getBankrAgentProfile;

  const generatedAt =
    dependencies.now?.() ??
    new Date().toISOString();

  const listedProfiles =
    await listProfiles();

  const loadedProfiles:
    BankrAgentProfileDetail[] =
    [];

  const failures:
    BankrCandidateImportFailure[] =
    [];

  for (
    const profile
    of listedProfiles
  ) {
    try {
      const detail =
        await getProfile(
          profile.slug
        );

      loadedProfiles.push(
        detail
      );
    } catch (error) {
      failures.push(
        createFailure(
          profile,
          error
        )
      );
    }
  }

  const candidateReport =
    buildBankrCandidateReport(
      loadedProfiles,
      generatedAt
    );

  return {
    schemaVersion:
      "1.0",

    source:
      "bankr",

    generatedAt,

    profilesListed:
      listedProfiles.length,

    detailsLoaded:
      loadedProfiles.length,

    failures,

    candidates:
      candidateReport.candidates,

    warnings:
      createWarningSummary(
        candidateReport.candidates
      ),

    conflicts:
      candidateReport.conflicts,

    githubEvidence:
      createGitHubEvidenceSummary(
        candidateReport.candidates
      )
  };
}

export async function saveBankrCandidateImportReport(
  report:
    BankrCandidateImportReport,

  outputPath =
    getBankrCandidateReportPath()
): Promise<string> {
  await mkdir(
    dirname(outputPath),
    {
      recursive: true
    }
  );

  const temporaryPath =
    `${outputPath}.${randomUUID()}.tmp`;

  try {
    await writeFile(
      temporaryPath,

      JSON.stringify(
        report,
        null,
        2
      ) + "\n",

      "utf8"
    );

    await rename(
      temporaryPath,
      outputPath
    );
  } catch (error) {
    await unlink(
      temporaryPath
    ).catch(
      () => undefined
    );

    throw error;
  }

  return outputPath;
}

export async function runBankrCandidateImport(
  options:
    RunBankrCandidateImportOptions = {}
): Promise<{
  report: BankrCandidateImportReport;
  outputPath: string;
}> {
  const report =
    await generateBankrCandidateImportReport(
      options
    );

  const outputPath =
    await saveBankrCandidateImportReport(
      report,
      options.outputPath
    );

  return {
    report,
    outputPath
  };
}
