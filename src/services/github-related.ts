import { Octokit } from "octokit";

import {
discoverGitHubOwner,
type DiscoveredRepository
} from "./github-discovery.js";

const githubToken = process.env.GITHUB_TOKEN;

const octokit = new Octokit(
githubToken
? {
auth: githubToken
}
: {}
);

export type RepositoryRelationStatus =
| "anchor"
| "verified-related"
| "probable-related"
| "needs-review"
| "unrelated";

export type RelatedRepositoryResult = {
repository: DiscoveredRepository;
relationScore: number;
status: RepositoryRelationStatus;
evidence: string[];
};

export type GitHubRelatedDiscovery = {
owner: string;

anchor: {
owner: string;
repository: string;
fullName: string;
url: string;
};

related: RelatedRepositoryResult[];
review: RelatedRepositoryResult[];
unrelated: RelatedRepositoryResult[];
excluded: DiscoveredRepository[];
collectedAt: string;
};

type GitHubApiError = {
status?: number;
};

type AnchorContext = {
owner: string;
repository: string;
fullName: string;
url: string;
description: string | null;
homepage: string | null;
readme: string;
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

function normalize(value: string): string {
return value
.trim()
.toLowerCase()
.replace(/[^a-z0-9]/g, "");
}

function normalizeUrl(
value: string | null
): string | null {
if (!value) {
return null;
}

let normalized =
value.trim().toLowerCase();

while (normalized.endsWith("/")) {
normalized =
normalized.slice(0, -1);
}

return normalized;
}

async function getReadmeText(
owner: string,
repository: string
): Promise<string> {
try {
const response =
await octokit.rest.repos.getReadme({
owner,
repo: repository
});

const content =
  response.data.content;

if (
  typeof content !== "string" ||
  content.length === 0
) {
  return "";
}

return Buffer.from(
  content,
  response.data.encoding === "base64"
    ? "base64"
    : "utf8"
)
  .toString("utf8")
  .toLowerCase();


} catch (error) {
if (
isGitHubApiError(error) &&
error.status === 404
) {
return "";
}
throw error;
}
}

function getStatus(
score: number
): RepositoryRelationStatus {
if (score >= 80) {
return "verified-related";
}

if (score >= 55) {
return "probable-related";
}

if (score >= 30) {
return "needs-review";
}

return "unrelated";
}

function shouldReadCandidateReadme(
candidate: DiscoveredRepository,
anchor: AnchorContext
): boolean {
const candidateName =
candidate.name.toLowerCase();

const candidateDescription =
(
candidate.description ?? ""
).toLowerCase();

const anchorName =
anchor.repository.toLowerCase();

const normalizedCandidateName =
normalize(candidate.name);

const normalizedAnchorName =
normalize(anchor.repository);

const anchorHomepage =
normalizeUrl(anchor.homepage);

const candidateHomepage =
normalizeUrl(candidate.homepage);

const sameHomepage =
anchorHomepage !== null &&
candidateHomepage !== null &&
anchorHomepage === candidateHomepage;

return (
normalizedCandidateName.includes(
normalizedAnchorName
) ||
candidateDescription.includes(
anchorName
) ||
anchor.readme.includes(
candidate.fullName.toLowerCase()
) ||
anchor.readme.includes(
candidate.url.toLowerCase()
) ||
(
candidateName.length >= 5 &&
anchor.readme.includes(
candidateName
)
) ||
sameHomepage
);
}

function scoreRepositoryRelation(
candidate: DiscoveredRepository,
candidateReadme: string,
anchor: AnchorContext
): RelatedRepositoryResult {
const sameRepository =
candidate.owner.toLowerCase() ===
anchor.owner.toLowerCase() &&
candidate.name.toLowerCase() ===
anchor.repository.toLowerCase();

if (sameRepository) {
return {
repository: candidate,
relationScore: 100,
status: "anchor",
evidence: [
"Selected anchor repository."
]
};
}

let score = 0;
const evidence: string[] = [];

function addEvidence(
points: number,
reason: string
): void {
score += points;


evidence.push(
  `+${points}: ${reason}`
);

}

const candidateName =
candidate.name.toLowerCase();

const candidateDescription =
(
candidate.description ?? ""
).toLowerCase();

const anchorName =
anchor.repository.toLowerCase();

const normalizedCandidateName =
normalize(candidate.name);

const normalizedAnchorName =
normalize(anchor.repository);

if (
candidate.owner.toLowerCase() ===
anchor.owner.toLowerCase()
) {
addEvidence(
5,
"Same GitHub owner."
);
}

if (
normalizedAnchorName.length >= 4 &&
normalizedCandidateName.includes(
normalizedAnchorName
)
) {
addEvidence(
35,
"Repository name contains the anchor project name."
);
}

if (
anchorName.length >= 4 &&
candidateDescription.includes(
anchorName
)
) {
addEvidence(
20,
"Repository description mentions the anchor project."
);
}

if (
anchor.readme.includes(
candidate.fullName.toLowerCase()
) ||
anchor.readme.includes(
candidate.url.toLowerCase()
)
) {
addEvidence(
45,
"Anchor README directly links to this repository."
);
} else if (
candidateName.length >= 5 &&
anchor.readme.includes(
candidateName
)
) {
addEvidence(
25,
"Anchor README mentions this repository name."
);
}

if (
candidateReadme.includes(
anchor.fullName.toLowerCase()
) ||
candidateReadme.includes(
anchor.url.toLowerCase()
)
) {
addEvidence(
45,
"Candidate README directly links to the anchor repository."
);
} else if (
anchorName.length >= 5 &&
candidateReadme.includes(
anchorName
)
) {
addEvidence(
20,
"Candidate README mentions the anchor project name."
);
}

const anchorHomepage =
normalizeUrl(anchor.homepage);

const candidateHomepage =
normalizeUrl(candidate.homepage);

if (
anchorHomepage &&
candidateHomepage &&
anchorHomepage === candidateHomepage
) {
addEvidence(
30,
"Repository uses the same official homepage."
);
}

const relationScore =
Math.min(100, score);

return {
repository: candidate,
relationScore,
status:
getStatus(relationScore),

evidence:
  evidence.length > 0
    ? evidence
    : [
        "No meaningful relationship signals found."
      ]

};
}

function sortResults(
results: RelatedRepositoryResult[]
): RelatedRepositoryResult[] {
return [...results].sort(
(first, second) =>
second.relationScore -
first.relationScore
);
}

export async function discoverRelatedRepositories(
owner: string,
anchorRepository: string
): Promise<GitHubRelatedDiscovery> {
const [
ownerDiscovery,
anchorResponse,
anchorReadme
] = await Promise.all([
discoverGitHubOwner(owner),

octokit.rest.repos.get({
  owner,
  repo: anchorRepository
}),

getReadmeText(
  owner,
  anchorRepository
)

]);

const anchorData =
anchorResponse.data;

const anchor: AnchorContext = {
owner:
anchorData.owner.login,

repository:
  anchorData.name,

fullName:
  anchorData.full_name,

url:
  anchorData.html_url,

description:
  anchorData.description,

homepage:
  anchorData.homepage ?? null,

readme:
  anchorReadme

};

const results =
await Promise.all(
ownerDiscovery.candidates.map(
async (candidate) => {
const isAnchor =
candidate.owner.toLowerCase() ===
anchor.owner.toLowerCase() &&
candidate.name.toLowerCase() ===
anchor.repository.toLowerCase();

      const candidateReadme =
        isAnchor
          ? anchor.readme
          : shouldReadCandidateReadme(
                candidate,
                anchor
              )
            ? await getReadmeText(
                candidate.owner,
                candidate.name
              )
            : "";

      return scoreRepositoryRelation(
        candidate,
        candidateReadme,
        anchor
      );
    }
  )
);

const related =
sortResults(
results.filter(
(result) =>
result.status === "anchor" ||
result.status ===
"verified-related" ||
result.status ===
"probable-related"
)
);

const review =
sortResults(
results.filter(
(result) =>
result.status ===
"needs-review"
)
);

const unrelated =
sortResults(
results.filter(
(result) =>
result.status ===
"unrelated"
)
);

return {
owner:
ownerDiscovery.owner,

anchor: {
  owner:
    anchor.owner,

  repository:
    anchor.repository,

  fullName:
    anchor.fullName,

  url:
    anchor.url
},

related,
review,
unrelated,

excluded:
  ownerDiscovery.excluded,

collectedAt:
  new Date().toISOString()

};
}
