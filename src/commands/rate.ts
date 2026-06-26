import {
  findRegisteredAgent
} from "../data/agent-registry.js";

import {
  calculateGitHubScore
} from "../scoring/github-score.js";

import {
  getRepositoryData
} from "../services/github.js";

export async function rateAgent(
  agentSlug: string
): Promise<string> {
  const agent = findRegisteredAgent(agentSlug);

  if (!agent) {
    throw new Error(
      `Agent "${agentSlug}" is not registered.`
    );
  }

  const repository = await getRepositoryData(
    agent.github.owner,
    agent.github.repository
  );

  const score = calculateGitHubScore(repository);

  const scopeWarning =
    agent.github.scope === "component"
      ? "Warning: this score covers a project component, not the complete agent."
      : "Source scope: primary project repository.";

  return [
    "CLARITY AGENT REPORT",
    "GitHub data only — not a complete Clarity rating",
    "",
    agent.name,
    agent.description,
    "",
    `GitHub Score         ${score.overall}/100`,
    `Current Activity     ${score.activity}/100`,
    `Collaboration        ${score.collaboration}/100`,
    `Adoption             ${score.adoption}/100`,
    `Release Discipline   ${score.releases}/100`,
    "",
    `Data Coverage        ${score.dataCoverage}%`,
    `Repository Scope     ${agent.github.scope}`,
    "",
    scopeWarning,
    "",
    "Evidence:",
    ...score.evidence.map((item) => `- ${item}`),
    "",
    `Repository: ${repository.url}`,
    `Collected: ${new Date().toISOString()}`
  ].join("\n");
}
