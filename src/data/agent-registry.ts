export type RepositoryScope =
  | "primary"
  | "component";

export type RegisteredAgent = {
  slug: string;
  name: string;
  aliases: string[];
  searchAliases: string[];
  description: string;
  github: {
    owner: string;
    repository: string;
    scope: RepositoryScope;
  };
};

export const agentRegistry: RegisteredAgent[] = [
  {
    slug: "aeon",
    name: "Aeon",
    aliases: [
      "aeon-agent",
      "aaronjmars/aeon"
    ],

    searchAliases: [
      "aeon ai"
    ],
    description:
      "Autonomous agent framework with reusable skills and scheduled workflows.",
    github: {
      owner: "aaronjmars",
      repository: "aeon",
      scope: "primary"
    }
  },
  {
    slug: "prxvt",
    name: "PRXVT",
    aliases: [
      "prxvt-sdk",
      "prxvt/sdk"
    ],

    searchAliases: [
      "prxvt ai",
      "prxvt privacy",
      "privacy agent"
    ],
    description:
      "Privacy infrastructure and SDK for private x402 payments.",
    github: {
      owner: "PRXVT",
      repository: "sdk",
      scope: "component"
    }
  },
  {
    slug: "gitlawb",
    name: "Gitlawb",
    aliases: [
      "gitlawb-agent",
      "gitlawb/openclaude",
      "openclaude"
    ],

    searchAliases: [
      "gitlawb ai",
      "gitlawb agent",
      "coding agent"
    ],
    description:
      "Open-source coding agent and command-line development assistant.",
    github: {
      owner: "Gitlawb",
      repository: "openclaude",
      scope: "primary"
    }
  },
  {
    slug: "ethy",
    name: "Ethy",
    aliases: [
      "ethy-agent",
      "ethyai",
      "ethyai/agent-intelligence-arena",
      "agent-intelligence-arena"
    ],

    searchAliases: [
      "ethy agent",
      "signal marketplace",
      "trading signal agent"
    ],
    description:
      "Agent intelligence arena for evaluating and coordinating AI agents.",
    github: {
      owner: "EthyAI",
      repository: "agent-intelligence-arena",
      scope: "primary"
    }
  }
];

export function findRegisteredAgent(
  value: string
): RegisteredAgent | undefined {
  const normalizedValue =
    value.trim().toLowerCase();

  return agentRegistry.find((agent) => {
    if (agent.slug === normalizedValue) {
      return true;
    }

    return agent.aliases.some(
      (alias) =>
        alias.toLowerCase() === normalizedValue
    );
  });
}

export function listRegisteredAgents():
  RegisteredAgent[] {
  return [...agentRegistry];
}
