import type { AgentRecord } from "../types.js";

export const agents: AgentRecord[] = [
  {
    slug: "aeon",
    name: "Aeon",
    description: "Autonomous agent framework with reusable skills.",
    githubUrl: "https://github.com/example/aeon",
    marketCapUsd: 2_100_000,
    scores: {
      overall: 91,
      development: 94,
      activity: 96,
      documentation: 82,
      community: 87,
      transparency: 90
    },
    updatedAt: new Date().toISOString(),
    source: "demo"
  },
  {
    slug: "hermes",
    name: "Hermes",
    description: "Operating system and runtime for autonomous AI agents.",
    githubUrl: "https://github.com/example/hermes",
    marketCapUsd: 195_000,
    scores: {
      overall: 89,
      development: 90,
      activity: 87,
      documentation: 91,
      community: 86,
      transparency: 88
    },
    updatedAt: new Date().toISOString(),
    source: "demo"
  },
  {
    slug: "clawbank",
    name: "ClawBank",
    description: "Infrastructure for autonomous economic agents.",
    marketCapUsd: 2_000_000,
    scores: {
      overall: 88,
      development: 86,
      activity: 92,
      documentation: 80,
      community: 91,
      transparency: 84
    },
    updatedAt: new Date().toISOString(),
    source: "demo"
  }
];

export function findAgent(slug: string): AgentRecord | undefined {
  return agents.find(
    (agent) => agent.slug.toLowerCase() === slug.toLowerCase()
  );
}