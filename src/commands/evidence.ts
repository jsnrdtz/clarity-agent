import {
  getAgentEvidenceProfile
} from "../data/agent-evidence.js";

import {
  findRegisteredAgent
} from "../data/agent-registry.js";

import {
  assessAutomaticPublicEvidence,
  formatAutomaticPublicEvidence
} from "../services/automatic-public-evidence.js";

import {
  calculateProjectScore
} from "../services/project-score.js";

export async function inspectEvidence(
  agentSlug: string
): Promise<string> {
  const agent =
    findRegisteredAgent(agentSlug);

  if (!agent) {
    throw new Error(
      `Agent "${agentSlug}" is not registered.`
    );
  }

  const result =
    await calculateProjectScore(
      agent.name,
      agent.github.owner,
      agent.github.repository
    );

  const profile =
    getAgentEvidenceProfile(
      agent.slug
    );

  const assessment =
    assessAutomaticPublicEvidence(
      agent,
      profile,
      result
    );

  return formatAutomaticPublicEvidence(
    agent,
    profile,
    result,
    assessment
  );
}
