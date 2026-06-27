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

import {
  scoreProject
} from "./score-project.js";

export async function rateAgent(
  agentSlug: string
): Promise<string> {
  const agent =
    findRegisteredAgent(agentSlug);

  if (!agent) {
    throw new Error(
      `Agent "${agentSlug}" is not registered.`
    );
  }

  const projectResult =
    await calculateProjectScore(
      agent.name,
      agent.github.owner,
      agent.github.repository
    );

  const projectReport =
    await scoreProject(
      agent.name,
      agent.github.owner,
      agent.github.repository
    );

  const profile =
    getAgentEvidenceProfile(
      agent.slug
    );

  const evidenceAssessment =
    assessAutomaticPublicEvidence(
      agent,
      profile,
      projectResult
    );

  const evidenceReport =
    formatAutomaticPublicEvidence(
      agent,
      profile,
      projectResult,
      evidenceAssessment
    );

  return [
    projectReport.replace(
      "CLARITY PROJECT GITHUB SCORE",
      "CLARITY AGENT GITHUB REPORT"
    ),
    "",
    evidenceReport
  ].join("\n");
}
