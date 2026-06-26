import {
discoverRelatedRepositories,
type RelatedRepositoryResult
} from "../services/github-related.js";

function formatResult(
result: RelatedRepositoryResult,
index: number
): string {
return [
`${index + 1}. ${result.repository.fullName}`,
`   Relation: ${result.status}`,
`   Confidence: ${result.relationScore}/100`,
`   Stars: ${result.repository.stars}`,
`  Last push: ${
      result.repository.daysSincePush === null
        ? "unknown"
        :`${result.repository.daysSincePush} days ago`
    }`,
"   Evidence:",
...result.evidence.map(
(item) => `   - ${item}`
),
`   URL: ${result.repository.url}`
].join("\n");
}

export async function discoverRelated(
owner: string,
anchorRepository: string
): Promise<string> {
const discovery =
await discoverRelatedRepositories(
owner,
anchorRepository
);

const relatedRows =
discovery.related.length > 0
? discovery.related.map(
formatResult
)
: [
"No related repositories found."
];

const reviewRows =
discovery.review.length > 0
? discovery.review.map(
formatResult
)
: [
"No repositories require review."
];

return [
"CLARITY RELATED REPOSITORY DISCOVERY",
"",
`Anchor: ${discovery.anchor.fullName}`,
`Owner: ${discovery.owner}`,
"",
"RELATED REPOSITORIES",
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
"Important:",
"Only repositories with meaningful relationship signals are displayed.",
"Results are not automatically added to the Clarity rating yet.",
"",
`Anchor URL: ${discovery.anchor.url}`,
`Collected: ${discovery.collectedAt}`
].join("\n");
}
