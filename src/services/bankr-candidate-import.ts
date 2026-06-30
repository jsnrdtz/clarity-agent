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
  applyBankrCandidateRepositoryIdentity,
  buildBankrCandidateReport,
  mergeBankrGitHubRepositories
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

import {
  discoverBankrWebsiteGitHub,
  isBankrProjectWebsiteUrl
} from "./bankr-website-github.js";

import type {
  BankrWebsiteGitHubDiscovery
} from "./bankr-website-github.js";

import {
  discoverGitHubOwner
} from "./github-discovery.js";

import type {
  GitHubOwnerDiscovery
} from "./github-discovery.js";

import {
  discoverBankrCandidateGlobalGitHub,
  searchGitHubRepositories
} from "./bankr-global-github-search.js";

import type {
  BankrGlobalGitHubQuery,
  BankrGlobalGitHubRepositoryMatch,
  SearchGitHubRepositories
} from "./bankr-global-github-search.js";

import {
  parseGitHubOwnerUrl,
  rankBankrOwnerRepositories
} from "./bankr-owner-repository.js";

import type {
  BankrOwnerRepositoryMatch
} from "./bankr-owner-repository.js";

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

export type BankrWebsiteDiscoveryResult = {
  bankrProfileId: string;
  bankrSlug: string;
  website: string;

  status:
    | "found"
    | "owner-only"
    | "not-found"
    | "failed";

  finalUrl: string | null;
  redirects: number;
  bytesRead: number;

  repositories:
    string[];

  ownerUrls:
    string[];

  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
};

export type BankrWebsiteDiscoverySummary = {
  skippedExistingGitHub: number;
  skippedNoWebsite: number;
  skippedSocialWebsite: number;

  attempted: number;
  found: number;
  ownerOnly: number;
  notFound: number;
  failed: number;

  repositoriesFound: number;
  ownerPagesFound: number;

  results:
    BankrWebsiteDiscoveryResult[];
};

export type BankrOwnerDiscoveryResult = {
  bankrProfileId: string;
  bankrSlug: string;

  ownerUrl: string;
  owner: string;

  status:
    | "probable"
    | "review"
    | "not-found"
    | "failed";

  repositoriesFound: number;

  candidates:
    BankrOwnerRepositoryMatch[];

  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
};

export type BankrOwnerDiscoverySummary = {
  enabled: boolean;
  skippedNoToken: number;

  attempted: number;
  probable: number;
  review: number;
  notFound: number;
  failed: number;

  candidatesFound: number;

  results:
    BankrOwnerDiscoveryResult[];
};

export type BankrGlobalGitHubDiscoveryResult = {
  bankrProfileId: string;
  bankrSlug: string;

  status:
    | "probable"
    | "review"
    | "weak"
    | "not-found"
    | "failed";

  queries:
    BankrGlobalGitHubQuery[];

  repositoriesFound: number;

  candidates:
    BankrGlobalGitHubRepositoryMatch[];

  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
};

export type BankrGlobalGitHubDiscoverySummary = {
  enabled: boolean;

  skippedNoToken: number;
  skippedExistingGitHub: number;
  skippedOwnerProbable: number;

  attempted: number;
  probable: number;
  review: number;
  weak: number;
  notFound: number;
  failed: number;

  candidatesFound: number;

  results:
    BankrGlobalGitHubDiscoveryResult[];
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

  websiteDiscovery:
    BankrWebsiteDiscoverySummary;

  ownerDiscovery:
    BankrOwnerDiscoverySummary;

  globalGitHubDiscovery:
    BankrGlobalGitHubDiscoverySummary;

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

  discoverWebsite?: (
    websiteUrl: string
  ) => Promise<
    BankrWebsiteGitHubDiscovery
  >;

  discoverOwner?: (
    owner: string
  ) => Promise<
    GitHubOwnerDiscovery
  >;

  ownerDiscoveryEnabled?:
    boolean;

  searchGlobalGitHub?:
    SearchGitHubRepositories;

  globalGitHubSearchEnabled?:
    boolean;

  globalGitHubSearchIntervalMs?:
    number;

  sleep?: (
    milliseconds: number
  ) => Promise<void>;

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

function getErrorDetails(
  error: unknown,

  fallbackCode: string,
  fallbackMessage: string
): {
  code: string;
  message: string;
  retryable: boolean;
} {
  const candidate =
    (
      typeof error ===
        "object" &&
      error !== null
    )
      ? error as {
          code?: unknown;
          message?: unknown;
          retryable?: unknown;
        }
      : {};

  return {
    code:
      typeof candidate.code ===
        "string"
        ? candidate.code
        : fallbackCode,

    message:
      error instanceof Error
        ? error.message
        : typeof candidate.message ===
            "string"
          ? candidate.message
          : fallbackMessage,

    retryable:
      candidate.retryable ===
      true
  };
}

function createFailure(
  profile:
    BankrAgentProfileSummary,

  error: unknown
): BankrCandidateImportFailure {
  const details =
    getErrorDetails(
      error,
      "BANKR_PROFILE_LOAD_FAILED",
      "Unknown Bankr profile load error."
    );

  return {
    bankrProfileId:
      profile.id,

    bankrSlug:
      profile.slug,

    ...details
  };
}

function createEmptyWebsiteSummary():
BankrWebsiteDiscoverySummary {
  return {
    skippedExistingGitHub:
      0,

    skippedNoWebsite:
      0,

    skippedSocialWebsite:
      0,

    attempted:
      0,

    found:
      0,

    ownerOnly:
      0,

    notFound:
      0,

    failed:
      0,

    repositoriesFound:
      0,

    ownerPagesFound:
      0,

    results:
      []
  };
}

async function enrichCandidatesFromWebsites(
  profiles:
    BankrAgentProfileDetail[],

  candidates:
    BankrCandidate[],

  discoverWebsite:
    NonNullable<
      BankrCandidateImportDependencies[
        "discoverWebsite"
      ]
    >
): Promise<
  BankrWebsiteDiscoverySummary
> {
  const summary =
    createEmptyWebsiteSummary();

  for (
    let index = 0;
    index < profiles.length;
    index += 1
  ) {
    const profile =
      profiles[index];

    const candidate =
      candidates[index];

    if (
      !profile ||
      !candidate
    ) {
      continue;
    }

    if (
      candidate
        .githubRepositories
        .length > 0
    ) {
      summary
        .skippedExistingGitHub +=
        1;

      continue;
    }

    const website =
      profile
        .website
        ?.trim() ??
      "";

    if (!website) {
      summary
        .skippedNoWebsite +=
        1;

      continue;
    }

    if (
      !isBankrProjectWebsiteUrl(
        website
      )
    ) {
      summary
        .skippedSocialWebsite +=
        1;

      continue;
    }

    summary.attempted +=
      1;

    try {
      const discovery =
        await discoverWebsite(
          website
        );

      candidate.githubRepositories =
        mergeBankrGitHubRepositories(
          candidate
            .githubRepositories,

          discovery.repositories
        );

      applyBankrCandidateRepositoryIdentity(
        candidate
      );

      if (
        candidate
          .githubRepositories
          .length > 0
      ) {
        candidate.warnings =
          candidate
            .warnings
            .filter(
              (warning) =>
                warning !==
                "no-github-repository"
            );
      }

      const status =
        discovery
          .repositories
          .length > 0
          ? "found"
          : discovery
              .ownerUrls
              .length > 0
            ? "owner-only"
            : "not-found";

      summary[
        status === "owner-only"
          ? "ownerOnly"
          : status === "not-found"
            ? "notFound"
            : "found"
      ] += 1;

      summary.repositoriesFound +=
        discovery
          .repositories
          .length;

      summary.ownerPagesFound +=
        discovery
          .ownerUrls
          .length;

      summary.results.push(
        {
          bankrProfileId:
            profile.id,

          bankrSlug:
            profile.slug,

          website,

          status,

          finalUrl:
            discovery.finalUrl,

          redirects:
            discovery.redirects,

          bytesRead:
            discovery.bytesRead,

          repositories:
            discovery
              .repositories
              .map(
                (repository) =>
                  repository.url
              ),

          ownerUrls:
            discovery.ownerUrls,

          error:
            null
        }
      );
    } catch (error) {
      summary.failed +=
        1;

      const details =
        getErrorDetails(
          error,
          "WEBSITE_DISCOVERY_FAILED",
          "Unknown website discovery error."
        );

      summary.results.push(
        {
          bankrProfileId:
            profile.id,

          bankrSlug:
            profile.slug,

          website,

          status:
            "failed",

          finalUrl:
            null,

          redirects:
            0,

          bytesRead:
            0,

          repositories:
            [],

          ownerUrls:
            [],

          error:
            details
        }
      );
    }
  }

  return summary;
}

function createEmptyOwnerDiscoverySummary():
BankrOwnerDiscoverySummary {
  return {
    enabled:
      true,

    skippedNoToken:
      0,

    attempted:
      0,

    probable:
      0,

    review:
      0,

    notFound:
      0,

    failed:
      0,

    candidatesFound:
      0,

    results:
      []
  };
}

async function discoverCandidatesFromOwners(
  candidates:
    BankrCandidate[],

  websiteDiscovery:
    BankrWebsiteDiscoverySummary,

  discoverOwner:
    NonNullable<
      BankrCandidateImportDependencies[
        "discoverOwner"
      ]
    >
): Promise<
  BankrOwnerDiscoverySummary
> {
  const summary =
    createEmptyOwnerDiscoverySummary();

  for (
    const websiteResult
    of websiteDiscovery.results
  ) {
    if (
      websiteResult.status !==
        "owner-only"
    ) {
      continue;
    }

    const candidate =
      candidates.find(
        (entry) =>
          entry.bankrProfileId ===
            websiteResult.bankrProfileId &&
          entry.bankrSlug ===
            websiteResult.bankrSlug
      );

    if (!candidate) {
      continue;
    }

    for (
      const ownerUrl
      of websiteResult.ownerUrls
    ) {
      const owner =
        parseGitHubOwnerUrl(
          ownerUrl
        );

      if (!owner) {
        continue;
      }

      summary.attempted +=
        1;

      try {
        const discovery =
          await discoverOwner(
            owner
          );

        const matches =
          rankBankrOwnerRepositories(
            candidate,
            discovery
          );

        const hasProbable =
          matches.some(
            (repository) =>
              repository.probable
          );

        const status =
          hasProbable
            ? "probable"
            : matches.length > 0
              ? "review"
              : "not-found";

        if (
          status === "probable"
        ) {
          summary.probable +=
            1;
        } else if (
          status === "review"
        ) {
          summary.review +=
            1;
        } else {
          summary.notFound +=
            1;
        }

        summary.candidatesFound +=
          matches.length;

        summary.results.push(
          {
            bankrProfileId:
              candidate.bankrProfileId,

            bankrSlug:
              candidate.bankrSlug,

            ownerUrl,

            owner:
              discovery.owner,

            status,

            repositoriesFound:
              discovery.repositoriesFound,

            candidates:
              matches,

            error:
              null
          }
        );
      } catch (error) {
        summary.failed +=
          1;

        const details =
          getErrorDetails(
            error,
            "GITHUB_OWNER_DISCOVERY_FAILED",
            "Unknown GitHub owner discovery error."
          );

        summary.results.push(
          {
            bankrProfileId:
              candidate.bankrProfileId,

            bankrSlug:
              candidate.bankrSlug,

            ownerUrl,

            owner,

            status:
              "failed",

            repositoriesFound:
              0,

            candidates:
              [],

            error:
              details
          }
        );
      }
    }
  }

  return summary;
}

function createEmptyGlobalGitHubDiscoverySummary():
BankrGlobalGitHubDiscoverySummary {
  return {
    enabled:
      true,

    skippedNoToken:
      0,

    skippedExistingGitHub:
      0,

    skippedOwnerProbable:
      0,

    attempted:
      0,

    probable:
      0,

    review:
      0,

    weak:
      0,

    notFound:
      0,

    failed:
      0,

    candidatesFound:
      0,

    results:
      []
  };
}

function hasProbableOwnerDiscovery(
  candidate:
    BankrCandidate,

  ownerDiscovery:
    BankrOwnerDiscoverySummary
): boolean {
  return ownerDiscovery
    .results
    .some(
      (result) =>
        result.bankrProfileId ===
          candidate.bankrProfileId &&
        result.bankrSlug ===
          candidate.bankrSlug &&
        result.status ===
          "probable"
    );
}

function countGlobalGitHubSearchableCandidates(
  candidates:
    BankrCandidate[],

  ownerDiscovery:
    BankrOwnerDiscoverySummary
): number {
  return candidates
    .filter(
      (candidate) =>
        candidate
          .githubRepositories
          .length === 0 &&
        !hasProbableOwnerDiscovery(
          candidate,
          ownerDiscovery
        )
    )
    .length;
}

async function discoverCandidatesFromGlobalGitHub(
  candidates:
    BankrCandidate[],

  ownerDiscovery:
    BankrOwnerDiscoverySummary,

  searchRepositories:
    SearchGitHubRepositories,

  minimumIntervalMs:
    number,

  sleep:
    (
      milliseconds: number
    ) => Promise<void>
): Promise<
  BankrGlobalGitHubDiscoverySummary
> {
  const summary =
    createEmptyGlobalGitHubDiscoverySummary();

  let previousSearchStartedAt =
    0;

  const rateLimitedSearch:
    SearchGitHubRepositories =
    async (
      query
    ) => {
      const waitMilliseconds =
        Math.max(
          0,

          previousSearchStartedAt +
            minimumIntervalMs -
            Date.now()
        );

      if (
        waitMilliseconds > 0
      ) {
        await sleep(
          waitMilliseconds
        );
      }

      previousSearchStartedAt =
        Date.now();

      return searchRepositories(
        query
      );
    };

  for (
    const candidate
    of candidates
  ) {
    if (
      candidate
        .githubRepositories
        .length > 0
    ) {
      summary
        .skippedExistingGitHub +=
        1;

      continue;
    }

    if (
      hasProbableOwnerDiscovery(
        candidate,
        ownerDiscovery
      )
    ) {
      summary
        .skippedOwnerProbable +=
        1;

      continue;
    }

    summary.attempted +=
      1;

    try {
      const discovery =
        await discoverBankrCandidateGlobalGitHub(
          candidate,
          rateLimitedSearch
        );

      const matches =
        discovery
          .candidates
          .filter(
            (repository) =>
              repository.status !==
                "unrelated"
          );

      const status:
        BankrGlobalGitHubDiscoveryResult[
          "status"
        ] =
        matches.some(
          (repository) =>
            repository.status ===
              "probable"
        )
          ? "probable"
          : matches.some(
                (repository) =>
                  repository.status ===
                    "review"
              )
            ? "review"
            : matches.some(
                  (repository) =>
                    repository.status ===
                      "weak"
                )
              ? "weak"
              : "not-found";

      if (
        status === "probable"
      ) {
        summary.probable +=
          1;
      } else if (
        status === "review"
      ) {
        summary.review +=
          1;
      } else if (
        status === "weak"
      ) {
        summary.weak +=
          1;
      } else {
        summary.notFound +=
          1;
      }

      summary.candidatesFound +=
        matches.length;

      summary.results.push(
        {
          bankrProfileId:
            candidate.bankrProfileId,

          bankrSlug:
            candidate.bankrSlug,

          status,

          queries:
            discovery.queries,

          repositoriesFound:
            discovery.repositoriesFound,

          candidates:
            matches,

          error:
            null
        }
      );
    } catch (error) {
      summary.failed +=
        1;

      const details =
        getErrorDetails(
          error,
          "GITHUB_GLOBAL_SEARCH_FAILED",
          "Unknown global GitHub search error."
        );

      summary.results.push(
        {
          bankrProfileId:
            candidate.bankrProfileId,

          bankrSlug:
            candidate.bankrSlug,

          status:
            "failed",

          queries:
            [],

          repositoriesFound:
            0,

          candidates:
            [],

          error:
            details
        }
      );
    }
  }

  return summary;
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

  const discoverWebsite =
    dependencies.discoverWebsite ??
    discoverBankrWebsiteGitHub;

  const discoverOwner =
    dependencies.discoverOwner ??
    discoverGitHubOwner;

  const searchGlobalGitHub =
    dependencies.searchGlobalGitHub ??
    searchGitHubRepositories;

  const ownerDiscoveryEnabled =
    dependencies
      .ownerDiscoveryEnabled ??
    (
      dependencies.discoverOwner !==
        undefined ||
      Boolean(
        process.env
          .GITHUB_TOKEN
          ?.trim()
      )
    );

  const globalGitHubSearchEnabled =
    dependencies
      .globalGitHubSearchEnabled ??
    (
      dependencies
        .searchGlobalGitHub !==
          undefined ||
      Boolean(
        process.env
          .GITHUB_TOKEN
          ?.trim()
      )
    );

  const globalGitHubSearchIntervalMs =
    Math.max(
      0,

      dependencies
        .globalGitHubSearchIntervalMs ??
      (
        dependencies
          .searchGlobalGitHub !==
            undefined
          ? 0
          : 2_100
      )
    );

  const sleep =
    dependencies.sleep ??
    (
      async (
        milliseconds: number
      ): Promise<void> => {
        await new Promise<void>(
          (resolve) => {
            setTimeout(
              resolve,
              milliseconds
            );
          }
        );
      }
    );

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

  for (
    const candidate
    of candidateReport.candidates
  ) {
    applyBankrCandidateRepositoryIdentity(
      candidate
    );
  }

  const websiteDiscovery =
    await enrichCandidatesFromWebsites(
      loadedProfiles,
      candidateReport.candidates,
      discoverWebsite
    );

  const ownerDiscovery =
    ownerDiscoveryEnabled
      ? await discoverCandidatesFromOwners(
          candidateReport.candidates,
          websiteDiscovery,
          discoverOwner
        )
      : {
          ...createEmptyOwnerDiscoverySummary(),

          enabled:
            false,

          skippedNoToken:
            websiteDiscovery
              .results
              .filter(
                (result) =>
                  result.status ===
                    "owner-only"
              )
              .reduce(
                (
                  count,
                  result
                ) =>
                  count +
                  result
                    .ownerUrls
                    .length,

                0
              )
        };

  const globalGitHubDiscovery =
    globalGitHubSearchEnabled
      ? await discoverCandidatesFromGlobalGitHub(
          candidateReport.candidates,
          ownerDiscovery,
          searchGlobalGitHub,
          globalGitHubSearchIntervalMs,
          sleep
        )
      : {
          ...createEmptyGlobalGitHubDiscoverySummary(),

          enabled:
            false,

          skippedNoToken:
            countGlobalGitHubSearchableCandidates(
              candidateReport.candidates,
              ownerDiscovery
            )
        };

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

    websiteDiscovery,

    ownerDiscovery,

    globalGitHubDiscovery,

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
