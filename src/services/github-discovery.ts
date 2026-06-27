import { Octokit } from "octokit";

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

const PER_PAGE = 100;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type GitHubOwnerType =
| "Organization"
| "User";

export type DiscoveredRepositoryRole =
| "primary-candidate"
| "component"
| "documentation"
| "website"
| "unknown";

export type DiscoveredRepository = {
owner: string;
name: string;
fullName: string;
description: string | null;
url: string;
homepage: string | null;
language: string | null;
stars: number;
forks: number;
openIssues: number;
pushedAt: string | null;
daysSincePush: number | null;
fork: boolean;
archived: boolean;
disabled: boolean;
role: DiscoveredRepositoryRole;
roleReason: string;
excluded: boolean;
exclusionReason: string | null;
};

export type GitHubOwnerDiscovery = {
owner: string;
ownerType: GitHubOwnerType;
profileUrl: string;
repositoriesFound: number;
candidates: DiscoveredRepository[];
excluded: DiscoveredRepository[];
collectedAt: string;
};

function normalize(value: string): string {
return value
.trim()
.toLowerCase()
.replace(/[^a-z0-9]/g, "");
}

function getDaysSince(
date: string | null
): number | null {
if (!date) {
return null;
}

const timestamp = new Date(date).getTime();

if (Number.isNaN(timestamp)) {
return null;
}

return Math.max(
0,
Math.floor(
(Date.now() - timestamp) / DAY_IN_MS
)
);
}

function classifyRepository(
owner: string,
name: string,
description: string | null
): {
role: DiscoveredRepositoryRole;
reason: string;
} {
const normalizedOwner = normalize(owner);
const normalizedName = normalize(name);

const text = [
name,
description ?? ""
]
.join(" ")
.toLowerCase();

if (
text.includes("documentation") ||
text.includes(" docs") ||
normalizedName.endsWith("docs")
) {
return {
role: "documentation",
reason:
"Repository name or description indicates documentation."
};
}

if (
text.includes("website") ||
text.includes("landing page") ||
normalizedName.endsWith("site") ||
normalizedName.endsWith("website")
) {
return {
role: "website",
reason:
"Repository appears to contain a website or landing page."
};
}

if (
text.includes("sdk") ||
text.includes("library") ||
text.includes("client") ||
text.includes("contracts") ||
text.includes("contract") ||
text.includes("plugin") ||
text.includes("skill") ||
text.includes("mcp") ||
text.includes("cli") ||
text.includes("api")
) {
return {
role: "component",
reason:
"Repository appears to provide a reusable project component."
};
}

if (
normalizedName === normalizedOwner ||
text.includes("agent framework") ||
text.includes("autonomous agent") ||
text.includes("ai agent") ||
text.includes("protocol")
) {
return {
role: "primary-candidate",
reason:
"Repository appears to represent the main project or agent."
};
}

return {
role: "unknown",
reason:
"Not enough metadata to determine the repository role."
};
}

function getExclusionReason(
repository: {
fork?: boolean;
archived?: boolean;
disabled?: boolean;
}
): string | null {
if (repository.fork) {
return "fork";
}

if (repository.archived) {
return "archived";
}

if (repository.disabled) {
return "disabled";
}

return null;
}

function sortRepositories(
repositories: DiscoveredRepository[]
): DiscoveredRepository[] {
return [...repositories].sort(
(first, second) => {
const firstTimestamp = first.pushedAt
? new Date(first.pushedAt).getTime()
: 0;

  const secondTimestamp = second.pushedAt
    ? new Date(second.pushedAt).getTime()
    : 0;

  if (secondTimestamp !== firstTimestamp) {
    return secondTimestamp - firstTimestamp;
  }

  return second.stars - first.stars;
}

);
}

async function discoverGitHubOwnerUnwrapped(
owner: string
): Promise<GitHubOwnerDiscovery> {
const profileResponse =
await octokit.rest.users.getByUsername({
username: owner
});

const ownerType: GitHubOwnerType =
profileResponse.data.type === "Organization"
? "Organization"
: "User";

const repositories =
ownerType === "Organization"
? await octokit.paginate(
octokit.rest.repos.listForOrg,
{
org: owner,
type: "public",
sort: "pushed",
direction: "desc",
per_page: PER_PAGE
}
)
: await octokit.paginate(
octokit.rest.repos.listForUser,
{
username: owner,
type: "owner",
sort: "pushed",
direction: "desc",
per_page: PER_PAGE
}
);

const discovered: DiscoveredRepository[] =
repositories.map((repository) => {
const exclusionReason =
getExclusionReason(repository);


  const classification =
    classifyRepository(
      owner,
      repository.name,
      repository.description
    );

  return {
    owner:
      repository.owner?.login ?? owner,

    name:
      repository.name,

    fullName:
      repository.full_name,

    description:
      repository.description,

    url:
      repository.html_url,

    homepage:
      repository.homepage ?? null,

    language:
      repository.language ?? null,

    stars:
  repository.stargazers_count ?? 0,

forks:
  repository.forks_count ?? 0,

openIssues:
  repository.open_issues_count ?? 0,

    pushedAt:
      repository.pushed_at ?? null,

    daysSincePush:
      getDaysSince(
        repository.pushed_at ?? null
      ),

    fork:
      repository.fork,

    archived:
      Boolean(repository.archived),

    disabled:
      Boolean(repository.disabled),

    role:
      classification.role,

    roleReason:
      classification.reason,

    excluded:
      exclusionReason !== null,

    exclusionReason
  };
});


const candidates = sortRepositories(
discovered.filter(
(repository) => !repository.excluded
)
);

const excluded = sortRepositories(
discovered.filter(
(repository) => repository.excluded
)
);

return {
owner:
profileResponse.data.login,

ownerType,

profileUrl:
  profileResponse.data.html_url,

repositoriesFound:
  discovered.length,

candidates,

excluded,

collectedAt:
  new Date().toISOString()


};
}


export async function discoverGitHubOwner(
  owner: string
): Promise<GitHubOwnerDiscovery> {
  try {
    return await discoverGitHubOwnerUnwrapped(
      owner
    );
  } catch (error) {
    throw normalizeGitHubError(
      error,
      {
        resource: "owner",
        owner
      }
    );
  }
}
