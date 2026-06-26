import {
discoverGitHubProject,
type ProjectRepositoryMatch
} from "../services/github-project-discovery.js";

type PlanDecision =
| "include-core"
| "ecosystem"
| "review"
| "exclude";

type PlannedRepository = {
match: ProjectRepositoryMatch;
decision: PlanDecision;
reason: string;
};

function decideRepository(
match: ProjectRepositoryMatch,
dedicatedBrandAccount: boolean
): PlannedRepository {
if (match.role === "anchor") {
return {
match,
decision: "include-core",
reason:
"Anchor repository is always included in the core development score."
};
}

if (match.role === "profile") {
return {
match,
decision: "exclude",
reason:
"GitHub profile repository is not part of the project."
};
}

if (match.role === "deployment") {
return {
match,
decision: "exclude",
reason:
"Deployment or personal configuration does not represent core project development."
};
}

if (match.role === "core-candidate") {
if (
match.relationScore >= 80 &&
match.status === "verified-related"
) {
return {
match,
decision: "include-core",
reason:
"High-confidence core candidate."
};
}


return {
  match,
  decision: "review",
  reason:
    "Possible core repository, but confidence is not high enough for automatic inclusion."
};


}

if (match.role === "component") {
if (
dedicatedBrandAccount &&
match.relationScore >= 55
) {
return {
match,
decision: "ecosystem",
reason:
"Component on a dedicated project account. Tracked separately from the core score."
};
}


if (match.relationScore >= 80) {
  return {
    match,
    decision: "ecosystem",
    reason:
      "High-confidence project component. Tracked separately from the core score."
  };
}

return {
  match,
  decision: "review",
  reason:
    "Possible project component requires verification."
};


}

if (match.role === "integration") {
if (match.relationScore >= 55) {
return {
match,
decision: "ecosystem",
reason:
"Project integration belongs to the ecosystem but not the core repository set."
};
}


return {
  match,
  decision: "review",
  reason:
    "Possible project integration requires verification."
};


}

if (match.role === "related-unknown") {
return {
match,
decision: "review",
reason:
"Relationship exists, but the repository role is unclear."
};
}

return {
match,
decision: "exclude",
reason:
"Repository does not meet the inclusion rules."
};
}

function formatAge(
days: number | null
): string {
if (days === null) {
return "unknown";
}

if (days === 0) {
return "today";
}

if (days === 1) {
return "1 day ago";
}

return `${days} days ago`;
}

function formatRepository(
item: PlannedRepository,
index: number
): string {
const repository =
item.match.repository;

return [
`${index + 1}. ${repository.fullName}`,
`   Role: ${item.match.role}`,
`   Confidence: ${item.match.relationScore}/100`,
`   Stars: ${repository.stars}`,
`   Last push: ${formatAge(
      repository.daysSincePush
    )}`,
`   Decision: ${item.decision}`,
`   Reason: ${item.reason}`,
`   URL: ${repository.url}`
].join("\n");
}

function formatSection(
title: string,
repositories: PlannedRepository[],
emptyMessage: string
): string[] {
return [
title,
"",
repositories.length > 0
? repositories
.map(formatRepository)
.join("\n\n")
: emptyMessage
];
}

function sortPlan(
repositories: PlannedRepository[]
): PlannedRepository[] {
return [...repositories].sort(
(first, second) =>
second.match.relationScore -
first.match.relationScore
);
}

export async function planProject(
brand: string,
owner: string,
anchorRepository: string
): Promise<string> {
const discovery =
await discoverGitHubProject(
brand,
owner,
anchorRepository
);

const visibleMatches = [
...discovery.related,
...discovery.review
];

const plan =
visibleMatches.map((match) =>
decideRepository(
match,
discovery.dedicatedBrandAccount
)
);

const core =
sortPlan(
plan.filter(
(item) =>
item.decision === "include-core"
)
);

const ecosystem =
sortPlan(
plan.filter(
(item) =>
item.decision === "ecosystem"
)
);

const review =
sortPlan(
plan.filter(
(item) =>
item.decision === "review"
)
);

const excluded =
sortPlan(
plan.filter(
(item) =>
item.decision === "exclude"
)
);

return [
"CLARITY PROJECT PLAN",
"",
`Project: ${discovery.brand}`,
`Owner: ${discovery.owner}`,
`Anchor: ${discovery.anchor.fullName}`,
`Dedicated brand account: ${
      discovery.dedicatedBrandAccount
        ? "yes"
        : "no"
    }`,
"",
...formatSection(
"CORE SCORE",
core,
"No repositories approved for the core score."
),
"",
...formatSection(
"ECOSYSTEM SIGNALS",
ecosystem,
"No ecosystem repositories detected."
),
"",
...formatSection(
"REVIEW REQUIRED",
review,
"No repositories require manual review."
),
"",
...formatSection(
"EXCLUDED CANDIDATES",
excluded,
"No visible candidates were excluded."
),
"",
`Hidden unrelated repositories: ${discovery.unrelated.length}`,
`Forked or archived repositories filtered: ${discovery.excluded.length}`,
"",
"Automatic rules:",
"- Anchor repositories are included.",
"- Verified core candidates with confidence of at least 80 are included.",
"- Components and integrations are tracked as ecosystem signals.",
"- Deployments and profile repositories are excluded.",
"- Ambiguous repositories require review.",
"",
`Collected: ${new Date().toISOString()}`
].join("\n");
}
