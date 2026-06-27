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
