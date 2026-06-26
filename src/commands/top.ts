import {
  listRegisteredAgents,
  type RegisteredAgent
} from "../data/agent-registry.js";

import {
  calculateGitHubScore,
  type GitHubScoreBreakdown
} from "../scoring/github-score.js";

import {
  getRepositoryData,
  type GitHubRepositoryData
} from "../services/github.js";

type RankedAgent = {
  agent: RegisteredAgent;
  repository: GitHubRepositoryData;
  score: GitHubScoreBreakdown;
};

async function rankAgent(
  agent: RegisteredAgent
): Promise<RankedAgent> {
  const repository = await getRepositoryData(
    agent.github.owner,
    agent.github.repository
  );

  const score = calculateGitHubScore(repository);

  return {
    agent,
    repository,
    score
  };
}

function formatScope(
  agent: RegisteredAgent
): string {
  return agent.github.scope === "primary"
    ? "primary"
    : "component only";
}

export async function getTopAgents(): Promise<string> {
  const agents = listRegisteredAgents();

  if (agents.length === 0) {
    return "No agents are registered.";
  }

  const results = await Promise.all(
    agents.map((agent) => rankAgent(agent))
  );

  const ranked = results.sort(
    (first, second) =>
      second.score.overall - first.score.overall
  );

  const rows = ranked.map(
    ({ agent, repository, score }, index) => {
      const position = `#${index + 1}`.padEnd(4);
      const name = agent.name.padEnd(14);
      const overall = String(
        score.overall
      ).padStart(3);

      const activity = String(
        score.activity
      ).padStart(3);

      const adoption = String(
        score.adoption
      ).padStart(3);

      return [
        `${position}${name} ${overall}/100`,
        `     Activity: ${activity}  Adoption: ${adoption}`,
        `     Commits: ${repository.activity.commitsLast30Days}`,
        `     Scope: ${formatScope(agent)}`
      ].join("\n");
    }
  );

  const incompleteAgents = ranked.filter(
    ({ agent }) =>
      agent.github.scope === "component"
  );

  const warning =
    incompleteAgents.length > 0
      ? [
          "",
          "Coverage warning:",
          ...incompleteAgents.map(
            ({ agent }) =>
              `- ${agent.name} is currently measured using a component repository only.`
          )
        ]
      : [];

  return [
    "CLARITY AGENT RANKING",
    "GitHub data only — not a complete Clarity ranking",
    "",
    ...rows,
    ...warning,
    "",
    `Agents analyzed: ${ranked.length}`,
    `Collected: ${new Date().toISOString()}`
  ].join("\n");
}
