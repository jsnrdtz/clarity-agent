import {
discoverGitHubOwner,
type DiscoveredRepository
} from "../services/github-discovery.js";

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

function formatCandidate(
repository: DiscoveredRepository,
index: number
): string {
return [
`${index + 1}. ${repository.fullName}`,
`   Role: ${repository.role}`,
`   Reason: ${repository.roleReason}`,
`   Stars: ${repository.stars}`,
`   Forks: ${repository.forks}`,
`   Language: ${repository.language ?? "unknown"}`,
`   Last push: ${formatAge(
      repository.daysSincePush
    )}`,
`   URL: ${repository.url}`
].join("\n");
}

function formatExcluded(
repository: DiscoveredRepository
): string {
return [
`- ${repository.fullName}`,
`  Excluded: ${
      repository.exclusionReason ??
      "unknown reason"
    }`
].join("\n");
}

export async function discoverGitHub(
owner: string
): Promise<string> {
const discovery =
await discoverGitHubOwner(owner);

const candidateRows =
discovery.candidates.length > 0
? discovery.candidates.map(
formatCandidate
)
: [
"No active original repositories found."
];

const excludedRows =
discovery.excluded.length > 0
? discovery.excluded.map(
formatExcluded
)
: [
"No repositories were excluded."
];

return [
"CLARITY GITHUB DISCOVERY",
"",
`Owner: ${discovery.owner}`,
`Type: ${discovery.ownerType}`,
`Repositories found: ${discovery.repositoriesFound}${
  discovery.repositoriesCapped
    ? " (capped)"
    : ""
}`,
`Active candidates: ${discovery.candidates.length}`,
`Excluded: ${discovery.excluded.length}`,
"",
"CANDIDATE REPOSITORIES",
"",
...candidateRows,
"",
"EXCLUDED REPOSITORIES",
"",
...excludedRows,
"",
"Important:",
"Repository roles are preliminary heuristic classifications.",
"Discovery does not yet add the project to the Clarity registry.",
"",
`Profile: ${discovery.profileUrl}`,
`Collected: ${discovery.collectedAt}`
].join("\n");
}
