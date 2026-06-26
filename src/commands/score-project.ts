import {
calculateGitHubScore
} from "../scoring/github-score.js";

import {
discoverGitHubProject,
type ProjectRepositoryMatch
} from "../services/github-project-discovery.js";

import {
buildProjectGitHubMetrics,
type ProjectCoreRepositoryMetrics
} from "../services/project-github-metrics.js";

function isApprovedCore(
match: ProjectRepositoryMatch
): boolean {
if (match.role === "anchor") {
return true;
}

return (
match.role === "core-candidate" &&
match.status === "verified-related" &&
match.relationScore >= 80
);
}

function isEcosystemRepository(
match: ProjectRepositoryMatch
): boolean {
return (
match.role === "component" ||
match.role === "integration"
);
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
      repository.data.pushedAt
        ? Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                new Date(
                  repository.data.pushedAt
                ).getTime()
              ) /
                (
                  24 *
                  60 *
                  60 *
                  1000
                )
            )
          )
        : null
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
const discovery =
await discoverGitHubProject(
brand,
owner,
anchorRepository
);

const coreMatches =
discovery.related.filter(
isApprovedCore
);

if (coreMatches.length === 0) {
throw new Error(
"No repositories were approved for the project core score."
);
}

const projectMetrics =
await buildProjectGitHubMetrics(
brand,
coreMatches.map((match) => ({
owner:
match.repository.owner,


    repository:
      match.repository.name,

    role:
      match.role,

    relationScore:
      match.relationScore,

    isAnchor:
      match.role === "anchor"
  }))
);


const score =
calculateGitHubScore(
projectMetrics.aggregate
);

const ecosystem =
discovery.related.filter(
isEcosystemRepository
);

const excludedRelated =
discovery.related.filter(
(match) =>
!isApprovedCore(match) &&
!isEcosystemRepository(match)
);

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
`Core repositories      ${projectMetrics.repositories.length}`,
`Ecosystem repositories ${ecosystem.length}`,
`Raw commits in 30 days ${projectMetrics.rawCommitsLast30Days}`,
`Adjusted activity      ${projectMetrics.adjustedCommitsLast30Days}`,
`Unique contributors    ${projectMetrics.uniqueContributors}`,
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
...projectMetrics.repositories.map(
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
