import {
findRegisteredAgent
} from "../data/agent-registry.js";

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

return projectReport.replace(
"CLARITY PROJECT GITHUB SCORE",
"CLARITY AGENT GITHUB REPORT"
);
}
