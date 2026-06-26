import { Octokit } from "octokit";

const octokit = new Octokit();

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 100;

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

function isGitHubApiError(error: unknown): error is GitHubApiError {
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
    if (isGitHubApiError(error) && error.status === 404) {
      return false;
    }

    throw error;
  }
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
    commitsResponse,
    contributorsResponse,
    releasesResponse,
    hasReadme
  ] = await Promise.all([
    octokit.rest.repos.get({
      owner,
      repo
    }),

    octokit.rest.repos.listCommits({
      owner,
      repo,
      since: thirtyDaysAgo,
      per_page: PAGE_LIMIT
    }),

    octokit.rest.repos.listContributors({
      owner,
      repo,
      per_page: PAGE_LIMIT
    }),

    octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: PAGE_LIMIT
    }),

    repositoryHasReadme(owner, repo)
  ]);

  const repository = repositoryResponse.data;
  const releases = releasesResponse.data;

  const releasesLast90Days = releases.filter((release) => {
    const releaseDate =
      release.published_at ?? release.created_at;

    return (
      new Date(releaseDate).getTime() >=
      ninetyDaysAgoTimestamp
    );
  }).length;

  const latestReleaseAt =
    releases
      .map(
        (release) =>
          release.published_at ?? release.created_at
      )
      .sort(
        (first, second) =>
          new Date(second).getTime() -
          new Date(first).getTime()
      )[0] ?? null;

  return {
    owner: repository.owner.login,
    name: repository.name,
    description: repository.description,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    language: repository.language,
    defaultBranch: repository.default_branch,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    url: repository.html_url,

    activity: {
      commitsLast30Days: commitsResponse.data.length,
      commitsCapped:
        commitsResponse.data.length === PAGE_LIMIT,

      contributors: contributorsResponse.data.length,
      contributorsCapped:
        contributorsResponse.data.length === PAGE_LIMIT,

      releasesLast90Days,
      releasesCapped:
        releasesResponse.data.length === PAGE_LIMIT,

      latestReleaseAt,
      hasReadme
    }
  };
}