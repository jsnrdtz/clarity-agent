import {
type ProjectRepositoryMatch
} from "../services/github-project-discovery.js";

import {
type ProjectCoreRepositoryMetrics
} from "../services/project-github-metrics.js";

import {
calculateProjectScore
} from "../services/project-score.js";

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

function getDaysSince(
date: string | null
): number | null {
if (!date) {
return null;
}

const timestamp =
new Date(date).getTime();

if (Number.isNaN(timestamp)) {
return null;
}

return Math.max(
0,
Math.floor(
(
Date.now() -
timestamp
) /
(
24 *
60 *
60 *
1000
)
)
);
}

function formatCoreRepository(
repository:
ProjectCoreRepositoryMetrics,
index: number
): string {
return [
`${index + 1}. ${repository.data.owner}/${repository.data.name}`,
`   Role: ${repository.input.role}`,
`   Relation confidence: ${repository.input.relationScore}/100`,
`   Raw commits in 30 days: ${repository.data.activity.commitsLast30Days}`,
`   Activity contribution: ${repository.adjustedCommitContribution}`,
`   Contributors: ${repository.data.activity.contributors}`,
`   Stars: ${repository.data.stars}`,
`   Last push: ${formatAge(
      getDaysSince(
        repository.data.pushedAt
      )
    )}`,
`   URL: ${repository.data.url}`
].join("\n");
}

function formatEcosystemRepository(
match: ProjectRepositoryMatch,
index: number
): string {
return [
`${index + 1}. ${match.repository.fullName}`,
`   Role: ${match.role}`,
`   Relation confidence: ${match.relationScore}/100`,
`   Stars: ${match.repository.stars}`,
`   Last push: ${formatAge(
      match.repository.daysSincePush
    )}`,
"   Score impact: none",
`   URL: ${match.repository.url}`
].join("\n");
}

export async function scoreProject(
brand: string,
owner: string,
anchorRepository: string
): Promise<string> {
const result =
await calculateProjectScore(
brand,
owner,
anchorRepository
);

const {
discovery,
score,
metrics,
ecosystem,
excludedRelated
} = result;

const ecosystemRows =
ecosystem.length > 0
? ecosystem.map(
formatEcosystemRepository
)
: [
"No ecosystem repositories detected."
];

return [
"CLARITY PROJECT GITHUB SCORE",
"GitHub data only — not a complete Clarity rating",
"",
`Project: ${discovery.brand}`,
`Owner: ${discovery.owner}`,
`Anchor: ${discovery.anchor.fullName}`,
"",
`Project GitHub Score   ${score.overall}/100`,
`Current Activity       ${score.activity}/100`,
`Collaboration          ${score.collaboration}/100`,
`Adoption               ${score.adoption}/100`,
`Release Discipline     ${score.releases}/100`,
"",
`Data Coverage          ${score.dataCoverage}%`,
`Core repositories      ${metrics.repositories.length}`,
`Ecosystem repositories ${ecosystem.length}`,
`Raw commits in 30 days ${metrics.rawCommitsLast30Days}`,
`Adjusted activity      ${metrics.adjustedCommitsLast30Days}`,
`Unique contributors    ${metrics.uniqueContributors}`,
"",
"Aggregation model:",
"- Anchor activity is counted in full.",
"- Additional core repositories contribute 25% of activity, capped at 120 raw commits each.",
"- Contributors are deduplicated across core repositories.",
"- Stars and forks come only from the anchor repository.",
"- Releases are combined across approved core repositories.",
"",
"CORE SCORE REPOSITORIES",
"",
...metrics.repositories.map(
formatCoreRepository
),
"",
"ECOSYSTEM SIGNALS",
"These repositories do not affect the core project score.",
"",
...ecosystemRows,
"",
"Project evidence:",
...score.evidence.map(
(item) => `- ${item}`
),
"",
`Related repositories excluded from score: ${excludedRelated.length}`,
`Repositories requiring review: ${discovery.review.length}`,
`Unrelated repositories hidden: ${discovery.unrelated.length}`,
`Forked or archived repositories filtered: ${discovery.excluded.length}`,
"",
"Important:",
"This model aggregates project-level development signals without blindly summing adoption metrics.",
"This remains a GitHub development score, not the final Clarity Agent Score.",
"",
`Collected: ${new Date().toISOString()}`
].join("\n");
}
