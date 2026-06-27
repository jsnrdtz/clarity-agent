import {
  resolveAgentEvaluation
} from "../services/evaluation-snapshot.js";

export async function evaluateAgentJson(
  agentSlug: string
): Promise<string> {
  const resolved =
    await resolveAgentEvaluation(
      agentSlug
    );

  return JSON.stringify(
    {
      ...resolved.evaluation,

      delivery:
        resolved.delivery
    },
    null,
    2
  );
}
