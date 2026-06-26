import { Octokit } from "octokit";

const githubToken = process.env.GITHUB_TOKEN;

const octokit = new Octokit(
  githubToken
    ? {
        auth: githubToken
      }
    : {}
);

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PER_PAGE = 100;

export type GitHubRepositoryData = {
  owner: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  defaultBranch: string;
  createdAt: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
  url: string;

  activity: {
    commitsLast30Days: number;
    commitsCapped: boolean;
    contributors: number;
    contributorsCapped: boolean;
    releasesLast90Days: number;
    releasesCapped: boolean;
    latestReleaseAt: string | null;
    hasReadme: boolean;
  };
};

type GitHubApiError = {
  status?: number;
};

function isGitHubApiError(
  error: unknown
): error is GitHubApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error
  );
}

async function repositoryHasReadme(
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await octokit.rest.repos.getReadme({
      owner,
      repo
    });

    return true;
  } catch (error) {
    if (
      isGitHubApiError(error) &&
      error.status === 404
    ) {
      return false;
    }

    throw error;
  }
}

async function getCommitsLast30Days(
  owner: string,
  repo: string,
  since: string
): Promise<number> {
  try {
    const commits = await octokit.paginate(
      octokit.rest.repos.listCommits,
      {
        owner,
        repo,
        since,
        per_page: PER_PAGE
      }
    );

    return commits.length;
  } catch (error) {
    if (
      isGitHubApiError(error) &&
      error.status === 409
    ) {
      return 0;
    }

    throw error;
  }
}

async function getContributorCount(
  owner: string,
  repo: string
): Promise<number> {
  const contributors = await octokit.paginate(
    octokit.rest.repos.listContributors,
    {
      owner,
      repo,
      per_page: PER_PAGE
    }
  );

  return contributors.length;
}

async function getReleaseData(
  owner: string,
  repo: string,
  ninetyDaysAgoTimestamp: number
): Promise<{
  releasesLast90Days: number;
  latestReleaseAt: string | null;
}> {
  const releases = await octokit.paginate(
    octokit.rest.repos.listReleases,
    {
      owner,
      repo,
      per_page: PER_PAGE
    }
  );

  const releaseDates = releases
    .map(
      (release) =>
        release.published_at ??
        release.created_at
    )
    .filter(
      (date): date is string =>
        typeof date === "string"
    )
    .sort(
      (first, second) =>
        new Date(second).getTime() -
        new Date(first).getTime()
    );

  const releasesLast90Days =
    releaseDates.filter(
      (date) =>
        new Date(date).getTime() >=
        ninetyDaysAgoTimestamp
    ).length;

  return {
    releasesLast90Days,
    latestReleaseAt:
      releaseDates[0] ?? null
  };
}

export async function getRepositoryData(
  owner: string,
  repo: string
): Promise<GitHubRepositoryData> {
  const now = Date.now();

  const thirtyDaysAgo = new Date(
    now - 30 * DAY_IN_MS
  ).toISOString();

  const ninetyDaysAgoTimestamp =
    now - 90 * DAY_IN_MS;

  const [
    repositoryResponse,
    commitsLast30Days,
    contributors,
    releaseData,
    hasReadme
  ] = await Promise.all([
    octokit.rest.repos.get({
      owner,
      repo
    }),

    getCommitsLast30Days(
      owner,
      repo,
      thirtyDaysAgo
    ),

    getContributorCount(
      owner,
      repo
    ),

    getReleaseData(
      owner,
      repo,
      ninetyDaysAgoTimestamp
    ),

    repositoryHasReadme(
      owner,
      repo
    )
  ]);

  const repository =
    repositoryResponse.data;

  return {
    owner: repository.owner.login,
    name: repository.name,
    description:
      repository.description,
    stars:
      repository.stargazers_count,
    forks:
      repository.forks_count,
    openIssues:
      repository.open_issues_count,
    language:
      repository.language,
    defaultBranch:
      repository.default_branch,
    createdAt:
      repository.created_at,
    updatedAt:
      repository.updated_at,
    pushedAt:
      repository.pushed_at,
    url:
      repository.html_url,

    activity: {
      commitsLast30Days,
      commitsCapped: false,

      contributors,
      contributorsCapped: false,

      releasesLast90Days:
        releaseData.releasesLast90Days,

      releasesCapped: false,

      latestReleaseAt:
        releaseData.latestReleaseAt,

      hasReadme
    }
  };
}
