import { Octokit } from "octokit";

import {
  collectPaginatedItems,
  countPaginatedItems
} from "./capped-pagination.js";
import {
  normalizeGitHubError
} from "./github-error.js";

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
const MAX_COMMIT_PAGES = 3;
const MAX_COMMITS =
  PER_PAGE * MAX_COMMIT_PAGES;

const MAX_CONTRIBUTOR_PAGES = 2;
const MAX_CONTRIBUTORS =
  PER_PAGE * MAX_CONTRIBUTOR_PAGES;

const MAX_RELEASE_PAGES = 2;
const MAX_RELEASES =
  PER_PAGE * MAX_RELEASE_PAGES;

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
): Promise<{
  count: number;
  capped: boolean;
}> {
  try {
    return await countPaginatedItems(
      octokit.paginate.iterator(
        octokit.rest.repos.listCommits,
        {
          owner,
          repo,
          since,
          per_page: PER_PAGE
        }
      ),
      MAX_COMMITS
    );
  } catch (error) {
    if (
      isGitHubApiError(error) &&
      error.status === 409
    ) {
      return {
        count: 0,
        capped: false
      };
    }

    throw error;
  }
}

async function getContributorCount(
  owner: string,
  repo: string
): Promise<{
  count: number;
  capped: boolean;
}> {
  return countPaginatedItems(
    octokit.paginate.iterator(
      octokit.rest.repos.listContributors,
      {
        owner,
        repo,
        per_page: PER_PAGE
      }
    ),
    MAX_CONTRIBUTORS
  );
}

async function getReleaseData(
  owner: string,
  repo: string,
  ninetyDaysAgoTimestamp: number
): Promise<{
  releasesLast90Days: number;
  latestReleaseAt: string | null;
  capped: boolean;
}> {
  const result =
    await collectPaginatedItems(
      octokit.paginate.iterator(
        octokit.rest.repos.listReleases,
        {
          owner,
          repo,
          per_page: PER_PAGE
        }
      ),
      MAX_RELEASES
    );

  const releaseDates = result.items
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
      releaseDates[0] ?? null,
    capped:
      result.capped
  };
}

async function getRepositoryDataUnwrapped(
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
    commitData,
    contributorData,
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
      commitsLast30Days:
        commitData.count,

      commitsCapped:
        commitData.capped,

      contributors:
        contributorData.count,

      contributorsCapped:
        contributorData.capped,

      releasesLast90Days:
        releaseData.releasesLast90Days,

      releasesCapped:
        releaseData.capped,

      latestReleaseAt:
        releaseData.latestReleaseAt,

      hasReadme
    }
  };
}


export async function getRepositoryData(
  owner: string,
  repo: string
): Promise<GitHubRepositoryData> {
  try {
    return await getRepositoryDataUnwrapped(
      owner,
      repo
    );
  } catch (error) {
    throw normalizeGitHubError(
      error,
      {
        resource: "repository",
        owner,
        repository: repo
      }
    );
  }
}
