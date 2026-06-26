import type { GitHubRepositoryData } from "../services/github.js";

export type GitHubScoreBreakdown = {
  overall: number;
  activity: number;
  collaboration: number;
  adoption: number;
  releases: number;
  dataCoverage: number;
  evidence: string[];
};

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundScore(value: number): number {
  return Math.round(clamp(value));
}

function linearScore(value: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return roundScore((Math.min(value, target) / target) * 100);
}

function logarithmicScore(value: number, target: number): number {
  if (value <= 0 || target <= 0) {
    return 0;
  }

  const limitedValue = Math.min(value, target);

  return roundScore(
    (Math.log1p(limitedValue) / Math.log1p(target)) * 100
  );
}

function getDaysSince(date: string | null): number | null {
  if (!date) {
    return null;
  }

  const timestamp = new Date(date).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  const difference = Date.now() - timestamp;

  return Math.max(
    0,
    Math.floor(difference / (24 * 60 * 60 * 1000))
  );
}

function calculateReleaseScore(
  releasesLast90Days: number,
  latestReleaseAt: string | null
): number {
  const frequencyScore = linearScore(releasesLast90Days, 4);
  const daysSinceRelease = getDaysSince(latestReleaseAt);

  const recencyScore =
    daysSinceRelease === null
      ? 0
      : roundScore(100 - (daysSinceRelease / 180) * 100);

  return roundScore(
    frequencyScore * 0.6 +
    recencyScore * 0.4
  );
}

function calculateDataCoverage(
  repository: GitHubRepositoryData
): number {
  let coverage = 100;

  if (repository.activity.commitsCapped) {
    coverage -= 10;
  }

  if (repository.activity.contributorsCapped) {
    coverage -= 10;
  }

  if (repository.activity.releasesCapped) {
    coverage -= 10;
  }

  return clamp(coverage);
}

export function calculateGitHubScore(
  repository: GitHubRepositoryData
): GitHubScoreBreakdown {
  const activity = logarithmicScore(
    repository.activity.commitsLast30Days,
    30
  );

  const collaboration = logarithmicScore(
    repository.activity.contributors,
    20
  );

  const starsScore = logarithmicScore(
    repository.stars,
    10_000
  );

  const forksScore = logarithmicScore(
    repository.forks,
    2_000
  );

  const adoption = roundScore(
    starsScore * 0.7 +
    forksScore * 0.3
  );

  const releases = calculateReleaseScore(
    repository.activity.releasesLast90Days,
    repository.activity.latestReleaseAt
  );

  const overall = roundScore(
    activity * 0.4 +
    collaboration * 0.2 +
    adoption * 0.25 +
    releases * 0.15
  );

  const evidence = [
    `${repository.activity.commitsLast30Days} commits in the last 30 days`,
    `${repository.activity.contributors} contributors`,
    `${repository.stars} stars and ${repository.forks} forks`,
    `${repository.activity.releasesLast90Days} releases in the last 90 days`,
    repository.activity.hasReadme
      ? "README detected"
      : "No README detected"
  ];

  return {
    overall,
    activity,
    collaboration,
    adoption,
    releases,
    dataCoverage: calculateDataCoverage(repository),
    evidence
  };
}