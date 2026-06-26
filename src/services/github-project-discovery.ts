import {
discoverGitHubOwner,
type DiscoveredRepository
} from "./github-discovery.js";

export type ProjectRelationStatus =
| "anchor"
| "verified-related"
| "probable-related"
| "needs-review"
| "unrelated";

export type ProjectRepositoryRole =
| "anchor"
| "core-candidate"
| "component"
| "integration"
| "deployment"
| "profile"
| "related-unknown";

export type ProjectRepositoryMatch = {
repository: DiscoveredRepository;
relationScore: number;
status: ProjectRelationStatus;
role: ProjectRepositoryRole;
evidence: string[];
};

export type GitHubProjectDiscovery = {
brand: string;
owner: string;
dedicatedBrandAccount: boolean;

anchor: {
fullName: string;
url: string;
};

related: ProjectRepositoryMatch[];
review: ProjectRepositoryMatch[];
unrelated: ProjectRepositoryMatch[];
excluded: DiscoveredRepository[];

collectedAt: string;
};

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

function getStatus(
score: number
): ProjectRelationStatus {
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

function classifyRole(
brand: string,
owner: string,
repository: DiscoveredRepository,
isAnchor: boolean,
dedicatedBrandAccount: boolean
): ProjectRepositoryRole {
if (isAnchor) {
return "anchor";
}

const normalizedBrand =
normalize(brand);

const normalizedOwner =
normalize(owner);

const normalizedRepository =
normalize(repository.name);

const rawRepositoryName =
repository.name.toLowerCase();

const normalizedBrandWithDash =
brand.trim().toLowerCase();

const text = [
repository.name,
repository.description ?? ""
]
.join(" ")
.toLowerCase();

if (
!dedicatedBrandAccount &&
normalizedRepository === normalizedOwner
) {
return "profile";
}

if (
!dedicatedBrandAccount &&
normalizedRepository.includes(
normalizedBrand
) &&
normalizedRepository.includes(
normalizedOwner
)
) {
return "deployment";
}

const isExplicitAgentRepository =
normalizedRepository ===
`${normalizedBrand}agent` ||
normalizedRepository ===
`agent${normalizedBrand}`;

if (isExplicitAgentRepository) {
return "core-candidate";
}

const containsBrand =
normalizedBrand.length >= 3 &&
normalizedRepository.includes(
normalizedBrand
);

const hasAdditionalProductName =
containsBrand &&
normalizedRepository !==
normalizedBrand &&
!isExplicitAgentRepository;

if (
hasAdditionalProductName &&
(
rawRepositoryName.startsWith(
`${normalizedBrandWithDash}-`
) ||
rawRepositoryName.endsWith(
`-${normalizedBrandWithDash}`
)
)
) {
return "integration";
}

if (
text.includes("sdk") ||
text.includes("kit") ||
text.includes("contract") ||
text.includes("privacy") ||
text.includes("library") ||
text.includes("plugin") ||
text.includes("client") ||
text.includes("api") ||
text.includes("mcp") ||
text.includes("cli")
) {
return "component";
}

if (
normalizedRepository ===
normalizedBrand ||
text.includes("core") ||
text.includes("protocol") ||
text.includes("platform")
) {
return "core-candidate";
}

if (containsBrand) {
return "integration";
}

return "related-unknown";
}

function scoreRepository(
brand: string,
owner: string,
anchor: DiscoveredRepository,
repository: DiscoveredRepository,
dedicatedBrandAccount: boolean
): ProjectRepositoryMatch {
const isAnchor =
repository.owner.toLowerCase() ===
anchor.owner.toLowerCase() &&
repository.name.toLowerCase() ===
anchor.name.toLowerCase();

const role =
classifyRole(
brand,
owner,
repository,
isAnchor,
dedicatedBrandAccount
);

if (isAnchor) {
return {
repository,
relationScore: 100,
status: "anchor",
role: "anchor",
evidence: [
"Selected anchor repository."
]
};
}

if (role === "profile") {
return {
repository,
relationScore: 0,
status: "unrelated",
role,
evidence: [
"GitHub profile repository, not a project repository."
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

const normalizedBrand =
normalize(brand);

const normalizedRepository =
normalize(repository.name);

const normalizedAnchor =
normalize(anchor.name);

const description =
(
repository.description ?? ""
).toLowerCase();

if (dedicatedBrandAccount) {
addEvidence(
45,
"Repository belongs to an account matching the project brand."
);


addEvidence(
  10,
  "Original active repository on the dedicated project account."
);


} else {
addEvidence(
5,
"Same GitHub owner as the anchor repository."
);
}

if (
normalizedBrand.length >= 3 &&
normalizedRepository.includes(
normalizedBrand
)
) {
addEvidence(
35,
"Repository name contains the project brand."
);
}

if (
brand.length >= 3 &&
description.includes(
brand.toLowerCase()
)
) {
addEvidence(
20,
"Repository description mentions the project brand."
);
}

if (
normalizedAnchor.length >= 3 &&
normalizedRepository.includes(
normalizedAnchor
)
) {
addEvidence(
15,
"Repository name contains the anchor repository name."
);
}

const anchorHomepage =
normalizeUrl(anchor.homepage);

const repositoryHomepage =
normalizeUrl(repository.homepage);

if (
anchorHomepage &&
repositoryHomepage &&
anchorHomepage ===
repositoryHomepage
) {
addEvidence(
25,
"Repository uses the same project homepage."
);
}

if (
role === "component" ||
role === "core-candidate"
) {
addEvidence(
10,
`Repository structure suggests role: ${role}.`
);
}

const relationScore =
Math.min(100, score);

return {
repository,
relationScore,
status:
getStatus(relationScore),
role,
evidence:
evidence.length > 0
? evidence
: [
"No meaningful project relationship signals found."
]
};
}

function sortMatches(
matches: ProjectRepositoryMatch[]
): ProjectRepositoryMatch[] {
return [...matches].sort(
(first, second) =>
second.relationScore -
first.relationScore
);
}

export async function discoverGitHubProject(
brand: string,
owner: string,
anchorRepository: string
): Promise<GitHubProjectDiscovery> {
const ownerDiscovery =
await discoverGitHubOwner(owner);

const anchor =
ownerDiscovery.candidates.find(
(repository) =>
repository.name.toLowerCase() ===
anchorRepository.toLowerCase()
);

if (!anchor) {
throw new Error(
`Anchor repository "${owner}/${anchorRepository}" was not found among active original repositories.`
);
}

const dedicatedBrandAccount =
normalize(ownerDiscovery.owner) ===
normalize(brand);

const results =
ownerDiscovery.candidates.map(
(repository) =>
scoreRepository(
brand,
ownerDiscovery.owner,
anchor,
repository,
dedicatedBrandAccount
)
);

return {
brand,


owner:
  ownerDiscovery.owner,

dedicatedBrandAccount,

anchor: {
  fullName:
    anchor.fullName,

  url:
    anchor.url
},

related:
  sortMatches(
    results.filter(
      (result) =>
        result.status === "anchor" ||
        result.status ===
          "verified-related" ||
        result.status ===
          "probable-related"
    )
  ),

review:
  sortMatches(
    results.filter(
      (result) =>
        result.status ===
        "needs-review"
    )
  ),

unrelated:
  sortMatches(
    results.filter(
      (result) =>
        result.status ===
        "unrelated"
    )
  ),

excluded:
  ownerDiscovery.excluded,

collectedAt:
  new Date().toISOString()

};
}
