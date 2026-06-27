import {
buildAgentEvaluation
} from "../services/agent-evaluation.js";

export async function evaluateAgentJson(
agentSlug: string
): Promise<string> {
const evaluation =
await buildAgentEvaluation(
agentSlug
);

return JSON.stringify(
evaluation,
null,
2
);
}
