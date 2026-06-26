import { Octokit } from "octokit";

import {
getRepositoryData,
type GitHubRepositoryData
} from "./github.js";

const githubToken =
process.env.GITHUB_TOKEN;

const octokit = new Octokit(
githubToken
? {
auth: githubToken
}
: {}
);

const PER_PAGE = 100;

const ADDITIONAL_CORE_ACTIVITY_WEIGHT =
0.25;

const ADDITIONAL_CORE_COMMIT_CAP =
120;

export type ProjectCoreRepositoryInput = {
owner: string;
repository: string;
role: string;
relationScore: number;
isAnchor: boolean;
};

export type ProjectCoreRepositoryMetrics = {
input: ProjectCoreRepositoryInput;
data: GitHubRepositoryData;
contributorKeys: string[];
adjustedCommitContribution: number;
};

export type ProjectGitHubMetrics = {
aggregate: GitHubRepositoryData;
repositories:
ProjectCoreRepositoryMetrics[];
rawCommitsLast30Days: number;
adjustedCommitsLast30Days: number;
uniqueContributors: number;
};

type ContributorIdentity = {
login?: string | null;
id?: number;
};

function getContributorKey(
contributor: ContributorIdentity,
owner: string,
repository: string,
index: number
): string {
if (
typeof contributor.login === "string" &&
contributor.login.length > 0
) {
return (
`login:${contributor.login.toLowerCase()}`
);
}

if (
typeof contributor.id === "number"
) {
return `id:${contributor.id}`;
}

return (
`anonymous:${owner}/${repository}/${index}`
);
}

async function getContributorKeys(
owner: string,
repository: string
): Promise<string[]> {
const contributors =
await octokit.paginate(
octokit.rest.repos.listContributors,
{
owner,
repo: repository,
per_page: PER_PAGE
}
);

return (
contributors as ContributorIdentity[]
).map(
(contributor, index) =>
getContributorKey(
contributor,
owner,
repository,
index
)
);
}

function latestDate(
dates: Array<string | null>
): string | null {
const validDates =
dates.filter(
(date): date is string =>
typeof date === "string"
);

if (validDates.length === 0) {
return null;
}

return validDates.sort(
(first, second) =>
new Date(second).getTime() -
new Date(first).getTime()
)[0] ?? null;
}

function earliestDate(
dates: Array<string | null>
): string | null {
const validDates =
dates.filter(
(date): date is string =>
typeof date === "string"
);

if (validDates.length === 0) {
return null;
}

return validDates.sort(
(first, second) =>
new Date(first).getTime() -
new Date(second).getTime()
)[0] ?? null;
}

function calculateCommitContribution(
commits: number,
isAnchor: boolean
): number {
if (isAnchor) {
return commits;
}

const cappedCommits =
Math.min(
commits,
ADDITIONAL_CORE_COMMIT_CAP
);

return Math.round(
cappedCommits *
ADDITIONAL_CORE_ACTIVITY_WEIGHT
);
}

export async function buildProjectGitHubMetrics(
brand: string,
coreRepositories:
ProjectCoreRepositoryInput[]
): Promise<ProjectGitHubMetrics> {
if (coreRepositories.length === 0) {
throw new Error(
"At least one core repository is required."
);
}

const anchorInput =
coreRepositories.find(
(repository) =>
repository.isAnchor
);

if (!anchorInput) {
throw new Error(
"Project core repository list has no anchor."
);
}

const repositories =
await Promise.all(
coreRepositories.map(
async (
input
): Promise<ProjectCoreRepositoryMetrics> => {
const [
data,
contributorKeys
] = await Promise.all([
getRepositoryData(
input.owner,
input.repository
),


        getContributorKeys(
          input.owner,
          input.repository
        )
      ]);

      return {
        input,
        data,
        contributorKeys,

        adjustedCommitContribution:
          calculateCommitContribution(
            data.activity
              .commitsLast30Days,
            input.isAnchor
          )
      };
    }
  )
);


const anchor =
repositories.find(
(repository) =>
repository.input.isAnchor
);

if (!anchor) {
throw new Error(
"Anchor repository metrics were not collected."
);
}

const contributorKeys =
new Set<string>();

for (
const repository of repositories
) {
for (
const contributorKey of
repository.contributorKeys
) {
contributorKeys.add(
contributorKey
);
}
}

const fallbackContributorCount =
Math.max(
...repositories.map(
(repository) =>
repository.data.activity
.contributors
)
);

const uniqueContributors =
contributorKeys.size > 0
? contributorKeys.size
: fallbackContributorCount;

const rawCommitsLast30Days =
repositories.reduce(
(total, repository) =>
total +
repository.data.activity
.commitsLast30Days,
0
);

const adjustedCommitsLast30Days =
repositories.reduce(
(total, repository) =>
total +
repository
.adjustedCommitContribution,
0
);

const releasesLast90Days =
repositories.reduce(
(total, repository) =>
total +
repository.data.activity
.releasesLast90Days,
0
);

const aggregate:
GitHubRepositoryData = {
owner:
anchor.data.owner,


  name:
    `${brand}-project`,

  description:
    `Aggregated core GitHub metrics for ${brand}.`,

  stars:
    anchor.data.stars,

  forks:
    anchor.data.forks,

  openIssues:
    repositories.reduce(
      (total, repository) =>
        total +
        repository.data.openIssues,
      0
    ),

  language:
    anchor.data.language,

  defaultBranch:
    anchor.data.defaultBranch,

  createdAt:
    earliestDate(
      repositories.map(
        (repository) =>
          repository.data.createdAt
      )
    ),

  updatedAt:
    latestDate(
      repositories.map(
        (repository) =>
          repository.data.updatedAt
      )
    ),

  pushedAt:
    latestDate(
      repositories.map(
        (repository) =>
          repository.data.pushedAt
      )
    ),

  url:
    anchor.data.url,

  activity: {
    commitsLast30Days:
      adjustedCommitsLast30Days,

    commitsCapped:
      false,

    contributors:
      uniqueContributors,

    contributorsCapped:
      false,

    releasesLast90Days,

    releasesCapped:
      false,

    latestReleaseAt:
      latestDate(
        repositories.map(
          (repository) =>
            repository.data.activity
              .latestReleaseAt
        )
      ),

    hasReadme:
      anchor.data.activity.hasReadme
  }
};


return {
aggregate,
repositories,
rawCommitsLast30Days,
adjustedCommitsLast30Days,
uniqueContributors
};
}
