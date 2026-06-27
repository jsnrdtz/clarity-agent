import {
getAgentEvidenceProfile
} from "../data/agent-evidence.js";

import {
findRegisteredAgent
} from "../data/agent-registry.js";

import {
assessPublicEvidence,
formatPublicEvidenceAssessment
} from "../services/public-evidence.js";

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

const projectReport =
await scoreProject(
agent.name,
agent.github.owner,
agent.github.repository
);

const evidenceProfile =
getAgentEvidenceProfile(
agent.slug
);

const evidenceAssessment =
assessPublicEvidence(
agent,
evidenceProfile
);

const evidenceReport =
formatPublicEvidenceAssessment(
evidenceAssessment,
evidenceProfile.note
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
