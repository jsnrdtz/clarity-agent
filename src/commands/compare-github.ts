import {
calculateGitHubScore,
type GitHubScoreBreakdown
} from "../scoring/github-score.js";

import {
getRepositoryData,
type GitHubRepositoryData
} from "../services/github.js";

type ScoreKey =
| "overall"
| "activity"
| "collaboration"
| "adoption"
| "releases";

const metrics: Array<{
label: string;
key: ScoreKey;
}> = [
{ label: "Overall", key: "overall" },
{ label: "Current Activity", key: "activity" },
{ label: "Collaboration", key: "collaboration" },
{ label: "Adoption", key: "adoption" },
{ label: "Release Discipline", key: "releases" }
];

function getLeader(
firstRepository: GitHubRepositoryData,
firstScore: GitHubScoreBreakdown,
secondRepository: GitHubRepositoryData,
secondScore: GitHubScoreBreakdown
): string {
if (firstScore.overall > secondScore.overall) {
return `${firstRepository.owner}/${firstRepository.name}`;
}

if (secondScore.overall > firstScore.overall) {
return `${secondRepository.owner}/${secondRepository.name}`;
}

return "Tie";
}

function shortenName(
owner: string,
repository: string
): string {
const fullName = `${owner}/${repository}`;

if (fullName.length <= 18) {
return fullName;
}

return repository.slice(0, 18);
}

export async function compareGitHubRepositories(
firstOwner: string,
firstRepositoryName: string,
secondOwner: string,
secondRepositoryName: string
): Promise<string> {
const [firstRepository, secondRepository] =
await Promise.all([
getRepositoryData(
firstOwner,
firstRepositoryName
),
getRepositoryData(
secondOwner,
secondRepositoryName
)
]);

const firstScore =
calculateGitHubScore(firstRepository);

const secondScore =
calculateGitHubScore(secondRepository);

const firstName = shortenName(
firstRepository.owner,
firstRepository.name
);

const secondName = shortenName(
secondRepository.owner,
secondRepository.name
);

const rows = metrics.map(({ label, key }) => {
const firstValue = String(
firstScore[key]
).padStart(3);


const secondValue = String(
  secondScore[key]
).padStart(3);

return `${label.padEnd(21)} ${firstValue}  ${secondValue}`;


});

const leader = getLeader(
firstRepository,
firstScore,
secondRepository,
secondScore
);

return [
"CLARITY GITHUB COMPARISON",
"GitHub data only — not a complete Clarity rating",
"",
`${firstRepository.owner}/${firstRepository.name}`,
"vs",
`${secondRepository.owner}/${secondRepository.name}`,
"",
`${"Metric".padEnd(21)} ${firstName
      .slice(0, 3)
      .toUpperCase()}  ${secondName
      .slice(0, 3)
      .toUpperCase()}`,
"-".repeat(31),
...rows,
"",
`Data Coverage        ${String(
      firstScore.dataCoverage
    ).padStart(3)}  ${String(
      secondScore.dataCoverage
    ).padStart(3)}`,
"",
`Leader: ${leader}`,
"",
"Evidence:",
`${firstName}: ${firstRepository.activity.commitsLast30Days} commits, ${firstRepository.activity.contributors} contributors, ${firstRepository.stars} stars`,
`${secondName}: ${secondRepository.activity.commitsLast30Days} commits, ${secondRepository.activity.contributors} contributors, ${secondRepository.stars} stars`,
"",
`Collected: ${new Date().toISOString()}`
].join("\n");
}
