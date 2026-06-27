const aliasesByAgent:
Readonly<Record<string, readonly string[]>> = {
  aeon: [
    "aeon agent",
    "aeon ai"
  ],

  prxvt: [
    "prxvt ai",
    "prxvt privacy",
    "privacy agent"
  ],

  gitlawb: [
    "gitlawb agent",
    "gitlawb ai",
    "openclaude",
    "open claude"
  ],

  ethy: [
    "ethy agent",
    "ethy ai",
    "ethyai",
    "agent intelligence arena"
  ]
};

export function getAgentAliases(
  agentSlug: string
): readonly string[] {
  return (
    aliasesByAgent[
      agentSlug
        .trim()
        .toLowerCase()
    ] ?? []
  );
}
