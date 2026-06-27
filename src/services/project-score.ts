import {
  calculateGitHubScore,
  type GitHubScoreBreakdown
} from "../scoring/github-score.js";

import {
  discoverGitHubProject,
  type GitHubProjectDiscovery,
  type ProjectRepositoryMatch
} from "./github-project-discovery.js";

import {
  buildProjectGitHubMetrics,
  type ProjectGitHubMetrics
} from "./project-github-metrics.js";

import {
  TtlPromiseCache
} from "./ttl-promise-cache.js";

export type ProjectScoreResult = {
  discovery: GitHubProjectDiscovery;
  score: GitHubScoreBreakdown;
  metrics: ProjectGitHubMetrics;
  coreMatches: ProjectRepositoryMatch[];
  ecosystem: ProjectRepositoryMatch[];
  excludedRelated: ProjectRepositoryMatch[];
};

const DEFAULT_CACHE_TTL_MS =
  10 * 60 * 1000;

function getCacheTtlMs(): number {
  const rawValue =
    process.env.CLARITY_CACHE_TTL_MS;

  if (!rawValue) {
    return DEFAULT_CACHE_TTL_MS;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    throw new Error(
      `Invalid CLARITY_CACHE_TTL_MS value: "${rawValue}"`
    );
  }

  return parsedValue;
}

const projectScoreCacheTtlMs =
  getCacheTtlMs();

const projectScoreCache =
  new TtlPromiseCache<ProjectScoreResult>(
    projectScoreCacheTtlMs
  );

function getCacheKey(
  brand: string,
  owner: string,
  anchorRepository: string
): string {
  return [
    brand,
    owner,
    anchorRepository
  ]
    .map(
      (value) =>
        value
          .trim()
          .toLowerCase()
    )
    .join(":");
}

export function isApprovedCore(
  match: ProjectRepositoryMatch
): boolean {
  if (match.role === "anchor") {
    return true;
  }

  return (
    match.role === "core-candidate" &&
    match.status === "verified-related" &&
    match.relationScore >= 80
  );
}

export function isEcosystemRepository(
  match: ProjectRepositoryMatch
): boolean {
  return (
    match.role === "component" ||
    match.role === "integration"
  );
}

async function calculateProjectScoreUncached(
  brand: string,
  owner: string,
  anchorRepository: string
): Promise<ProjectScoreResult> {
  const discovery =
    await discoverGitHubProject(
      brand,
      owner,
      anchorRepository
    );

  const coreMatches =
    discovery.related
      .filter(isApprovedCore)
      .sort(
        (first, second) => {
          if (
            first.role === "anchor"
          ) {
            return -1;
          }

          if (
            second.role === "anchor"
          ) {
            return 1;
          }

          return (
            second.relationScore -
            first.relationScore
          );
        }
      );

  if (coreMatches.length === 0) {
    throw new Error(
      `No core repositories were approved for ${brand}.`
    );
  }

  const metrics =
    await buildProjectGitHubMetrics(
      brand,

      coreMatches.map(
        (match) => ({
          owner:
            match.repository.owner,

          repository:
            match.repository.name,

          role:
            match.role,

          relationScore:
            match.relationScore,

          isAnchor:
            match.role === "anchor"
        })
      )
    );

  const score =
    calculateGitHubScore(
      metrics.aggregate
    );

  const ecosystem =
    discovery.related.filter(
      isEcosystemRepository
    );

  const excludedRelated =
    discovery.related.filter(
      (match) =>
        !isApprovedCore(match) &&
        !isEcosystemRepository(match)
    );

  return {
    discovery,
    score,
    metrics,
    coreMatches,
    ecosystem,
    excludedRelated
  };
}

export function calculateProjectScore(
  brand: string,
  owner: string,
  anchorRepository: string
): Promise<ProjectScoreResult> {
  const cacheKey =
    getCacheKey(
      brand,
      owner,
      anchorRepository
    );

  return projectScoreCache.getOrCreate(
    cacheKey,

    () =>
      calculateProjectScoreUncached(
        brand,
        owner,
        anchorRepository
      )
  );
}

export function clearProjectScoreCache():
void {
  projectScoreCache.clear();
}

export function getProjectScoreCacheStatus(): {
  strategy: "in-memory-ttl";
  ttlMs: number;
  entries: number;
} {
  return {
    strategy: "in-memory-ttl",
    ttlMs:
      projectScoreCacheTtlMs,

    entries:
      projectScoreCache.size
  };
}
