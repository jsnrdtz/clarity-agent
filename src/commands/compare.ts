import {
  compareGitHubRepositories
} from "./compare-github.js";

import {
  findRegisteredAgent
} from "../data/agent-registry.js";

export async function compareAgents(
  firstSlug: string,
  secondSlug: string
): Promise<string> {
  const firstAgent =
    findRegisteredAgent(firstSlug);

  const secondAgent =
    findRegisteredAgent(secondSlug);

  if (!firstAgent) {
    throw new Error(
      `Agent "${firstSlug}" is not registered.`
    );
  }

  if (!secondAgent) {
    throw new Error(
      `Agent "${secondSlug}" is not registered.`
    );
  }

  const comparison =
    await compareGitHubRepositories(
      firstAgent.github.owner,
      firstAgent.github.repository,
      secondAgent.github.owner,
      secondAgent.github.repository
    );

  const hasComponentRepository =
    firstAgent.github.scope === "component" ||
    secondAgent.github.scope === "component";

  const scopeMessage = hasComponentRepository
    ? "Scope warning: at least one source represents a project component, not the complete agent."
    : "Both sources are registered as primary project repositories.";

  return [
    "CLARITY AGENT COMPARISON",
    "",
    `${firstAgent.name} vs ${secondAgent.name}`,
    "",
    `${firstAgent.name}: ${firstAgent.description}`,
    `${secondAgent.name}: ${secondAgent.description}`,
    "",
    scopeMessage,
    "",
    comparison
  ].join("\n");
}
