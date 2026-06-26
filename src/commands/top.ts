import {
listRegisteredAgents,
type RegisteredAgent
} from "../data/agent-registry.js";

import {
calculateProjectScore,
type ProjectScoreResult
} from "../services/project-score.js";

type RankedAgent = {
agent: RegisteredAgent;
result: ProjectScoreResult;
};

type FailedAgent = {
agent: RegisteredAgent;
reason: string;
};

async function rankAgent(
agent: RegisteredAgent
): Promise<RankedAgent> {
const result =
await calculateProjectScore(
agent.name,
agent.github.owner,
agent.github.repository
);

return {
agent,
result
};
}

function formatRankedAgent(
item: RankedAgent,
index: number
): string {
const {
agent,
result
} = item;

return [
`#${index + 1}  ${agent.name}  ${result.score.overall}/100`,
`     Activity: ${result.score.activity}/100`,
`     Collaboration: ${result.score.collaboration}/100`,
`     Adoption: ${result.score.adoption}/100`,
`     Releases: ${result.score.releases}/100`,
`     Core repositories: ${result.metrics.repositories.length}`,
`     Ecosystem repositories: ${result.ecosystem.length}`,
`     Unique contributors: ${result.metrics.uniqueContributors}`,
`     Anchor: ${result.discovery.anchor.fullName}`
].join("\n");
}

export async function getTopAgents():
Promise<string> {
const agents =
listRegisteredAgents();

if (agents.length === 0) {
return "No agents are registered.";
}

const settled =
await Promise.allSettled(
agents.map(
(agent) =>
rankAgent(agent)
)
);

const ranked: RankedAgent[] = [];
const failed: FailedAgent[] = [];

settled.forEach(
(result, index) => {
const agent =
agents[index];


  if (!agent) {
    return;
  }

  if (
    result.status === "fulfilled"
  ) {
    ranked.push(
      result.value
    );

    return;
  }

  const reason =
    result.reason instanceof Error
      ? result.reason.message
      : "Unknown error";

  failed.push({
    agent,
    reason
  });
}


);

ranked.sort(
(first, second) =>
second.result.score.overall -
first.result.score.overall
);

const rankingRows =
ranked.length > 0
? ranked
.map(formatRankedAgent)
.join("\n\n")
: "No agents were scored successfully.";

const scopeWarnings =
ranked
.filter(
({ agent }) =>
agent.github.scope ===
"component"
)
.map(
({ agent }) =>
`- ${agent.name} uses a component repository as its current anchor.`
);

const failedRows =
failed.map(
({ agent, reason }) =>
`- ${agent.name}: ${reason}`
);

return [
"CLARITY AGENT RANKING",
"Project-level GitHub data only — not a complete Clarity ranking",
"",
rankingRows,
"",
`Agents ranked: ${ranked.length}`,
`Agents failed: ${failed.length}`,
"",
...(scopeWarnings.length > 0
? [
"Coverage warnings:",
...scopeWarnings,
""
]
: []),
...(failedRows.length > 0
? [
"Failed agents:",
...failedRows,
""
]
: []),
"Ranking method:",
"- Project repositories are discovered automatically.",
"- Only approved core repositories affect the score.",
"- Ecosystem repositories are shown but do not affect the score.",
"- Contributors are deduplicated across core repositories.",
"",
`Collected: ${new Date().toISOString()}`
].join("\n");
}
