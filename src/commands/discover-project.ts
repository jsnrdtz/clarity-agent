import {
discoverGitHubProject,
type ProjectRepositoryMatch
} from "../services/github-project-discovery.js";

function formatMatch(
match: ProjectRepositoryMatch,
index: number
): string {
const age =
match.repository.daysSincePush === null
? "unknown"
: match.repository.daysSincePush === 0
? "today"
: `${match.repository.daysSincePush} days ago`;

return [
`${index + 1}. ${match.repository.fullName}`,
`   Relation: ${match.status}`,
`   Confidence: ${match.relationScore}/100`,
`   Role: ${match.role}`,
`   Stars: ${match.repository.stars}`,
`   Last push: ${age}`,
"   Evidence:",
...match.evidence.map(
(item) => `   - ${item}`
),
`   URL: ${match.repository.url}`
].join("\n");
}

export async function discoverProject(
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

const relatedRows =
discovery.related.length > 0
? discovery.related.map(
formatMatch
)
: [
"No related repositories found."
];

const reviewRows =
discovery.review.length > 0
? discovery.review.map(
formatMatch
)
: [
"No repositories require review."
];

return [
"CLARITY PROJECT DISCOVERY",
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
"PROJECT CANDIDATES",
"",
...relatedRows,
"",
"NEEDS REVIEW",
"",
...reviewRows,
"",
`Unrelated repositories hidden: ${discovery.unrelated.length}`,
`Forked or archived repositories excluded: ${discovery.excluded.length}`,
"",
"Scoring rule:",
"Only anchor and approved core repositories may affect the final development score.",
"Components, integrations, deployments, and unknown repositories remain separate.",
"",
`Anchor URL: ${discovery.anchor.url}`,
`Collected: ${discovery.collectedAt}`
].join("\n");
}
